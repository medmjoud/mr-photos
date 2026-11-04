import { createReadStream } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { Readable } from 'node:stream'
import { AwsClient } from 'aws4fetch'
import { env } from '../env'
import { hmacHex, safeEqual } from '../crypto'

/**
 * Private object storage. Nothing in it is publicly reachable: public images
 * are streamed through /media/* after a status check, and private files
 * (originals, pending previews) only through short-lived signed URLs.
 */
export type StoredObject = { body: ReadableStream<Uint8Array>; size: number; contentType: string }

export interface Storage {
  put: (key: string, body: Buffer, contentType: string) => Promise<void>
  get: (key: string) => Promise<StoredObject | null>
  getBuffer: (key: string) => Promise<Buffer | null>
  delete: (key: string) => Promise<void>
  move: (from: string, to: string) => Promise<void>
  /** Short-lived URL for owner/admin access to a private object. */
  signedUrl: (key: string, ttlSeconds: number, opts?: { download?: string }) => Promise<string>
}

const KEY_RE = /^[a-z0-9][a-z0-9/_.-]{2,200}$/

export function assertKey(key: string): void {
  if (!KEY_RE.test(key) || key.includes('..')) throw new Error(`invalid storage key: ${key}`)
}

/* -------------------------------------------------------------- local */

function localRoot(): string {
  return resolve(process.cwd(), env().STORAGE_LOCAL_DIR)
}

function localPath(key: string): string {
  assertKey(key)
  const root = localRoot()
  const p = resolve(root, key)
  if (!p.startsWith(root + sep)) throw new Error('path traversal')
  return p
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
}

function mimeFor(key: string): string {
  return MIME_BY_EXT[key.split('.').pop() ?? ''] ?? 'application/octet-stream'
}

export function signLocal(key: string, exp: number, download?: string): string {
  return hmacHex(env().sessionSecret, `files|${key}|${exp}|${download ?? ''}`)
}

export function verifyLocalSignature(key: string, exp: number, sig: string, download?: string): boolean {
  if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false
  return safeEqual(signLocal(key, exp, download), sig)
}

const localStorage: Storage = {
  async put(key, body) {
    const p = localPath(key)
    await mkdir(dirname(p), { recursive: true })
    await writeFile(p, body, { mode: 0o600 })
  },
  async get(key) {
    const p = localPath(key)
    try {
      const s = await stat(p)
      const stream = Readable.toWeb(createReadStream(p)) as ReadableStream<Uint8Array>
      return { body: stream, size: s.size, contentType: mimeFor(key) }
    } catch {
      return null
    }
  },
  async getBuffer(key) {
    try {
      return await readFile(localPath(key))
    } catch {
      return null
    }
  },
  async delete(key) {
    await rm(localPath(key), { force: true })
  },
  async move(from, to) {
    const dest = localPath(to)
    await mkdir(dirname(dest), { recursive: true })
    await rename(localPath(from), dest)
  },
  async signedUrl(key, ttlSeconds, opts) {
    assertKey(key)
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds
    const params = new URLSearchParams({ exp: String(exp), sig: signLocal(key, exp, opts?.download) })
    if (opts?.download) params.set('dl', opts.download)
    return `/files/${key}?${params.toString()}`
  },
}

/* --------------------------------------------------- S3 / Cloudflare R2 */

function s3() {
  const e = env()
  const client = new AwsClient({
    accessKeyId: e.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: e.S3_SECRET_ACCESS_KEY ?? '',
    service: 's3',
    region: e.S3_REGION,
  })
  const base = `${(e.S3_ENDPOINT ?? '').replace(/\/$/, '')}/${e.S3_BUCKET}`
  return { client, url: (key: string) => `${base}/${key.split('/').map(encodeURIComponent).join('/')}` }
}

const s3Storage: Storage = {
  async put(key, body, contentType) {
    assertKey(key)
    const { client, url } = s3()
    const res = await client.fetch(url(key), {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: { 'Content-Type': contentType, 'Content-Length': String(body.length) },
    })
    if (!res.ok) throw new Error(`storage put failed: ${res.status}`)
  },
  async get(key) {
    assertKey(key)
    const { client, url } = s3()
    const res = await client.fetch(url(key))
    if (res.status === 404) return null
    if (!res.ok || !res.body) throw new Error(`storage get failed: ${res.status}`)
    return {
      body: res.body,
      size: Number(res.headers.get('content-length') ?? 0),
      contentType: res.headers.get('content-type') ?? mimeFor(key),
    }
  },
  async getBuffer(key) {
    assertKey(key)
    const { client, url } = s3()
    const res = await client.fetch(url(key))
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`storage get failed: ${res.status}`)
    return Buffer.from(await res.arrayBuffer())
  },
  async delete(key) {
    assertKey(key)
    const { client, url } = s3()
    const res = await client.fetch(url(key), { method: 'DELETE' })
    if (!res.ok && res.status !== 404) throw new Error(`storage delete failed: ${res.status}`)
  },
  async move(from, to) {
    const buf = await this.getBuffer(from)
    if (!buf) throw new Error('storage move: source missing')
    await this.put(to, buf, mimeFor(from))
    await this.delete(from)
  },
  async signedUrl(key, ttlSeconds, opts) {
    assertKey(key)
    const { client, url } = s3()
    const u = new URL(url(key))
    u.searchParams.set('X-Amz-Expires', String(ttlSeconds))
    if (opts?.download) {
      u.searchParams.set('response-content-disposition', `attachment; filename="${opts.download}"`)
    }
    const signed = await client.sign(u.toString(), { method: 'GET', aws: { signQuery: true } })
    return signed.url
  },
}

export function storage(): Storage {
  return env().STORAGE_DRIVER === 's3' ? s3Storage : localStorage
}

/** Deletes keys, ignoring individual failures (logged). */
export async function deleteKeys(keys: Array<string>): Promise<void> {
  const s = storage()
  await Promise.all(
    keys.map((k) =>
      s.delete(k).catch((err: unknown) => {
        console.error('[storage] delete failed', k, err instanceof Error ? err.message : err)
      }),
    ),
  )
}

export function localStorageRoot(): string {
  return localRoot()
}


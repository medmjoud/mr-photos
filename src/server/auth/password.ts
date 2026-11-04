import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * scrypt with OWASP-recommended parameters (N=2^15, r=8, p=3 ≈ 32 MiB).
 * Stored as: scrypt$<log2N>$<r>$<p>$<salt b64url>$<hash b64url>
 */
const LOG_N = 15
const R = 8
const P = 3
const KEY_LEN = 32

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password.normalize('NFKC'), salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key)))
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const N = 2 ** LOG_N
  const key = await scrypt(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: 256 * N * R })
  return ['scrypt', LOG_N, R, P, salt.toString('base64url'), key.toString('base64url')].join('$')
}

export async function verifyPassword(stored: string, password: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const logN = Number(parts[1])
  const r = Number(parts[2])
  const p = Number(parts[3])
  if (!Number.isInteger(logN) || logN < 10 || logN > 20) return false
  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  const N = 2 ** logN
  const actual = await scrypt(password, salt, expected.length, { N, r, p, maxmem: 256 * N * r })
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

let dummy: Promise<string> | null = null
/** A hash to verify against when the user does not exist, so timing does not reveal accounts. */
export function dummyHash(): Promise<string> {
  dummy ??= hashPassword(randomBytes(16).toString('hex'))
  return dummy
}

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 200

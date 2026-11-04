import { env } from './env'

/**
 * Optional Cloudflare cache purge for media URLs (when the site is proxied by
 * Cloudflare). Public media URLs also carry a token that is rotated whenever
 * a photo is hidden, so new pages never reference the old URL.
 */
export async function purgeUrls(paths: Array<string>): Promise<void> {
  const e = env()
  if (!e.CLOUDFLARE_ZONE_ID || !e.CLOUDFLARE_API_TOKEN || paths.length === 0) return
  const files = paths.map((p) => new URL(p, e.APP_URL).toString())
  try {
    for (let i = 0; i < files.length; i += 30) {
      const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${e.CLOUDFLARE_ZONE_ID}/purge_cache`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${e.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: files.slice(i, i + 30) }),
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) console.error('[cdn] purge failed', res.status)
    }
  } catch (err) {
    console.error('[cdn] purge error', err instanceof Error ? err.message : err)
  }
}

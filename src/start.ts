import { createMiddleware, createStart } from '@tanstack/react-start'
import { contentSecurityPolicy, isAllowedOrigin, newNonce, securityHeaders } from '@/server/security'

/**
 * Global request middleware: CSRF origin check, per-request CSP nonce and
 * security headers for every response (pages, server functions, API routes).
 */
const securityMiddleware = createMiddleware().server(async ({ next, request, pathname }) => {
  if (!isAllowedOrigin(request)) {
    return new Response(JSON.stringify({ error: 'origin_mismatch' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const nonce = newNonce()
  const result = await next({ context: { nonce } })

  const headers = new Headers(result.response.headers)
  for (const [k, v] of Object.entries(securityHeaders(pathname))) {
    if (!headers.has(k)) headers.set(k, v)
  }
  const isHtml = headers.get('content-type')?.includes('text/html') ?? false
  if (isHtml) {
    // The built server (NODE_ENV=production) always enforces CSP; the Vite
    // dev server injects un-nonced scripts, so it is report-free there.
    if (process.env.NODE_ENV === 'production') {
      headers.set('Content-Security-Policy', contentSecurityPolicy(nonce))
    }
    // Pages contain the signed-in user's chrome: never share-cache them, even
    // if a server function rendered during SSR asked for public caching.
    headers.set('Cache-Control', 'private, no-cache')
  }

  let body: ReadableStream<Uint8Array> | null = result.response.body
  if (body && shouldCompress(request, headers)) {
    body = body.pipeThrough(new CompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>)
    headers.set('Content-Encoding', 'gzip')
    headers.delete('Content-Length')
    headers.append('Vary', 'Accept-Encoding')
  }

  return {
    ...result,
    response: new Response(body as BodyInit | null, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    }),
  }
})

const COMPRESSIBLE = /^(text\/|application\/(json|xml|javascript|x-tss|x-ndjson)|image\/svg\+xml)/

/** On-the-fly gzip for dynamic text responses (static assets are pre-compressed at build). */
function shouldCompress(request: Request, headers: Headers): boolean {
  if (headers.has('content-encoding')) return false
  if (!/\bgzip\b/.test(request.headers.get('accept-encoding') ?? '')) return false
  const type = headers.get('content-type') ?? ''
  if (!COMPRESSIBLE.test(type) || type.includes('event-stream')) return false
  const length = Number(headers.get('content-length') ?? 'NaN')
  return Number.isNaN(length) || length > 1024
}

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware],
}))

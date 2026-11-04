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
    // Pages contain the signed-in user's chrome: never share-cache them.
    if (!headers.has('cache-control')) headers.set('Cache-Control', 'private, no-cache')
  }

  return {
    ...result,
    response: new Response(result.response.body, {
      status: result.response.status,
      statusText: result.response.statusText,
      headers,
    }),
  }
})

export const startInstance = createStart(() => ({
  requestMiddleware: [securityMiddleware],
}))

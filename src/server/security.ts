import { randomBytes } from 'node:crypto'
import { env } from './env'

export function newNonce(): string {
  return randomBytes(16).toString('base64')
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

/** Paths authenticated by a bearer secret instead of a browser session. */
const CSRF_EXEMPT = [/^\/api\/cron\//]

/**
 * CSRF defence for every state-changing request (server functions and server
 * routes): the Origin header must match APP_URL. Falls back to
 * Sec-Fetch-Site when Origin is absent; requests with neither are refused.
 * Session cookies are also SameSite=Lax.
 */
export function isAllowedOrigin(request: Request): boolean {
  if (SAFE_METHODS.has(request.method)) return true
  const path = new URL(request.url).pathname
  if (CSRF_EXEMPT.some((re) => re.test(path))) return true
  const origin = request.headers.get('origin')
  const allowed = env().appOrigin
  if (origin) {
    if (origin === allowed) return true
    // In local development the dev server may be reached on another host/port.
    if (!env().isProduction && origin === new URL(request.url).origin) return true
    return false
  }
  const site = request.headers.get('sec-fetch-site')
  return site === 'same-origin'
}

export function contentSecurityPolicy(nonce: string): string {
  const e = env()
  const analytics = e.ANALYTICS_SCRIPT_URL ? new URL(e.ANALYTICS_SCRIPT_URL).origin : ''
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${analytics ? ` ${analytics}` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'${analytics ? ` ${analytics}` : ''}`,
    `media-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `manifest-src 'self'`,
    `worker-src 'self' blob:`,
  ]
  if (e.secureCookies) directives.push('upgrade-insecure-requests')
  return directives.join('; ')
}

const PRIVATE_PATH = /^\/(?:[a-z]{2}\/)?(?:dashboard|admin|auth)(?:\/|$)|^\/api\//

export function securityHeaders(pathname: string): Record<string, string> {
  const e = env()
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  }
  if (e.secureCookies) headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
  if (PRIVATE_PATH.test(pathname)) headers['X-Robots-Tag'] = 'noindex, nofollow'
  return headers
}

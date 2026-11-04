import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '@/server/env'
import { contentSecurityPolicy, isAllowedOrigin, securityHeaders } from '@/server/security'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { signLocal, verifyLocalSignature } from '@/server/storage'

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

function req(method: string, headers: Record<string, string>, url = 'https://soura.example/_serverFn/x') {
  return new Request(url, { method, headers })
}

describe('CSRF origin check', () => {
  it('allows same-origin writes and safe methods; refuses cross-site and anonymous writes', () => {
    vi.stubEnv('APP_URL', 'https://soura.example')
    vi.stubEnv('APP_ENV', 'production')
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(40))
    resetEnvCache()
    expect(isAllowedOrigin(req('GET', {}))).toBe(true)
    expect(isAllowedOrigin(req('POST', { origin: 'https://soura.example' }))).toBe(true)
    expect(isAllowedOrigin(req('POST', { origin: 'https://evil.example' }))).toBe(false)
    expect(isAllowedOrigin(req('POST', { origin: 'http://soura.example' }))).toBe(false)
    expect(isAllowedOrigin(req('POST', { 'sec-fetch-site': 'same-origin' }))).toBe(true)
    expect(isAllowedOrigin(req('POST', { 'sec-fetch-site': 'cross-site' }))).toBe(false)
    expect(isAllowedOrigin(req('POST', {}))).toBe(false)
    // Bearer-authenticated cron endpoint is exempt.
    expect(isAllowedOrigin(req('POST', {}, 'https://soura.example/api/cron/cleanup'))).toBe(true)
  })
})

describe('headers', () => {
  it('CSP uses a nonce and forbids framing, plugins and inline scripts', () => {
    const csp = contentSecurityPolicy('abc123')
    expect(csp).toContain("script-src 'self' 'nonce-abc123'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).not.toContain("'unsafe-inline'; script")
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/)
  })
  it('private areas are never indexed', () => {
    expect(securityHeaders('/fr/admin/review')['X-Robots-Tag']).toBe('noindex, nofollow')
    expect(securityHeaders('/ar/dashboard')['X-Robots-Tag']).toBe('noindex, nofollow')
    expect(securityHeaders('/fr/explore')['X-Robots-Tag']).toBeUndefined()
  })
})

describe('passwords', () => {
  it('scrypt hashes verify and are salted', async () => {
    const h1 = await hashPassword('une phrase de passe')
    const h2 = await hashPassword('une phrase de passe')
    expect(h1).not.toBe(h2)
    expect(h1.startsWith('scrypt$15$8$3$')).toBe(true)
    expect(await verifyPassword(h1, 'une phrase de passe')).toBe(true)
    expect(await verifyPassword(h1, 'mauvaise phrase')).toBe(false)
    expect(await verifyPassword('garbage', 'x')).toBe(false)
  })
})

describe('signed private URLs', () => {
  it('expire and cannot be altered', () => {
    const exp = Math.floor(Date.now() / 1000) + 60
    const sig = signLocal('originals/a/b.jpg', exp)
    expect(verifyLocalSignature('originals/a/b.jpg', exp, sig)).toBe(true)
    expect(verifyLocalSignature('originals/a/c.jpg', exp, sig)).toBe(false)
    expect(verifyLocalSignature('originals/a/b.jpg', exp + 1, sig)).toBe(false)
    const past = Math.floor(Date.now() / 1000) - 1
    expect(verifyLocalSignature('originals/a/b.jpg', past, signLocal('originals/a/b.jpg', past))).toBe(false)
  })
})

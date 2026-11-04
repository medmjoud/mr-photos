import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetEnvCache } from '@/server/env'
import { mapOpenAi, runAiCheck } from '@/server/moderation/ai'

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0])

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  resetEnvCache()
})

describe('AI pre-check provider interface', () => {
  it('without a provider the check is "unavailable" (photo stays pending for a human)', async () => {
    vi.stubEnv('MODERATION_PROVIDER', 'none')
    resetEnvCache()
    expect(await runAiCheck({ jpeg, text: '' }, { csamLocked: false })).toEqual({ kind: 'unavailable', provider: 'none' })
  })

  it('provider errors and outages are reported, never thrown', async () => {
    vi.stubEnv('MODERATION_PROVIDER', 'mock')
    resetEnvCache()
    expect((await runAiCheck({ jpeg, text: '[ai:error]' }, { csamLocked: false })).kind).toBe('error')
    expect((await runAiCheck({ jpeg, text: '[ai:unavailable]' }, { csamLocked: false })).kind).toBe('unavailable')
  })

  it('timeouts become errors', async () => {
    vi.stubEnv('MODERATION_PROVIDER', 'openai')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    vi.stubEnv('MODERATION_TIMEOUT_MS', '50')
    resetEnvCache()
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => new Promise((_res, rej) => init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))))
    expect(await runAiCheck({ jpeg, text: '' }, { csamLocked: false })).toMatchObject({ kind: 'error', message: 'timeout' })
  })

  it('never sends child-safety-locked material to any provider', async () => {
    vi.stubEnv('MODERATION_PROVIDER', 'openai')
    vi.stubEnv('OPENAI_API_KEY', 'sk-test')
    resetEnvCache()
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect((await runAiCheck({ jpeg, text: '' }, { csamLocked: true })).kind).toBe('skipped')
    expect(spy).not.toHaveBeenCalled()
  })

  it('the mock provider is refused in production', async () => {
    vi.stubEnv('MODERATION_PROVIDER', 'mock')
    vi.stubEnv('APP_ENV', 'production')
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(40))
    resetEnvCache()
    expect((await runAiCheck({ jpeg, text: '[ai:flag:nudity]' }, { csamLocked: false })).kind).toBe('unavailable')
  })
})

describe('OpenAI omni-moderation mapping', () => {
  it('flags categories above threshold, with a lower threshold for minors', () => {
    const flags = mapOpenAi({
      flagged: true,
      categories: {},
      category_scores: { sexual: 0.7, 'sexual/minors': 0.25, 'violence/graphic': 0.1, hate: 0.6, 'self-harm': 0.01 },
    })
    expect(flags.map((f) => f.category).sort()).toEqual(['hate', 'sexual', 'sexual_minors'])
  })
  it('respects the provider’s own flags', () => {
    const flags = mapOpenAi({ flagged: true, categories: { 'violence/graphic': true }, category_scores: { 'violence/graphic': 0.3 } })
    expect(flags).toEqual([{ category: 'graphic_violence', score: 0.3 }])
  })
})

import { env } from '../env'
import type { AiCategory, AiFlag, AiOutcome } from '@/lib/moderation'

/**
 * AI safety pre-check — a replaceable provider interface. Results are
 * ADVISORY: they add flags for the admin and never change a photo's status.
 * Any failure, timeout or missing configuration leaves the photo pending.
 */
export type AiInput = { jpeg: Buffer; text: string }

export interface ModerationProvider {
  readonly name: string
  check: (input: AiInput, signal: AbortSignal) => Promise<Array<AiFlag>>
}

export class ProviderUnavailable extends Error {}

/** Disabled: every photo is marked "AI check unavailable" and reviewed by a human as usual. */
const noneProvider: ModerationProvider = {
  name: 'none',
  check: () => Promise.reject(new ProviderUnavailable('no moderation provider configured')),
}

/**
 * Deterministic provider for development and automated tests. Markers in
 * the title/description drive the outcome: [ai:error], [ai:unavailable],
 * [ai:flag:<category>]. Refused in production.
 */
const mockProvider: ModerationProvider = {
  name: 'mock',
  check: async (input) => {
    if (env().isProduction) throw new ProviderUnavailable('mock provider disabled in production')
    if (input.text.includes('[ai:unavailable]')) throw new ProviderUnavailable('mock unavailable')
    if (input.text.includes('[ai:error]')) throw new Error('mock provider error')
    const flags: Array<AiFlag> = []
    for (const m of input.text.matchAll(/\[ai:flag:([a-z_]+)\]/g)) {
      flags.push({ category: m[1] as AiCategory, score: 0.99 })
    }
    return flags
  },
}

type OpenAiResult = {
  flagged: boolean
  categories: Record<string, boolean>
  category_scores: Record<string, number>
}

/** OpenAI omni-moderation (image + text). Hate is evaluated on text only by this model. */
const openAiProvider: ModerationProvider = {
  name: 'openai',
  check: async (input, signal) => {
    const e = env()
    if (!e.OPENAI_API_KEY) throw new ProviderUnavailable('OPENAI_API_KEY missing')
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${e.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: e.OPENAI_MODERATION_MODEL,
        input: [
          { type: 'text', text: input.text.slice(0, 4000) || '-' },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.jpeg.toString('base64')}` } },
        ],
      }),
    })
    if (res.status === 429 || res.status >= 500) throw new ProviderUnavailable(`openai ${res.status}`)
    if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const json = (await res.json()) as { results?: Array<OpenAiResult> }
    const r = json.results?.[0]
    if (!r) throw new Error('openai: empty result')
    return mapOpenAi(r)
  },
}

const THRESHOLDS: Array<{ keys: Array<string>; category: AiCategory; min: number }> = [
  // Lower threshold on purpose: false positives only mean an extra careful human look.
  { keys: ['sexual/minors'], category: 'sexual_minors', min: 0.2 },
  { keys: ['sexual'], category: 'sexual', min: 0.5 },
  { keys: ['violence/graphic'], category: 'graphic_violence', min: 0.5 },
  { keys: ['hate', 'hate/threatening', 'harassment/threatening'], category: 'hate', min: 0.5 },
  { keys: ['self-harm', 'self-harm/intent', 'self-harm/instructions'], category: 'self_harm', min: 0.5 },
]

export function mapOpenAi(r: OpenAiResult): Array<AiFlag> {
  const flags: Array<AiFlag> = []
  for (const t of THRESHOLDS) {
    const score = Math.max(0, ...t.keys.map((k) => r.category_scores[k] ?? 0))
    const flaggedByProvider = t.keys.some((k) => r.categories[k])
    if (score >= t.min || flaggedByProvider) flags.push({ category: t.category, score: Math.round(score * 1000) / 1000 })
  }
  return flags
}

export function moderationProvider(): ModerationProvider {
  switch (env().MODERATION_PROVIDER) {
    case 'openai':
      return openAiProvider
    case 'mock':
      return mockProvider
    default:
      return noneProvider
  }
}

/** Runs the configured provider with a timeout and never throws. */
export async function runAiCheck(input: AiInput, opts: { csamLocked: boolean }): Promise<AiOutcome> {
  const provider = moderationProvider()
  // Content flagged under the child-safety procedure is never sent to any third party.
  if (opts.csamLocked) return { kind: 'skipped', provider: provider.name }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), env().MODERATION_TIMEOUT_MS)
  try {
    const flags = await provider.check(input, controller.signal)
    return { kind: 'result', flags, provider: provider.name }
  } catch (err) {
    if (err instanceof ProviderUnavailable) return { kind: 'unavailable', provider: provider.name }
    const message = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : 'unknown error'
    return { kind: 'error', provider: provider.name, message }
  } finally {
    clearTimeout(timer)
  }
}

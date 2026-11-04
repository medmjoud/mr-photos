/**
 * Tiny dependency-free search-param parsers for route validateSearch (keeps
 * zod out of the client bundle). Server functions still validate with zod.
 */
export function str(v: unknown, max = 200): string | undefined {
  return typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined
}

export function oneOf<T extends string>(v: unknown, list: ReadonlyArray<T>): T | undefined {
  return typeof v === 'string' && (list as ReadonlyArray<string>).includes(v) ? (v as T) : undefined
}

export function posInt(v: unknown, max = 500): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : Number.NaN
  return Number.isInteger(n) && n >= 1 && n <= max ? n : undefined
}

export function idParam(v: unknown): string | undefined {
  return typeof v === 'string' && /^[a-z0-9]{16}$/.test(v) ? v : undefined
}

export function slugParam(v: unknown): string | undefined {
  return typeof v === 'string' && /^[a-z0-9-]{1,80}$/.test(v) ? v : undefined
}

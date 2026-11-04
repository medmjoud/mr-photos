/** Accepts only same-site relative paths inside the current locale (prevents open redirects). */
export function safeNext(next: string | undefined, locale: string): string | null {
  if (!next) return null
  if (!next.startsWith(`/${locale}/`) && next !== `/${locale}`) return null
  if (next.startsWith('//') || next.includes('\\') || /[\r\n]/.test(next)) return null
  if (next.includes('/auth/')) return null
  return next
}

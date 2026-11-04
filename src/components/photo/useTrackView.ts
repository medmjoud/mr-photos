import { useEffect } from 'react'
import { trackView } from '@/functions/public.functions'

/** Records one cookieless view after the page has been visible for a moment (skips prerender/bots). */
export function useTrackView(input: { photoId?: string; profileSlug?: string }) {
  const key = input.photoId ?? input.profileSlug ?? ''
  useEffect(() => {
    if (!key) return
    const timer = window.setTimeout(() => {
      void trackView({ data: input }).catch(() => undefined)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [key])
}

import { useEffect, useState } from 'react'
import { useTranslations } from 'use-intl'
import { Icon } from '../ui/Icon'

type Theme = 'dark' | 'light'
export const THEME_KEY = 'soura-theme'

/** Inline, nonce'd script that applies the saved theme before first paint (dark by default). */
export const themeInitScript = `(function(){var d=document.documentElement;d.classList.add('js');try{var t=localStorage.getItem('${THEME_KEY}');d.dataset.theme=t==='light'?'light':'dark'}catch(e){d.dataset.theme='dark'}})()`

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme')
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  }, [])

  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      className={className ?? 'btn btn-ghost btn-sm min-w-11 px-0'}
      aria-label={next === 'light' ? t('toLight') : t('toDark')}
      title={next === 'light' ? t('toLight') : t('toDark')}
      onClick={() => {
        document.documentElement.dataset.theme = next
        try {
          localStorage.setItem(THEME_KEY, next)
        } catch {
          /* storage unavailable: theme still applies for this page */
        }
        setTheme(next)
      }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  )
}

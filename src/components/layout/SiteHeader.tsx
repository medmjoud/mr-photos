import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData, useLocation, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useTranslations } from 'use-intl'
import { logout } from '@/functions/auth.functions'
import { useAppLocale } from '@/i18n/react'
import { cx } from '@/lib/cx'
import { Icon } from '../ui/Icon'
import { LanguageSwitcher } from './LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { Wordmark } from './Wordmark'

export function SiteHeader() {
  const t = useTranslations('nav')
  const locale = useAppLocale()
  const { me } = useLoaderData({ from: '/$locale' })
  const router = useRouter()
  const logoutFn = useServerFn(logout)
  const location = useLocation()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)

  // Close the mobile menu on navigation.
  useEffect(() => {
    dialogRef.current?.close()
  }, [location.pathname])

  const primary = [
    { to: '/$locale/explore', label: t('explore') },
    { to: '/$locale/photographers', label: t('photographers') },
    { to: '/$locale/for-photographers', label: t('forPhotographers') },
    { to: '/$locale/about', label: t('about') },
  ] as const

  async function onLogout() {
    await logoutFn()
    await router.invalidate()
    await router.navigate({ to: '/$locale', params: { locale } })
  }

  const account = me ? (
    <>
      {me.role === 'admin' ? (
        <Link to="/$locale/admin" params={{ locale }} className="btn btn-ghost btn-sm">
          <Icon name="shield" size={18} />
          {t('admin')}
        </Link>
      ) : null}
      <Link to="/$locale/dashboard" params={{ locale }} className="btn btn-secondary btn-sm">
        {t('dashboard')}
      </Link>
    </>
  ) : (
    <>
      <Link to="/$locale/auth/login" params={{ locale }} className="btn btn-ghost btn-sm">
        {t('login')}
      </Link>
      <Link to="/$locale/dashboard/upload" params={{ locale }} className="btn btn-primary btn-sm">
        {t('upload')}
      </Link>
    </>
  )

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/$locale" params={{ locale }} className="shrink-0">
          <Wordmark />
          <span className="sr-only"> — {t('home')}</span>
        </Link>

        <nav aria-label={t('primary')} className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {primary.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  params={{ locale }}
                  className="inline-flex min-h-11 items-center px-3 text-small text-ink-muted transition-colors hover:text-ink"
                  activeProps={{ className: 'text-ink', 'aria-current': 'page' }}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden items-center gap-1 lg:flex">
          <LanguageSwitcher />
          <ThemeToggle />
          <span aria-hidden className="mx-2 h-5 w-px bg-line-strong" />
          {account}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-ghost btn-sm min-w-11 px-0"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={t('menu')}
            onClick={() => {
              dialogRef.current?.showModal()
              setOpen(true)
            }}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={t('menu')}
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-0 text-ink backdrop:bg-black/60"
      >
        <div className="container-page flex h-16 items-center justify-between border-b border-line">
          <Wordmark />
          <button
            type="button"
            className="btn btn-ghost btn-sm min-w-11 px-0"
            aria-label={t('closeMenu')}
            onClick={() => dialogRef.current?.close()}
            autoFocus
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="container-page flex flex-col gap-10 py-10">
          <nav aria-label={t('primary')}>
            <ul className="flex flex-col gap-1">
              {primary.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    params={{ locale }}
                    className="block py-2 font-display text-display-md"
                    onClick={() => dialogRef.current?.close()}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className={cx('flex flex-wrap gap-3')} onClick={() => dialogRef.current?.close()}>
            {account}
            {me ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
                {t('logout')}
              </button>
            ) : null}
          </div>
          <div className="border-t border-line pt-6">
            <p className="eyebrow mb-2">{t('language')}</p>
            <LanguageSwitcher variant="full" />
          </div>
        </div>
      </dialog>
    </header>
  )
}

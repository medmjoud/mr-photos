import { useMatch, useRouter, type ErrorComponentProps } from '@tanstack/react-router'
import { IntlProvider, useTranslations } from 'use-intl'

export function ErrorView({ error, reset }: ErrorComponentProps) {
  const match = useMatch({ from: '/$locale', shouldThrow: false })
  const data = match?.loaderData
  if (import.meta.env.DEV) console.error(error)
  if (!data) {
    return (
      <main id="main" className="container-page grid min-h-dvh content-center gap-4 py-20">
        <h1 className="text-display-lg">Erreur · خطأ · Error</h1>
        <a className="btn btn-primary w-fit" href="/">
          SOURA
        </a>
      </main>
    )
  }
  return (
    <IntlProvider locale={data.locale} messages={data.messages} timeZone="Africa/Nouakchott">
      <LocalizedError reset={reset} />
    </IntlProvider>
  )
}

function LocalizedError({ reset }: { reset: () => void }) {
  const t = useTranslations('errorPage')
  const router = useRouter()
  return (
    <section className="container-page grid min-h-[60dvh] content-center gap-6 py-20" role="alert">
      <h1 className="max-w-[20ch] text-display-lg">{t('title')}</h1>
      <p className="max-w-[52ch] text-body-lg text-ink-muted">{t('body')}</p>
      <button
        type="button"
        className="btn btn-primary w-fit"
        onClick={() => {
          reset()
          void router.invalidate()
        }}
      >
        {t('retry')}
      </button>
    </section>
  )
}

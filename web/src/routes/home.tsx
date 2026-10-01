import { useTranslation } from 'react-i18next'

export default function Home() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-2 px-6">
      <h1 className="text-3xl font-semibold">{t('home.title')}</h1>
      <p className="text-muted-foreground">{t('home.subtitle')}</p>
    </main>
  )
}

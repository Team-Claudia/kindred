import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

const sections = ['stores', 'google', 'who', 'notStored', 'delete'] as const

// Reachable while signed out: Google's consent screen links here.
export default function Privacy() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-6 py-8">
      <h1 className="text-3xl font-semibold">{t('privacy.title')}</h1>
      <p>{t('privacy.intro')}</p>
      {sections.map((section) => (
        <section key={section} className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{t(`privacy.${section}.title`)}</h2>
          <p>{t(`privacy.${section}.body`)}</p>
        </section>
      ))}
      <Button asChild variant="outline" size="lg" className="mt-auto">
        <Link to="/">{t('privacy.back')}</Link>
      </Button>
    </main>
  )
}

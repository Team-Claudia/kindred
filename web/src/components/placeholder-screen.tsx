import type { ParseKeys } from 'i18next'
import { useTranslation } from 'react-i18next'

// Stands in for a screen until its task builds it (wireframes in docs/wireframes).
export function PlaceholderScreen({ titleKey }: { titleKey: ParseKeys }) {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-2 px-6 py-8">
      <h1 className="text-3xl font-semibold">{t(titleKey)}</h1>
      <p className="text-muted-foreground">{t('placeholder.comingSoon')}</p>
    </main>
  )
}

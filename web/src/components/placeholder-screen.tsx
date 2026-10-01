import type { ParseKeys } from 'i18next'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

// Stands in for a screen until its task builds it (wireframes in docs/wireframes).
export function PlaceholderScreen({
  titleKey,
  children,
}: {
  titleKey: ParseKeys
  children?: ReactNode
}) {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex max-w-md flex-col gap-2 px-6 py-8">
      <h1 className="text-3xl font-semibold">{t(titleKey)}</h1>
      <p className="text-muted-foreground">{t('placeholder.comingSoon')}</p>
      {children}
    </main>
  )
}

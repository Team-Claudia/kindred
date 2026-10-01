import { useTranslation } from 'react-i18next'
import { TestPushButton } from '@/components/test-push-button'

export default function Notifications() {
  const { t } = useTranslation()

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-4 px-6 py-8">
      <h1 className="text-3xl font-semibold">{t('screens.notifications')}</h1>
      <p className="text-muted-foreground">{t('placeholder.comingSoon')}</p>
      <TestPushButton />
    </main>
  )
}

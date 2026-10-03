import { useTranslation } from 'react-i18next'
import { LegalPage } from '@/components/legal'

const sections = ['stores', 'google', 'who', 'notStored', 'delete'] as const

// Reachable while signed out: Google's consent screen links here.
export default function Privacy() {
  const { t } = useTranslation()
  return (
    <LegalPage
      title={t('privacy.title')}
      intro={t('privacy.intro')}
      sections={sections.map((section) => ({
        title: t(`privacy.${section}.title`),
        body: t(`privacy.${section}.body`),
      }))}
      back={t('privacy.back')}
    />
  )
}

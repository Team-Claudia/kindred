import { useTranslation } from 'react-i18next'
import { LegalPage } from '@/components/legal'

const sections = ['what', 'notMedical', 'you', 'circle', 'noWarranty', 'changes'] as const

// Terms of use (task 4.3). Reachable while signed out, like /privacy, since
// setup, join and sign-in link here.
export default function Terms() {
  const { t } = useTranslation()
  return (
    <LegalPage
      title={t('terms.title')}
      intro={t('terms.intro')}
      sections={sections.map((section) => ({
        title: t(`terms.${section}.title`),
        body: t(`terms.${section}.body`),
      }))}
      back={t('terms.back')}
    />
  )
}

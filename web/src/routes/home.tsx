import { useTranslation } from 'react-i18next'
import { HomeTopBar } from '@/components/home-top-bar'
import { InstallGuide } from '@/components/install-guide'
import { PlaceholderScreen } from '@/components/placeholder-screen'
import { ShareButton } from '@/components/share-button'
import { useInstallGuide } from '@/lib/install-guide'
import { platform } from '@/platform'

export default function Home() {
  const { t } = useTranslation()
  const installGuide = useInstallGuide()

  // In a Safari tab, ask to add Kindred to the Home Screen first: on iPhone,
  // push only works from there.
  if (installGuide.show) return <InstallGuide onRemindLater={installGuide.remindLater} />

  return (
    <>
      <HomeTopBar />
      <PlaceholderScreen titleKey="screens.home">
        {/* Temporary: checks the share sheet on a phone (task 1.3). */}
        <ShareButton
          label={t('shell.testShare')}
          content={{ text: t('shell.testShareText'), url: platform.appUrl('/') }}
        />
      </PlaceholderScreen>
    </>
  )
}

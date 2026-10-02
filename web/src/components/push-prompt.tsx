import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { platform, type PushResult } from '@/platform'

const DISMISSED_KEY = 'pushPromptDismissed'
const reasons = ['requests', 'reminders', 'coverage', 'overdue', 'updates'] as const

// Show the screen only in the Home Screen app, before the phone has asked, and
// only until the member answers or taps "Not now".
function shouldShowPushPrompt(): boolean {
  return (
    platform.isStandalone() &&
    platform.notificationPermission() === 'default' &&
    platform.deviceSetting.get(DISMISSED_KEY) !== '1'
  )
}

// "Turn on notifications" (wireframe 10). Shown once, before the phone's own
// permission prompt, so members know what they're agreeing to.
export function PushPrompt() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(shouldShowPushPrompt)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<PushResult | 'error' | null>(null)

  if (!visible) return null

  async function turnOn() {
    setBusy(true)
    setMessage(null)
    try {
      const result = await platform.enablePush()
      if (result === 'enabled') setVisible(false)
      else setMessage(result)
    } catch (error) {
      console.error(error)
      setMessage('error')
    } finally {
      setBusy(false)
    }
  }

  function notNow() {
    platform.deviceSetting.set(DISMISSED_KEY, '1')
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-prompt-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-background"
    >
      <div className="mx-auto flex min-h-full max-w-md flex-col gap-4 px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="flex size-14 items-center justify-center rounded-lg border-2 border-foreground bg-muted">
          <Bell className="size-6" aria-hidden />
        </div>
        <h1 id="push-prompt-title" className="text-3xl font-bold">
          {t('push.prompt.title')}
        </h1>
        <p className="text-muted-foreground">{t('push.prompt.intro')}</p>
        <ul className="list-disc space-y-2 pl-6">
          {reasons.map((reason) => (
            <li key={reason}>{t(`push.prompt.reasons.${reason}`)}</li>
          ))}
        </ul>
        <p className="rounded-lg border bg-muted p-4 text-sm">{t('push.prompt.privacy')}</p>

        <div className="mt-auto flex flex-col gap-3 pt-6">
          {message && (
            <p role="status" className="text-sm">
              {t(`push.result.${message}`)}
            </p>
          )}
          {message === 'denied' || message === 'unsupported' ? (
            <Button size="lg" onClick={notNow}>
              {t('push.prompt.close')}
            </Button>
          ) : (
            <>
              <Button size="lg" onClick={turnOn} disabled={busy}>
                {t('push.prompt.turnOn')}
              </Button>
              <Button size="lg" variant="outline" onClick={notNow} disabled={busy}>
                {t('push.prompt.notNow')}
              </Button>
            </>
          )}
          <p className="text-center text-sm text-muted-foreground">
            {t('push.prompt.changeLater')}
          </p>
        </div>
      </div>
    </div>
  )
}

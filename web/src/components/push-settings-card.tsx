import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { setPushTurnedOff } from '@/lib/push-resync'
import { readPushStatus, type PushStatus as ReadStatus } from '@/lib/push-status'
import { cn } from '@/lib/utils'
import { platform } from '@/platform'

type PushStatus = ReadStatus | 'checking'

// Status as text plus colour, never colour alone. Colours are token pairs in
// tokens.css, shared with the item states.
const badgeStyles: Record<PushStatus, string> = {
  checking: 'bg-muted text-muted-foreground',
  on: 'bg-state-assigned text-state-assigned-foreground',
  off: 'bg-state-completed text-state-completed-foreground',
  blocked: 'bg-state-needs-coverage text-state-needs-coverage-foreground',
  needs_install: 'bg-state-needs-someone text-state-needs-someone-foreground',
  unsupported: 'bg-state-completed text-state-completed-foreground',
}

// "Notifications on this phone" (task 4.3): on or off for this device only.
// Which kinds of notification to get (US 11.4) is Tier 2.
export function PushSettingsCard() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<PushStatus>('checking')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    readPushStatus()
      .catch(() => 'off' as const)
      .then((next) => current && setStatus(next))
    return () => {
      current = false
    }
  }, [])

  async function change(on: boolean) {
    setBusy(true)
    setFailed(false)
    try {
      if (on) {
        const result = await platform.enablePush()
        if (result === 'enabled') setPushTurnedOff(false)
        setStatus(result === 'enabled' ? 'on' : result === 'denied' ? 'blocked' : result)
      } else {
        setPushTurnedOff(true)
        await platform.disablePush()
        setStatus('off')
      }
    } catch (error) {
      console.error(error)
      setFailed(true)
      setStatus(await readPushStatus().catch(() => 'off' as const))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="push-settings-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="push-settings-heading" className="text-lg font-semibold">
          {t('pushSettings.heading')}
        </h2>
        <span
          data-push-status={status}
          className={cn('shrink-0 rounded-full px-3 py-1 text-sm font-medium', badgeStyles[status])}
        >
          {t(`pushSettings.state.${status}`)}
        </span>
      </div>
      {status !== 'checking' && (
        <p className="text-sm text-muted-foreground">{t(`pushSettings.explain.${status}`)}</p>
      )}
      {status === 'on' && (
        <Button variant="outline" disabled={busy} onClick={() => void change(false)}>
          {busy ? t('pushSettings.working') : t('pushSettings.turnOff')}
        </Button>
      )}
      {status === 'off' && (
        <Button disabled={busy} onClick={() => void change(true)}>
          {busy ? t('pushSettings.working') : t('pushSettings.turnOn')}
        </Button>
      )}
      {failed && (
        <p role="alert" className="text-sm">
          {t('pushSettings.error')}
        </p>
      )}
      {/* Tier 2: per-category switches (notification_prefs, US 11.4) go here. */}
    </section>
  )
}

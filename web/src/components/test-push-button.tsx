import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { sendTestPush } from '@/lib/api'
import { platform } from '@/platform'

type Status =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; count: number }
  | { kind: 'message'; key: 'push.result.denied' | 'push.result.unsupported' | 'push.test.error' }

// Temporary (task 1.4): sends a test push to the member's own devices so push
// can be checked on a real phone. Remove or hide once outbox-worker (task 3.3)
// sends real notifications.
export function TestPushButton() {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const standalone = platform.isStandalone()

  async function send() {
    setStatus({ kind: 'sending' })
    try {
      // Make sure this phone is subscribed and saved before sending.
      const result = await platform.enablePush()
      if (result === 'denied' || result === 'unsupported') {
        setStatus({ kind: 'message', key: `push.result.${result}` })
        return
      }
      const { sent } = await sendTestPush()
      setStatus({ kind: 'sent', count: sent })
    } catch (error) {
      console.error(error)
      setStatus({ kind: 'message', key: 'push.test.error' })
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="test-push-heading">
      <h2 id="test-push-heading" className="text-lg font-semibold">
        {t('push.test.heading')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('push.test.explainer')}</p>
      <Button onClick={send} disabled={!standalone || status.kind === 'sending'}>
        {status.kind === 'sending' ? t('push.test.sending') : t('push.test.send')}
      </Button>
      <p role="status" className="text-sm">
        {!standalone && t('push.test.needsInstall')}
        {status.kind === 'sent' &&
          (status.count > 0 ? t('push.test.sent', { count: status.count }) : t('push.test.noDevices'))}
        {status.kind === 'message' && t(status.key)}
      </p>
    </section>
  )
}

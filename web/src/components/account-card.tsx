import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { signOut } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import { platform } from '@/platform'

// Leave the Care Circle and sign out (part of task 4.3, brought forward so a
// phone can switch accounts for testing). Task 4.3 builds the rest of the
// screen around this.
export function AccountCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState<'leave' | 'signOut' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function leave() {
    setBusy('leave')
    setError(null)
    try {
      await api.leaveCircle()
      // Clear first, so no guard reads the old circle from the cache and sends
      // the member back to it.
      queryClient.clear()
      navigate('/welcome', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setBusy(null)
    }
  }

  async function onSignOut() {
    setBusy('signOut')
    setError(null)
    // So the next person on this phone doesn't get this member's notifications.
    // Best effort: signing out matters more.
    await platform.disablePush().catch(() => undefined)
    try {
      await signOut()
      queryClient.clear()
      navigate('/sign-in', { replace: true })
    } catch {
      setError(t('account.signOutError'))
      setBusy(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-lg font-semibold">
        {t('account.heading')}
      </h2>

      {confirming ? (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="leave-confirm">
          <p id="leave-confirm" className="font-semibold">
            {t('account.leaveConfirm')}
          </p>
          <p className="text-sm text-muted-foreground">{t('account.leaveExplainer')}</p>
          <Button variant="destructive" disabled={busy !== null} onClick={() => void leave()}>
            {t('account.leaveYes')}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming(false)}>
            {t('account.leaveNo')}
          </Button>
        </div>
      ) : (
        <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming(true)}>
          {t('account.leave')}
        </Button>
      )}

      <Button variant="outline" disabled={busy !== null} onClick={() => void onSignOut()}>
        {t('account.signOut')}
      </Button>

      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  )
}

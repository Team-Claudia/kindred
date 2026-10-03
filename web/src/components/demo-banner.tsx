import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { isAnonymous, signOut, useAuth } from '@/lib/auth'
import { forgetPushResync } from '@/lib/push-resync'
import { platform } from '@/platform'

/**
 * "You're trying the demo", for Try the demo guests only (task 4.2). Sign in
 * for real signs the guest out and goes to the sign-in screen; the nightly
 * clean-up deletes the guest account.
 */
export function DemoBanner() {
  const { t } = useTranslation()
  const auth = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  if (!isAnonymous(auth)) return null

  async function signInForReal() {
    setBusy(true)
    setFailed(false)
    // As in the account card: this phone stops getting the guest's
    // notifications. Best effort; signing out matters more.
    await platform.disablePush().catch(() => undefined)
    forgetPushResync()
    try {
      await signOut()
      queryClient.clear()
      navigate('/sign-in', { replace: true })
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="demo-banner"
      className="flex flex-col gap-2 rounded-xl border bg-muted p-4 break-words"
    >
      <h2 id="demo-banner" className="font-semibold">
        {t('demo.banner')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('demo.bannerBody')}</p>
      <Button
        variant="outline"
        className="self-start"
        disabled={busy}
        onClick={() => void signInForReal()}
      >
        {t('demo.signInForReal')}
      </Button>
      {failed && (
        <p role="alert" className="text-sm">
          {t('account.signOutError')}
        </p>
      )}
    </section>
  )
}

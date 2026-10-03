import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { authErrorKind, signInAsGuest, type AuthErrorKind } from '@/lib/auth'

/**
 * Try the demo on the sign-in screen (task 4.2): signs in as an anonymous
 * guest. Once signed in, the sign-in screen moves on and the sign-in guard
 * adds the guest to the sample circle.
 */
export function TryDemo() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorKind | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      await signInAsGuest()
    } catch (caught) {
      setError(authErrorKind(caught))
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button size="lg" variant="secondary" onClick={() => void start()} disabled={busy}>
        {busy ? t('auth.start.demoBusy') : t('auth.start.demo')}
      </Button>
      <p className="text-center text-sm text-muted-foreground">{t('auth.start.demoBody')}</p>
      {error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {t(error === 'rate_limited' ? 'auth.errors.demoRateLimited' : 'auth.errors.unknown')}
        </p>
      )}
    </div>
  )
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { signOut, useAuth } from '@/lib/auth'
import { circleKeys, useProfile } from '@/lib/circles'
import { errorMessage } from '@/lib/errors'
import { forgetPushResync } from '@/lib/push-resync'
import { platform } from '@/platform'

// "Your account" on Care Circle and settings (task 4.3): your name, Leave this
// Care Circle and Sign out. Export and Delete account are Tier 2 and hidden.
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
    forgetPushResync()
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

      <NameForm />

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

// Your name as the Care Circle sees it, saved through set_display_name.
function NameForm() {
  const { t } = useTranslation()
  const id = useId()
  const queryClient = useQueryClient()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const profile = useProfile(userId)
  const saved = profile.data?.display_name ?? ''
  const [draft, setDraft] = useState<string | null>(null)
  const [blank, setBlank] = useState(false)
  const name = draft ?? saved

  const save = useMutation({
    mutationFn: api.setDisplayName,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile'] }),
        queryClient.invalidateQueries({ queryKey: circleKeys.members }),
      ])
      setDraft(null)
    },
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    setBlank(!name.trim())
    if (name.trim()) save.mutate(name.trim())
  }

  const error = blank ? t('account.nameRequired') : save.error ? errorMessage(save.error) : null

  return (
    <form className="flex flex-col gap-2" onSubmit={submit} noValidate>
      <label htmlFor={id} className="font-medium">
        {t('account.nameLabel')}
      </label>
      <input
        id={id}
        className="h-12 w-full rounded-lg border border-input bg-background px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive"
        value={name}
        onChange={(event) => {
          setDraft(event.target.value)
          save.reset()
        }}
        autoComplete="name"
        maxLength={80}
        disabled={profile.isPending}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-note`}
      />
      <p id={`${id}-note`} role={error ? 'alert' : 'status'} className="text-sm text-muted-foreground">
        {error ?? (save.isSuccess ? t('account.nameSaved') : t('account.nameHint'))}
      </p>
      {draft !== null && draft.trim() !== saved.trim() && (
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? t('account.savingName') : t('account.saveName')}
        </Button>
      )}
    </form>
  )
}

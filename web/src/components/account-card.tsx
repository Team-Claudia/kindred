import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { circleKeys, useProfile } from '@/lib/circles'
import { errorMessage } from '@/lib/errors'
import { useSignOut } from '@/lib/use-sign-out'
import { platform, type SaveFileContent } from '@/platform'

type Busy = 'leave' | 'signOut' | 'export' | 'delete'

// "Your account" on Care Circle and settings (task 4.3): your name, Leave this
// Care Circle and Sign out, then Download my data and Delete my account (task
// 4.5e, ADR-015). Demo guests don't see this card.
export function AccountCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const signOut = useSignOut()
  const [confirming, setConfirming] = useState<'leave' | 'delete' | null>(null)
  const [busy, setBusy] = useState<Busy | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  // The export, kept when the share sheet needs another tap to open.
  const [unsavedFile, setUnsavedFile] = useState<SaveFileContent | null>(null)

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
    try {
      await signOut()
    } catch {
      setError(t('account.signOutError'))
      setBusy(null)
    }
  }

  async function saveFile(file: SaveFileContent) {
    const result = await platform.saveFile(file)
    setUnsavedFile(result === 'needs_tap' ? file : null)
    setNotice(result === 'saved' ? t('account.exportDone') : null)
  }

  async function onExport() {
    setBusy('export')
    setError(null)
    setNotice(null)
    try {
      const data = await api.exportAccount()
      await saveFile({
        name: `kindred-my-data-${new Date().toISOString().slice(0, 10)}.json`,
        type: 'application/json',
        text: JSON.stringify(data, null, 2),
      })
    } catch {
      setError(t('account.exportError'))
    } finally {
      setBusy(null)
    }
  }

  async function onDelete() {
    setBusy('delete')
    setError(null)
    setNotice(null)
    try {
      await api.deleteAccount()
    } catch {
      setError(t('account.deleteError'))
      setBusy(null)
      return
    }
    try {
      // The account is gone, so only this phone's session is left to forget.
      await signOut({ local: true })
    } catch {
      queryClient.clear()
      navigate('/sign-in', { replace: true })
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-lg font-semibold">
        {t('account.heading')}
      </h2>

      <NameForm />

      {confirming === 'leave' ? (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="leave-confirm">
          <p id="leave-confirm" className="font-semibold">
            {t('account.leaveConfirm')}
          </p>
          <p className="text-sm text-muted-foreground">{t('account.leaveExplainer')}</p>
          <Button variant="destructive" disabled={busy !== null} onClick={() => void leave()}>
            {t('account.leaveYes')}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming(null)}>
            {t('account.leaveNo')}
          </Button>
        </div>
      ) : (
        <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming('leave')}>
          {t('account.leave')}
        </Button>
      )}

      <Button variant="outline" disabled={busy !== null} onClick={() => void onSignOut()}>
        {t('account.signOut')}
      </Button>

      {unsavedFile ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{t('account.exportReady')}</p>
          <Button disabled={busy !== null} onClick={() => void saveFile(unsavedFile)}>
            {t('account.exportSave')}
          </Button>
        </div>
      ) : (
        <Button variant="outline" disabled={busy !== null} onClick={() => void onExport()}>
          {busy === 'export' ? t('account.exporting') : t('account.export')}
        </Button>
      )}

      {confirming === 'delete' ? (
        <div className="flex flex-col gap-3" role="group" aria-labelledby="delete-confirm">
          <p id="delete-confirm" className="font-semibold">
            {t('account.deleteConfirm')}
          </p>
          <ul className="flex list-disc flex-col gap-1 ps-5 text-sm text-muted-foreground">
            <li>{t('account.deleteItems')}</li>
            <li>{t('account.deleteHistory')}</li>
            <li>{t('account.deleteCalendar')}</li>
            <li>{t('account.deleteCircle')}</li>
          </ul>
          <p className="text-sm font-semibold">{t('account.deleteFinal')}</p>
          <Button variant="destructive" disabled={busy !== null} onClick={() => void onDelete()}>
            {busy === 'delete' ? t('account.deleting') : t('account.deleteYes')}
          </Button>
          <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming(null)}>
            {t('account.deleteNo')}
          </Button>
        </div>
      ) : (
        <Button variant="outline" disabled={busy !== null} onClick={() => setConfirming('delete')}>
          {t('account.delete')}
        </Button>
      )}

      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
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

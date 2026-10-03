import { ChevronLeft } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router'
import { CodeInput } from '@/components/code-input'
import { LegalLinks } from '@/components/legal'
import { Button } from '@/components/ui/button'
import {
  authErrorKind,
  safeNext,
  sendEmailCode,
  signInWithGoogle,
  useAuth,
  verifyEmailCode,
  type AuthErrorKind,
} from '@/lib/auth'
import { CODE_LENGTH } from '@/lib/sign-in-code'

// Wireframes 01 (welcome), 02 (sign in with email) and 03 (enter code).
type Step = 'start' | 'email' | 'code'

export default function SignIn() {
  const auth = useAuth()
  const [searchParams] = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const [step, setStep] = useState<Step>('start')
  const [email, setEmail] = useState('')

  // Signed in (a code was accepted, or they were already): carry on to where
  // they were going. The guard there sends people with no circle to /welcome.
  if (auth.status === 'signed_in') return <Navigate to={next} replace />

  if (step === 'email') {
    return (
      <EmailStep
        initialEmail={email}
        onBack={() => setStep('start')}
        onSent={(sentTo) => {
          setEmail(sentTo)
          setStep('code')
        }}
      />
    )
  }
  if (step === 'code') {
    return <CodeStep email={email} onBack={() => setStep('email')} />
  }
  return <StartStep next={next} onEmail={() => setStep('email')} />
}

function StartStep({ next, onEmail }: { next: string; onEmail: () => void }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorKind | null>(null)

  async function continueWithGoogle() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle(next) // leaves the page for Google
    } catch (caught) {
      setError(authErrorKind(caught))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col gap-6 px-6 py-8">
      <p className="text-xl font-semibold">{t('auth.appName')}</p>
      <div className="aspect-[4/3] w-full rounded-xl bg-muted" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t('auth.start.title')}</h1>
        <p className="text-muted-foreground">{t('auth.start.body')}</p>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <ErrorMessage kind={error} />
        <Button size="lg" onClick={() => void continueWithGoogle()} disabled={busy}>
          {t('auth.start.google')}
        </Button>
        <Button size="lg" variant="outline" onClick={onEmail} disabled={busy}>
          {t('auth.start.email')}
        </Button>
        <p className="text-center text-sm">
          {t('auth.start.demoPrompt')}{' '}
          <Button variant="link" className="h-11 px-1" disabled>
            {t('auth.start.demo')}
          </Button>{' '}
          {t('auth.start.demoSoon')}
        </p>
        <p className="text-center text-sm text-muted-foreground">{t('auth.start.disclaimer')}</p>
        <LegalLinks />
      </div>
    </main>
  )
}

function EmailStep({
  initialEmail,
  onBack,
  onSent,
}: {
  initialEmail: string
  onBack: () => void
  onSent: (email: string) => void
}) {
  const { t } = useTranslation()
  const [email, setEmail] = useState(initialEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorKind | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const address = email.trim()
    if (!address) return
    setBusy(true)
    setError(null)
    try {
      await sendEmailCode(address)
      onSent(address)
    } catch (caught) {
      setError(authErrorKind(caught))
      setBusy(false)
    }
  }

  return (
    <EmailLayout onBack={onBack}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t('auth.email.title')}</h1>
        <p className="text-muted-foreground">{t('auth.email.body')}</p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)}>
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-medium uppercase tracking-wide">
            {t('auth.email.label')}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-lg border border-input bg-background px-4 text-base outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
        </div>
        <ErrorMessage kind={error} />
        <Button type="submit" size="lg" disabled={busy}>
          {t('auth.email.submit')}
        </Button>
        <p className="text-center text-sm text-muted-foreground">{t('auth.email.sameStep')}</p>
      </form>
    </EmailLayout>
  )
}

function CodeStep({ email, onBack }: { email: string; onBack: () => void }) {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<AuthErrorKind | null>(null)
  const [resent, setResent] = useState(false)

  async function verify(value: string) {
    setBusy(true)
    setError(null)
    setResent(false)
    try {
      // On success the auth state changes and SignIn moves on.
      await verifyEmailCode(email, value)
    } catch (caught) {
      setError(authErrorKind(caught))
      setBusy(false)
    }
  }

  function change(value: string) {
    if (busy) return
    setCode(value)
    setError(null)
    if (value.length === CODE_LENGTH) void verify(value)
  }

  async function resend() {
    setBusy(true)
    setError(null)
    setResent(false)
    try {
      await sendEmailCode(email)
      setCode('')
      setResent(true)
    } catch (caught) {
      setError(authErrorKind(caught))
    }
    setBusy(false)
  }

  return (
    <EmailLayout onBack={onBack}>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t('auth.code.title')}</h1>
        <p className="text-muted-foreground">
          <Trans
            i18nKey="auth.code.sentTo"
            values={{ email }}
            components={{ strong: <strong className="text-foreground" /> }}
          />
        </p>
      </div>
      <form
        className="flex flex-1 flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (code.length === CODE_LENGTH) void verify(code)
        }}
      >
        <CodeInput
          id="code"
          value={code}
          onChange={change}
          invalid={error === 'code_invalid'}
        />
        <div className="flex flex-wrap items-center gap-x-2">
          <Button type="button" variant="link" className="px-0" onClick={() => void resend()} disabled={busy}>
            {t('auth.code.resend')}
          </Button>
          <span aria-hidden="true">·</span>
          <Button type="button" variant="link" className="px-0" onClick={onBack} disabled={busy}>
            {t('auth.code.differentEmail')}
          </Button>
        </div>
        <ErrorMessage kind={error} />
        {resent && (
          <p role="status" className="text-sm">
            {t('auth.code.resent')}
          </p>
        )}
        <p className="rounded-lg bg-muted p-4">{t('auth.code.anyDevice')}</p>
        <Button type="submit" size="lg" className="mt-auto" disabled={busy || code.length < CODE_LENGTH}>
          {t('auth.code.submit')}
        </Button>
      </form>
    </EmailLayout>
  )
}

function EmailLayout({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col">
      <header className="flex items-center gap-2 border-b px-2 py-2">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('auth.back')}>
          <ChevronLeft className="size-6" />
        </Button>
        <p className="font-semibold">{t('auth.email.header')}</p>
      </header>
      <main className="flex flex-1 flex-col gap-6 px-6 py-6">{children}</main>
    </div>
  )
}

function ErrorMessage({ kind }: { kind: AuthErrorKind | null }) {
  const { t } = useTranslation()
  if (!kind) return null
  return (
    <p role="alert" className="text-sm text-destructive">
      {t(`auth.errors.${kind}`)}
    </p>
  )
}

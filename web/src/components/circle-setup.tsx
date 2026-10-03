import { ChevronLeft } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { relationships } from '@/lib/circles'
import { cn } from '@/lib/utils'

// Building blocks for the /welcome and /join/:code screens (wireframes 04–08).

export function SetupScreen({
  title,
  onBack,
  children,
  footer,
}: {
  title?: ReactNode
  onBack?: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col">
      {title && (
        <header className="flex min-h-14 items-center gap-1 border-b px-3">
          {onBack ? (
            <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('circleSetup.back')}>
              <ChevronLeft className="size-6" />
            </Button>
          ) : (
            <span className="w-3" />
          )}
          <h1 className="text-lg font-semibold">{title}</h1>
        </header>
      )}
      <main className="flex flex-1 flex-col gap-5 px-6 py-6">{children}</main>
      {footer && <footer className="flex flex-col gap-3 px-6 pt-2 pb-6">{footer}</footer>}
    </div>
  )
}

export function StepProgress({ step, label }: { step: 1 | 2 | 3; label: string }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-sm font-medium tracking-wider text-muted-foreground uppercase">
        {t('welcome.step', { step, label })}
      </p>
      <div className="grid grid-cols-3 gap-2" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('h-1 rounded-full', n <= step ? 'bg-primary' : 'bg-muted')} />
        ))}
      </div>
    </div>
  )
}

export function Heading({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-3xl leading-tight font-bold">{children}</h2>
      {intro && <p className="text-muted-foreground">{intro}</p>}
    </div>
  )
}

const fieldLabel = 'font-mono text-sm font-medium tracking-wider text-muted-foreground uppercase'
const fieldControl =
  'h-12 w-full rounded-lg border border-input bg-background px-4 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive'

export function TextField({
  label,
  value,
  onChange,
  hint,
  error,
  autoComplete,
  placeholder,
  verbatim = false,
  maxLength = 80,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  autoComplete?: string
  placeholder?: string
  /** Kept exactly as typed (codes, links): no auto-capitals or autocorrect. */
  verbatim?: boolean
  maxLength?: number
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        className={fieldControl}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        maxLength={maxLength}
        {...(verbatim && { autoCapitalize: 'none', autoCorrect: 'off', spellCheck: false })}
        aria-invalid={Boolean(error)}
        aria-describedby={`${id}-hint`}
      />
      <FieldNote id={`${id}-hint`} hint={hint} error={error} />
    </div>
  )
}

// "<Name> is my…", asked the same way in setup and join (task 4.9). The answer
// is what the care recipient is to the member; member lists show it the other
// way round with relationshipLabel.
export function RelationshipField({
  recipientName,
  value,
  onChange,
  hint,
}: {
  recipientName: string
  value: string
  onChange: (value: string) => void
  hint?: string
}) {
  const { t } = useTranslation()
  const id = useId()
  const name = recipientName.trim()
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={fieldLabel}>
        {name ? t('circleSetup.relationshipLabel', { name }) : t('circleSetup.relationshipLabelNoName')}
      </label>
      <select
        id={id}
        className={fieldControl}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={`${id}-hint`}
      >
        <option value="">{t('circleSetup.chooseRelationship')}</option>
        {relationships.map((key) => (
          <option key={key} value={key}>
            {t(`circleSetup.relationship.${key}`)}
          </option>
        ))}
      </select>
      <FieldNote id={`${id}-hint`} hint={hint} />
    </div>
  )
}

export function CheckboxField({
  checked,
  onChange,
  children,
  error,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: ReactNode
  error?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="flex min-h-tap cursor-pointer items-start gap-3 py-2">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-6 shrink-0 accent-primary"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <span>{children}</span>
      </label>
      <FieldNote id={`${id}-error`} error={error} />
    </div>
  )
}

function FieldNote({ id, hint, error }: { id: string; hint?: string; error?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="text-sm font-medium text-destructive">
        {error}
      </p>
    )
  }
  return hint ? (
    <p id={id} className="text-sm text-muted-foreground">
      {hint}
    </p>
  ) : null
}

export function Notice({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border bg-muted px-5 py-4">{children}</div>
}

export function ErrorText({ children }: { children: ReactNode }) {
  return children ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {children}
    </p>
  ) : null
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-12 shrink-0 items-center justify-center rounded-full border bg-muted font-mono font-semibold',
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

// A full-screen message with a way back to Home, for invites that can't be
// used and other dead ends.
export function MessageScreen({ heading, body }: { heading: string; body: string }) {
  const { t } = useTranslation()
  return (
    <SetupScreen
      footer={
        <Button asChild size="lg">
          <Link to="/">{t('circleSetup.goHome')}</Link>
        </Button>
      }
    >
      <Heading intro={body}>{heading}</Heading>
    </SetupScreen>
  )
}

export function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <SetupScreen>
      <p className="text-muted-foreground" role="status">
        {t('circleSetup.loading')}
      </p>
    </SetupScreen>
  )
}

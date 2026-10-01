import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

export const CODE_LENGTH = 6

/**
 * A 6-digit code entry that looks like six boxes but is one input, so the
 * phone can fill the code from the email (autocomplete="one-time-code") and
 * pasting works.
 */
export function CodeInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  const { t } = useTranslation()
  const digits = value.padEnd(CODE_LENGTH).slice(0, CODE_LENGTH).split('')
  const activeIndex = Math.min(value.length, CODE_LENGTH - 1)

  return (
    <div className="group relative">
      <input
        id={id}
        className="absolute inset-0 z-10 h-full w-full cursor-text text-base opacity-0"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        aria-label={t('auth.code.label')}
        aria-invalid={invalid || undefined}
        value={value}
        autoFocus
        onChange={(event) => onChange(event.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH))}
      />
      <div className="grid grid-cols-6 gap-2" aria-hidden="true">
        {digits.map((digit, index) => (
          <div
            key={index}
            className={cn(
              'flex h-16 items-center justify-center rounded-lg border border-input text-2xl font-semibold',
              index === activeIndex && 'group-focus-within:border-2 group-focus-within:border-foreground',
              invalid && 'border-destructive',
            )}
          >
            {digit.trim()}
          </div>
        ))}
      </div>
    </div>
  )
}

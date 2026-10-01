import { useTranslation } from 'react-i18next'
import { CODE_LENGTH, codeFromText } from '@/lib/sign-in-code'
import { cn } from '@/lib/utils'

/**
 * A 6-digit code entry that looks like six boxes but is one input, so the
 * phone can fill the code from the email (autocomplete="one-time-code") and
 * pasting works. The input's text is transparent rather than the input being
 * opacity-0: iPhone Safari won't offer Paste on an invisible input.
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
        className="absolute inset-0 z-10 h-full w-full cursor-text bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        aria-label={t('auth.code.label')}
        aria-invalid={invalid || undefined}
        value={value}
        autoFocus
        onChange={(event) => onChange(codeFromText(event.target.value))}
        onPaste={(event) => {
          event.preventDefault()
          const code = codeFromText(event.clipboardData.getData('text'))
          // Pasting something with no digits keeps what's already typed.
          if (code) onChange(code)
        }}
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

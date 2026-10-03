import { Plus, Share } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Wireframe 09: three steps to add Kindred to the iPhone Home Screen. On Home
 * it explains notifications; before sign-in and join (task 4.10) it asks
 * people to install first, with `intro`, `lastStep` and `dismissLabel` saying
 * so, and `children` (the invite code) above the steps.
 */
export function InstallGuide({
  onDismiss,
  intro,
  lastStep,
  dismissLabel,
  children,
}: {
  onDismiss: () => void
  intro?: string
  lastStep?: string
  dismissLabel?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()

  const steps = [
    { title: t('install.step1Title'), detail: t('install.step1Detail'), icon: <Share aria-hidden className="size-6" /> },
    { title: t('install.step2Title'), detail: t('install.step2Detail'), icon: <Plus aria-hidden className="size-6" /> },
    {
      title: t('install.step3Title'),
      detail: lastStep ?? t('install.step3Detail'),
      icon: <img src="/apple-touch-icon.png" alt="" className="size-8 rounded-md" />,
    },
  ]

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-6 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">{t('install.title')}</h1>
        <p className="text-muted-foreground">{intro ?? t('install.intro')}</p>
      </div>
      {children}
      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => (
          <li key={step.title} className="flex items-center gap-4 rounded-xl border p-4">
            <span
              aria-hidden
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground"
            >
              {index + 1}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{step.title}</span>
              <span className="text-sm text-muted-foreground">{step.detail}</span>
            </div>
            {step.icon}
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={onDismiss}
        className="mx-auto min-h-tap px-4 text-muted-foreground underline underline-offset-4"
      >
        {dismissLabel ?? t('install.notNow')}
      </button>
    </main>
  )
}

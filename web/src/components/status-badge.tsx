import { useTranslation } from 'react-i18next'
import type { BadgeStatus } from '@/lib/status'
import { cn } from '@/lib/utils'

// Full class names, so Tailwind finds them. Colours are the state token pairs
// in tokens.css.
const styles: Record<BadgeStatus, string> = {
  // Unclaimed is an invitation: a dashed outline, like the nobody avatar.
  needs_someone:
    'border-dashed border-state-needs-someone-foreground bg-state-needs-someone text-state-needs-someone-foreground',
  awaiting_acceptance: 'bg-state-awaiting-acceptance text-state-awaiting-acceptance-foreground',
  assigned: 'bg-state-assigned text-state-assigned-foreground',
  needs_coverage: 'bg-state-needs-coverage text-state-needs-coverage-foreground',
  completed: 'bg-state-completed text-state-completed-foreground',
  cancelled: 'bg-state-cancelled text-state-cancelled-foreground',
  overdue: 'border-overdue-border bg-state-overdue font-semibold text-state-overdue-foreground',
}

/**
 * A state, or Overdue, as its name in text plus its colour. Never colour alone.
 * With `name`, Awaiting acceptance says who it's waiting for ("Awaiting Maya").
 */
export function StatusBadge({
  status,
  name,
  className,
}: {
  status: BadgeStatus
  name?: string
  className?: string
}) {
  const { t } = useTranslation()
  const label =
    status === 'overdue'
      ? t('status.overdue')
      : status === 'awaiting_acceptance' && name
        ? t('status.awaitingNamed', { name })
        : t(`state.${status}`)

  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex max-w-full items-center rounded-full border border-transparent px-3 py-1 text-sm font-medium leading-tight',
        styles[status],
        className,
      )}
    >
      {label}
    </span>
  )
}

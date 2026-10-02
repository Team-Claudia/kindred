import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/status-badge'
import { formatTime } from '@/lib/dates'
import { hasNoTime } from '@/lib/item-form'
import { isOverdue, type Item } from '@/lib/items'
import { ASSIGNMENT_STATES, type AssignmentState } from '@/lib/status'
import { cn } from '@/lib/utils'

export type ItemRowItem = Pick<
  Item,
  | 'id'
  | 'kind'
  | 'title'
  | 'starts_at'
  | 'state'
  | 'owner_id'
  | 'proposed_assignee_id'
  | 'location'
  | 'updated_at'
>

export interface ItemRowProps {
  item: ItemRowItem
  /** Display names by user ID (lib/items.ts memberNames). */
  names: ReadonlyMap<string, string>
  /** The circle's time zone, for the time shown. */
  timeZone: string
  /** For the Overdue indicator. */
  now: Date
  className?: string
}

function asState(state: string): AssignmentState {
  return (ASSIGNMENT_STATES as readonly string[]).includes(state)
    ? (state as AssignmentState)
    : 'needs_someone'
}

/**
 * One task or appointment in a list (This week, Home). Shows its title, kind,
 * time, who owns it or has been asked, its state as text plus colour and the
 * Overdue indicator. Tapping it opens the item.
 */
export function ItemRow({ item, names, timeZone, now, className }: ItemRowProps) {
  const { t, i18n } = useTranslation()
  const state = asState(item.state)
  const overdue = isOverdue(item, now)
  const name = (userId: string | null) =>
    userId ? (names.get(userId) ?? t('item.formerMember')) : undefined
  const owner = name(item.owner_id)
  const asked = name(item.proposed_assignee_id)
  const time = formatTime(item.starts_at, timeZone, i18n.language)

  // The time, then who: the confirmed owner, who has been asked, or nobody.
  const meta: string[] = []
  if (state === 'completed') {
    // There's no completed_at yet: completing is the last change to the item.
    meta.push(t('item.done', { time: formatTime(item.updated_at, timeZone, i18n.language) }))
    if (owner) meta.push(owner)
  } else {
    meta.push(
      item.kind !== 'task' ? time : hasNoTime(item, timeZone) ? t('item.dueEndOfDay') : t('item.due', { time }),
    )
    if (state === 'awaiting_acceptance' && asked) meta.push(t('item.asked', { name: asked }))
    else if (state === 'needs_someone') meta.push(t('item.nobody'))
    else if (owner) meta.push(owner)
  }
  if (item.location && item.kind === 'appointment') meta.push(item.location)

  // The avatar: the owner, who has been asked (dashed, not yet confirmed), or ?.
  const avatarName = state === 'awaiting_acceptance' ? asked : state === 'needs_someone' ? undefined : owner
  const unconfirmed = state === 'awaiting_acceptance' || !avatarName
  const initial = avatarName?.trim().charAt(0).toUpperCase() || '?'
  const finished = state === 'completed' || state === 'cancelled'
  const needsAttention = overdue || state === 'needs_someone' || state === 'needs_coverage'

  return (
    <Link
      to={`/i/${item.id}`}
      data-state={state}
      data-overdue={overdue || undefined}
      className={cn(
        'flex min-h-tap gap-3 rounded-xl border bg-card p-4 text-card-foreground',
        needsAttention && 'border-2 border-foreground',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'flex size-tap shrink-0 items-center justify-center rounded-full border font-semibold',
          unconfirmed ? 'border-dashed border-muted-foreground' : 'bg-muted',
        )}
      >
        {initial}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={cn(
            'text-lg leading-snug font-semibold break-words',
            finished && 'text-muted-foreground line-through',
          )}
        >
          {item.title}
        </span>
        <span className="break-words text-muted-foreground">{meta.join(' · ')}</span>
        <span className="flex flex-wrap gap-2 pt-1">
          {overdue && <StatusBadge status="overdue" />}
          <StatusBadge status={state} name={asked} />
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm leading-tight">
            {t(`item.kind.${item.kind === 'appointment' ? 'appointment' : 'task'}`)}
          </span>
        </span>
      </span>
    </Link>
  )
}

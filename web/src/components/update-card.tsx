import { Tag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import type { DayKey } from '@/lib/dates'
import type { UpdateWithItem } from '@/lib/queries'
import { formatPostedAt } from '@/lib/updates'

// One update (wireframes 13 and 23): who posted it, when, the text, and the
// item it's linked to as a chip that opens the item. On the thread, an update
// linked to an appointment also offers Create follow-up task (US 10.2).

export function UpdateCard({
  update,
  names,
  timeZone,
  today,
  showItem = true,
  onFollowUp,
}: {
  update: UpdateWithItem
  /** First names by user ID (lib/items.ts memberNames). */
  names: ReadonlyMap<string, string>
  timeZone: string
  today: DayKey
  /** Show the linked item's chip (not on that item's own detail). */
  showItem?: boolean
  /** Offered when the linked item is an appointment. */
  onFollowUp?: (appointment: { id: string; title: string }) => void
}) {
  const { t, i18n } = useTranslation()
  const author = update.author_id ? names.get(update.author_id) : undefined
  const item = showItem ? update.items : null

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground">
      <header className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-tap shrink-0 items-center justify-center rounded-full border bg-muted font-semibold"
        >
          {author?.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-lg font-semibold break-words">{author ?? t('item.formerMember')}</span>
          <time dateTime={update.created_at} className="text-sm text-muted-foreground">
            {formatPostedAt(t, i18n.language, update.created_at, timeZone, today)}
          </time>
        </span>
      </header>
      <p className="break-words whitespace-pre-line">{update.body}</p>
      {item && (
        <div className="flex flex-wrap gap-2">
          <Link
            to={`/i/${item.id}`}
            aria-label={t('updates.linkedTo', { title: item.title })}
            className="inline-flex min-h-tap max-w-full items-center gap-2 rounded-full border px-4 py-2"
          >
            <Tag aria-hidden className="size-4 shrink-0" />
            <span className="break-words">{item.title}</span>
          </Link>
          {item.kind === 'appointment' && onFollowUp && (
            <Button variant="outline" onClick={() => onFollowUp({ id: item.id, title: item.title })}>
              {t('updates.createFollowUp')}
            </Button>
          )}
        </div>
      )}
    </article>
  )
}

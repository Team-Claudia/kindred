import type { Json } from './database.types'

/** An item history row, as useItemHistory reads it. */
export interface HistoryEvent {
  type: string
  data: Json
  at: string
}

/** Who the overdue alert told, the person on the item first, and when. */
export interface OverdueAlert {
  told: string[]
  at: string
}

/**
 * The overdue alert sent for the item's current due time (task 4.5b): its
 * newest `overdue_alerted` history row whose `starts_at` matches. An alert for
 * an earlier due time doesn't count once the date has changed. Null until the
 * alert has gone out.
 */
export function overdueAlertFor(
  history: readonly HistoryEvent[] | undefined,
  startsAt: string,
): OverdueAlert | null {
  const due = Date.parse(startsAt)
  for (const event of [...(history ?? [])].reverse()) {
    if (event.type !== 'overdue_alerted') continue
    const data = event.data
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue
    if (typeof data.starts_at !== 'string' || Date.parse(data.starts_at) !== due) continue
    const told = Array.isArray(data.told)
      ? data.told.filter((id): id is string => typeof id === 'string')
      : []
    return { told, at: event.at }
  }
  return null
}

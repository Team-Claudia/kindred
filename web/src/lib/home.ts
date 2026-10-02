import { addDays, dayKey, hourOf, type DayKey } from './dates'
import { countByKind, isOverdue, type Item } from './items'

// What Home (wireframe 11) shows in each section, as pure functions over the
// items its queries return. "Today" is the day in the circle's time zone
// (BR-09), and Overdue uses the same rule as This week (lib/items.ts).

type HomeItem = Pick<Item, 'id' | 'kind' | 'state' | 'starts_at' | 'owner_id' | 'proposed_assignee_id'>

function byTime<T extends Pick<Item, 'starts_at'>>(a: T, b: T) {
  return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
}

/** Items in time order, each once, from any number of lists. */
export function uniqueById<T extends Pick<Item, 'id' | 'starts_at'>>(...lists: readonly (readonly T[])[]): T[] {
  const byId = new Map<string, T>()
  for (const list of lists) for (const item of list) if (!byId.has(item.id)) byId.set(item.id, item)
  return [...byId.values()].sort(byTime)
}

/** Needs your answer: assignments waiting for `me` to Accept or Decline. */
export function needsYourAnswer<T extends HomeItem>(items: readonly T[], me: string): T[] {
  return items
    .filter((item) => item.state === 'awaiting_acceptance' && item.proposed_assignee_id === me)
    .sort(byTime)
}

/**
 * Today: everything on `today` in the circle's time zone except cancelled
 * items, plus anything from an earlier day that's still open and so overdue.
 */
export function todayItems<T extends HomeItem>(
  items: readonly T[],
  today: DayKey,
  timeZone: string,
  now: Date,
): T[] {
  return uniqueById(items).filter((item) => {
    const day = dayKey(item.starts_at, timeZone)
    if (day === today) return item.state !== 'cancelled'
    return day < today && isOverdue(item, now)
  })
}

/** Needs someone: items nobody has claimed, soonest first (overdue ones too). */
export function needsSomeone<T extends HomeItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.state === 'needs_someone').sort(byTime)
}

/** Coverage requests: items whose owner has asked for someone to cover. */
export function coverageRequests<T extends HomeItem>(items: readonly T[]): T[] {
  return items.filter((item) => item.state === 'needs_coverage').sort(byTime)
}

/**
 * The counts under the greeting. Tasks and appointments are this week's, as
 * This week counts them for Everyone. Overdue is every open item past its
 * time, which is exactly the overdue rows in Today.
 */
export function homeCounts(
  weekItems: readonly Pick<Item, 'kind' | 'state'>[],
  today: readonly Pick<Item, 'starts_at' | 'state'>[],
  now: Date,
) {
  return {
    ...countByKind(weekItems),
    overdue: today.filter((item) => isOverdue(item, now)).length,
  }
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

/** For "Good morning": before noon, before 6 pm, then evening, in the circle's time zone. */
export function timeOfDay(now: Date, timeZone: string): TimeOfDay {
  const hour = hourOf(now, timeZone)
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

export type RelativeDay = 'today' | 'tomorrow' | 'yesterday' | 'week' | 'later'

/** How to name `day` next to `today`: by name close by, by weekday within a week, else with the month. */
export function relativeDay(day: DayKey, today: DayKey): RelativeDay {
  if (day === today) return 'today'
  if (day === addDays(today, 1)) return 'tomorrow'
  if (day === addDays(today, -1)) return 'yesterday'
  if (day > addDays(today, -7) && day < addDays(today, 7)) return 'week'
  return 'later'
}

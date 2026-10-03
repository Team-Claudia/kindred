import type { TFunction } from 'i18next'
import { dayKey, formatDayShort, formatMonthDay, formatTime, type DayKey } from './dates'
import { relativeDay } from './home'
import type { Item } from './items'

// Updates (task 4.1, PRD Epic 10): short reports of what happened, in one
// thread for the Care Circle, each optionally linked to one task or
// appointment. post_update checks the same rules (plan §4.2).

/** The longest update post_update accepts. */
export const UPDATE_MAX_LENGTH = 2000

export type UpdateProblem = 'required' | 'tooLong'

/** What's wrong with an update's text, or null if it can be posted. */
export function updateProblem(body: string): UpdateProblem | null {
  const text = body.trim()
  if (!text) return 'required'
  if (text.length > UPDATE_MAX_LENGTH) return 'tooLong'
  return null
}

/** An item an update can be linked to. */
export type LinkableItem = Pick<Item, 'id' | 'kind' | 'title' | 'starts_at' | 'state'>

/**
 * The items offered under "Link this to": the `max` items closest in time to
 * `now` (recent and upcoming), in date order, leaving out cancelled ones.
 * `pinned` (the item the sheet was opened from) always comes first.
 */
export function linkChoices<T extends LinkableItem>(
  items: readonly T[],
  now: Date,
  pinned?: T | null,
  max = 5,
): T[] {
  const time = (item: T) => new Date(item.starts_at).getTime()
  const distance = (item: T) => Math.abs(time(item) - now.getTime())
  const nearest = items
    .filter((item) => item.state !== 'cancelled' && item.id !== pinned?.id)
    .sort((a, b) => distance(a) - distance(b))
    .slice(0, pinned ? max - 1 : max)
    .sort((a, b) => time(a) - time(b))
  return pinned ? [pinned, ...nearest] : nearest
}

/**
 * When an update was posted, in the circle's time zone: "Today, 3:12 p.m.",
 * "Yesterday, …", the weekday within the last week ("Tue 22, 8:05 a.m."),
 * else the date ("September 2, 8:05 a.m.").
 */
export function formatPostedAt(
  t: TFunction,
  locale: string,
  iso: string,
  timeZone: string,
  today: DayKey,
): string {
  const day = dayKey(iso, timeZone)
  const relative = relativeDay(day, today)
  return t('updates.postedAt', {
    context: relative === 'week' || relative === 'later' ? undefined : relative,
    day: relative === 'later' ? formatMonthDay(day, locale) : formatDayShort(day, locale),
    time: formatTime(iso, timeZone, locale),
  })
}

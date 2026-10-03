import type { AvailabilitySlot } from './api'
import { isDayKey, isTimeOfDay } from './dates'
import { formTimes, hasNoTime, type ItemForm } from './item-form'
import type { Item } from './items'

// Who's free (task 4.5a): the slot the ask-someone pickers check. It matches
// how the calendar feed shows the item (plan §4.4): an appointment with no
// end lasts an hour, a task with a time lasts 15 minutes. A task with no time
// has no slot, so nobody's availability is shown for it.

const MINUTE = 60 * 1000

/** The time to check for `item`, or null if it has no time of day. */
export function availabilitySlot(
  item: Pick<Item, 'kind' | 'starts_at' | 'ends_at'>,
  timeZone: string,
): AvailabilitySlot | null {
  if (item.kind !== 'appointment' && hasNoTime(item, timeZone)) return null
  const start = new Date(item.starts_at)
  if (Number.isNaN(start.getTime())) return null
  const fallback = new Date(start.getTime() + (item.kind === 'appointment' ? 60 : 15) * MINUTE)
  const given = item.kind === 'appointment' && item.ends_at ? new Date(item.ends_at) : null
  const end = given && given > start ? given : fallback
  return { start: start.toISOString(), end: end.toISOString() }
}

/** The slot for the create sheet, once the form has a date and a time. */
export function formAvailabilitySlot(form: ItemForm, timeZone: string): AvailabilitySlot | null {
  if (!isDayKey(form.date) || !isTimeOfDay(form.time)) return null
  const { starts_at, ends_at } = formTimes(form, timeZone)
  return availabilitySlot({ kind: form.kind, starts_at, ends_at }, timeZone)
}

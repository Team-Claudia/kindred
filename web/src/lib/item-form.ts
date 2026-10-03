import type { CreateItemArgs, ItemPatch, Repeat } from './api'
import { instantAt, isDayKey, isTimeOfDay, timeOfDay, dayKey, type DayKey } from './dates'
import type { Item, ItemKind } from './items'

// The create/edit sheet's fields and the rules for turning them into
// create_item arguments or an update_item patch (task 2.2). Dates and times
// are read in the circle's time zone (BR-09), never the phone's.

/** The same limits create_item and update_item check (plan §4.2). */
export const limits = { title: 200, location: 200, notes: 4000 } as const

/**
 * A task with no time is due by the end of its day. There's no all-day flag
 * on items, so 23:59 in the circle's time zone stands for "no time": Overdue
 * starts the next morning, and the edit sheet shows the time as blank.
 */
export const END_OF_DAY = '23:59'

/** Whether `item` is a task saved with no time (see END_OF_DAY). */
export function hasNoTime(item: Pick<Item, 'kind' | 'starts_at'>, timeZone: string): boolean {
  return item.kind === 'task' && timeOfDay(item.starts_at, timeZone) === END_OF_DAY
}

export interface ItemForm {
  kind: ItemKind
  title: string
  /** 'YYYY-MM-DD', or '' until chosen. */
  date: string
  /** 'HH:MM', or ''. Optional for a task; an appointment's start time. */
  time: string
  /** An appointment's optional end time, 'HH:MM' or ''. */
  endTime: string
  /** Appointments only. */
  location: string
  notes: string
  /** Who is asked to do it: a member's user ID, or null for Nobody yet. */
  assigneeId: string | null
  /** Creating only: how it repeats (task 4.5c). Each occurrence is its own item. */
  repeat: Repeat | 'none'
  /** The last day it repeats, 'YYYY-MM-DD', or '' for no end date. */
  until: string
}

export type ItemFormField = 'title' | 'date' | 'time' | 'endTime' | 'location' | 'notes' | 'until'

export type ItemFormProblem =
  | 'titleRequired'
  | 'titleTooLong'
  | 'dateRequired'
  | 'timeRequired'
  | 'endBeforeStart'
  | 'locationTooLong'
  | 'notesTooLong'
  | 'untilBeforeStart'

export type ItemFormProblems = Partial<Record<ItemFormField, ItemFormProblem>>

/** A blank form for a new item, due `day`. */
export function newItemForm(kind: ItemKind, day: DayKey): ItemForm {
  return {
    kind,
    title: '',
    date: day,
    time: '',
    endTime: '',
    location: '',
    notes: '',
    assigneeId: null,
    repeat: 'none',
    until: '',
  }
}

/** The form for editing `item`, with its times in `timeZone`. */
export function itemToForm(item: Item, timeZone: string): ItemForm {
  const kind: ItemKind = item.kind === 'appointment' ? 'appointment' : 'task'
  const time = timeOfDay(item.starts_at, timeZone)
  return {
    kind,
    title: item.title,
    date: dayKey(item.starts_at, timeZone),
    time: hasNoTime(item, timeZone) ? '' : time,
    endTime: kind === 'appointment' && item.ends_at ? timeOfDay(item.ends_at, timeZone) : '',
    location: kind === 'appointment' ? (item.location ?? '') : '',
    notes: item.private_notes ?? '',
    assigneeId: null,
    repeat: 'none',
    until: '',
  }
}

/** Characters as Postgres counts them (code points, not UTF-16 units). */
function length(value: string): number {
  return [...value].length
}

/** What's wrong with the form, by field. Empty when it can be saved. */
export function validateItemForm(form: ItemForm): ItemFormProblems {
  const problems: ItemFormProblems = {}
  const title = form.title.trim()
  if (!title) problems.title = 'titleRequired'
  else if (length(title) > limits.title) problems.title = 'titleTooLong'
  if (!isDayKey(form.date)) problems.date = 'dateRequired'
  if (form.kind === 'appointment') {
    if (!isTimeOfDay(form.time)) problems.time = 'timeRequired'
    else if (isTimeOfDay(form.endTime) && form.endTime < form.time) problems.endTime = 'endBeforeStart'
    if (length(form.location.trim()) > limits.location) problems.location = 'locationTooLong'
  }
  if (length(form.notes.trim()) > limits.notes) problems.notes = 'notesTooLong'
  if (form.repeat !== 'none' && isDayKey(form.until) && isDayKey(form.date) && form.until < form.date) {
    problems.until = 'untilBeforeStart'
  }
  return problems
}

/** When the item starts (a task's due time) and, for an appointment, ends. */
export function formTimes(form: ItemForm, timeZone: string): { starts_at: string; ends_at: string | null } {
  if (form.kind === 'task') {
    const time = isTimeOfDay(form.time) ? form.time : END_OF_DAY
    return { starts_at: instantAt(form.date, time, timeZone).toISOString(), ends_at: null }
  }
  return {
    starts_at: instantAt(form.date, form.time, timeZone).toISOString(),
    ends_at: isTimeOfDay(form.endTime)
      ? instantAt(form.date, form.endTime, timeZone).toISOString()
      : null,
  }
}

const orNull = (value: string) => value.trim() || null

/**
 * create_item's arguments for a valid form. A repeat ends at the end of its
 * Until day in the circle's time zone, so an occurrence that day is included.
 */
export function createItemArgs(form: ItemForm, timeZone: string): CreateItemArgs {
  const { starts_at, ends_at } = formTimes(form, timeZone)
  const location = form.kind === 'appointment' ? orNull(form.location) : null
  const notes = orNull(form.notes)
  const repeat = form.repeat === 'none' ? null : form.repeat
  const until = repeat && isDayKey(form.until) ? instantAt(form.until, END_OF_DAY, timeZone).toISOString() : null
  return {
    kind: form.kind,
    title: form.title.trim(),
    starts_at,
    ...(ends_at && { ends_at }),
    ...(location && { location }),
    ...(notes && { private_notes: notes }),
    ...(form.assigneeId && { assignee_id: form.assigneeId }),
    ...(repeat && { repeat }),
    ...(until && { until }),
  }
}

/**
 * The update_item patch for a valid form: only the fields that changed.
 * Times are compared as the form shows them (date and 'HH:MM'), so a stored
 * time with seconds isn't moved, or sent back to its owner to confirm
 * (BR-11), unless the member actually changed it.
 */
export function itemPatch(form: ItemForm, item: Item, timeZone: string): ItemPatch {
  const patch: ItemPatch = {}
  const title = form.title.trim()
  if (title !== item.title) patch.title = title

  const before = itemToForm(item, timeZone)
  const { starts_at, ends_at } = formTimes(form, timeZone)
  const dateChanged = form.date !== before.date
  if (dateChanged || form.time !== before.time) patch.starts_at = starts_at
  if (form.kind === 'appointment' && (dateChanged || form.endTime !== before.endTime)) {
    patch.ends_at = ends_at
  }

  if (form.kind === 'appointment') {
    const location = orNull(form.location)
    if (location !== (item.location ?? null)) patch.location = location
  }
  const notes = orNull(form.notes)
  if (notes !== (item.private_notes ?? null)) patch.private_notes = notes
  return patch
}

/**
 * Whether saving `patch` sends the item back to its owner to confirm (BR-11):
 * someone else changed the date or time of an Assigned item.
 */
export function needsReconfirm(
  patch: ItemPatch,
  item: Pick<Item, 'state' | 'owner_id'>,
  viewerId: string,
): boolean {
  return (
    item.state === 'assigned' &&
    item.owner_id !== null &&
    item.owner_id !== viewerId &&
    ('starts_at' in patch || 'ends_at' in patch)
  )
}

// Dates in the circle's time zone (BR-09: one time zone per circle, from
// circles.time_zone), not the phone's. Calendar days are passed around as
// 'YYYY-MM-DD' day keys, so moving between days and weeks is plain calendar
// arithmetic and never trips over a daylight-saving change.

/** A calendar day, 'YYYY-MM-DD'. */
export type DayKey = string

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string) {
  let formatter = partsFormatters.get(timeZone)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormatters.set(timeZone, formatter)
  }
  return formatter
}

/** The wall-clock date and time at `date` in `timeZone`. */
function wallClock(date: Date, timeZone: string) {
  const parts: Record<string, number> = {}
  for (const { type, value } of partsFormatter(timeZone).formatToParts(date)) {
    if (type !== 'literal') parts[type] = Number(value)
  }
  return parts as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

function pad(value: number, length = 2) {
  return String(value).padStart(length, '0')
}

function parseDayKey(day: DayKey) {
  const match = DAY_KEY.exec(day)
  if (!match) throw new RangeError(`Not a day key: ${day}`)
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/** Whether `value` is a real 'YYYY-MM-DD' day, e.g. from a URL. */
export function isDayKey(value: string | null | undefined): value is DayKey {
  if (!value || !DAY_KEY.test(value)) return false
  const { year, month, day } = parseDayKey(value)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

/** The calendar day `date` falls on in `timeZone`. */
export function dayKey(date: Date | string, timeZone: string): DayKey {
  const { year, month, day } = wallClock(new Date(date), timeZone)
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

/** The hour of the day (0–23) at `date` in `timeZone`. */
export function hourOf(date: Date, timeZone: string): number {
  return wallClock(date, timeZone).hour
}

/** The day `days` after (or before, if negative) `day`. */
export function addDays(day: DayKey, days: number): DayKey {
  const { year, month, day: date } = parseDayKey(day)
  const next = new Date(Date.UTC(year, month - 1, date + days))
  return `${pad(next.getUTCFullYear(), 4)}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}`
}

/** Day of the week, 1 = Monday … 7 = Sunday. */
function isoWeekday(day: DayKey): number {
  const { year, month, day: date } = parseDayKey(day)
  return new Date(Date.UTC(year, month - 1, date)).getUTCDay() || 7
}

/** The Monday of the week (Monday to Sunday) that `day` is in. */
export function weekStartOf(day: DayKey): DayKey {
  return addDays(day, 1 - isoWeekday(day))
}

/** The Monday of the week `date` falls in, in `timeZone`. */
export function weekStart(date: Date, timeZone: string): DayKey {
  return weekStartOf(dayKey(date, timeZone))
}

/** The instant midnight starts `day` in `timeZone`. */
export function startOfDay(day: DayKey, timeZone: string): Date {
  const { year, month, day: date } = parseDayKey(day)
  const wanted = Date.UTC(year, month - 1, date)
  // Guess the UTC offset, then correct it once: the offset at the answer can
  // differ from the offset at the guess when a daylight-saving change is near.
  let instant = wanted
  for (let i = 0; i < 2; i++) {
    const clock = wallClock(new Date(instant), timeZone)
    const shown = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second)
    instant += wanted - shown
  }
  return new Date(instant)
}

export interface Week {
  /** Monday, then each day to Sunday. */
  days: DayKey[]
  /** Midnight Monday in the circle's time zone (inclusive). */
  start: Date
  /** Midnight the following Monday (exclusive). */
  end: Date
}

/** The seven days from Monday `monday`, and the instants the week starts and ends. */
export function weekOf(monday: DayKey, timeZone: string): Week {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  return {
    days,
    start: startOfDay(monday, timeZone),
    end: startOfDay(addDays(monday, 7), timeZone),
  }
}

/** Items grouped by the day they start on in `timeZone`, in time order. */
export function groupByDay<T extends { starts_at: string }>(
  items: readonly T[],
  timeZone: string,
): Map<DayKey, T[]> {
  const sorted = [...items].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
  )
  const groups = new Map<DayKey, T[]>()
  for (const item of sorted) {
    const key = dayKey(item.starts_at, timeZone)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }
  return groups
}

// Formatting. Day keys are formatted as UTC noon, so the calendar day shown
// is the day key's, whatever the phone's time zone.

function dayKeyDate(day: DayKey) {
  const { year, month, day: date } = parseDayKey(day)
  return new Date(Date.UTC(year, month - 1, date, 12))
}

/** "Mon 22" */
export function formatDayShort(day: DayKey, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    dayKeyDate(day),
  )
}

/** "Wednesday 24" */
export function formatDayLong(day: DayKey, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', timeZone: 'UTC' }).format(
    dayKeyDate(day),
  )
}

/** "September" */
export function formatMonth(day: DayKey, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(dayKeyDate(day))
}

/** Whether two days are in the same month. */
export function sameMonth(a: DayKey, b: DayKey): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

/** The time of day at `date` in `timeZone`, e.g. "5:00 p.m." */
export function formatTime(date: Date | string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(
    new Date(date),
  )
}

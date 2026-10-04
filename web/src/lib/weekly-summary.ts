import type { TFunction } from 'i18next'
import type { WeeklySummaryLine } from './api'
import { addDays, dayKey, formatDate, formatTime, hourOf, timeOfDay, weekStart, type DayKey } from './dates'

// The Summary tab (task 4.5g, wireframe 14, ADR-016, PRD US 10.3). The
// weekly_summary RPC returns structured lines; this turns each one into a
// fixed en-CA sentence. Sentences only ever name items and people, and say
// when: they never interpret anything, and update text never reaches them
// (the RPC only counts updates). Days are in the circle's time zone (BR-09).

export const SUMMARY_KINDS = [
  'completed',
  'missed',
  'unowned',
  'overdue',
  'needs_someone',
  'updates',
] as const
export type SummaryKind = (typeof SUMMARY_KINDS)[number]

/** One line of the summary. Nulls as the RPC sends them. */
export interface SummaryLine {
  kind: SummaryKind
  item_id: string | null
  item_title: string | null
  /** Who did it or is on it; null for nobody, or for a former member. */
  person_id: string | null
  at: string | null
  count: number | null
}

/** "What happened" kinds, then "What's still open" kinds. */
const HAPPENED: readonly SummaryKind[] = ['completed', 'missed', 'unowned', 'updates']
const OPEN: readonly SummaryKind[] = ['overdue', 'needs_someone']

function isSummaryKind(kind: string): kind is SummaryKind {
  return (SUMMARY_KINDS as readonly string[]).includes(kind)
}

/** The RPC's rows as summary lines, skipping any kind this app doesn't know yet. */
export function toSummaryLines(rows: readonly WeeklySummaryLine[]): SummaryLine[] {
  return rows.flatMap((row) =>
    isSummaryKind(row.kind)
      ? [
          {
            kind: row.kind,
            item_id: row.item_id ?? null,
            item_title: row.item_title ?? null,
            person_id: row.person_id ?? null,
            at: row.at ?? null,
            count: row.count ?? null,
          },
        ]
      : [],
  )
}

/** The lines split into the two cards, keeping the RPC's order. */
export function summarySections(lines: readonly SummaryLine[]): {
  happened: SummaryLine[]
  open: SummaryLine[]
} {
  return {
    happened: lines.filter((line) => HAPPENED.includes(line.kind)),
    open: lines.filter((line) => OPEN.includes(line.kind)),
  }
}

/**
 * The Monday of the most recent summary: this week from 08:00 on Sunday in
 * the circle's time zone (when the "ready" notification goes out), and last
 * week before that.
 */
export function latestSummaryWeek(now: Date, timeZone: string): DayKey {
  const monday = weekStart(now, timeZone)
  const sunday = addDays(monday, 6)
  return dayKey(now, timeZone) === sunday && hourOf(now, timeZone) >= 8 ? monday : addDays(monday, -7)
}

export interface SentenceContext {
  t: TFunction
  /** e.g. 'en-CA' */
  locale: string
  /** The circle's time zone. */
  timeZone: string
  /** First names by user ID (lib/items.ts memberNames). */
  names: ReadonlyMap<string, string>
}

/** "Wednesday", in the circle's time zone. */
function weekday(at: string, { locale, timeZone }: SentenceContext): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone }).format(new Date(at))
}

/** "Wednesday, October 1", plus the time unless it's a task with no time (23:59). */
function when(at: string, { t, locale, timeZone }: SentenceContext): string {
  const date = formatDate(at, timeZone, locale)
  if (timeOfDay(at, timeZone) === '23:59') return date
  return t('share.dateTime', { date, time: formatTime(at, timeZone, locale) })
}

/** A person's first name; someone no longer in the circle is a former member. */
function personName(personId: string | null, ctx: SentenceContext): string {
  return (personId && ctx.names.get(personId)) || ctx.t('summary.formerMember')
}

/** The fixed en-CA sentence for one line. */
export function summarySentence(line: SummaryLine, ctx: SentenceContext): string {
  const { t } = ctx
  const title = line.item_title ?? ''
  const at = line.at ?? ''
  switch (line.kind) {
    case 'completed':
      return t('summary.line.completed', { name: personName(line.person_id, ctx), title, day: weekday(at, ctx) })
    case 'missed':
      return t('summary.line.missed', { name: personName(line.person_id, ctx), title, day: weekday(at, ctx) })
    case 'unowned':
      return t('summary.line.unowned', { title, day: weekday(at, ctx) })
    case 'overdue':
      return line.person_id
        ? t('summary.line.overdue', {
            name: personName(line.person_id, ctx),
            title,
            date: formatDate(at, ctx.timeZone, ctx.locale),
          })
        : t('summary.line.overdueNobody', { title, date: formatDate(at, ctx.timeZone, ctx.locale) })
    case 'needs_someone':
      return t('summary.line.needsSomeone', { title, when: when(at, ctx) })
    case 'updates':
      return t('summary.line.updates', { name: personName(line.person_id, ctx), count: line.count ?? 0 })
  }
}

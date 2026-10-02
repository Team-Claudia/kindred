// Builds the .ics text for a member's calendar feed (task 3.4, ADR-008,
// RFC 5545). Pure: no network, no environment, so the Deno tests cover it.
//
// The database (calendar_feed_for_token) picks the member's items; this module
// turns them into events with a title, a time and a Kindred link, never notes,
// location or updates (US 5.2). As a second check it also drops anything that
// isn't accepted (see FEED_STATES).

export interface FeedItem {
  id: string
  kind: 'task' | 'appointment'
  state: string
  title: string
  starts_at: string
  ends_at: string | null
  updated_at: string
  version: number
}

export interface Feed {
  /** The care recipient's name, e.g. "Dad"; null if the member has no circle. */
  careRecipientName: string | null
  /** The circle's IANA time zone, used for tasks with no time (all-day). */
  timeZone: string
  /** The app's origin, e.g. "https://kindred.example", for /i/<id> links. */
  appUrl: string
  items: FeedItem[]
  /** When the feed was built (DTSTAMP). */
  now: Date
}

/** A task with no time is saved at this time in the circle's zone (web/src/lib/item-form.ts). */
const END_OF_DAY = '23:59'
/**
 * Accepted items: Assigned, or Needs coverage (still the owner's until someone
 * takes it). Never Awaiting acceptance (BR-05), Completed or Cancelled.
 */
export const FEED_STATES: ReadonlySet<string> = new Set(['assigned', 'needs_coverage'])

const HOUR = 60 * 60 * 1000
const TASK_MINUTES = 15 * 60 * 1000

/** Escapes a TEXT value (RFC 5545 §3.3.11). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

const encoder = new TextEncoder()

/**
 * Folds a content line so no line is longer than 75 octets (RFC 5545 §3.1),
 * never splitting a UTF-8 character. Continuation lines start with a space.
 */
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line
  const parts: string[] = []
  let current = ''
  let octets = 0
  // The first line holds 75 octets; continuations hold 74 after the space.
  let limit = 75
  for (const char of line) {
    const size = encoder.encode(char).length
    if (octets + size > limit) {
      parts.push(current)
      current = ''
      octets = 0
      limit = 74
    }
    current += char
    octets += size
  }
  parts.push(current)
  return parts.join('\r\n ')
}

/** A UTC date-time, e.g. 20261017T153000Z. */
export function utcStamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** The calendar day and wall-clock time of `date` in `timeZone`. */
function wallClock(date: Date, timeZone: string) {
  const parts: Record<string, string> = {}
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  for (const { type, value } of formatter.formatToParts(date)) parts[type] = value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    time: `${parts.hour}:${parts.minute}`,
  }
}

function dateValue(year: number, month: number, day: number): string {
  // Date.UTC rolls over month ends, so day + 1 is always a real date.
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10).replace(/-/g, '')
}

/** The calendar name, e.g. "Kindred: Dad's care". */
export function calendarName(careRecipientName: string | null): string {
  const name = careRecipientName?.trim()
  return name ? `Kindred: ${name}'s care` : 'Kindred'
}

/** The DTSTART and DTEND lines for one item. */
function eventTimes(item: FeedItem, timeZone: string): string[] {
  const start = new Date(item.starts_at)
  if (item.kind === 'task') {
    const local = wallClock(start, timeZone)
    if (local.time === END_OF_DAY) {
      // No time: an all-day event on its date. DTEND is the next day (exclusive).
      return [
        `DTSTART;VALUE=DATE:${dateValue(local.year, local.month, local.day)}`,
        `DTEND;VALUE=DATE:${dateValue(local.year, local.month, local.day + 1)}`,
      ]
    }
    return [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(new Date(start.getTime() + TASK_MINUTES))}`]
  }
  const end = item.ends_at ? new Date(item.ends_at) : null
  const until = end && end.getTime() > start.getTime() ? end : new Date(start.getTime() + HOUR)
  return [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(until)}`]
}

/** The whole feed as RFC 5545 text, with CRLF line endings. */
export function buildCalendar(feed: Feed): string {
  const appUrl = feed.appUrl.replace(/\/+$/, '')
  const stamp = utcStamp(feed.now)
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kindred//Calendar feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName(feed.careRecipientName))}`,
    // Hints for how often to refresh. Apple and Google mostly use their own timetable.
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    'X-PUBLISHED-TTL:PT15M',
  ]
  for (const item of feed.items) {
    if (!FEED_STATES.has(item.state)) continue
    const link = `${appUrl}/i/${item.id}`
    lines.push(
      'BEGIN:VEVENT',
      `UID:${item.id}@kindred`,
      `DTSTAMP:${stamp}`,
      `LAST-MODIFIED:${utcStamp(new Date(item.updated_at))}`,
      `SEQUENCE:${Math.max(0, item.version - 1)}`,
      ...eventTimes(item, feed.timeZone),
      `SUMMARY:${escapeText(item.title)}`,
      `URL:${link}`,
      `DESCRIPTION:${escapeText(`Open in Kindred: ${link}`)}`,
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

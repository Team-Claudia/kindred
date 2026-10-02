// Tests for the .ics builder (task 3.4). Run with:
//   deno test supabase/functions/calendar-feed/
import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1'
import { buildCalendar, calendarName, escapeText, foldLine, type Feed, type FeedItem } from './ics.ts'

const NOW = new Date('2026-10-02T12:00:00Z')

function item(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    kind: 'appointment',
    state: 'assigned',
    title: 'Physio',
    starts_at: '2026-10-17T17:30:00+00:00',
    ends_at: '2026-10-17T18:15:00+00:00',
    updated_at: '2026-10-01T09:00:00+00:00',
    version: 3,
    ...overrides,
  }
}

function feed(items: FeedItem[], overrides: Partial<Feed> = {}): string {
  return buildCalendar({
    careRecipientName: 'Dad',
    timeZone: 'America/Vancouver',
    appUrl: 'https://kindred.example/',
    items,
    now: NOW,
    ...overrides,
  })
}

/** The unfolded content lines of a feed. */
function lines(ics: string): string[] {
  return ics.replace(/\r\n /g, '').split('\r\n').filter(Boolean)
}

/** The lines of the one VEVENT in a feed. */
function event(ics: string): string[] {
  const all = lines(ics)
  return all.slice(all.indexOf('BEGIN:VEVENT') + 1, all.indexOf('END:VEVENT'))
}

Deno.test('escapes backslashes, semicolons, commas and newlines', () => {
  assertEquals(escapeText('a\\b;c,d\ne\r\nf'), 'a\\\\b\\;c\\,d\\ne\\nf')
})

Deno.test('leaves short lines alone', () => {
  const line = 'SUMMARY:' + 'x'.repeat(67)
  assertEquals(foldLine(line), line)
})

Deno.test('folds long lines at 75 octets with a leading space', () => {
  const line = 'SUMMARY:' + 'x'.repeat(200)
  const folded = foldLine(line).split('\r\n')
  assert(folded.length > 1)
  for (const [i, part] of folded.entries()) {
    assert(new TextEncoder().encode(part).length <= 75, `line ${i} is too long`)
    if (i > 0) assert(part.startsWith(' '))
  }
  assertEquals(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join(''), line)
})

Deno.test('never splits a multi-byte character when folding', () => {
  const line = 'SUMMARY:' + 'é😀'.repeat(40)
  const folded = foldLine(line).split('\r\n')
  for (const part of folded) {
    assert(new TextEncoder().encode(part).length <= 75)
    assert(!part.includes('�'))
  }
  assertEquals(folded.map((part, i) => (i === 0 ? part : part.slice(1))).join(''), line)
})

Deno.test('every line ends with CRLF and none is longer than 75 octets', () => {
  const ics = feed([item({ title: 'A very long title, with commas; and semicolons '.repeat(5) })])
  assert(ics.endsWith('\r\n'))
  assert(!/[^\r]\n/.test(ics), 'bare LF found')
  for (const line of ics.split('\r\n')) assert(new TextEncoder().encode(line).length <= 75)
})

Deno.test('the calendar is named after the care recipient', () => {
  assertEquals(calendarName('Dad'), "Kindred: Dad's care")
  assertEquals(calendarName(null), 'Kindred')
  assertEquals(calendarName('  '), 'Kindred')
  assertStringIncludes(feed([]), "X-WR-CALNAME:Kindred: Dad's care\r\n")
  assertStringIncludes(feed([], { careRecipientName: 'Mum, Dad' }), 'X-WR-CALNAME:Kindred: Mum\\, Dad\'s care')
})

Deno.test('an empty feed is still a valid calendar', () => {
  const all = lines(feed([]))
  assertEquals(all[0], 'BEGIN:VCALENDAR')
  assertEquals(all.at(-1), 'END:VCALENDAR')
  assert(all.includes('VERSION:2.0'))
  assert(all.some((line) => line.startsWith('PRODID:')))
  assert(!all.includes('BEGIN:VEVENT'))
})

Deno.test('an appointment has its UID, title, UTC times and a Kindred link', () => {
  const lines = event(feed([item({ title: 'Physio, room 3' })]))
  const id = '11111111-1111-1111-1111-111111111111'
  assertEquals(lines, [
    `UID:${id}@kindred`,
    'DTSTAMP:20261002T120000Z',
    'LAST-MODIFIED:20261001T090000Z',
    'SEQUENCE:2',
    'DTSTART:20261017T173000Z',
    'DTEND:20261017T181500Z',
    'SUMMARY:Physio\\, room 3',
    `URL:https://kindred.example/i/${id}`,
    `DESCRIPTION:Open in Kindred: https://kindred.example/i/${id}`,
  ])
})

Deno.test('an appointment with no end time lasts an hour', () => {
  const lines = event(feed([item({ ends_at: null })]))
  assert(lines.includes('DTSTART:20261017T173000Z'))
  assert(lines.includes('DTEND:20261017T183000Z'))
})

Deno.test('a task with a time is a 15-minute event', () => {
  const lines = event(feed([item({ kind: 'task', starts_at: '2026-10-17T16:00:00Z', ends_at: null })]))
  assert(lines.includes('DTSTART:20261017T160000Z'))
  assert(lines.includes('DTEND:20261017T161500Z'))
})

Deno.test('a task with no time is an all-day event on its date in the circle time zone', () => {
  // 23:59 on 17 October in Vancouver (PDT, UTC-7) is 06:59 on the 18th in UTC.
  const lines = event(feed([item({ kind: 'task', starts_at: '2026-10-18T06:59:00Z', ends_at: null })]))
  assert(lines.includes('DTSTART;VALUE=DATE:20261017'))
  assert(lines.includes('DTEND;VALUE=DATE:20261018'))
})

Deno.test('an all-day task at the end of a month ends on the 1st', () => {
  // 23:59 on 31 October in Toronto (EDT, UTC-4).
  const lines = event(
    feed([item({ kind: 'task', starts_at: '2026-11-01T03:59:00Z', ends_at: null })], {
      timeZone: 'America/Toronto',
    }),
  )
  assert(lines.includes('DTSTART;VALUE=DATE:20261031'))
  assert(lines.includes('DTEND;VALUE=DATE:20261101'))
})

Deno.test('an appointment at 23:59 is not all-day', () => {
  const lines = event(feed([item({ starts_at: '2026-10-18T06:59:00Z', ends_at: null })]))
  assert(lines.includes('DTSTART:20261018T065900Z'))
})

Deno.test('includes accepted items only, one VEVENT each', () => {
  // calendar_feed_for_token already filters (pgTAP); this is the second check.
  const states = ['needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage', 'completed', 'cancelled']
  const ics = feed(states.map((state) => item({ id: state, state })))
  assertEquals(lines(ics).filter((line) => line === 'BEGIN:VEVENT').length, 2)
  assertStringIncludes(ics, 'UID:assigned@kindred')
  assertStringIncludes(ics, 'UID:needs_coverage@kindred')
})

Deno.test('never includes notes, location or updates', () => {
  const extra = { private_notes: 'Secret note', location: '12 Main St', updates: ['Went well'] }
  const ics = feed([{ ...item(), ...extra } as FeedItem])
  for (const text of ['Secret note', '12 Main St', 'Went well', 'LOCATION']) {
    assert(!ics.includes(text), `${text} leaked into the feed`)
  }
})

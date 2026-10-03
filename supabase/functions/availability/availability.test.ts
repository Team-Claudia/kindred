// Tests for "Who's free?" (task 4.5a). Run with:
//   deno test supabase/functions/availability/
import { assertEquals } from 'jsr:@std/assert@1'
import {
  cacheKey,
  freeBusyRequest,
  MAX_SLOT_MS,
  parseRequest,
  statusFromFreeBusy,
  TtlCache,
  type Slot,
} from './availability.ts'

const CIRCLE = '10000000-0000-0000-0000-000000000001'
// 9:30 to 10:30 in Toronto on a Friday.
const SLOT: Slot = { start: new Date('2026-10-16T13:30:00Z'), end: new Date('2026-10-16T14:30:00Z') }

function reply(busy: unknown, errors?: unknown) {
  return { kind: 'calendar#freeBusy', calendars: { primary: { busy, ...(errors ? { errors } : {}) } } }
}

Deno.test('no busy periods is free', () => {
  assertEquals(statusFromFreeBusy(reply([]), SLOT), 'free')
})

Deno.test('a busy period overlapping the slot is busy', () => {
  assertEquals(
    statusFromFreeBusy(reply([{ start: '2026-10-16T14:00:00Z', end: '2026-10-16T15:00:00Z' }]), SLOT),
    'busy',
  )
  assertEquals(
    statusFromFreeBusy(reply([{ start: '2026-10-16T12:00:00Z', end: '2026-10-16T16:00:00Z' }]), SLOT),
    'busy',
    'a period covering the whole slot',
  )
  assertEquals(
    statusFromFreeBusy(reply([{ start: '2026-10-16T09:31:00-04:00', end: '2026-10-16T09:45:00-04:00' }]), SLOT),
    'busy',
    'times with an offset',
  )
})

Deno.test('a busy period that only touches the slot is free', () => {
  assertEquals(
    statusFromFreeBusy(
      reply([
        { start: '2026-10-16T12:30:00Z', end: '2026-10-16T13:30:00Z' },
        { start: '2026-10-16T14:30:00Z', end: '2026-10-16T15:00:00Z' },
      ]),
      SLOT,
    ),
    'free',
  )
})

Deno.test('a calendar error is unknown', () => {
  assertEquals(statusFromFreeBusy(reply([], [{ domain: 'global', reason: 'notFound' }]), SLOT), 'unknown')
})

Deno.test('a reply we can’t read is unknown', () => {
  for (const bad of [null, 'busy', {}, { calendars: {} }, { calendars: { primary: {} } }, reply('x'), reply([null]), reply([{ start: 'soon' }])]) {
    assertEquals(statusFromFreeBusy(bad, SLOT), 'unknown', JSON.stringify(bad))
  }
})

Deno.test('the request asks about the slot and the primary calendar only', () => {
  assertEquals(freeBusyRequest(SLOT), {
    timeMin: '2026-10-16T13:30:00.000Z',
    timeMax: '2026-10-16T14:30:00.000Z',
    items: [{ id: 'primary' }],
  })
})

Deno.test('parseRequest accepts a circle and a slot', () => {
  assertEquals(
    parseRequest({ circle_id: CIRCLE, start: '2026-10-16T13:30:00Z', end: '2026-10-16T14:30:00.000Z' }),
    { circleId: CIRCLE, slot: SLOT },
  )
})

Deno.test('parseRequest refuses anything else', () => {
  const start = '2026-10-16T13:30:00Z'
  const tooLate = new Date(SLOT.start.getTime() + MAX_SLOT_MS + 1).toISOString()
  for (const bad of [
    null,
    'x',
    { start, end: '2026-10-16T14:30:00Z' },
    { circle_id: 'not-a-uuid', start, end: '2026-10-16T14:30:00Z' },
    { circle_id: CIRCLE, start: 'tomorrow', end: '2026-10-16T14:30:00Z' },
    { circle_id: CIRCLE, start, end: start },
    { circle_id: CIRCLE, start: '2026-10-16T14:30:00Z', end: start },
    { circle_id: CIRCLE, start, end: tooLate },
  ]) {
    assertEquals(parseRequest(bad), null, JSON.stringify(bad))
  }
})

Deno.test('the cache keeps an answer for its time to live, then forgets it', () => {
  const cache = new TtlCache<string>()
  const key = cacheKey('member', SLOT)
  cache.set(key, 'busy', 5 * 60 * 1000, 0)
  assertEquals(cache.get(key, 5 * 60 * 1000 - 1), 'busy')
  assertEquals(cache.get(key, 5 * 60 * 1000), undefined)
  assertEquals(cache.get(cacheKey('member', { ...SLOT, end: new Date(0) }), 0), undefined, 'another slot')
})

Deno.test('a full cache drops its oldest entry', () => {
  const cache = new TtlCache<number>(2)
  cache.set('a', 1, 1000, 0)
  cache.set('b', 2, 1000, 0)
  cache.set('c', 3, 1000, 0)
  assertEquals([cache.get('a', 0), cache.get('b', 0), cache.get('c', 0)], [undefined, 2, 3])
})

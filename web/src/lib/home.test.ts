import { countByKind, isOverdue, type Item } from './items'
import {
  coverageRequests,
  homeCounts,
  needsSomeone,
  needsYourAnswer,
  relativeDay,
  timeOfDay,
  todayItems,
  uniqueById,
} from './home'

const zone = 'America/Vancouver'
// Thursday 24 September 2026, 10 am in Vancouver.
const now = new Date('2026-09-24T17:00:00Z')
const today = '2026-09-24'

function item(overrides: Partial<Item> & Pick<Item, 'id'>): Item {
  return {
    circle_id: 'circle-1',
    kind: 'task',
    title: overrides.id,
    starts_at: '2026-09-24T21:00:00Z',
    ends_at: null,
    state: 'assigned',
    owner_id: 'maya',
    proposed_assignee_id: null,
    location: null,
    location_lat: null,
    location_lng: null,
    private_notes: null,
    series_id: null,
    occurrence_index: null,
    follow_up_of: null,
    created_by: 'maya',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    version: 1,
    ...overrides,
  }
}

const ids = (items: readonly Pick<Item, 'id'>[]) => items.map((i) => i.id)

const items = [
  // Today (Thursday), Vancouver time.
  item({ id: 'cardiology', kind: 'appointment', starts_at: '2026-09-24T21:00:00Z' }), // 2 pm
  item({ id: 'early', starts_at: '2026-09-24T07:30:00Z' }), // 12:30 am Thu: overdue
  item({ id: 'done-today', starts_at: '2026-09-24T16:00:00Z', state: 'completed' }),
  item({ id: 'cancelled-today', starts_at: '2026-09-24T22:00:00Z', state: 'cancelled' }),
  item({
    id: 'ask-maya-today',
    starts_at: '2026-09-25T00:00:00Z', // Thu 5 pm
    state: 'awaiting_acceptance',
    owner_id: null,
    proposed_assignee_id: 'maya',
  }),
  // Wednesday 23, after midnight UTC on the 24th: still yesterday in Vancouver.
  item({ id: 'meds', starts_at: '2026-09-24T00:00:00Z', owner_id: 'jonah' }), // open: overdue
  item({ id: 'done-yesterday', starts_at: '2026-09-23T18:00:00Z', state: 'completed' }),
  item({ id: 'cancelled-yesterday', starts_at: '2026-09-23T18:00:00Z', state: 'cancelled' }),
  item({
    id: 'unclaimed-last-week',
    starts_at: '2026-09-17T18:00:00Z',
    state: 'needs_someone',
    owner_id: null,
  }),
  // Later.
  item({
    id: 'pharmacy',
    starts_at: '2026-09-26T00:00:00Z', // Fri 5 pm
    state: 'awaiting_acceptance',
    owner_id: null,
    proposed_assignee_id: 'maya',
  }),
  item({
    id: 'ask-jonah',
    starts_at: '2026-09-25T18:00:00Z',
    state: 'awaiting_acceptance',
    owner_id: null,
    proposed_assignee_id: 'jonah',
  }),
  item({
    id: 'physio',
    kind: 'appointment',
    starts_at: '2026-09-25T16:30:00Z',
    state: 'needs_someone',
    owner_id: null,
  }),
  item({ id: 'cover-me', starts_at: '2026-09-27T18:00:00Z', state: 'needs_coverage' }),
  // Friday 25 just after midnight Vancouver time: tomorrow, not today.
  item({ id: 'tomorrow-early', starts_at: '2026-09-25T07:05:00Z' }),
]

describe('needsYourAnswer', () => {
  test('is the items awaiting my acceptance, soonest first', () => {
    expect(ids(needsYourAnswer(items, 'maya'))).toEqual(['ask-maya-today', 'pharmacy'])
  })

  test("leaves out other people's requests and items that are mine already", () => {
    expect(ids(needsYourAnswer(items, 'jonah'))).toEqual(['ask-jonah'])
    expect(needsYourAnswer([item({ id: 'mine', proposed_assignee_id: 'maya' })], 'maya')).toEqual([])
  })
})

describe('todayItems', () => {
  const shown = ids(todayItems(items, today, zone, now))

  test("has today's items in the circle's time zone, in time order", () => {
    expect(shown).toEqual([
      'unclaimed-last-week',
      'meds',
      'early',
      'done-today',
      'cardiology',
      'ask-maya-today',
    ])
  })

  test('includes open items from earlier days, which are overdue', () => {
    expect(shown).toContain('meds') // yesterday
    expect(shown).toContain('unclaimed-last-week') // a week ago
  })

  test("leaves out cancelled items and earlier days' finished ones", () => {
    for (const id of ['cancelled-today', 'done-yesterday', 'cancelled-yesterday']) {
      expect(shown).not.toContain(id)
    }
  })

  test('leaves out tomorrow, even when it is already tomorrow in UTC', () => {
    expect(shown).not.toContain('tomorrow-early')
    expect(shown).not.toContain('physio')
  })

  test('lists an item once when two queries both return it', () => {
    expect(ids(todayItems([...items, ...items], today, zone, now))).toEqual(shown)
  })
})

describe('needsSomeone', () => {
  test('is every unclaimed item, overdue ones first', () => {
    expect(ids(needsSomeone(items))).toEqual(['unclaimed-last-week', 'physio'])
  })
})

describe('coverageRequests', () => {
  test('is the items that need cover', () => {
    expect(ids(coverageRequests(items))).toEqual(['cover-me'])
  })
})

describe('homeCounts', () => {
  test("counts this week's tasks and appointments as This week does", () => {
    const week = items.filter((i) => i.starts_at >= '2026-09-21T07:00:00Z')
    const counts = homeCounts(week, todayItems(items, today, zone, now), now)
    expect({ tasks: counts.tasks, appointments: counts.appointments }).toEqual(countByKind(week))
    expect(counts.appointments).toBe(2)
  })

  test("counts every overdue item, as This week's Overdue badge shows them", () => {
    const shownToday = todayItems(items, today, zone, now)
    const counts = homeCounts([], shownToday, now)
    expect(counts.overdue).toBe(items.filter((i) => isOverdue(i, now)).length)
    expect(counts.overdue).toBe(3) // meds, early, unclaimed-last-week
  })

  test('is all zero for a new circle', () => {
    expect(homeCounts([], [], now)).toEqual({ tasks: 0, appointments: 0, overdue: 0 })
  })
})

test('uniqueById keeps the first copy and sorts by time', () => {
  const a = item({ id: 'a', starts_at: '2026-09-24T20:00:00Z', title: 'first' })
  const b = item({ id: 'b', starts_at: '2026-09-24T19:00:00Z' })
  expect(uniqueById([a], [b, { ...a, title: 'second' }]).map((i) => [i.id, i.title])).toEqual([
    ['b', 'b'],
    ['a', 'first'],
  ])
})

test('timeOfDay uses the circle time zone', () => {
  expect(timeOfDay(now, zone)).toBe('morning') // 10 am in Vancouver
  expect(timeOfDay(new Date('2026-09-24T21:00:00Z'), zone)).toBe('afternoon') // 2 pm
  expect(timeOfDay(new Date('2026-09-25T03:00:00Z'), zone)).toBe('evening') // 8 pm
  expect(timeOfDay(new Date('2026-09-24T09:00:00Z'), zone)).toBe('evening') // 2 am
})

test('relativeDay names nearby days', () => {
  expect(relativeDay('2026-09-24', today)).toBe('today')
  expect(relativeDay('2026-09-25', today)).toBe('tomorrow')
  expect(relativeDay('2026-09-23', today)).toBe('yesterday')
  expect(relativeDay('2026-09-29', today)).toBe('week')
  expect(relativeDay('2026-09-18', today)).toBe('week')
  expect(relativeDay('2026-10-01', today)).toBe('later')
  expect(relativeDay('2026-09-17', today)).toBe('later')
})

import i18n from '@/i18n'
import type { WeeklySummaryLine } from './api'
import { weeklySummaryShare } from './share-text'
import {
  latestSummaryWeek,
  summarySections,
  summarySentence,
  toSummaryLines,
  type SummaryLine,
} from './weekly-summary'

// Toronto still changes its clocks (CI's time zone data has no Vancouver
// change after March 2026): it falls back at 2 am on Sunday 1 November 2026.
const timeZone = 'America/Toronto'
const names = new Map([
  ['maya', 'Maya'],
  ['jonah', 'Jonah'],
])
const ctx = { t: i18n.t, locale: 'en-CA', timeZone, names }

function line(overrides: Partial<SummaryLine> & Pick<SummaryLine, 'kind'>): SummaryLine {
  return { item_id: 'item', item_title: null, person_id: null, at: null, count: null, ...overrides }
}

describe('latestSummaryWeek', () => {
  test('is last week until 08:00 on Sunday in the circle time zone, then this week', () => {
    // Sunday 1 November 2026: 07:59 EST is 12:59 UTC (it would be 11:59 before the change).
    expect(latestSummaryWeek(new Date('2026-11-01T12:59:00Z'), timeZone)).toBe('2026-10-19')
    expect(latestSummaryWeek(new Date('2026-11-01T13:00:00Z'), timeZone)).toBe('2026-10-26')
    expect(latestSummaryWeek(new Date('2026-11-01T23:59:00Z'), timeZone)).toBe('2026-10-26')
  })

  test('the rest of the week shows the summary made last Sunday', () => {
    expect(latestSummaryWeek(new Date('2026-11-02T15:00:00Z'), timeZone)).toBe('2026-10-26') // Monday
    expect(latestSummaryWeek(new Date('2026-11-07T23:00:00Z'), timeZone)).toBe('2026-10-26') // Saturday
  })

  test('the day is the circle time zone day, not UTC', () => {
    // 03:00 UTC on Monday 2 November is still Sunday evening in Toronto.
    expect(latestSummaryWeek(new Date('2026-11-02T03:00:00Z'), timeZone)).toBe('2026-10-26')
  })
})

describe('summarySentence', () => {
  test('completed: who did what, and the day in the circle time zone', () => {
    expect(
      summarySentence(
        line({ kind: 'completed', item_title: 'Groceries drop-off', person_id: 'maya', at: '2026-10-28T16:00:00Z' }),
        ctx,
      ),
    ).toBe('Maya did “Groceries drop-off” on Wednesday.')
    // 02:00 UTC Thursday is Wednesday evening in Toronto.
    expect(
      summarySentence(
        line({ kind: 'completed', item_title: 'Pharmacy call', person_id: null, at: '2026-10-29T02:00:00Z' }),
        ctx,
      ),
    ).toBe('A former member did “Pharmacy call” on Wednesday.')
  })

  test('missed and unowned appointments', () => {
    expect(
      summarySentence(
        line({ kind: 'missed', item_title: 'Dentist', person_id: 'jonah', at: '2026-10-30T14:00:00Z' }),
        ctx,
      ),
    ).toBe('Jonah had “Dentist” on Friday, but it wasn\'t marked done.')
    expect(
      summarySentence(line({ kind: 'unowned', item_title: 'Physio ride', at: '2026-10-30T13:30:00Z' }), ctx),
    ).toBe('Nobody took “Physio ride” on Friday.')
  })

  test('overdue: who has it, or nobody', () => {
    expect(
      summarySentence(
        line({ kind: 'overdue', item_title: 'Refill meds', person_id: 'jonah', at: '2026-10-28T21:00:00Z' }),
        ctx,
      ),
    ).toBe('“Refill meds”: Jonah has it, overdue since Wednesday, October 28.')
    expect(
      summarySentence(line({ kind: 'overdue', item_title: 'Paperwork', at: '2026-10-28T21:00:00Z' }), ctx),
    ).toBe('“Paperwork”: nobody has it, overdue since Wednesday, October 28.')
  })

  test('needs someone: when, with the time unless the task has none', () => {
    // 9:30 am EST, after the clocks went back.
    expect(
      summarySentence(line({ kind: 'needs_someone', item_title: 'Physio ride', at: '2026-11-04T14:30:00Z' }), ctx),
    ).toBe('“Physio ride” on Wednesday, November 4 at 9:30 a.m. needs someone.')
    // 23:59 in the circle time zone is a task with no time.
    expect(
      summarySentence(line({ kind: 'needs_someone', item_title: 'Laundry', at: '2026-11-05T04:59:00Z' }), ctx),
    ).toBe('“Laundry” on Wednesday, November 4 needs someone.')
  })

  test('updates are counted, never quoted', () => {
    expect(summarySentence(line({ kind: 'updates', item_id: null, person_id: 'maya', count: 1 }), ctx)).toBe(
      'Maya posted 1 update.',
    )
    expect(summarySentence(line({ kind: 'updates', item_id: null, person_id: null, count: 3 }), ctx)).toBe(
      'A former member posted 3 updates.',
    )
  })
})

describe('toSummaryLines and summarySections', () => {
  test('splits what happened from what is still open, in order, and skips unknown kinds', () => {
    const rows = [
      { kind: 'completed', item_id: 'a', item_title: 'A', person_id: 'maya', at: '2026-10-28T16:00:00Z', count: null },
      { kind: 'something_new', item_id: 'x', item_title: 'X', person_id: null, at: null, count: null },
      { kind: 'unowned', item_id: 'b', item_title: 'B', person_id: null, at: '2026-10-30T16:00:00Z', count: null },
      { kind: 'overdue', item_id: 'c', item_title: 'C', person_id: 'jonah', at: '2026-10-28T16:00:00Z', count: null },
      { kind: 'needs_someone', item_id: 'd', item_title: 'D', person_id: null, at: '2026-11-04T16:00:00Z', count: null },
      { kind: 'updates', item_id: null, item_title: null, person_id: 'maya', at: '2026-10-29T16:00:00Z', count: 2 },
    ] as unknown as WeeklySummaryLine[]
    const { happened, open } = summarySections(toSummaryLines(rows))
    expect(happened.map((l) => l.kind)).toEqual(['completed', 'unowned', 'updates'])
    expect(open.map((l) => l.item_id)).toEqual(['c', 'd'])
  })
})

describe('weeklySummaryShare', () => {
  const url = 'https://kindred.example/summary?week=2026-10-26'

  test('names items and people only, one fact per line, with the link', () => {
    const lines = [
      line({ kind: 'completed', item_title: 'Groceries drop-off', person_id: 'maya', at: '2026-10-28T16:00:00Z' }),
      line({ kind: 'updates', item_id: null, person_id: 'jonah', count: 2 }),
      line({ kind: 'needs_someone', item_title: 'Physio ride', at: '2026-11-04T14:30:00Z' }),
    ]
    const { happened, open } = summarySections(lines)
    const share = weeklySummaryShare(
      {
        heading: "Dad's care, Mon 26 October – Sun 1 November",
        happened: happened.map((l) => summarySentence(l, ctx)),
        open: open.map((l) => summarySentence(l, ctx)),
      },
      url,
      i18n.t,
    )
    expect(share).toEqual({
      text: [
        "Dad's care, Mon 26 October – Sun 1 November",
        '',
        'What happened',
        '• Maya did “Groceries drop-off” on Wednesday.',
        '• Jonah posted 2 updates.',
        '',
        "What's still open",
        '• “Physio ride” on Wednesday, November 4 at 9:30 a.m. needs someone.',
      ].join('\n'),
      url,
    })
  })

  test('leaves out an empty section, and says so when there is nothing at all', () => {
    expect(weeklySummaryShare({ heading: 'H', happened: [], open: ['Open thing.'] }, url, i18n.t).text).toBe(
      "H\n\nWhat's still open\n• Open thing.",
    )
    expect(weeklySummaryShare({ heading: 'H', happened: [], open: [] }, url, i18n.t).text).toBe(
      'H\n\nNothing to report this week.',
    )
  })
})

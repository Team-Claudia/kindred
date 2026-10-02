import {
  addDays,
  dayKey,
  formatDayLong,
  formatDayShort,
  groupByDay,
  isDayKey,
  startOfDay,
  weekOf,
  weekStart,
  weekStartOf,
} from './dates'

const VANCOUVER = 'America/Vancouver'
// The clocks-go-back tests use Toronto: British Columbia's move to permanent
// daylight time means newer time-zone data has no autumn change in Vancouver
// from 2026, so its result depends on the machine's tz data.
const TORONTO = 'America/Toronto'

describe('day keys', () => {
  test('a day is the calendar day in the circle time zone, not UTC', () => {
    // 6:30 am UTC on Thursday is still Wednesday evening in Vancouver.
    expect(dayKey('2026-09-24T06:30:00Z', VANCOUVER)).toBe('2026-09-23')
    expect(dayKey('2026-09-24T06:30:00Z', 'Europe/London')).toBe('2026-09-24')
  })

  test('adding days crosses months and years', () => {
    expect(addDays('2026-09-28', 3)).toBe('2026-10-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  test('only real dates are day keys', () => {
    expect(isDayKey('2026-09-22')).toBe(true)
    expect(isDayKey('2026-02-30')).toBe(false)
    expect(isDayKey('next week')).toBe(false)
    expect(isDayKey(null)).toBe(false)
  })
})

describe('weeks run Monday to Sunday', () => {
  test('any day finds its Monday', () => {
    expect(weekStartOf('2026-09-21')).toBe('2026-09-21') // Monday
    expect(weekStartOf('2026-09-24')).toBe('2026-09-21') // Thursday
    expect(weekStartOf('2026-09-27')).toBe('2026-09-21') // Sunday
    expect(weekStartOf('2026-09-28')).toBe('2026-09-28') // next Monday
  })

  test('the week follows the circle time zone', () => {
    // Monday 1 am UTC is still Sunday in Vancouver, so it's the week before.
    const instant = new Date('2026-09-28T01:00:00Z')
    expect(weekStart(instant, VANCOUVER)).toBe('2026-09-21')
    expect(weekStart(instant, 'Europe/London')).toBe('2026-09-28')
  })

  test('a normal week is seven 24-hour days from local midnight', () => {
    const week = weekOf('2026-09-21', VANCOUVER)
    expect(week.days).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ])
    expect(week.start.toISOString()).toBe('2026-09-21T07:00:00.000Z')
    expect(week.end.toISOString()).toBe('2026-09-28T07:00:00.000Z')
  })

  test('a week where the clocks go back is an hour longer', () => {
    // Daylight saving ends in Toronto at 2 am on Sunday 1 November 2026.
    const week = weekOf('2026-10-26', TORONTO)
    expect(week.start.toISOString()).toBe('2026-10-26T04:00:00.000Z') // EDT, UTC-4
    expect(week.end.toISOString()).toBe('2026-11-02T05:00:00.000Z') // EST, UTC-5
    expect(week.end.getTime() - week.start.getTime()).toBe((7 * 24 + 1) * 3_600_000)
  })

  test('a week where the clocks go forward is an hour shorter', () => {
    // Daylight saving starts in Vancouver at 2 am on Sunday 8 March 2026.
    const week = weekOf('2026-03-02', VANCOUVER)
    expect(week.start.toISOString()).toBe('2026-03-02T08:00:00.000Z')
    expect(week.end.toISOString()).toBe('2026-03-09T07:00:00.000Z')
    expect(week.end.getTime() - week.start.getTime()).toBe((7 * 24 - 1) * 3_600_000)
  })

  test('stepping week by week across a daylight-saving change keeps Mondays', () => {
    expect(addDays('2026-10-26', 7)).toBe('2026-11-02')
    expect(weekStart(startOfDay('2026-11-02', TORONTO), TORONTO)).toBe('2026-11-02')
    expect(weekStart(new Date('2026-11-02T04:59:59Z'), TORONTO)).toBe('2026-10-26')
  })

  test('works for a time zone ahead of UTC', () => {
    // Australia/Sydney: daylight saving starts on Sunday 4 October 2026.
    const week = weekOf('2026-09-28', 'Australia/Sydney')
    expect(week.start.toISOString()).toBe('2026-09-27T14:00:00.000Z') // AEST, UTC+10
    expect(week.end.toISOString()).toBe('2026-10-04T13:00:00.000Z') // AEDT, UTC+11
  })
})

describe('groupByDay', () => {
  test('groups items by local day, in time order', () => {
    const items = [
      { id: 'c', starts_at: '2026-09-25T21:00:00Z' }, // Thu 2 pm
      { id: 'a', starts_at: '2026-09-24T00:00:00Z' }, // Wed 23rd, 5 pm
      { id: 'b', starts_at: '2026-09-25T06:59:00Z' }, // Wed 24th, 11:59 pm
      { id: 'd', starts_at: '2026-09-25T07:00:00Z' }, // Thu 25th, midnight
    ]
    const groups = groupByDay(items, VANCOUVER)
    expect([...groups.keys()]).toEqual(['2026-09-23', '2026-09-24', '2026-09-25'])
    expect(groups.get('2026-09-25')!.map((item) => item.id)).toEqual(['d', 'c'])
  })

  test('days stay right across the clocks going back', () => {
    const items = [
      { id: 'sun-late', starts_at: '2026-11-02T04:30:00Z' }, // Sun 1 Nov, 11:30 pm EST
      { id: 'sat-late', starts_at: '2026-11-01T03:30:00Z' }, // Sat 31 Oct, 11:30 pm EDT
      { id: 'mon', starts_at: '2026-11-02T05:00:00Z' }, // Mon 2 Nov, midnight EST
    ]
    const groups = groupByDay(items, TORONTO)
    expect([...groups.keys()]).toEqual(['2026-10-31', '2026-11-01', '2026-11-02'])
    const week = weekOf('2026-10-26', TORONTO)
    const inWeek = items.filter(
      (item) => new Date(item.starts_at) >= week.start && new Date(item.starts_at) < week.end,
    )
    expect(inWeek.map((item) => item.id).sort()).toEqual(['sat-late', 'sun-late'])
  })
})

test('formats days for headings', () => {
  expect(formatDayShort('2026-09-22', 'en-CA')).toBe('Tue 22')
  expect(formatDayLong('2026-09-24', 'en-CA')).toBe('Thursday 24')
})

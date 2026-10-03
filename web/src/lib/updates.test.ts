import i18n from '@/i18n'
import { formatPostedAt, linkChoices, updateProblem, type LinkableItem } from './updates'

const t = i18n.t.bind(i18n)

function linkable(id: string, startsAt: string, state = 'assigned'): LinkableItem {
  return { id, kind: 'task', title: id, starts_at: startsAt, state }
}

test('updateProblem: blank and over-long text', () => {
  expect(updateProblem('')).toBe('required')
  expect(updateProblem('   \n ')).toBe('required')
  expect(updateProblem('a'.repeat(2000))).toBeNull()
  expect(updateProblem(` ${'a'.repeat(2000)} `)).toBeNull() // trimmed, as post_update does
  expect(updateProblem('a'.repeat(2001))).toBe('tooLong')
})

test('linkChoices: the items nearest now, in date order, without cancelled ones', () => {
  const now = new Date('2026-09-24T19:00:00Z')
  const items = [
    linkable('lastWeek', '2026-09-17T19:00:00Z'),
    linkable('yesterday', '2026-09-23T19:00:00Z'),
    linkable('cancelled', '2026-09-24T19:30:00Z', 'cancelled'),
    linkable('tomorrow', '2026-09-25T19:00:00Z'),
    linkable('nextMonth', '2026-10-20T19:00:00Z'),
  ]
  expect(linkChoices(items, now, null, 3).map((item) => item.id)).toEqual([
    'lastWeek',
    'yesterday',
    'tomorrow',
  ])
  expect(linkChoices(items, now, null, 2).map((item) => item.id)).toEqual(['yesterday', 'tomorrow'])
})

test('linkChoices: the pinned item comes first, once', () => {
  const now = new Date('2026-09-24T19:00:00Z')
  const pinned = linkable('farAway', '2026-12-01T19:00:00Z')
  const items = [linkable('yesterday', '2026-09-23T19:00:00Z'), pinned, linkable('tomorrow', '2026-09-25T19:00:00Z')]
  expect(linkChoices(items, now, pinned, 2).map((item) => item.id)).toEqual(['farAway', 'yesterday'])
})

test('formatPostedAt names nearby days, in the circle time zone', () => {
  const zone = 'America/Toronto'
  const today = '2026-09-24'
  expect(formatPostedAt(t, 'en-CA', '2026-09-24T19:12:00Z', zone, today)).toBe('Today, 3:12 p.m.')
  expect(formatPostedAt(t, 'en-CA', '2026-09-24T02:00:00Z', zone, today)).toBe('Yesterday, 10:00 p.m.')
  expect(formatPostedAt(t, 'en-CA', '2026-09-22T12:05:00Z', zone, today)).toBe('Tue 22, 8:05 a.m.')
  expect(formatPostedAt(t, 'en-CA', '2026-09-02T12:05:00Z', zone, today)).toBe('September 2, 8:05 a.m.')
})

import { countByKind, filterByMember, isOverdue, memberNames } from './items'

const now = new Date('2026-09-24T19:00:00Z')
const past = '2026-09-24T18:59:00Z'
const future = '2026-09-24T19:01:00Z'

describe('isOverdue', () => {
  test.each(['needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage'])(
    'a past item that is %s is overdue',
    (state) => {
      expect(isOverdue({ starts_at: past, state }, now)).toBe(true)
    },
  )

  test.each(['completed', 'cancelled'])('a past item that is %s is not overdue', (state) => {
    expect(isOverdue({ starts_at: past, state }, now)).toBe(false)
  })

  test('an item still to come is not overdue', () => {
    expect(isOverdue({ starts_at: future, state: 'assigned' }, now)).toBe(false)
  })

  test('an item due right now is not overdue yet', () => {
    expect(isOverdue({ starts_at: now.toISOString(), state: 'assigned' }, now)).toBe(false)
  })
})

describe('filterByMember', () => {
  const items = [
    { id: 'owned', owner_id: 'maya', proposed_assignee_id: null },
    { id: 'asked', owner_id: null, proposed_assignee_id: 'maya' },
    { id: 'other', owner_id: 'jonah', proposed_assignee_id: null },
    { id: 'nobody', owner_id: null, proposed_assignee_id: null },
  ]

  test('Everyone keeps every item', () => {
    expect(filterByMember(items, null).map((item) => item.id)).toEqual([
      'owned',
      'asked',
      'other',
      'nobody',
    ])
  })

  test('a member sees what they own and what they have been asked to do', () => {
    expect(filterByMember(items, 'maya').map((item) => item.id)).toEqual(['owned', 'asked'])
  })

  test('a member with nothing sees nothing', () => {
    expect(filterByMember(items, 'ada')).toEqual([])
  })
})

test('countByKind counts tasks and appointments, leaving out cancelled ones', () => {
  expect(
    countByKind([
      { kind: 'task', state: 'assigned' },
      { kind: 'task', state: 'completed' },
      { kind: 'task', state: 'cancelled' },
      { kind: 'appointment', state: 'needs_someone' },
    ]),
  ).toEqual({ tasks: 2, appointments: 1 })
})

test('memberNames uses first names, with a stand-in for members with no name', () => {
  const names = memberNames(
    [
      { user_id: 'u1', profiles: { display_name: 'Maya Reyes' } },
      { user_id: 'u2', profiles: { display_name: null } },
      { user_id: 'u3', profiles: null },
    ],
    'New member',
  )
  expect([...names]).toEqual([
    ['u1', 'Maya'],
    ['u2', 'New member'],
    ['u3', 'New member'],
  ])
})

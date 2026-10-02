import { currentHolder, isAskedViewer, itemActions, type ItemActionItem } from './item-actions'

const me = 'maya'
const other = 'jonah'

// Every state × viewer combination, and the buttons that viewer sees (PRD §17).
const cases: [string, ItemActionItem, string, ReturnType<typeof itemActions>][] = [
  [
    'Needs someone, anyone',
    { state: 'needs_someone', owner_id: null, proposed_assignee_id: null },
    me,
    ['claim', 'ask', 'edit', 'cancel'],
  ],
  [
    'Awaiting acceptance, the person asked',
    { state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: me },
    me,
    ['accept', 'decline', 'edit', 'cancel'],
  ],
  [
    'Awaiting acceptance, anyone else',
    { state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: other },
    me,
    ['withdraw', 'askSomeoneElse', 'edit', 'cancel'],
  ],
  [
    'Assigned, the owner',
    { state: 'assigned', owner_id: me, proposed_assignee_id: null },
    me,
    ['complete', 'reassign', 'edit', 'cancel'],
  ],
  [
    'Assigned, anyone else',
    { state: 'assigned', owner_id: other, proposed_assignee_id: null },
    me,
    ['reassign', 'edit', 'cancel'],
  ],
  [
    'Needs coverage, the owner',
    { state: 'needs_coverage', owner_id: me, proposed_assignee_id: null },
    me,
    ['edit', 'cancel'],
  ],
  [
    'Needs coverage, anyone else',
    { state: 'needs_coverage', owner_id: other, proposed_assignee_id: null },
    me,
    ['edit', 'cancel'],
  ],
  [
    'Completed, the owner',
    { state: 'completed', owner_id: me, proposed_assignee_id: null },
    me,
    [],
  ],
  [
    'Completed, anyone else',
    { state: 'completed', owner_id: other, proposed_assignee_id: null },
    me,
    [],
  ],
  [
    'Cancelled, the owner',
    { state: 'cancelled', owner_id: me, proposed_assignee_id: null },
    me,
    [],
  ],
  [
    'Cancelled, anyone else',
    { state: 'cancelled', owner_id: null, proposed_assignee_id: null },
    me,
    [],
  ],
  [
    'an unknown state',
    { state: 'something_new', owner_id: me, proposed_assignee_id: null },
    me,
    [],
  ],
]

describe('itemActions', () => {
  test.each(cases)('%s', (_, item, viewer, expected) => {
    expect(itemActions(item, viewer)).toEqual(expected)
  })

  test('only the owner can mark an item done', () => {
    for (const [, item, viewer] of cases) {
      if (itemActions(item, viewer).includes('complete')) {
        expect(item.owner_id).toBe(viewer)
        expect(item.state).toBe('assigned')
      }
    }
  })

  test('only the person asked can accept or decline', () => {
    for (const [, item, viewer] of cases) {
      const actions = itemActions(item, viewer)
      if (actions.includes('accept') || actions.includes('decline')) {
        expect(item.proposed_assignee_id).toBe(viewer)
      }
    }
  })
})

describe('isAskedViewer', () => {
  test('is the person asked while Awaiting acceptance', () => {
    expect(
      isAskedViewer({ state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: me }, me),
    ).toBe(true)
  })

  test('is nobody once it is no longer awaiting', () => {
    expect(isAskedViewer({ state: 'assigned', owner_id: me, proposed_assignee_id: me }, me)).toBe(false)
  })

  test('is not anyone else', () => {
    expect(
      isAskedViewer({ state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: other }, me),
    ).toBe(false)
  })
})

describe('currentHolder', () => {
  test('is the person asked while Awaiting acceptance', () => {
    expect(
      currentHolder({ state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: other }),
    ).toBe(other)
  })

  test('is the owner once Assigned', () => {
    expect(currentHolder({ state: 'assigned', owner_id: other, proposed_assignee_id: null })).toBe(other)
  })

  test('is nobody while it Needs someone', () => {
    expect(currentHolder({ state: 'needs_someone', owner_id: null, proposed_assignee_id: null })).toBe(
      null,
    )
  })
})

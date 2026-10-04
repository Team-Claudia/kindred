import { badgeText, notificationPath } from './notifications'

describe('notificationPath', () => {
  test('opens the item a request, change, reminder or overdue alert is about', () => {
    for (const kind of ['assignment_requested', 'coverage_requested', 'item_changed', 'reminder', 'overdue']) {
      expect(notificationPath({ kind, item_id: 'item-1' })).toBe('/i/item-1')
    }
  })

  test('opens Updates for an update, linked to an item or not', () => {
    expect(notificationPath({ kind: 'update_posted', item_id: 'item-1' })).toBe('/updates')
    expect(notificationPath({ kind: 'update_posted', item_id: null })).toBe('/updates')
  })

  test('opens Summary for the weekly summary', () => {
    expect(notificationPath({ kind: 'weekly_summary', item_id: null })).toBe('/summary')
  })

  test('opens Updates when there is no item', () => {
    expect(notificationPath({ kind: 'something_new', item_id: null })).toBe('/updates')
  })
})

test('badgeText caps the count at 9+', () => {
  expect(badgeText(1)).toBe('1')
  expect(badgeText(9)).toBe('9')
  expect(badgeText(10)).toBe('9+')
})

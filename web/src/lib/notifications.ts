// The in-app notification list (task 4.5f, PRD US 11.6). outbox-worker
// writes each row: `kind` is the push event (assignment_requested,
// coverage_requested, item_changed, update_posted, …) or `reminder` /
// `overdue`, `item_id` the item it's about, if any, and `line` the push's
// text.

/**
 * Where tapping a notification goes: the Updates thread for an update (even
 * one linked to an item, as its push does), Summary for the weekly summary,
 * else the item, or Updates when there's no item.
 */
export function notificationPath(notification: { kind: string; item_id: string | null }): string {
  if (notification.kind === 'weekly_summary') return '/summary'
  if (notification.kind === 'update_posted' || !notification.item_id) return '/updates'
  return `/i/${notification.item_id}`
}

/** The bell's badge: the count, or "9+" past nine so it stays small. */
export function badgeText(count: number): string {
  return count > 9 ? '9+' : String(count)
}

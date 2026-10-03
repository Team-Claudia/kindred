// Copy, preference and send-time checks for scheduled jobs: reminders and
// overdue alerts (task 4.5b, plan §4.4, ADR-010). Pure functions, so
// reminder-copy.test.ts can test them.
//
// Copy is generic: never an item's title, notes or location.

import { DEFAULT_PREFS, type NotificationPrefs } from './push-copy.ts'

export type ScheduledKind = 'reminder' | 'overdue'

export const SCHEDULED_LINES: Record<ScheduledKind, string> = {
  reminder: "Reminder: something you're on is coming up",
  overdue: 'Something is overdue',
}

export function isScheduledKind(kind: string): kind is ScheduledKind {
  return kind === 'reminder' || kind === 'overdue'
}

// Both kinds switch off with the "Reminders and overdue" preference (US 11.4).
export function scheduledPushAllowed(prefs: Partial<NotificationPrefs> | null): boolean {
  return prefs?.reminders ?? DEFAULT_PREFS.reminders
}

export function scheduledMessage(input: {
  kind: ScheduledKind
  itemId: string
  careRecipientName: string | null
}): { title: string; body: string; url: string } {
  const recipient = input.careRecipientName?.trim()
  return {
    title: recipient ? `${recipient}'s Care Circle` : 'Kindred',
    body: SCHEDULED_LINES[input.kind],
    url: `/i/${encodeURIComponent(input.itemId)}`,
  }
}

const OPEN_STATES = new Set(['needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage'])

export type ItemNow = {
  state: string
  owner_id: string | null
  proposed_assignee_id: string | null
  starts_at: string
}

// Whether two timestamps are the same instant, whatever their formatting.
export function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false
  const x = Date.parse(a)
  const y = Date.parse(b)
  return !Number.isNaN(x) && x === y
}

// Re-checks a job at send time. Returns why it should be dropped, or null if
// it should still be sent.
//   reminder: the item is still Assigned, to the same owner, at the same time.
//   overdue (one recipient): the item is still open at the same due time, and
//     the recipient is still the person on it or an admin.
export function staleReason(input: {
  kind: ScheduledKind
  payload: { recipient_id: string; starts_at: string }
  item: ItemNow | null
  recipientRole: string | null // null: no longer in the circle
}): string | null {
  const { kind, payload, item, recipientRole } = input
  if (!item) return 'item_gone'
  if (recipientRole === null) return 'not_member'
  if (!sameInstant(item.starts_at, payload.starts_at)) return 'time_changed'
  if (kind === 'reminder') {
    if (item.state !== 'assigned') return 'not_assigned'
    if (item.owner_id !== payload.recipient_id) return 'owner_changed'
    return null
  }
  if (!OPEN_STATES.has(item.state)) return 'not_open'
  const holder = item.owner_id ?? item.proposed_assignee_id
  if (recipientRole !== 'admin' && holder !== payload.recipient_id) return 'owner_changed'
  return null
}

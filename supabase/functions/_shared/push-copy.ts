// Push copy and categories for outbox-worker (task 3.3, plan §4.4, ADR-010).
// Pure functions with no imports, so push-copy.test.ts can test them.
//
// Copy is generic: it may use the actor's first name, never an item's title,
// notes, location or update text.

export type PrefCategory =
  | 'requests'
  | 'reminders'
  | 'changes'
  | 'updates'
  | 'weekly_summary'
  | 'comments'
  | 'everything_else'

export type NotificationPrefs = Record<PrefCategory, boolean>

// A member with no notification_prefs row gets these (plan §4.1).
export const DEFAULT_PREFS: NotificationPrefs = {
  requests: true,
  reminders: true,
  changes: true,
  updates: true,
  weekly_summary: true,
  comments: true,
  everything_else: false,
}

// Each event's line, given the actor's first name ("Someone" if unknown).
// Keep in step with the copy table in plan §4.4.
const LINES: Record<string, (actor: string) => string> = {
  assignment_requested: (actor) => `${actor} asked you to take something on`,
  assignment_accepted: (actor) => `${actor} accepted`,
  assignment_declined: (actor) => `${actor} declined`,
  assignment_withdrawn: (actor) => `${actor} withdrew their request`,
  reassigned_away: (actor) => `${actor} gave something of yours to someone else`,
  reconfirm_requested: (actor) => `${actor} changed the time. Can you still do it?`,
  item_changed: (actor) => `${actor} changed something you're on`,
  item_cancelled: (actor) => `${actor} cancelled something you were on`,
  coverage_requested: (actor) => `${actor} needs someone to cover for them`,
  coverage_taken: (actor) => `${actor} is covering for you`,
}

export const FALLBACK_LINE = 'Something changed in Kindred'

const CATEGORIES: Record<string, PrefCategory> = {
  assignment_requested: 'requests',
  assignment_accepted: 'requests',
  assignment_declined: 'requests',
  assignment_withdrawn: 'requests',
  reassigned_away: 'changes',
  reconfirm_requested: 'changes',
  item_changed: 'changes',
  item_cancelled: 'changes',
}

// The notification_prefs switch that decides whether an event is pushed.
// Coverage events (task 3.1) are requests, whatever their exact names.
export function eventCategory(event: string): PrefCategory {
  if (Object.hasOwn(CATEGORIES, event)) return CATEGORIES[event]
  if (event.startsWith('coverage_')) return 'requests'
  return 'everything_else'
}

export function pushAllowed(event: string, prefs: Partial<NotificationPrefs> | null): boolean {
  const category = eventCategory(event)
  return prefs?.[category] ?? DEFAULT_PREFS[category]
}

// "Maya Patel" → "Maya". Blank or missing → null.
export function firstName(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0]
  return first ? first : null
}

// The notification's title, body (also the in-app line) and tap target.
export function pushMessage(input: {
  event: string
  itemId: string
  careRecipientName: string | null
  actorName: string | null
}): { title: string; body: string; url: string } {
  const recipient = input.careRecipientName?.trim()
  const actor = firstName(input.actorName) ?? 'Someone'
  const line = Object.hasOwn(LINES, input.event) ? LINES[input.event](actor) : FALLBACK_LINE
  return {
    title: recipient ? `${recipient}'s Care Circle` : 'Kindred',
    body: line,
    url: `/i/${encodeURIComponent(input.itemId)}`,
  }
}

// The six assignment states (PRD §17), as stored in items.state.
export const ASSIGNMENT_STATES = [
  'needs_someone',
  'awaiting_acceptance',
  'assigned',
  'needs_coverage',
  'completed',
  'cancelled',
] as const

export type AssignmentState = (typeof ASSIGNMENT_STATES)[number]

// Overdue isn't a state: it's shown alongside one (computed in the client).
export type BadgeStatus = AssignmentState | 'overdue'

/**
 * The outline for a card that needs someone to act. Overdue looks the same
 * everywhere (accent border, tinted background); otherwise it's outlined in
 * primary when `needsAction`.
 */
export function attentionCardClass(overdue: boolean, needsAction = true) {
  if (overdue) return 'border-2 border-overdue-border bg-overdue-surface'
  return needsAction ? 'border-2 border-primary' : undefined
}

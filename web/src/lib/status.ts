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

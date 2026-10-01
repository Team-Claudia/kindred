import { firstName } from './circles'
import type { Tables } from './database.types'

// Shared rules for tasks and appointments (items), used by This week, Home and
// item detail.

export type Item = Tables<'items'>

export type ItemKind = 'task' | 'appointment'

/**
 * Overdue is an indicator shown alongside a state, never a state of its own
 * (PRD §17, plan §4.3): the item's time (a task's due time) has passed and
 * it's neither Completed nor Cancelled.
 */
export function isOverdue(item: Pick<Item, 'starts_at' | 'state'>, now: Date): boolean {
  if (item.state === 'completed' || item.state === 'cancelled') return false
  return new Date(item.starts_at).getTime() < now.getTime()
}

/**
 * One person's items: those they own or have been asked to do. `null` means
 * Everyone, so every item is kept.
 */
export function filterByMember<T extends Pick<Item, 'owner_id' | 'proposed_assignee_id'>>(
  items: readonly T[],
  memberId: string | null,
): T[] {
  if (memberId === null) return [...items]
  return items.filter(
    (item) => item.owner_id === memberId || item.proposed_assignee_id === memberId,
  )
}

/** How many tasks and appointments there are, leaving out cancelled ones. */
export function countByKind(items: readonly Pick<Item, 'kind' | 'state'>[]) {
  const live = items.filter((item) => item.state !== 'cancelled')
  return {
    tasks: live.filter((item) => item.kind === 'task').length,
    appointments: live.filter((item) => item.kind === 'appointment').length,
  }
}

/**
 * First names by user ID, for rows and filters ("Asked Maya"). Members with
 * no name yet get `unnamed`.
 */
export function memberNames(
  members: readonly { user_id: string; profiles: { display_name: string | null } | null }[],
  unnamed: string,
): Map<string, string> {
  return new Map(
    members.map((member) => [member.user_id, firstName(member.profiles?.display_name) || unnamed]),
  )
}

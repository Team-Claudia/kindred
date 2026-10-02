import type { Item } from './items'

// Which buttons item detail shows (task 2.2, PRD §17). Every member can
// create, edit, cancel, assign, reassign and withdraw on any item (BR-08);
// only the person asked can accept or decline, and only the confirmed owner
// can mark it done. Completed and Cancelled items are read-only.
//
// Coverage ("Need coverage", "I can do it", task 3.1), Share (3.2) and
// updates and follow-ups (4.1) add their own buttons later.

export type ItemAction =
  | 'claim' // "I'll do it"
  | 'ask' // "Ask someone"
  | 'accept'
  | 'decline'
  | 'withdraw'
  | 'askSomeoneElse'
  | 'complete' // "Mark done"
  | 'reassign'
  | 'edit'
  | 'cancel'

export type ItemActionItem = Pick<Item, 'state' | 'owner_id' | 'proposed_assignee_id'>

/** Whether `viewerId` is the person this item is waiting on to accept or decline. */
export function isAskedViewer(item: ItemActionItem, viewerId: string): boolean {
  return item.state === 'awaiting_acceptance' && item.proposed_assignee_id === viewerId
}

/** The actions `viewerId` can take on `item` right now, in the order they're shown. */
export function itemActions(item: ItemActionItem, viewerId: string): ItemAction[] {
  const open: ItemAction[] = ['edit', 'cancel']
  switch (item.state) {
    case 'needs_someone':
      return ['claim', 'ask', ...open]
    case 'awaiting_acceptance':
      return isAskedViewer(item, viewerId)
        ? ['accept', 'decline', ...open]
        : ['withdraw', 'askSomeoneElse', ...open]
    case 'assigned':
      return item.owner_id === viewerId
        ? ['complete', 'reassign', ...open]
        : ['reassign', ...open]
    case 'needs_coverage':
      // Coverage actions are task 3.1; assign can't act on it until then.
      return open
    default:
      // Completed, Cancelled, or a state this version doesn't know.
      return []
  }
}

/**
 * Who "Ask someone" can't pick, because the item is already theirs: the
 * person asked while it's Awaiting acceptance, or the owner once Assigned
 * (assign raises invalid_state for them).
 */
export function currentHolder(item: ItemActionItem): string | null {
  if (item.state === 'awaiting_acceptance') return item.proposed_assignee_id
  if (item.state === 'assigned') return item.owner_id
  return null
}

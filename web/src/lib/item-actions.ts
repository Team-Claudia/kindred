import type { Item } from './items'

// Which buttons item detail shows (task 2.2, PRD §17). Every member can
// create, edit, cancel, assign, reassign and withdraw on any item (BR-08);
// only the person asked can accept or decline, and only the confirmed owner
// can mark it done. Completed and Cancelled items are read-only.
//
// Coverage (task 3.1): only the owner of an Assigned item can ask the family
// to cover it, and only they can cancel the request; anyone else can take a
// Needs coverage item with "I can do it". Assign and claim don't act on Needs
// coverage items. Share (3.2) and updates and follow-ups (4.1) add their own
// buttons later.

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
  | 'requestCoverage' // "Need coverage"
  | 'cancelCoverage' // "Cancel request"
  | 'acceptCoverage' // "I can do it"

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
        ? ['complete', 'requestCoverage', 'reassign', ...open]
        : ['reassign', ...open]
    case 'needs_coverage':
      return item.owner_id === viewerId
        ? ['cancelCoverage', ...open]
        : ['acceptCoverage', ...open]
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

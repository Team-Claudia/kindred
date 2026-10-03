// Run with: deno test supabase/functions (CI job "Edge Functions").
import { assertEquals } from 'jsr:@std/assert@1'
import { DEFAULT_PREFS } from './push-copy.ts'
import {
  isScheduledKind,
  sameInstant,
  scheduledMessage,
  scheduledPushAllowed,
  staleReason,
  type ItemNow,
} from './reminder-copy.ts'

const ITEM = '6f1c2b1e-0000-4000-8000-000000000001'
const MAYA = 'a0000000-0000-4000-8000-00000000000a'
const JONAH = 'b0000000-0000-4000-8000-00000000000b'
const AT = '2026-10-05T17:00:00+00:00'

const assigned: ItemNow = { state: 'assigned', owner_id: MAYA, proposed_assignee_id: null, starts_at: AT }

function reminder(item: ItemNow | null, role: string | null = 'member', recipient = MAYA) {
  return staleReason({ kind: 'reminder', payload: { recipient_id: recipient, starts_at: AT }, item, recipientRole: role })
}

function overdue(item: ItemNow | null, role: string | null, recipient: string) {
  return staleReason({ kind: 'overdue', payload: { recipient_id: recipient, starts_at: AT }, item, recipientRole: role })
}

Deno.test('copy is generic and opens the item', () => {
  assertEquals(scheduledMessage({ kind: 'reminder', itemId: ITEM, careRecipientName: ' Mom ' }), {
    title: "Mom's Care Circle",
    body: "Reminder: something you're on is coming up",
    url: `/i/${ITEM}`,
  })
  assertEquals(scheduledMessage({ kind: 'overdue', itemId: ITEM, careRecipientName: null }), {
    title: 'Kindred',
    body: 'Something is overdue',
    url: `/i/${ITEM}`,
  })
})

Deno.test('only reminder and overdue are scheduled kinds', () => {
  assertEquals(isScheduledKind('reminder'), true)
  assertEquals(isScheduledKind('overdue'), true)
  assertEquals(isScheduledKind('push'), false)
  assertEquals(isScheduledKind('weekly_summary'), false)
})

Deno.test('both kinds follow the reminders preference; no row means on', () => {
  assertEquals(scheduledPushAllowed(null), true)
  assertEquals(scheduledPushAllowed({ ...DEFAULT_PREFS, reminders: false }), false)
  assertEquals(scheduledPushAllowed({ ...DEFAULT_PREFS, changes: false, requests: false }), true)
})

Deno.test('sameInstant ignores formatting', () => {
  assertEquals(sameInstant('2026-10-05T17:00:00+00:00', '2026-10-05T10:00:00-07:00'), true)
  assertEquals(sameInstant('2026-10-05T17:00:00Z', '2026-10-05T17:00:01Z'), false)
  assertEquals(sameInstant(null, AT), false)
  assertEquals(sameInstant('not a date', 'not a date'), false)
})

Deno.test('a reminder is sent while the item is Assigned to the same owner at the same time', () => {
  assertEquals(reminder(assigned), null)
  assertEquals(reminder({ ...assigned, starts_at: '2026-10-05T10:00:00-07:00' }), null)
})

Deno.test('a reminder is dropped when the item changed since it was queued', () => {
  assertEquals(reminder(null), 'item_gone')
  assertEquals(reminder(assigned, null), 'not_member')
  assertEquals(reminder({ ...assigned, state: 'completed' }), 'not_assigned')
  assertEquals(reminder({ ...assigned, state: 'cancelled' }), 'not_assigned')
  assertEquals(reminder({ ...assigned, state: 'needs_coverage' }), 'not_assigned')
  assertEquals(
    reminder({ ...assigned, state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: MAYA }),
    'not_assigned',
  )
  assertEquals(reminder({ ...assigned, owner_id: JONAH }), 'owner_changed')
  assertEquals(reminder({ ...assigned, starts_at: '2026-10-05T18:00:00+00:00' }), 'time_changed')
})

Deno.test('an overdue alert goes to the person on it and admins while the item is open', () => {
  assertEquals(overdue(assigned, 'member', MAYA), null)
  assertEquals(overdue(assigned, 'admin', JONAH), null)
  const asked = { ...assigned, state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: MAYA }
  assertEquals(overdue(asked, 'member', MAYA), null)
  const nobody = { ...assigned, state: 'needs_someone', owner_id: null }
  assertEquals(overdue(nobody, 'admin', JONAH), null)
  assertEquals(overdue({ ...assigned, state: 'needs_coverage' }, 'member', MAYA), null)
})

Deno.test('an overdue alert is dropped when the item is done, moved or someone else has it', () => {
  assertEquals(overdue(null, 'admin', JONAH), 'item_gone')
  assertEquals(overdue({ ...assigned, state: 'completed' }, 'admin', JONAH), 'not_open')
  assertEquals(overdue({ ...assigned, state: 'cancelled' }, 'member', MAYA), 'not_open')
  assertEquals(overdue({ ...assigned, starts_at: '2026-10-06T17:00:00+00:00' }, 'member', MAYA), 'time_changed')
  assertEquals(overdue({ ...assigned, owner_id: JONAH }, 'member', MAYA), 'owner_changed')
  assertEquals(overdue(assigned, null, MAYA), 'not_member')
})

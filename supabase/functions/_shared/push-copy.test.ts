// Run with: deno test supabase/functions (CI job "Edge Functions").
import { assertEquals } from 'jsr:@std/assert@1'
import { DEFAULT_PREFS, eventCategory, firstName, pushAllowed, pushMessage } from './push-copy.ts'

const ITEM = '6f1c2b1e-0000-4000-8000-000000000001'

function body(event: string, actorName: string | null = 'Maya Patel') {
  return pushMessage({ event, itemId: ITEM, careRecipientName: 'Mom', actorName }).body
}

Deno.test('every event has its own line, using the actor first name', () => {
  assertEquals(body('assignment_requested'), 'Maya asked you to take something on')
  assertEquals(body('assignment_accepted'), 'Maya accepted')
  assertEquals(body('assignment_declined'), 'Maya declined')
  assertEquals(body('assignment_withdrawn'), 'Maya withdrew their request')
  assertEquals(body('reassigned_away'), 'Maya gave something of yours to someone else')
  assertEquals(body('reconfirm_requested'), 'Maya changed the time. Can you still do it?')
  assertEquals(body('item_changed'), "Maya changed something you're on")
  assertEquals(body('item_cancelled'), 'Maya cancelled something you were on')
  assertEquals(body('coverage_requested'), 'Maya needs someone to cover for them')
  assertEquals(body('coverage_taken'), 'Maya is covering for you')
  assertEquals(body('update_posted'), 'Maya posted an update')
})

Deno.test('a released item names nobody: the member who left has no account any more', () => {
  assertEquals(body('item_released', null), 'A member left Kindred. Something they were on needs someone')
  assertEquals(eventCategory('item_released'), 'changes')
})

Deno.test('an unknown event gets the generic line', () => {
  assertEquals(body('something_new'), 'Something changed in Kindred')
  assertEquals(body('toString'), 'Something changed in Kindred')
})

Deno.test('a missing actor name reads as Someone', () => {
  assertEquals(body('assignment_accepted', null), 'Someone accepted')
  assertEquals(body('assignment_accepted', '   '), 'Someone accepted')
})

Deno.test('title names the care recipient; url opens the item', () => {
  const message = pushMessage({
    event: 'assignment_requested',
    itemId: ITEM,
    careRecipientName: ' Mom ',
    actorName: 'Jonah',
  })
  assertEquals(message, {
    title: "Mom's Care Circle",
    body: 'Jonah asked you to take something on',
    url: `/i/${ITEM}`,
  })
  assertEquals(
    pushMessage({ event: 'x', itemId: ITEM, careRecipientName: null, actorName: null }).title,
    'Kindred',
  )
})

Deno.test('an update opens the Updates thread, linked or not', () => {
  const linked = pushMessage({
    event: 'update_posted',
    itemId: ITEM,
    careRecipientName: 'Mom',
    actorName: 'Maya Patel',
  })
  assertEquals(linked, { title: "Mom's Care Circle", body: 'Maya posted an update', url: '/updates' })
  assertEquals(
    pushMessage({ event: 'update_posted', itemId: null, careRecipientName: 'Mom', actorName: null }).url,
    '/updates',
  )
})

Deno.test('update pushes switch off with the updates preference', () => {
  assertEquals(pushAllowed('update_posted', null), true)
  assertEquals(pushAllowed('update_posted', { ...DEFAULT_PREFS, updates: false }), false)
})

Deno.test('events map to notification_prefs categories', () => {
  for (const event of [
    'assignment_requested',
    'assignment_accepted',
    'assignment_declined',
    'assignment_withdrawn',
    'coverage_requested',
    'coverage_taken',
    'coverage_anything_else',
  ]) {
    assertEquals(eventCategory(event), 'requests', event)
  }
  for (const event of ['item_changed', 'item_cancelled', 'reassigned_away', 'reconfirm_requested']) {
    assertEquals(eventCategory(event), 'changes', event)
  }
  assertEquals(eventCategory('update_posted'), 'updates')
  assertEquals(eventCategory('something_new'), 'everything_else')
  assertEquals(eventCategory('constructor'), 'everything_else')
})

Deno.test('preferences decide the push; no row means the defaults', () => {
  assertEquals(pushAllowed('assignment_requested', null), true)
  assertEquals(pushAllowed('something_new', null), false)
  assertEquals(pushAllowed('item_changed', { ...DEFAULT_PREFS, changes: false }), false)
  assertEquals(pushAllowed('assignment_requested', { ...DEFAULT_PREFS, changes: false }), true)
  assertEquals(pushAllowed('something_new', { ...DEFAULT_PREFS, everything_else: true }), true)
})

Deno.test('firstName', () => {
  assertEquals(firstName('Maya Patel'), 'Maya')
  assertEquals(firstName('  Ada  '), 'Ada')
  assertEquals(firstName(''), null)
  assertEquals(firstName(null), null)
})

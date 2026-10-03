// Tests for the google-oauth state (task 4.5a). Run with:
//   deno test supabase/functions/google-oauth/
import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1'
import { signState, STATE_TTL_MS, verifyState } from './state.ts'

const USER = 'a0000000-0000-0000-0000-00000000000a'
const SECRET = 'test-client-secret'
const NOW = Date.UTC(2026, 9, 4, 12)

Deno.test('a state verifies as the member it was signed for', async () => {
  const state = await signState(USER, SECRET, NOW)
  assertEquals(await verifyState(state, SECRET, NOW + 1000), USER)
})

Deno.test('each state is different', async () => {
  assertNotEquals(await signState(USER, SECRET, NOW), await signState(USER, SECRET, NOW))
})

Deno.test('an expired state is refused', async () => {
  const state = await signState(USER, SECRET, NOW)
  assertEquals(await verifyState(state, SECRET, NOW + STATE_TTL_MS + 1), null)
})

Deno.test('a state signed with another secret is refused', async () => {
  const state = await signState(USER, 'another-secret', NOW)
  assertEquals(await verifyState(state, SECRET, NOW), null)
})

Deno.test('a changed state is refused', async () => {
  const state = await signState(USER, SECRET, NOW)
  const [, signature] = state.split('.')
  const forged = btoa(JSON.stringify({ u: 'someone-else', e: NOW + STATE_TTL_MS, n: 'x' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  assertEquals(await verifyState(`${forged}.${signature}`, SECRET, NOW), null)
})

Deno.test('malformed states are refused', async () => {
  for (const state of ['', 'abc', 'a.b.c', '!!!.???', 'e30.']) {
    assertEquals(await verifyState(state, SECRET, NOW), null, state)
  }
})

// Run with: deno test supabase/functions (CI job "Edge Functions").
import { assertEquals } from 'jsr:@std/assert@1'
import { DEFAULT_PREFS } from './push-copy.ts'
import { weekStartOf, weeklySummaryMessage, weeklySummaryPushAllowed } from './weekly-summary-copy.ts'

Deno.test('copy is generic and opens the Summary tab on that week', () => {
  assertEquals(weeklySummaryMessage({ weekStart: '2026-10-26', careRecipientName: ' Dad ' }), {
    title: "Dad's Care Circle",
    body: 'Your weekly summary is ready',
    url: '/summary?week=2026-10-26',
  })
  assertEquals(weeklySummaryMessage({ weekStart: '2026-10-26', careRecipientName: null }).title, 'Kindred')
})

Deno.test('follows the weekly summary preference; no row means on', () => {
  assertEquals(weeklySummaryPushAllowed(null), true)
  assertEquals(weeklySummaryPushAllowed({ ...DEFAULT_PREFS, weekly_summary: false }), false)
  assertEquals(weeklySummaryPushAllowed({ ...DEFAULT_PREFS, reminders: false, updates: false }), true)
})

Deno.test('week_start must be a date', () => {
  assertEquals(weekStartOf('2026-10-26'), '2026-10-26')
  assertEquals(weekStartOf('2026-10-26T00:00:00Z'), null)
  assertEquals(weekStartOf(''), null)
  assertEquals(weekStartOf(20261026), null)
  assertEquals(weekStartOf(undefined), null)
})

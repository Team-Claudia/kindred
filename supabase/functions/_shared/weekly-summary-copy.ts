// Copy and preference for the Sunday "Your weekly summary is ready" job (task
// 4.5g, plan §4.4, ADR-016). Pure functions, so weekly-summary-copy.test.ts
// can test them.
//
// Copy is generic: the summary itself is only ever read in the app.

import { DEFAULT_PREFS, type NotificationPrefs } from './push-copy.ts'

export const WEEKLY_SUMMARY_LINE = 'Your weekly summary is ready'

const DAY = /^\d{4}-\d{2}-\d{2}$/

// The job's week_start, if it is a 'YYYY-MM-DD' date.
export function weekStartOf(value: unknown): string | null {
  return typeof value === 'string' && DAY.test(value) ? value : null
}

// Switched off with the "Weekly summary" preference (US 11.4).
export function weeklySummaryPushAllowed(prefs: Partial<NotificationPrefs> | null): boolean {
  return prefs?.weekly_summary ?? DEFAULT_PREFS.weekly_summary
}

// Tapping it opens the Summary tab on that week.
export function weeklySummaryMessage(input: {
  weekStart: string
  careRecipientName: string | null
}): { title: string; body: string; url: string } {
  const recipient = input.careRecipientName?.trim()
  return {
    title: recipient ? `${recipient}'s Care Circle` : 'Kindred',
    body: WEEKLY_SUMMARY_LINE,
    url: `/summary?week=${encodeURIComponent(input.weekStart)}`,
  }
}

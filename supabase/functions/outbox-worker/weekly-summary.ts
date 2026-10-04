// The Sunday "Your weekly summary is ready" job (task 4.5g, plan §4.4,
// ADR-016).
//
// pg_cron (queue_weekly_summaries, migration 20261005030000_weekly_summary.sql)
// queues one job per member at 08:00 on Sunday in the circle's time zone:
//   weekly_summary {recipient_id, week_start}
// The job is dropped if the member has since left the circle. Otherwise it
// writes the in-app row and pushes under the "weekly_summary" preference.
// The summary itself is built when it's read, in the app.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { NotificationPrefs } from '../_shared/push-copy.ts'
import {
  weekStartOf,
  weeklySummaryMessage,
  weeklySummaryPushAllowed,
} from '../_shared/weekly-summary-copy.ts'
import { deliver } from './deliver.ts'

type Job = { id: number; circle_id: string | null; payload: Record<string, unknown> }

// Resolves null when finished (sent or dropped) and an error message when the
// job should be retried.
export async function runWeeklySummaryJob(admin: SupabaseClient, job: Job): Promise<string | null> {
  const recipientId = typeof job.payload.recipient_id === 'string' ? job.payload.recipient_id : null
  const weekStart = weekStartOf(job.payload.week_start)
  if (!job.circle_id || !recipientId || !weekStart) {
    console.warn(`outbox ${job.id}: malformed weekly_summary payload; dropped`)
    return null
  }

  const [member, circle, prefs] = await Promise.all([
    admin
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', job.circle_id)
      .eq('user_id', recipientId)
      .maybeSingle(),
    admin.from('circles').select('care_recipient_name').eq('id', job.circle_id).maybeSingle(),
    admin.from('notification_prefs').select('*').eq('user_id', recipientId).maybeSingle(),
  ])
  for (const result of [member, circle, prefs]) {
    if (result.error) throw result.error
  }
  if (!member.data) {
    console.log(`outbox ${job.id}: weekly_summary dropped (not_member)`)
    return null
  }

  return await deliver(admin, {
    jobId: job.id,
    recipientId,
    kind: 'weekly_summary',
    itemId: null,
    message: weeklySummaryMessage({
      weekStart,
      careRecipientName: circle.data?.care_recipient_name ?? null,
    }),
    pushAllowed: weeklySummaryPushAllowed(prefs.data as Partial<NotificationPrefs> | null),
  })
}

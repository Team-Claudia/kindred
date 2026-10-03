// Reminders and overdue alerts (task 4.5b, plan §4.4, ADR-010).
//
// The trigger on items (migration 20261004040000_reminders.sql) queues:
//   reminder {item_id, recipient_id, starts_at}: one member, at the lead time;
//   overdue  {item_id, starts_at}: at the due time. expand_overdue_job turns
//     it into one overdue job per person to tell (owner or proposed assignee,
//     and every admin), each with a recipient_id, due straight away.
//
// Every job is re-checked here at send time (staleReason) and dropped if the
// item changed since it was queued. Both kinds go out under the "reminders"
// preference.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import type { NotificationPrefs } from '../_shared/push-copy.ts'
import {
  isScheduledKind,
  scheduledMessage,
  scheduledPushAllowed,
  staleReason,
  type ItemNow,
} from '../_shared/reminder-copy.ts'
import { deliver } from './deliver.ts'

type Job = { id: number; kind: string; attempts: number; payload: Record<string, unknown> }

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

// Resolves null when finished (sent, dropped or expanded) and an error
// message when the job should be retried.
export async function runScheduledJob(admin: SupabaseClient, job: Job): Promise<string | null> {
  const kind = job.kind
  const itemId = text(job.payload.item_id)
  const startsAt = text(job.payload.starts_at)
  const recipientId = text(job.payload.recipient_id)
  if (!isScheduledKind(kind) || !itemId || !startsAt) {
    console.warn(`outbox ${job.id}: malformed ${kind} payload; dropped`)
    return null
  }

  // An overdue job with no recipient is the one queued at the due time: the
  // database re-checks the item and fans it out, in one transaction.
  if (kind === 'overdue' && !recipientId) {
    const { error } = await admin.rpc('expand_overdue_job', {
      job_id: job.id,
      attempt: job.attempts,
    })
    if (error) throw error
    return null
  }
  if (!recipientId) {
    console.warn(`outbox ${job.id}: reminder without a recipient; dropped`)
    return null
  }

  const item = await admin
    .from('items')
    .select('circle_id, state, owner_id, proposed_assignee_id, starts_at')
    .eq('id', itemId)
    .maybeSingle()
  if (item.error) throw item.error

  const member = item.data
    ? await admin
        .from('circle_members')
        .select('role')
        .eq('circle_id', item.data.circle_id)
        .eq('user_id', recipientId)
        .maybeSingle()
    : { data: null, error: null }
  if (member.error) throw member.error

  const stale = staleReason({
    kind,
    payload: { recipient_id: recipientId, starts_at: startsAt },
    item: item.data as ItemNow | null,
    recipientRole: member.data?.role ?? null,
  })
  if (stale) {
    console.log(`outbox ${job.id}: ${kind} dropped (${stale})`)
    return null
  }

  const [circle, prefs] = await Promise.all([
    admin.from('circles').select('care_recipient_name').eq('id', item.data!.circle_id).single(),
    admin.from('notification_prefs').select('*').eq('user_id', recipientId).maybeSingle(),
  ])
  if (circle.error) throw circle.error
  if (prefs.error) throw prefs.error

  return await deliver(admin, {
    jobId: job.id,
    recipientId,
    kind,
    itemId,
    message: scheduledMessage({
      kind,
      itemId,
      careRecipientName: circle.data?.care_recipient_name ?? null,
    }),
    pushAllowed: scheduledPushAllowed(prefs.data as Partial<NotificationPrefs> | null),
  })
}

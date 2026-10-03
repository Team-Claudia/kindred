// Delivers one notification to one member: the in-app row, then a push to each
// of their devices if their preference allows. Used by scheduled jobs
// (reminders and overdue alerts, task 4.5b). runJob in index.ts does the same
// inline; it can call this once task 4.1's worker changes have merged.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { sendPush, type PushPayload, type Subscription } from '../_shared/web-push.ts'

// Resolves null when done and an error message when the job should be retried.
export async function deliver(
  admin: SupabaseClient,
  input: {
    jobId: number
    recipientId: string
    kind: string
    itemId: string | null
    message: PushPayload & { body: string }
    pushAllowed: boolean
  },
): Promise<string | null> {
  // In-app row first, whatever the preference. outbox_id is unique, so a
  // retry of this job doesn't write a second row.
  const notification = await admin.from('notifications').upsert(
    {
      user_id: input.recipientId,
      kind: input.kind,
      item_id: input.itemId,
      line: input.message.body,
      outbox_id: input.jobId,
    },
    { onConflict: 'outbox_id', ignoreDuplicates: true },
  )
  if (notification.error) throw notification.error

  if (!input.pushAllowed) return null

  const subs = await admin
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', input.recipientId)
  if (subs.error) throw subs.error
  const subscriptions = (subs.data ?? []) as Subscription[]
  if (subscriptions.length === 0) return null

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendPush(subscription, input.message)),
  )

  const gone = subscriptions
    .filter((_, i) => {
      const result = results[i]
      return result.status === 'fulfilled' && result.value === 'gone'
    })
    .map((subscription) => subscription.id)
  if (gone.length > 0) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', gone)
    if (error) console.error(error)
  }

  // Retry only if no device got it, so devices that did aren't sent it twice.
  const failures = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
  const sent = results.some((r) => r.status === 'fulfilled' && r.value === 'sent')
  if (failures.length > 0 && !sent) return `push failed: ${String(failures[0].reason)}`
  for (const failure of failures) console.error(failure.reason)
  return null
}

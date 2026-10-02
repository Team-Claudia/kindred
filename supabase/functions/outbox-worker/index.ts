// outbox-worker (task 3.3, plan §4.4, ADR-009, ADR-010): sends the push jobs
// the item RPCs queue in public.outbox.
//
// Called by the database, never the app: a trigger on outbox insert and a
// pg_cron job every minute both POST here through pg_net (migration
// 20261003000000_outbox_push_worker.sql). verify_jwt is off so the database
// can call it, so every call must carry the shared secret in x-outbox-secret.
//
// Each job: claim (claim_outbox_jobs, for update skip locked), re-check the
// item and the recipient's membership, write the in-app notifications row,
// then push to each of the recipient's devices if their preference allows,
// and record the result (finish_outbox_job, which handles retries).
//
// Secrets: OUTBOX_WORKER_SECRET (the same value as outbox_worker_secret in
// Vault), VAPID_PRIVATE_KEY and VAPID_SUBJECT (../_shared/web-push.ts).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { createHash, timingSafeEqual } from 'node:crypto'
import { pushAllowed, pushMessage, type NotificationPrefs } from '../_shared/push-copy.ts'
import { configureVapid, sendPush, type Subscription } from '../_shared/web-push.ts'

const BATCH_SIZE = 10
// Stop claiming new batches after this long, well inside the claim's 2-minute
// lease and the function's time limit; the cron picks up the rest.
const TIME_BUDGET_MS = 40_000

type Job = { id: number; attempts: number; payload: Record<string, unknown> }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(given), digest(expected))
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

// Runs one claimed job. Resolves null when the job is finished (sent, or
// dropped because there is nothing to send) and an error message when it
// should be retried.
async function runJob(admin: SupabaseClient, job: Job): Promise<string | null> {
  const event = text(job.payload.event)
  const itemId = text(job.payload.item_id)
  const recipientId = text(job.payload.recipient_id)
  const actorId = text(job.payload.actor_id)
  if (!event || !itemId || !recipientId) {
    console.warn(`outbox ${job.id}: malformed push payload; dropped`)
    return null
  }

  const item = await admin.from('items').select('id, circle_id').eq('id', itemId).maybeSingle()
  if (item.error) throw item.error
  if (!item.data) return null // The item is gone.

  const [member, circle, actor, prefs] = await Promise.all([
    admin
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', item.data.circle_id)
      .eq('user_id', recipientId)
      .maybeSingle(),
    admin.from('circles').select('care_recipient_name').eq('id', item.data.circle_id).single(),
    actorId
      ? admin.from('profiles').select('display_name').eq('id', actorId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    admin.from('notification_prefs').select('*').eq('user_id', recipientId).maybeSingle(),
  ])
  for (const result of [member, circle, actor, prefs]) {
    if (result.error) throw result.error
  }
  if (!member.data) return null // The recipient has left the circle.

  const message = pushMessage({
    event,
    itemId,
    careRecipientName: circle.data?.care_recipient_name ?? null,
    actorName: actor.data?.display_name ?? null,
  })

  // In-app row first, whatever the preference. outbox_id is unique, so a
  // retry of this job doesn't write a second row.
  const notification = await admin.from('notifications').upsert(
    { user_id: recipientId, kind: event, item_id: itemId, line: message.body, outbox_id: job.id },
    { onConflict: 'outbox_id', ignoreDuplicates: true },
  )
  if (notification.error) throw notification.error

  if (!pushAllowed(event, prefs.data as Partial<NotificationPrefs> | null)) return null

  const subs = await admin
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', recipientId)
  if (subs.error) throw subs.error
  const subscriptions = (subs.data ?? []) as Subscription[]
  if (subscriptions.length === 0) return null

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => sendPush(subscription, message)),
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const secret = Deno.env.get('OUTBOX_WORKER_SECRET')
  if (!secret) {
    console.error('OUTBOX_WORKER_SECRET must be set')
    return json({ error: 'not_configured' }, 500)
  }
  if (!sameSecret(req.headers.get('x-outbox-secret') ?? '', secret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  // Without VAPID nothing can be sent, so leave the jobs pending rather than
  // using up their attempts.
  if (!configureVapid()) return json({ error: 'not_configured' }, 500)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const started = Date.now()
  let claimed = 0
  let retrying = 0

  while (Date.now() - started < TIME_BUDGET_MS) {
    const { data, error } = await admin.rpc('claim_outbox_jobs', { max_jobs: BATCH_SIZE })
    if (error) {
      console.error(error)
      return json({ error: 'claim_failed', claimed }, 500)
    }
    const jobs = (data ?? []) as Job[]
    claimed += jobs.length

    await Promise.all(
      jobs.map(async (job) => {
        let failure: string | null
        try {
          failure = await runJob(admin, job)
        } catch (error) {
          failure = error instanceof Error ? error.message : JSON.stringify(error)
        }
        if (failure) {
          retrying += 1
          console.error(`outbox ${job.id}: ${failure}`)
        }
        const { error: finishError } = await admin.rpc('finish_outbox_job', {
          job_id: job.id,
          attempt: job.attempts,
          failure,
        })
        // If this fails too, the lease runs out and the cron retries the job.
        if (finishError) console.error(finishError)
      }),
    )

    if (jobs.length < BATCH_SIZE) break
  }

  return json({ claimed, retrying })
})

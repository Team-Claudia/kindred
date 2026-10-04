// outbox-worker (task 3.3, plan §4.4, ADR-009, ADR-010): sends the push jobs
// the item RPCs queue in public.outbox.
//
// Called by the database, never the app: a trigger on outbox insert and a
// pg_cron job every minute both POST here through pg_net (migration
// 20261003000000_outbox_push_worker.sql). verify_jwt is off so the database
// can call it, so every call must carry the shared secret in x-outbox-secret.
//
// Each job: claim (claim_outbox_jobs, for update skip locked), re-check the
// item (or, for update_posted, the update) and the recipient's membership, write the in-app notifications row,
// then push to each of the recipient's devices if their preference allows,
// and record the result (finish_outbox_job, which handles retries).
// Reminder and overdue jobs (task 4.5b) are run by scheduled.ts, and the
// Sunday weekly_summary jobs (task 4.5g) by weekly-summary.ts, and geocode
// jobs for the map preview (task 4.5h) by geocode.ts.
//
// Secrets: OUTBOX_WORKER_SECRET (the same value as outbox_worker_secret in
// Vault), VAPID_PRIVATE_KEY and VAPID_SUBJECT (../_shared/web-push.ts), and
// GEOAPIFY_API_KEY for geocoding (../_shared/geoapify.ts; optional).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { createHash, timingSafeEqual } from 'node:crypto'
import { isUpdateEvent, pushAllowed, pushMessage, type NotificationPrefs } from '../_shared/push-copy.ts'
import { configureVapid } from '../_shared/web-push.ts'
import { deliver } from './deliver.ts'
// Reminders and overdue alerts (task 4.5b).
import { runScheduledJob } from './scheduled.ts'
// The Sunday weekly summary (task 4.5g).
import { runWeeklySummaryJob } from './weekly-summary.ts'
// Geocoding appointment locations for the map preview (task 4.5h).
import { runGeocodeJob } from './geocode.ts'

const BATCH_SIZE = 10
// Stop claiming new batches after this long, well inside the claim's 2-minute
// lease and the function's time limit; the cron picks up the rest.
const TIME_BUDGET_MS = 40_000

type Job = {
  id: number
  kind: string
  attempts: number
  circle_id: string | null
  payload: Record<string, unknown>
}

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
  const updateId = text(job.payload.update_id)
  const recipientId = text(job.payload.recipient_id)
  const actorId = text(job.payload.actor_id)
  let itemId = text(job.payload.item_id)
  // Item events carry item_id; update events (task 4.1) carry update_id, and
  // item_id too when the update is linked to an item.
  const updateEvent = event !== null && isUpdateEvent(event)
  if (!event || !recipientId || (updateEvent ? !updateId : !itemId)) {
    console.warn(`outbox ${job.id}: malformed push payload; dropped`)
    return null
  }

  // What the push is about decides the circle. If it's gone, so is the push.
  // An update's item is read again, as the item may have been deleted since.
  let circleId: string
  if (updateEvent) {
    const update = await admin
      .from('updates')
      .select('circle_id, item_id')
      .eq('id', updateId!)
      .maybeSingle()
    if (update.error) throw update.error
    if (!update.data) return null
    circleId = update.data.circle_id
    itemId = update.data.item_id
  } else {
    const item = await admin.from('items').select('circle_id').eq('id', itemId!).maybeSingle()
    if (item.error) throw item.error
    if (!item.data) return null // The item is gone.
    circleId = item.data.circle_id
  }

  const [member, circle, actor, prefs] = await Promise.all([
    admin
      .from('circle_members')
      .select('user_id')
      .eq('circle_id', circleId)
      .eq('user_id', recipientId)
      .maybeSingle(),
    admin.from('circles').select('care_recipient_name').eq('id', circleId).single(),
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

  return await deliver(admin, {
    jobId: job.id,
    recipientId,
    kind: event,
    itemId,
    message,
    pushAllowed: pushAllowed(event, prefs.data as Partial<NotificationPrefs> | null),
  })
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
          failure =
            job.kind === 'push'
              ? await runJob(admin, job)
              : job.kind === 'weekly_summary'
                ? await runWeeklySummaryJob(admin, job)
                : job.kind === 'geocode'
                  ? await runGeocodeJob(admin, job)
                  : await runScheduledJob(admin, job)
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

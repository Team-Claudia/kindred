// push-test (task 1.4): sends a test web push to every device the caller has
// turned notifications on for. Kept for debugging push on a phone; real
// notifications come from outbox-worker (task 3.3).
//
// Secrets: VAPID_PRIVATE_KEY and VAPID_SUBJECT (see ../_shared/web-push.ts).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { configureVapid, sendPush, type Subscription } from '../_shared/web-push.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (!configureVapid()) return json({ error: 'not_configured' }, 500)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  // Verify the caller's JWT with Supabase Auth.
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'unauthorized' }, 401)
  const { data: userData, error: userError } = await admin.auth.getUser(token)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

  const { data: subscriptions, error: readError } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, keys')
    .eq('user_id', userData.user.id)
  if (readError) {
    console.error(readError)
    return json({ error: 'unknown' }, 500)
  }

  // Generic payload: only the page to open. The service worker supplies the
  // notification text, so no care details are ever sent (ADR-010).
  const payload = { url: '/notifications' }
  const results = await Promise.allSettled(
    (subscriptions as Subscription[]).map((subscription) => sendPush(subscription, payload)),
  )

  const gone = (subscriptions as Subscription[])
    .filter((_, i) => {
      const result = results[i]
      return result.status === 'fulfilled' && result.value === 'gone'
    })
    .map((subscription) => subscription.id)
  if (gone.length > 0) {
    const { error } = await admin.from('push_subscriptions').delete().in('id', gone)
    if (error) console.error(error)
  }

  for (const result of results) {
    if (result.status === 'rejected') console.error(result.reason)
  }

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value === 'sent').length
  const failed = results.filter((r) => r.status === 'rejected').length
  if (sent === 0 && failed > 0) return json({ error: 'send_failed' }, 502)
  return json({ sent, removed: gone.length, failed })
})

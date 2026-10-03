// google-oauth (task 4.5a, ADR-008): connects a member's Google Calendar for
// "Who's free?", asking Google for the free/busy scope only.
//
// 1. The app POSTs {action: "start"} with the member's JWT and gets back
//    {url}: Google's consent screen, with a signed state naming the member
//    (state.ts). If GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET aren't set it gets
//    {status: "not_configured"} instead.
// 2. Google sends the member back here (GET, no JWT, so verify_jwt is off).
//    This only passes the one-time code and state on to the app:
//    APP_URL/circle?google_code=…&google_state=…, or ?google=declined.
// 3. The app POSTs {action: "finish", code, state} with the member's JWT.
//    The state must be valid and signed for that same member. The code is
//    swapped for a refresh token, which save_google_connection stores in
//    Supabase Vault (never in a table, never logged). Returns
//    {status: "connected"}.
//
// Disconnecting is the disconnect_google_calendar RPC: the app calls it
// directly and it deletes the Vault secret.
//
// Secrets: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL (plan §8.3).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  appUrl,
  corsHeaders,
  FREEBUSY_SCOPE,
  GOOGLE_AUTH_URL,
  googleConfig,
  json,
  tokenRequest,
} from '../_shared/google.ts'
import { signState, verifyState } from './state.ts'

function backToApp(params: Record<string, string>): Response {
  const url = new URL('/circle', appUrl())
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new Response(null, {
    status: 302,
    headers: { Location: url.href, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // Step 2: Google's redirect. Pass the code and state to the app, which
  // finishes as the signed-in member.
  if (req.method === 'GET') {
    const params = new URL(req.url).searchParams
    const code = params.get('code')
    const state = params.get('state')
    if (params.get('error') || !code || !state) {
      // access_denied when the member chose Cancel; anything else is a failure.
      return backToApp({ google: params.get('error') === 'access_denied' ? 'declined' : 'error' })
    }
    return backToApp({ google_code: code.slice(0, 2048), google_state: state.slice(0, 2048) })
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const userId = userData.user.id

  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const config = googleConfig()
  if (!config) return json({ status: 'not_configured' })

  // Step 1: where to send the member to connect.
  if (body?.action === 'start') {
    const url = new URL(GOOGLE_AUTH_URL)
    url.searchParams.set('client_id', config.clientId)
    url.searchParams.set('redirect_uri', config.redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', FREEBUSY_SCOPE)
    // offline + consent: always get a refresh token, even on a second connect.
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('state', await signState(userId, config.clientSecret))
    return json({ url: url.href })
  }

  // Step 3: swap the code for a refresh token and keep it in Vault.
  if (body?.action === 'finish') {
    const code = typeof body.code === 'string' ? body.code : ''
    const state = typeof body.state === 'string' ? body.state : ''
    if (!code || !state) return json({ error: 'invalid_input' }, 400)
    if ((await verifyState(state, config.clientSecret)) !== userId) {
      return json({ error: 'invalid_state' }, 400)
    }

    let token
    try {
      token = await tokenRequest({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      })
    } catch (error) {
      console.error('google-oauth: token request failed', error instanceof Error ? error.name : 'unknown')
      return json({ error: 'google_failed' }, 502)
    }
    const refreshToken = token.body.refresh_token
    const scopes = typeof token.body.scope === 'string' ? token.body.scope.split(' ') : []
    if (!token.ok || typeof refreshToken !== 'string' || !scopes.includes(FREEBUSY_SCOPE)) {
      // Only Google's error code; the reply never holds event details, but
      // it may hold tokens, so it's never logged whole.
      console.error('google-oauth: no refresh token', token.status, token.body.error ?? '')
      return json({ error: 'google_failed' }, 502)
    }

    const { error } = await admin.rpc('save_google_connection', {
      user_id: userId,
      refresh_token: refreshToken,
    })
    if (error) {
      console.error('google-oauth: save failed', error.message)
      return json({ error: 'unknown' }, 500)
    }
    return json({ status: 'connected' })
  }

  return json({ error: 'invalid_input' }, 400)
})

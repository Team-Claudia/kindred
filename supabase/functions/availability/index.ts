// availability (task 4.5a, ADR-008): "Who's free?" for the ask-someone
// pickers.
//
// The app POSTs {circle_id, start, end} with the member's JWT and gets back
// {"<member_id>": "free" | "busy" | "unknown"} for every member of that
// circle. The caller must be in the circle (availability_tokens checks). For
// each member who connected Google Calendar, this asks Google's
// freeBusy.query about their primary calendar for that slot. Google answers
// with busy times only, so no event titles or details ever reach Kindred
// (BR-04), and the answer isn't stored: it's kept in this function's memory
// for 5 minutes, then forgotten. Members who haven't connected, or whose
// token no longer works, are Unknown. With no Google client set up
// (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET), everyone is Unknown.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  corsHeaders,
  fetchWithTimeout,
  GOOGLE_FREEBUSY_URL,
  googleConfig,
  json,
  tokenRequest,
  type GoogleConfig,
} from '../_shared/google.ts'
import {
  type Availability,
  CACHE_TTL_MS,
  cacheKey,
  freeBusyRequest,
  parseRequest,
  type Slot,
  statusFromFreeBusy,
  TtlCache,
} from './availability.ts'

type TokenRow = { member_id: string; refresh_token: string | null }

// Both caches live only as long as this function instance.
const answers = new TtlCache<Availability>()
// Access tokens by refresh token, so a member's next check skips the refresh.
const accessTokens = new TtlCache<string>()

async function accessToken(config: GoogleConfig, refreshToken: string): Promise<string | null> {
  const cached = accessTokens.get(refreshToken)
  if (cached) return cached
  const token = await tokenRequest({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  const access = token.body.access_token
  if (!token.ok || typeof access !== 'string') {
    // e.g. invalid_grant once the member removes Kindred in their Google
    // account. Only the error code is logged.
    console.warn('availability: token refresh failed', token.status, token.body.error ?? '')
    return null
  }
  const expiresIn = typeof token.body.expires_in === 'number' ? token.body.expires_in : 3600
  // Refresh a minute early.
  accessTokens.set(refreshToken, access, Math.max(expiresIn - 60, 0) * 1000)
  return access
}

async function memberStatus(config: GoogleConfig, row: TokenRow, slot: Slot): Promise<Availability> {
  if (!row.refresh_token) return 'unknown'
  // Keyed by connection too, so reconnecting a different Google account never
  // reuses the old account's answer. Memory only, like the access tokens.
  const key = cacheKey(`${row.member_id}|${row.refresh_token}`, slot)
  const cached = answers.get(key)
  if (cached) return cached

  let status: Availability = 'unknown'
  try {
    const access = await accessToken(config, row.refresh_token)
    if (access) {
      const res = await fetchWithTimeout(GOOGLE_FREEBUSY_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(freeBusyRequest(slot)),
      })
      if (res.ok) {
        status = statusFromFreeBusy(await res.json(), slot)
      } else {
        await res.body?.cancel()
        console.warn('availability: freeBusy failed', res.status)
        if (res.status === 401) accessTokens.set(row.refresh_token, '', 0)
      }
    }
  } catch (error) {
    console.warn('availability: Google unreachable', error instanceof Error ? error.name : 'unknown')
  }

  // Unknown isn't kept, so a passing hiccup doesn't last 5 minutes.
  if (status !== 'unknown') answers.set(key, status, CACHE_TTL_MS)
  return status
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
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

  const request = parseRequest(await req.json().catch(() => null))
  if (!request) return json({ error: 'invalid_input' }, 400)

  const { data, error } = await admin.rpc('availability_tokens', {
    circle_id: request.circleId,
    caller_id: userData.user.id,
  })
  if (error) {
    if (error.message === 'not_member') return json({ error: 'not_member' }, 403)
    console.error('availability: tokens failed', error.message)
    return json({ error: 'unknown' }, 500)
  }

  const rows = (data ?? []) as TokenRow[]
  const config = googleConfig()
  const statuses = await Promise.all(
    rows.map((row) => (config ? memberStatus(config, row, request.slot) : Promise.resolve<Availability>('unknown'))),
  )

  const result: Record<string, Availability> = {}
  rows.forEach((row, i) => (result[row.member_id] = statuses[i]))
  return json(result, 200, { 'Cache-Control': 'private, no-store' })
})

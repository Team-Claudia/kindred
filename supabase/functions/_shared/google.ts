// Google Calendar free/busy (task 4.5a, ADR-008), shared by google-oauth and
// availability.
//
// Only the free/busy scope is ever requested: it lets Kindred ask whether a
// member is busy, and Google answers with times only, never titles,
// descriptions, attendees, locations or notes (BR-04).
//
// Secrets: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (plan §8.3). Without
// them, connecting says it isn't set up yet and everyone shows Unknown.
// SUPABASE_URL is provided by Supabase.

export const FREEBUSY_SCOPE = 'https://www.googleapis.com/auth/calendar.freebusy'

export const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GOOGLE_FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy'

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string }

/** The OAuth client, or null if the one-time setup (plan §8.3) hasn't been done. */
export function googleConfig(): GoogleConfig | null {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')?.trim()
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '')
  if (!clientId || !clientSecret || !supabaseUrl) return null
  // Google sends the member back to the google-oauth function. This must match
  // an authorised redirect URI on the OAuth client exactly.
  return { clientId, clientSecret, redirectUri: `${supabaseUrl}/functions/v1/google-oauth` }
}

/** Calls fetch, giving up after `ms`. */
export function fetchWithTimeout(url: string, init: RequestInit, ms = 8000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) })
}

/** POSTs a form to Google's token endpoint and returns the JSON reply. */
export async function tokenRequest(
  params: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetchWithTimeout(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const body = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, body: body as Record<string, unknown> }
}

// Used when APP_URL isn't set: the production app (as in calendar-feed).
const DEFAULT_APP_URL = 'https://kindred-care-circle.vercel.app'

/** The app's origin, where google-oauth sends the member back to. */
export function appUrl(): string {
  return (Deno.env.get('APP_URL') || DEFAULT_APP_URL).replace(/\/+$/, '')
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...headers },
  })
}

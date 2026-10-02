// calendar-feed (task 3.4, ADR-008): a member's personal .ics feed.
//
// Calendar apps call it with no sign-in, through the Vercel rewrite
// /cal/:token.ics -> /functions/v1/calendar-feed?token=:token. The token is
// the member's secret calendar_settings.feed_token; the feed lists the items
// they've accepted (calendar_feed_for_token decides which). An unknown token
// gets a bare 404 that says nothing about whether it was ever valid.
//
// Secrets: APP_URL (the app's origin, for the /i/<id> links in each event).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { buildCalendar, type FeedItem } from './ics.ts'

// Used when APP_URL isn't set: the production app (also in config.toml).
const DEFAULT_APP_URL = 'https://kindred-care-circle.vercel.app'

// feed_token is 24 random bytes as hex.
const TOKEN = /^[0-9a-f]{48}$/

type FeedRow = {
  care_recipient_name: string | null
  time_zone: string
  items: FeedItem[]
}

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } })
  }

  // Accept "abc…" or "abc….ics", in case the rewrite passes the extension on.
  const token = new URL(req.url).searchParams.get('token')?.replace(/\.ics$/, '').toLowerCase()
  if (!token || !TOKEN.test(token)) return notFound()

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  const { data, error } = await admin.rpc('calendar_feed_for_token', { token })
  if (error) {
    console.error(error)
    return new Response('Something went wrong', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (!data) return notFound()

  const feed = data as FeedRow
  const body = buildCalendar({
    careRecipientName: feed.care_recipient_name,
    timeZone: feed.time_zone,
    appUrl: Deno.env.get('APP_URL') || DEFAULT_APP_URL,
    items: feed.items,
    now: new Date(),
  })

  return new Response(req.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="kindred.ics"',
      // Short, and private: the URL is a secret, so shared caches shouldn't keep it.
      'Cache-Control': 'private, max-age=300',
    },
  })
})

// static-map (task 4.5h, plan §4.4, ADR-017, PRD US 4.3): the map image under
// an appointment's location.
//
// The app GETs ?item=<id> with the member's JWT (verify_jwt is off; the
// function checks it, as availability does). If the member is in the item's
// circle and its location was found (location_lat / location_lng, filled in
// by the outbox-worker's geocode job), this fetches a small map of those
// coordinates from Geoapify and returns the image with a long, private cache
// header. Otherwise, with no GEOAPIFY_API_KEY, or if Geoapify refuses (e.g.
// the day's quota ran out), it returns 404 and the app shows the location as
// text. Geoapify only receives the coordinates.
//
// Secret: GEOAPIFY_API_KEY (plan §8.3). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { geoapifyKey, staticMapUrl } from '../_shared/geoapify.ts'
import { fetchWithTimeout } from '../_shared/google.ts'
import { handleStaticMap } from './handler.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

Deno.serve((req) =>
  handleStaticMap(req, {
    async getUser(jwt) {
      const { data, error } = await admin.auth.getUser(jwt)
      return error || !data.user ? null : data.user.id
    },

    async getItem(itemId) {
      const { data, error } = await admin
        .from('items')
        .select('circle_id, location_lat, location_lng')
        .eq('id', itemId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return null
      const { circle_id, location_lat: lat, location_lng: lng } = data
      return { circleId: circle_id, coords: lat === null || lng === null ? null : { lat, lng } }
    },

    async isMember(circleId, userId) {
      const { data, error } = await admin
        .from('circle_members')
        .select('user_id')
        .eq('circle_id', circleId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data !== null
    },

    async fetchMap(coords) {
      const key = geoapifyKey()
      if (!key) return null
      const res = await fetchWithTimeout(staticMapUrl(coords, key), { method: 'GET' })
      const contentType = res.headers.get('Content-Type') ?? ''
      if (!res.ok || !contentType.startsWith('image/')) {
        await res.body?.cancel()
        // e.g. 429 once the day's free credits are used up.
        console.warn('static-map: Geoapify refused', res.status)
        return null
      }
      return { body: res.body, contentType }
    },
  })
)

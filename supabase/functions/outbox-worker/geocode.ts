// Geocoding an appointment's location for its map (task 4.5h, plan §4.4,
// ADR-017).
//
// The trigger on items (migration 20261005040000_map_preview.sql) queues
//   geocode {item_id}
// when an appointment's location is set or changed, once per place in a
// circle. This reads the item's location text, asks Geoapify where it is
// (sending only that text) and stores the coordinates with store_geocode,
// which fills them in on every appointment in the circle at that text. If
// nothing is found confidently, they stay null and the app shows the text.

import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { fetchWithTimeout } from '../_shared/google.ts'
import { type Coords, geoapifyKey, geocodeUrl, parseGeocode } from '../_shared/geoapify.ts'

type Job = { id: number; payload: Record<string, unknown> }

export type GeocodeItem = { kind: string; location: string | null; location_lat: number | null }

export interface GeocodeDeps {
  /** The item now, or null if it's gone. */
  readItem(itemId: string): Promise<GeocodeItem | null>
  /**
   * Asks Geoapify about the location text: the place, null if it found
   * nothing, 'not_configured' with no key (or one Geoapify refuses), or an
   * error message to retry.
   */
  geocode(location: string): Promise<Coords | null | 'not_configured' | { error: string }>
  /** store_geocode: how many items now have the coordinates. */
  store(itemId: string, location: string, coords: Coords): Promise<number>
}

// Resolves null when finished (stored, or nothing to do) and an error message
// when the job should be retried.
export async function geocodeJob(job: Job, deps: GeocodeDeps): Promise<string | null> {
  const itemId = typeof job.payload.item_id === 'string' ? job.payload.item_id : null
  if (!itemId) {
    console.warn(`outbox ${job.id}: malformed geocode payload; dropped`)
    return null
  }

  const item = await deps.readItem(itemId)
  // Gone, a task, no location, or already found (reused from another item).
  if (!item || item.kind !== 'appointment' || !item.location || item.location_lat !== null) {
    console.log(`outbox ${job.id}: geocode dropped (nothing to find)`)
    return null
  }

  const result = await deps.geocode(item.location)
  if (result === 'not_configured') {
    // queue_missing_geocodes() queues these again once the key works.
    console.warn(`outbox ${job.id}: no working GEOAPIFY_API_KEY; location stays as text`)
    return null
  }
  if (result && 'error' in result) return result.error
  if (!result) {
    console.log(`outbox ${job.id}: geocode found nothing; location stays as text`)
    return null
  }

  await deps.store(itemId, item.location, result)
  return null
}

export function runGeocodeJob(admin: SupabaseClient, job: Job): Promise<string | null> {
  return geocodeJob(job, {
    async readItem(itemId) {
      const { data, error } = await admin
        .from('items')
        .select('kind, location, location_lat')
        .eq('id', itemId)
        .maybeSingle()
      if (error) throw error
      return data as GeocodeItem | null
    },

    async geocode(location) {
      const key = geoapifyKey()
      if (!key) return 'not_configured'
      const res = await fetchWithTimeout(geocodeUrl(location, key), { method: 'GET' })
      if (!res.ok) {
        await res.body?.cancel()
        // Only the status is logged, never the location.
        console.warn('geocode: Geoapify refused', res.status)
        // A wrong or revoked key won't work on a retry either.
        if (res.status === 401 || res.status === 403) return 'not_configured'
        // Nor will text Geoapify can't take.
        if (res.status === 400) return null
        // e.g. 429 once the day's free credits are used up, or 5xx: retried.
        return { error: `geoapify_${res.status}` }
      }
      return parseGeocode(await res.json())
    },

    async store(itemId, location, coords) {
      const { data, error } = await admin.rpc('store_geocode', {
        item_id: itemId,
        location,
        lat: coords.lat,
        lng: coords.lng,
      })
      if (error) throw error
      return data as number
    },
  })
}

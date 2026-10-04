// Geoapify, for the map preview (task 4.5h, ADR-017), shared by the
// outbox-worker's geocode job and the static-map function.
//
// Geoapify only ever receives an appointment's location text (to geocode it)
// or its coordinates (to draw the map), never its title, notes or people.
// The key stays in function secrets; the app never sees it.
//
// Secret: GEOAPIFY_API_KEY (plan §8.3). Without it, nothing is geocoded, no
// map is drawn, and the app shows locations as text.

export const GEOAPIFY_GEOCODE_URL = 'https://api.geoapify.com/v1/geocode/search'
export const GEOAPIFY_STATIC_MAP_URL = 'https://maps.geoapify.com/v1/staticmap'

export type Coords = { lat: number; lng: number }

/** The API key, or null if the one-time setup (plan §8.3) hasn't been done. */
export function geoapifyKey(): string | null {
  return Deno.env.get('GEOAPIFY_API_KEY')?.trim() || null
}

/** The geocoding request for a location: the text and nothing else. */
export function geocodeUrl(location: string, key: string): string {
  const params = new URLSearchParams({ text: location, format: 'json', limit: '1', apiKey: key })
  return `${GEOAPIFY_GEOCODE_URL}?${params}`
}

// Below this, Geoapify is guessing, e.g. "Dad's house" matching a street
// somewhere: better to show the text than the wrong place.
export const MIN_CONFIDENCE = 0.7

// Matches this broad are a region, not a place anyone can be driven to.
const TOO_BROAD = new Set(['country', 'state', 'county'])

/** The place in a geocoding reply, or null if nothing was found confidently. */
export function parseGeocode(body: unknown): Coords | null {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results) || results.length === 0) return null
  const first = results[0] as {
    lat?: unknown
    lon?: unknown
    result_type?: unknown
    rank?: { confidence?: unknown }
  }
  const { lat, lon } = first
  const confidence = first.rank?.confidence
  if (typeof lat !== 'number' || typeof lon !== 'number') return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null
  if (typeof confidence !== 'number' || confidence < MIN_CONFIDENCE) return null
  if (typeof first.result_type === 'string' && TOO_BROAD.has(first.result_type)) return null
  return { lat, lng: lon }
}

/** The static map image request: a small street map with a pin. */
export function staticMapUrl({ lat, lng }: Coords, key: string): string {
  const params = new URLSearchParams({
    style: 'osm-bright',
    width: '600',
    height: '300',
    scaleFactor: '2',
    format: 'png',
    center: `lonlat:${lng},${lat}`,
    zoom: '15',
    marker: `lonlat:${lng},${lat};type:material;color:#c2410c;size:large`,
    apiKey: key,
  })
  return `${GEOAPIFY_STATIC_MAP_URL}?${params}`
}

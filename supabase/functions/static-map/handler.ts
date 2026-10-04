// The static-map function's request handling (task 4.5h, ADR-017), with the
// database and Geoapify passed in, so handler.test.ts can check the
// membership check without either.

import type { Coords } from '../_shared/geoapify.ts'
import { corsHeaders, json } from '../_shared/google.ts'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The app adds the coordinates to the URL, so a moved appointment gets a new
// image; the same coordinates always give the same map. Private: only the
// member's own browser keeps it.
export const CACHE_CONTROL = 'private, max-age=2592000, immutable'

const headers = {
  ...corsHeaders,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

export type MapItem = { circleId: string; coords: Coords | null }

export interface StaticMapDeps {
  /** The signed-in member's ID for a JWT, or null if it isn't valid. */
  getUser(jwt: string): Promise<string | null>
  /** The item's circle and stored coordinates, or null if there's no such item. */
  getItem(itemId: string): Promise<MapItem | null>
  /** Whether the member is in the circle. */
  isMember(circleId: string, userId: string): Promise<boolean>
  /**
   * The map image from Geoapify for the coordinates, or null with no key or
   * when Geoapify refuses (e.g. the day's quota ran out).
   */
  fetchMap(coords: Coords): Promise<{ body: ReadableStream<Uint8Array> | null; contentType: string } | null>
}

function nothing(): Response {
  // The app shows the location as text. Not cached, so a map can appear once
  // the location is found or the quota resets.
  return json({ error: 'not_found' }, 404, { ...headers, 'Cache-Control': 'no-store' })
}

export async function handleStaticMap(req: Request, deps: StaticMapDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405, headers)

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401, headers)
  const userId = await deps.getUser(jwt)
  if (!userId) return json({ error: 'unauthorized' }, 401, headers)

  const itemId = new URL(req.url).searchParams.get('item') ?? ''
  if (!UUID.test(itemId)) return json({ error: 'invalid_input' }, 400, headers)

  try {
    const item = await deps.getItem(itemId)
    // Another circle's item looks the same as no item at all.
    if (!item || !(await deps.isMember(item.circleId, userId))) return nothing()
    if (!item.coords) return nothing()

    const map = await deps.fetchMap(item.coords)
    if (!map) return nothing()
    return new Response(map.body, {
      status: 200,
      headers: { ...headers, 'Content-Type': map.contentType, 'Cache-Control': CACHE_CONTROL },
    })
  } catch (error) {
    console.error('static-map: failed', error instanceof Error ? error.message : 'unknown')
    return nothing()
  }
}

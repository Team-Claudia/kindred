// Tests for the static-map function (task 4.5h). Run with:
//   deno test supabase/functions/static-map/
import { assertEquals } from 'jsr:@std/assert@1'
import type { Coords } from '../_shared/geoapify.ts'
import { CACHE_CONTROL, handleStaticMap, type MapItem, type StaticMapDeps } from './handler.ts'

const ALICE = 'a0000000-0000-4000-8000-00000000000a'
const ERIN = 'e0000000-0000-4000-8000-00000000000e'
const CIRCLE = '10000000-0000-4000-8000-000000000001'
const ITEM = '6f1c2b1e-0000-4000-8000-000000000001'
const FOUND: Coords = { lat: 43.6588, lng: -79.3887 }

function fakes(options: {
  user?: string | null
  item?: MapItem | null
  members?: string[]
  map?: boolean
} = {}) {
  const calls: string[] = []
  const deps: StaticMapDeps = {
    getUser(jwt) {
      calls.push(`getUser:${jwt}`)
      return Promise.resolve(options.user === undefined ? ALICE : options.user)
    },
    getItem(itemId) {
      calls.push(`getItem:${itemId}`)
      return Promise.resolve(options.item === undefined ? { circleId: CIRCLE, coords: FOUND } : options.item)
    },
    isMember(circleId, userId) {
      calls.push(`isMember:${circleId}|${userId}`)
      return Promise.resolve((options.members ?? [ALICE]).includes(userId))
    },
    fetchMap(coords) {
      calls.push(`fetchMap:${coords.lat},${coords.lng}`)
      if (options.map === false) return Promise.resolve(null)
      return Promise.resolve({ body: new Blob(['png']).stream(), contentType: 'image/png' })
    },
  }
  return { calls, deps }
}

function get(query = `?item=${ITEM}`, jwt: string | null = 'alice-jwt', method = 'GET'): Request {
  return new Request(`http://localhost/static-map${query}`, {
    method,
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
  })
}

Deno.test('a member gets the map of the stored coordinates, cached for a long time', async () => {
  const { calls, deps } = fakes()
  const res = await handleStaticMap(get(), deps)
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('Content-Type'), 'image/png')
  assertEquals(res.headers.get('Cache-Control'), CACHE_CONTROL)
  assertEquals(await res.text(), 'png')
  assertEquals(calls, [
    'getUser:alice-jwt',
    `getItem:${ITEM}`,
    `isMember:${CIRCLE}|${ALICE}`,
    'fetchMap:43.6588,-79.3887',
  ])
})

Deno.test('someone outside the circle gets nothing, and Geoapify is not asked', async () => {
  const { calls, deps } = fakes({ user: ERIN })
  const res = await handleStaticMap(get(), deps)
  assertEquals(res.status, 404)
  assertEquals(res.headers.get('Cache-Control'), 'no-store')
  assertEquals(calls.some((call) => call.startsWith('fetchMap')), false)
})

Deno.test('an item that does not exist looks the same as another circle\'s', async () => {
  const { calls, deps } = fakes({ item: null })
  const res = await handleStaticMap(get(), deps)
  assertEquals(res.status, 404)
  assertEquals(calls, ['getUser:alice-jwt', `getItem:${ITEM}`])
})

Deno.test('no coordinates (not found on the map): nothing', async () => {
  const { calls, deps } = fakes({ item: { circleId: CIRCLE, coords: null } })
  const res = await handleStaticMap(get(), deps)
  assertEquals(res.status, 404)
  assertEquals(calls.some((call) => call.startsWith('fetchMap')), false)
})

Deno.test('no key, or the quota ran out: nothing', async () => {
  const { deps } = fakes({ map: false })
  const res = await handleStaticMap(get(), deps)
  assertEquals(res.status, 404)
})

Deno.test('without a valid JWT: unauthorized, before anything is read', async () => {
  for (const [jwt, user] of [[null, ALICE], ['bad-jwt', null]] as const) {
    const { calls, deps } = fakes({ user })
    const res = await handleStaticMap(get(undefined, jwt), deps)
    assertEquals(res.status, 401)
    assertEquals(calls.some((call) => call.startsWith('getItem')), false)
  }
})

Deno.test('a missing or malformed item ID is invalid input', async () => {
  for (const query of ['', '?item=', '?item=not-a-uuid']) {
    const { deps } = fakes()
    const res = await handleStaticMap(get(query), deps)
    assertEquals(res.status, 400)
  }
})

Deno.test('CORS preflight is answered, and only GET is allowed', async () => {
  const { deps } = fakes()
  const preflight = await handleStaticMap(get(undefined, null, 'OPTIONS'), deps)
  assertEquals(preflight.status, 200)
  assertEquals(preflight.headers.get('Access-Control-Allow-Methods'), 'GET, OPTIONS')
  const post = await handleStaticMap(get(undefined, 'alice-jwt', 'POST'), deps)
  assertEquals(post.status, 405)
})

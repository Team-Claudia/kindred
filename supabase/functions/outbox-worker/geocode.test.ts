// Tests for the geocode job (task 4.5h). Run with:
//   deno test supabase/functions/outbox-worker/
import { assertEquals } from 'jsr:@std/assert@1'
import type { Coords } from '../_shared/geoapify.ts'
import { geocodeJob, type GeocodeDeps, type GeocodeItem } from './geocode.ts'

const ITEM = '6f1c2b1e-0000-4000-8000-000000000001'
const CLINIC: GeocodeItem = { kind: 'appointment', location: '200 Elizabeth St, Toronto', location_lat: null }
const FOUND: Coords = { lat: 43.6588, lng: -79.3887 }

function fakes(options: {
  item?: GeocodeItem | null
  result?: Awaited<ReturnType<GeocodeDeps['geocode']>>
} = {}) {
  const calls: string[] = []
  const deps: GeocodeDeps = {
    readItem(itemId) {
      calls.push(`read:${itemId}`)
      return Promise.resolve(options.item === undefined ? CLINIC : options.item)
    },
    geocode(location) {
      calls.push(`geocode:${location}`)
      return Promise.resolve(options.result === undefined ? FOUND : options.result)
    },
    store(itemId, location, coords) {
      calls.push(`store:${itemId}|${location}|${coords.lat},${coords.lng}`)
      return Promise.resolve(1)
    },
  }
  return { calls, deps }
}

const job = { id: 1, payload: { item_id: ITEM } }

Deno.test('geocode: sends only the location text, then stores what was found for that text', async () => {
  const { calls, deps } = fakes()
  assertEquals(await geocodeJob(job, deps), null)
  assertEquals(calls, [
    `read:${ITEM}`,
    'geocode:200 Elizabeth St, Toronto',
    `store:${ITEM}|200 Elizabeth St, Toronto|43.6588,-79.3887`,
  ])
})

Deno.test("geocode: nothing found (\"Dad's house\") stores nothing, so it stays as text", async () => {
  const { calls, deps } = fakes({
    item: { kind: 'appointment', location: "Dad's house", location_lat: null },
    result: null,
  })
  assertEquals(await geocodeJob(job, deps), null)
  assertEquals(calls, [`read:${ITEM}`, "geocode:Dad's house"])
})

Deno.test('geocode: with no API key, the job finishes without calling anyone', async () => {
  const { calls, deps } = fakes({ result: 'not_configured' })
  assertEquals(await geocodeJob(job, deps), null)
  assertEquals(calls, [`read:${ITEM}`, 'geocode:200 Elizabeth St, Toronto'])
})

Deno.test('geocode: a Geoapify error (e.g. the quota ran out) is retried', async () => {
  const { calls, deps } = fakes({ result: { error: 'geoapify_429' } })
  assertEquals(await geocodeJob(job, deps), 'geoapify_429')
  assertEquals(calls.some((call) => call.startsWith('store:')), false)
})

Deno.test('geocode: nothing to find is dropped without asking Geoapify', async () => {
  const cases: (GeocodeItem | null)[] = [
    null, // deleted
    { kind: 'task', location: '200 Elizabeth St, Toronto', location_lat: null },
    { kind: 'appointment', location: null, location_lat: null },
    { kind: 'appointment', location: '200 Elizabeth St, Toronto', location_lat: 43.6588 }, // already found
  ]
  for (const item of cases) {
    const { calls, deps } = fakes({ item })
    assertEquals(await geocodeJob(job, deps), null)
    assertEquals(calls, [`read:${ITEM}`])
  }
})

Deno.test('geocode: a malformed payload is dropped', async () => {
  const { calls, deps } = fakes()
  assertEquals(await geocodeJob({ id: 2, payload: {} }, deps), null)
  assertEquals(calls, [])
})

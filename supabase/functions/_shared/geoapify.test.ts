// Run with: deno test supabase/functions (CI job "Edge Functions").
import { assertEquals } from 'jsr:@std/assert@1'
import { geocodeUrl, parseGeocode, staticMapUrl } from './geoapify.ts'

Deno.test('geocodeUrl: sends the location text and the key, nothing else', () => {
  const url = new URL(geocodeUrl("Dad's house, 12 Oak St", 'key-1'))
  assertEquals(url.origin + url.pathname, 'https://api.geoapify.com/v1/geocode/search')
  assertEquals(Object.fromEntries(url.searchParams), {
    text: "Dad's house, 12 Oak St",
    format: 'json',
    limit: '1',
    apiKey: 'key-1',
  })
})

Deno.test('staticMapUrl: sends the coordinates and the key, nothing else', () => {
  const url = new URL(staticMapUrl({ lat: 43.6588, lng: -79.3887 }, 'key-1'))
  assertEquals(url.origin + url.pathname, 'https://maps.geoapify.com/v1/staticmap')
  assertEquals(url.searchParams.get('center'), 'lonlat:-79.3887,43.6588')
  assertEquals(url.searchParams.get('apiKey'), 'key-1')
  assertEquals([...url.searchParams.keys()].sort(), [
    'apiKey', 'center', 'format', 'height', 'marker', 'scaleFactor', 'style', 'width', 'zoom',
  ])
})

const result = (overrides: Record<string, unknown> = {}) => ({
  results: [{ lat: 43.6588, lon: -79.3887, result_type: 'amenity', rank: { confidence: 0.95 }, ...overrides }],
})

Deno.test('parseGeocode: a confident match is the place', () => {
  assertEquals(parseGeocode(result()), { lat: 43.6588, lng: -79.3887 })
})

Deno.test('parseGeocode: nothing, a guess, a region or junk is not found', () => {
  assertEquals(parseGeocode({ results: [] }), null)
  assertEquals(parseGeocode(result({ rank: { confidence: 0.3 } })), null)
  assertEquals(parseGeocode(result({ rank: {} })), null)
  assertEquals(parseGeocode(result({ result_type: 'country' })), null)
  assertEquals(parseGeocode(result({ lat: 'x' })), null)
  assertEquals(parseGeocode(result({ lat: 123 })), null)
  assertEquals(parseGeocode(null), null)
  assertEquals(parseGeocode({ error: 'Unauthorized' }), null)
})

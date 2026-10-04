import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import { staticMap } from '@/lib/api'
import { platform } from '@/platform'
import { MapPreview } from './map-preview'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  staticMap: vi.fn(),
}))
vi.mock('@/platform', () => ({
  platform: {
    openMaps: vi.fn(),
    imageUrl: vi.fn(() => ({ url: 'blob:map-1', release: vi.fn() })),
  },
}))

const ITEM = 'item-1'
const LOCATION = 'Toronto General Hospital, 200 Elizabeth St'

function renderMap(lat: number | null, lng: number | null) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <p>{LOCATION}</p>
      <MapPreview itemId={ITEM} location={LOCATION} lat={lat} lng={lng} />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

test('a found location shows its map with the credits; tapping it opens Maps', async () => {
  vi.mocked(staticMap).mockResolvedValue(new Blob(['png'], { type: 'image/png' }))
  renderMap(43.6588, -79.3887)

  const map = await screen.findByRole('button', { name: `Map of ${LOCATION}. Opens directions in Maps.` })
  expect(staticMap).toHaveBeenCalledWith(ITEM, { lat: 43.6588, lng: -79.3887 })
  expect(map.querySelector('img')).toHaveAttribute('src', 'blob:map-1')
  expect(screen.getByText('Powered by Geoapify')).toBeInTheDocument()
  expect(screen.getByText('© OpenStreetMap contributors')).toBeInTheDocument()

  fireEvent.click(map)
  expect(platform.openMaps).toHaveBeenCalledWith({ lat: 43.6588, lng: -79.3887 })
})

test("a location that wasn't found (\"Dad's house\") stays as text, with no map", () => {
  renderMap(null, null)
  expect(screen.getByText(LOCATION)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByText('Powered by Geoapify')).not.toBeInTheDocument()
  expect(staticMap).not.toHaveBeenCalled()
})

test('no map from the server (no key, or the quota ran out): text only', async () => {
  vi.mocked(staticMap).mockResolvedValue(null)
  renderMap(43.6588, -79.3887)
  await vi.waitFor(() => expect(staticMap).toHaveBeenCalled())
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.getByText(LOCATION)).toBeInTheDocument()
})

test('a failed request shows no map either', async () => {
  vi.mocked(staticMap).mockRejectedValue(new Error('offline'))
  renderMap(43.6588, -79.3887)
  await vi.waitFor(() => expect(staticMap).toHaveBeenCalled())
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

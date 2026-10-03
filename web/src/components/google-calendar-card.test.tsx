import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { platform } from '@/platform'
import { GoogleCalendarCard } from './google-calendar-card'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  googleCalendarConnected: vi.fn(),
  disconnectGoogleCalendar: vi.fn(),
  startGoogleConnect: vi.fn(),
  finishGoogleConnect: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ status: 'signed_in', session: { user: { id: 'user-1' } } }),
}))
vi.mock('@/platform', () => ({ platform: { openExternal: vi.fn() } }))

function renderCard(path = '/circle') {
  const router = createMemoryRouter([{ path: '/circle', element: <GoogleCalendarCard /> }], {
    initialEntries: [path],
  })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

afterEach(() => vi.clearAllMocks())

test('says only free/busy is read', async () => {
  vi.mocked(api.googleCalendarConnected).mockResolvedValue(false)
  renderCard()
  expect(screen.getByText(/only reads when you're free or busy, never your events' titles or details/)).toBeInTheDocument()
})

test('Connect sends the member to Google', async () => {
  vi.mocked(api.googleCalendarConnected).mockResolvedValue(false)
  vi.mocked(api.startGoogleConnect).mockResolvedValue({ url: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' })
  renderCard()
  const connect = screen.getByRole('button', { name: 'Connect Google Calendar' })
  await vi.waitFor(() => expect(connect).toBeEnabled())
  fireEvent.click(connect)
  await vi.waitFor(() =>
    expect(platform.openExternal).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1'),
  )
})

test('Connect explains when Google isn’t set up yet', async () => {
  vi.mocked(api.googleCalendarConnected).mockResolvedValue(false)
  vi.mocked(api.startGoogleConnect).mockResolvedValue('not_configured')
  renderCard()
  const connect = screen.getByRole('button', { name: 'Connect Google Calendar' })
  await vi.waitFor(() => expect(connect).toBeEnabled())
  fireEvent.click(connect)
  expect(await screen.findByText(/isn't set up yet/)).toBeInTheDocument()
  expect(platform.openExternal).not.toHaveBeenCalled()
})

test('back from Google, it finishes connecting and clears the code from the address', async () => {
  vi.mocked(api.googleCalendarConnected).mockResolvedValue(false)
  vi.mocked(api.finishGoogleConnect).mockResolvedValue()
  const router = renderCard('/circle?google_code=abc&google_state=signed')
  expect(await screen.findByText(/Connected. Others can now see/)).toBeInTheDocument()
  expect(api.finishGoogleConnect).toHaveBeenCalledTimes(1)
  expect(api.finishGoogleConnect).toHaveBeenCalledWith('abc', 'signed')
  expect(router.state.location.search).toBe('')
  expect(screen.getByRole('button', { name: 'Disconnect' })).toBeInTheDocument()
})

test('says so when the member chose Cancel on Google’s screen', async () => {
  vi.mocked(api.googleCalendarConnected).mockResolvedValue(false)
  renderCard('/circle?google=declined')
  expect(await screen.findByText(/wasn't connected. You can connect it any time/)).toBeInTheDocument()
  expect(api.finishGoogleConnect).not.toHaveBeenCalled()
})

test('Disconnect forgets the connection', async () => {
  vi.mocked(api.googleCalendarConnected).mockResolvedValue(true)
  vi.mocked(api.disconnectGoogleCalendar).mockResolvedValue(undefined)
  renderCard()
  expect(await screen.findByText('Google Calendar is connected.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }))
  expect(await screen.findByRole('button', { name: 'Connect Google Calendar' })).toBeInTheDocument()
  expect(api.disconnectGoogleCalendar).toHaveBeenCalled()
})

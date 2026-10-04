import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import '@/i18n'
import { notificationPrefs, setNotificationPref, type NotificationPrefs } from '@/lib/api'
import { NotificationPrefsList } from './notification-prefs-list'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  notificationPrefs: vi.fn(),
  setNotificationPref: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ status: 'signed_in', session: { user: { id: 'user-1' } } }),
}))

const DEFAULTS: NotificationPrefs = {
  requests: true,
  reminders: true,
  changes: true,
  updates: true,
  weekly_summary: true,
  comments: true,
  everything_else: false,
}

function renderList() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NotificationPrefsList />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(notificationPrefs).mockResolvedValue(DEFAULTS)
})

afterEach(() => vi.clearAllMocks())

test('lists the categories in PRD order, without Comments, with defaults as text', async () => {
  renderList()
  const switches = await screen.findAllByRole('switch')
  await vi.waitFor(() => expect(switches[0]).toBeEnabled())
  expect(switches.map((s) => s.getAttribute('aria-label'))).toEqual([
    'Requests',
    'Reminders and overdue',
    'Changes',
    'Updates',
    'Weekly summary',
    'Everything else',
  ])
  expect(switches.map((s) => s.textContent)).toEqual(['On', 'On', 'On', 'On', 'On', 'Off'])
  expect(switches.map((s) => s.getAttribute('aria-checked'))).toEqual([
    'true',
    'true',
    'true',
    'true',
    'true',
    'false',
  ])
  expect(screen.queryByText('Comments')).not.toBeInTheDocument()
  expect(
    screen.getByText("Everything still shows in Kindred; this only changes what's pushed to your phone."),
  ).toBeInTheDocument()
})

test('turning a category off saves just that category', async () => {
  vi.mocked(setNotificationPref).mockResolvedValue({ ...DEFAULTS, changes: false })
  renderList()
  const changes = await screen.findByRole('switch', { name: 'Changes' })
  await vi.waitFor(() => expect(changes).toBeEnabled())
  fireEvent.click(changes)
  await vi.waitFor(() => expect(setNotificationPref).toHaveBeenCalledWith('changes', false))
  await vi.waitFor(() => expect(within(changes).getByText('Off')).toBeInTheDocument())
  expect(screen.getByRole('switch', { name: 'Requests' })).toHaveTextContent('On')
})

test('turning on a category that is off by default', async () => {
  vi.mocked(setNotificationPref).mockResolvedValue({ ...DEFAULTS, everything_else: true })
  renderList()
  const other = await screen.findByRole('switch', { name: 'Everything else' })
  await vi.waitFor(() => expect(other).toBeEnabled())
  fireEvent.click(other)
  await vi.waitFor(() => expect(setNotificationPref).toHaveBeenCalledWith('everything_else', true))
  await vi.waitFor(() => expect(other).toHaveTextContent('On'))
})

test('says so and offers a retry when the choices cannot be loaded', async () => {
  vi.mocked(notificationPrefs).mockRejectedValue(new Error('offline'))
  renderList()
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your notification choices.")
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

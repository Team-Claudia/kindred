import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import { calendarFeed, setCalendarFeedTasks } from '@/lib/api'
import { platform } from '@/platform'
import { CalendarFeedCard } from './calendar-feed-card'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  calendarFeed: vi.fn(),
  setCalendarFeedTasks: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ status: 'signed_in', session: { user: { id: 'user-1' } } }),
}))
vi.mock('@/platform', () => ({
  platform: {
    appUrl: (path: string) => `https://kindred.example${path}`,
    addCalendarFeed: vi.fn(),
    copyText: vi.fn(),
  },
}))

const TOKEN = 'ab'.repeat(24)
const URL = `https://kindred.example/cal/${TOKEN}.ics`

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <CalendarFeedCard />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(calendarFeed).mockResolvedValue({ token: TOKEN, feed_tasks: false })
})

afterEach(() => vi.clearAllMocks())

test('Add Kindred to my calendar subscribes to the member’s feed', async () => {
  renderCard()
  const add = screen.getByRole('button', { name: 'Add Kindred to my calendar' })
  await vi.waitFor(() => expect(add).toBeEnabled())
  fireEvent.click(add)
  expect(platform.addCalendarFeed).toHaveBeenCalledWith(URL)
})

test('Copy link copies the feed URL', async () => {
  vi.mocked(platform.copyText).mockResolvedValue(true)
  renderCard()
  const copy = screen.getByRole('button', { name: 'Copy link' })
  await vi.waitFor(() => expect(copy).toBeEnabled())
  fireEvent.click(copy)
  expect(await screen.findByText('Link copied')).toBeInTheDocument()
  expect(platform.copyText).toHaveBeenCalledWith(URL)
})

test('shows the link to copy by hand if copying fails', async () => {
  vi.mocked(platform.copyText).mockResolvedValue(false)
  renderCard()
  const copy = screen.getByRole('button', { name: 'Copy link' })
  await vi.waitFor(() => expect(copy).toBeEnabled())
  fireEvent.click(copy)
  expect(await screen.findByText(URL)).toBeInTheDocument()
})

test('the tasks switch saves the setting', async () => {
  vi.mocked(setCalendarFeedTasks).mockResolvedValue({ token: TOKEN, feed_tasks: true })
  renderCard()
  const tasks = screen.getByRole('checkbox', { name: 'Include tasks as well as appointments' })
  await vi.waitFor(() => expect(tasks).toBeEnabled())
  expect(tasks).not.toBeChecked()
  fireEvent.click(tasks)
  await vi.waitFor(() => expect(tasks).toBeChecked())
  expect(vi.mocked(setCalendarFeedTasks).mock.calls[0][0]).toBe(true)
})

test('offers Try again if the link fails to load', async () => {
  vi.mocked(calendarFeed).mockRejectedValue(new Error('offline'))
  renderCard()
  expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load your calendar link")
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

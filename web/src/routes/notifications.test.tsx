import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { HomeTopBar } from '@/components/home-top-bar'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import { supabase } from '@/lib/supabase'
import Notifications from './notifications'

// A pretend notifications table: the supabase-js calls the screen and the
// bell make read from it, and mark_notifications_read writes to it.
type Row = {
  id: number
  user_id: string
  kind: string
  item_id: string | null
  line: string
  created_at: string
  read_at: string | null
}
let table: Row[] = []

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  markNotificationsRead: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof circles>()),
  useMyMembership: vi.fn(),
}))
vi.mock('@/lib/use-now', () => ({ useNow: () => new Date('2026-10-05T20:00:00Z') }))

function query() {
  let rows = () => [...table]
  let head = false
  const builder = {
    select: (_columns: string, options?: { head?: boolean }) => {
      head = options?.head ?? false
      return builder
    },
    eq: (column: keyof Row, value: unknown) => {
      const before = rows
      rows = () => before().filter((row) => row[column] === value)
      return builder
    },
    is: (column: keyof Row, value: null) => {
      const before = rows
      rows = () => before().filter((row) => row[column] === value)
      return builder
    },
    order: () => builder,
    limit: () => builder,
    then: (resolve: (value: unknown) => void) => {
      const result = rows().sort((a, b) => b.created_at.localeCompare(a.created_at))
      resolve(head ? { count: result.length, error: null } : { data: result, error: null })
    },
  }
  return builder
}

const me = 'maya'
const signedIn: AuthState = {
  status: 'signed_in',
  session: { user: { id: me, user_metadata: {} } } as never,
}

function notification(id: number, overrides: Partial<Row>): Row {
  return {
    id,
    user_id: me,
    kind: 'assignment_requested',
    item_id: 'item-1',
    line: `Notification ${id}`,
    created_at: '2026-10-05T19:00:00Z',
    read_at: null,
    ...overrides,
  }
}

beforeEach(() => {
  table = [
    notification(1, {
      kind: 'assignment_requested',
      item_id: 'pharmacy',
      line: 'Ada asked you to take something',
      created_at: '2026-10-05T19:00:00Z',
    }),
    notification(2, {
      kind: 'coverage_requested',
      item_id: 'physio',
      line: 'Jonah needs someone to cover',
      created_at: '2026-10-05T18:00:00Z',
    }),
    notification(3, {
      kind: 'update_posted',
      item_id: 'physio',
      line: 'Ada posted an update',
      created_at: '2026-10-04T18:00:00Z',
    }),
    notification(4, {
      kind: 'reminder',
      item_id: 'meds',
      line: 'Coming up soon',
      created_at: '2026-10-03T18:00:00Z',
      read_at: '2026-10-03T19:00:00Z',
    }),
    // Someone else's, which RLS would hide; the screen asks for its own anyway.
    notification(5, { user_id: 'jonah', line: 'Not for Maya' }),
  ]
  vi.mocked(supabase.from).mockImplementation(() => query() as never)
  vi.mocked(api.markNotificationsRead).mockImplementation((id?: number) => {
    const now = new Date().toISOString()
    table = table.map((row) =>
      row.user_id === me && !row.read_at && (id === undefined || row.id === id)
        ? { ...row, read_at: now }
        : row,
    )
    return Promise.resolve(undefined)
  })
  vi.mocked(useAuth).mockReturnValue(signedIn)
  vi.mocked(circles.useMyMembership).mockReturnValue({
    isPending: false,
    isError: false,
    data: { role: 'member', relationship: null, circles: { id: 'c', care_recipient_name: 'Dad', time_zone: 'America/Toronto' } },
  } as unknown as ReturnType<typeof circles.useMyMembership>)
})

afterEach(() => vi.clearAllMocks())

// Home's bell and the list, as on the phone: the bell opens the list.
function renderApp(path = '/notifications') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomeTopBar name="Maya" /> },
      {
        path: '/notifications',
        element: (
          <>
            <HomeTopBar name="Maya" />
            <Notifications />
          </>
        ),
      },
      { path: '/i/:itemId', element: <p>Item screen</p> },
      { path: '/updates', element: <p>Updates screen</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient }
}

const bell = () => screen.getByRole('link', { name: /^Notifications/ })

test('the bell on Home shows how many are unread, in words for VoiceOver', async () => {
  renderApp('/')
  await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications, 3 unread'))
  expect(within(bell()).getByText('3')).toBeInTheDocument()
  expect(bell()).toHaveAttribute('href', '/notifications')
})

test('the bell has no badge with nothing unread', async () => {
  table = table.map((row) => ({ ...row, read_at: '2026-10-05T19:30:00Z' }))
  renderApp('/')
  await waitFor(() => expect(supabase.from).toHaveBeenCalled())
  expect(bell()).toHaveAccessibleName('Notifications')
  expect(within(bell()).queryByText(/\d/)).not.toBeInTheDocument()
})

test('lists the member’s own notifications newest first, unread ones marked in words', async () => {
  renderApp()
  const list = await screen.findByRole('list')
  const rows = within(list).getAllByRole('listitem')
  expect(rows.map((row) => row.querySelector('span.break-words')?.textContent)).toEqual([
    'Ada asked you to take something',
    'Jonah needs someone to cover',
    'Ada posted an update',
    'Coming up soon',
  ])
  expect(within(rows[0]).getByText('New')).toBeInTheDocument()
  expect(within(rows[2]).getByText('New')).toBeInTheDocument()
  expect(within(rows[3]).queryByText('New')).not.toBeInTheDocument()
  expect(within(rows[0]).getByText(/^Today/)).toBeInTheDocument()
  expect(within(rows[2]).getByText(/^Yesterday/)).toBeInTheDocument()
  expect(screen.queryByText('Not for Maya')).not.toBeInTheDocument()
  // The temporary test push stays below the list until task 4.6.
  expect(screen.getByRole('heading', { name: 'Test notifications' })).toBeInTheDocument()
})

test('tapping one opens its item and marks it read', async () => {
  const { router } = renderApp()
  fireEvent.click(await screen.findByRole('link', { name: /Ada asked you to take something/ }))
  expect(router.state.location.pathname).toBe('/i/pharmacy')
  // Still saved once the list has gone.
  await waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalledWith(1))
  expect(table.find((row) => row.id === 1)?.read_at).not.toBeNull()
})

test('tapping an update opens Updates', async () => {
  const { router } = renderApp()
  fireEvent.click(await screen.findByRole('link', { name: /Ada posted an update/ }))
  expect(router.state.location.pathname).toBe('/updates')
})

test('tapping one already read just opens it', async () => {
  renderApp()
  fireEvent.click(await screen.findByRole('link', { name: /Coming up soon/ }))
  expect(api.markNotificationsRead).not.toHaveBeenCalled()
})

test('Mark all read clears every unread mark and the badge', async () => {
  renderApp()
  await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications, 3 unread'))
  fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }))
  await waitFor(() => expect(api.markNotificationsRead).toHaveBeenCalledWith(undefined))
  await waitFor(() => expect(screen.queryByText('New')).not.toBeInTheDocument())
  await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications'))
  expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
})

test('shows a message when there is nothing yet', async () => {
  table = []
  renderApp()
  expect(await screen.findByText(/^Nothing yet/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Mark all read' })).not.toBeInTheDocument()
})

test('says so when marking read fails', async () => {
  vi.mocked(api.markNotificationsRead).mockRejectedValue(new Error('offline'))
  renderApp()
  fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("That didn't save")
  // The unread marks come back.
  await waitFor(() => expect(screen.getAllByText('New')).toHaveLength(3))
})

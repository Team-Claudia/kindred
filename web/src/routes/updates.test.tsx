import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import * as queries from '@/lib/queries'
import Updates from './updates'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof circles>()),
  useMyMembership: vi.fn(),
  useCircleMembers: vi.fn(),
}))
vi.mock('@/lib/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof queries>()),
  useUpdates: vi.fn(),
  useItemsInRange: vi.fn(),
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  createItem: vi.fn(),
  postUpdate: vi.fn(),
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

const thread: queries.UpdateWithItem[] = [
  {
    id: 'u3',
    author_id: 'maya',
    body: 'Back from cardiology. Next visit in six weeks.',
    created_at: '2026-09-24T18:12:00Z', // today, 11:12 a.m. in Vancouver
    item_id: 'cardio',
    items: { id: 'cardio', title: 'Cardiology', kind: 'appointment' },
  },
  {
    id: 'u2',
    author_id: 'jonah',
    body: 'Stuck at work until seven.',
    created_at: '2026-09-24T01:40:00Z', // yesterday, 6:40 p.m.
    item_id: 'meds',
    items: { id: 'meds', title: 'Refill meds', kind: 'task' },
  },
  {
    id: 'u1',
    author_id: null,
    body: 'Added the physio ride.',
    created_at: '2026-09-22T15:05:00Z', // Tue 22, 8:05 a.m.
    item_id: null,
    items: null,
  },
]

function mockUpdates(data: queries.UpdateWithItem[]) {
  vi.mocked(queries.useUpdates).mockReturnValue({
    isPending: false,
    isError: false,
    data,
  } as unknown as Query<typeof queries.useUpdates>)
}

function renderUpdates() {
  const router = createMemoryRouter(
    [
      { path: '/updates', element: <Updates /> },
      { path: '/i/:itemId', element: <p>Item screen</p> },
    ],
    { initialEntries: ['/updates'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:00:00Z')) // Thu 24 Sep, noon in Vancouver
  vi.mocked(useAuth).mockReturnValue({
    status: 'signed_in',
    session: { user: { id: 'maya' } },
  } as unknown as AuthState)
  vi.mocked(circles.useMyMembership).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      role: 'admin',
      relationship: 'parent',
      circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Vancouver' },
    },
  } as Query<typeof circles.useMyMembership>)
  vi.mocked(circles.useCircleMembers).mockReturnValue({
    isPending: false,
    isSuccess: true,
    data: [
      { user_id: 'maya', role: 'admin', relationship: 'parent', joined_at: '', profiles: { display_name: 'Maya Patel' } },
      { user_id: 'jonah', role: 'member', relationship: 'parent', joined_at: '', profiles: { display_name: 'Jonah' } },
    ],
  } as unknown as Query<typeof circles.useCircleMembers>)
  vi.mocked(queries.useItemsInRange).mockReturnValue({
    isPending: false,
    data: [],
  } as unknown as Query<typeof queries.useItemsInRange>)
  vi.mocked(api.createItem).mockResolvedValue('follow-up')
  vi.mocked(api.postUpdate).mockResolvedValue('new-update')
  mockUpdates(thread)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('the thread shows each update, newest first, with author, when, text and linked item', () => {
  renderUpdates()

  const cards = screen.getAllByRole('article')
  expect(cards).toHaveLength(3)
  expect(cards[0]).toHaveTextContent('Maya')
  expect(cards[0]).toHaveTextContent('Today, 11:12 a.m.')
  expect(cards[0]).toHaveTextContent('Back from cardiology. Next visit in six weeks.')
  expect(within(cards[0]).getByRole('link', { name: 'Linked to Cardiology' })).toHaveAttribute(
    'href',
    '/i/cardio',
  )
  expect(cards[1]).toHaveTextContent('Jonah')
  expect(cards[1]).toHaveTextContent('Yesterday, 6:40 p.m.')
  expect(within(cards[1]).getByRole('link', { name: 'Linked to Refill meds' })).toBeInTheDocument()
  // Follow-ups are for appointments only.
  expect(within(cards[1]).queryByRole('button', { name: 'Create follow-up task' })).toBeNull()
  expect(cards[2]).toHaveTextContent('Former member')
  expect(cards[2]).toHaveTextContent('Tue 22, 8:05 a.m.')
  expect(within(cards[2]).queryByRole('link')).toBeNull()
})

test('an empty thread says what updates are for', () => {
  mockUpdates([])
  renderUpdates()

  expect(screen.getByText(/No updates yet/)).toBeInTheDocument()
  expect(screen.queryByRole('article')).toBeNull()
})

test('the share box opens the New update sheet', async () => {
  renderUpdates()

  fireEvent.click(screen.getByRole('button', { name: 'Share an update with the circle…' }))
  const sheet = await screen.findByRole('dialog', { name: 'New update' })
  fireEvent.change(within(sheet).getByLabelText('What happened?'), { target: { value: 'All good' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Post to updates' }))

  await waitFor(() => expect(api.postUpdate).toHaveBeenCalledWith({ body: 'All good' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
})

test('Create follow-up task on an update linked to an appointment', async () => {
  const router = renderUpdates()

  fireEvent.click(
    within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Create follow-up task' }),
  )
  const sheet = await screen.findByRole('dialog', { name: 'New task' })
  expect(sheet).toHaveTextContent('Follow-up to Cardiology')

  fireEvent.change(within(sheet).getByLabelText('Task'), { target: { value: 'Pick up prescription' } })
  fireEvent.click(within(sheet).getByRole('radio', { name: /Jonah/ }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add task' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/i/follow-up'))
  expect(api.createItem).toHaveBeenCalledWith({
    kind: 'task',
    title: 'Pick up prescription',
    starts_at: '2026-09-25T06:59:00.000Z',
    assignee_id: 'jonah',
    follow_up_of: 'cardio',
  })
})

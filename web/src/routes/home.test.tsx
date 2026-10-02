import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import { RpcError } from '@/lib/errors'
import type { Item } from '@/lib/items'
import * as queries from '@/lib/queries'
import { platform } from '@/platform'
import Home from './home'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  acceptAssignment: vi.fn(),
  declineAssignment: vi.fn(),
  claim: vi.fn(),
  acceptCoverage: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof circles>()),
  useMyMembership: vi.fn(),
  useCircleMembers: vi.fn(),
  useProfile: vi.fn(),
}))
vi.mock('@/lib/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof queries>()),
  useItemsInRange: vi.fn(),
  useItemsNeedingAttention: vi.fn(),
  useLatestUpdate: vi.fn(),
  useItemCount: vi.fn(),
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>
type Attention = queries.ItemNeedingAttention

function item(overrides: Partial<Attention> & Pick<Item, 'id'>): Attention {
  return {
    circle_id: 'circle-1',
    kind: 'task',
    title: overrides.id,
    starts_at: '2026-09-24T21:00:00Z',
    ends_at: null,
    state: 'assigned',
    owner_id: 'maya',
    proposed_assignee_id: null,
    location: null,
    location_lat: null,
    location_lng: null,
    private_notes: null,
    series_id: null,
    follow_up_of: null,
    created_by: 'maya',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    version: 3,
    assignment_requests: [],
    ...overrides,
  }
}

// Thursday 24 September 2026 in Vancouver; the week is Mon 21 – Sun 27.
const week = [
  item({ id: 'cardiology', kind: 'appointment', title: 'Cardiology appointment', starts_at: '2026-09-24T21:00:00Z' }),
  item({ id: 'meds', title: 'Refill blood pressure meds', starts_at: '2026-09-24T00:00:00Z', owner_id: 'jonah' }),
  item({ id: 'groceries', title: 'Groceries', starts_at: '2026-09-26T18:00:00Z' }),
]
const attention = [
  item({ id: 'meds', title: 'Refill blood pressure meds', starts_at: '2026-09-24T00:00:00Z', owner_id: 'jonah' }),
  item({
    id: 'pharmacy',
    title: 'Call the pharmacy',
    starts_at: '2026-09-26T06:59:00Z', // Fri, no time (23:59)
    state: 'awaiting_acceptance',
    owner_id: null,
    proposed_assignee_id: 'maya',
    assignment_requests: [{ assigner_id: 'ada' }],
  }),
  item({
    id: 'physio',
    kind: 'appointment',
    title: 'Physio ride',
    starts_at: '2026-09-25T16:30:00Z',
    state: 'needs_someone',
    owner_id: null,
  }),
  item({
    id: 'cover',
    title: 'Evening visit',
    starts_at: '2026-09-27T01:00:00Z',
    state: 'needs_coverage',
    owner_id: 'jonah',
  }),
]

function success<T>(data: T) {
  return { isPending: false, isError: false, isSuccess: true, data, refetch: vi.fn() }
}

function given({
  weekItems = week,
  open = attention,
  update = {
    id: 'u1',
    author_id: 'jonah',
    body: 'Stuck at work until seven.',
    created_at: '2026-09-24T01:40:00Z',
  } as Query<typeof queries.useLatestUpdate>['data'],
  count = 5,
}: {
  weekItems?: Attention[]
  open?: Attention[]
  update?: Query<typeof queries.useLatestUpdate>['data']
  count?: number
} = {}) {
  vi.mocked(queries.useItemsInRange).mockReturnValue(
    success(weekItems) as unknown as Query<typeof queries.useItemsInRange>,
  )
  vi.mocked(queries.useItemsNeedingAttention).mockReturnValue(
    success(open) as unknown as Query<typeof queries.useItemsNeedingAttention>,
  )
  vi.mocked(queries.useLatestUpdate).mockReturnValue(
    success(update) as unknown as Query<typeof queries.useLatestUpdate>,
  )
  vi.mocked(queries.useItemCount).mockReturnValue(
    success(count) as unknown as Query<typeof queries.useItemCount>,
  )
}

function renderHome() {
  const router = createMemoryRouter([{ path: '/', element: <Home /> }], { initialEntries: ['/'] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T16:00:00Z')) // Thu 24 Sep, 9 am in Vancouver
  vi.spyOn(platform, 'isStandalone').mockReturnValue(true)
  vi.spyOn(platform, 'notificationPermission').mockReturnValue('unsupported')
  vi.mocked(useAuth).mockReturnValue({
    status: 'signed_in',
    session: { user: { id: 'maya' } },
  } as unknown as AuthState)
  vi.mocked(circles.useProfile).mockReturnValue(
    success({ display_name: 'Maya Reyes' }) as unknown as Query<typeof circles.useProfile>,
  )
  vi.mocked(circles.useMyMembership).mockReturnValue(
    success({
      role: 'admin',
      relationship: 'parent',
      circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Vancouver' },
    }) as unknown as Query<typeof circles.useMyMembership>,
  )
  vi.mocked(circles.useCircleMembers).mockReturnValue(
    success([
      { user_id: 'maya', role: 'admin', relationship: 'child', joined_at: '', profiles: { display_name: 'Maya Reyes' } },
      { user_id: 'jonah', role: 'member', relationship: 'child', joined_at: '', profiles: { display_name: 'Jonah' } },
      { user_id: 'ada', role: 'member', relationship: 'child', joined_at: '', profiles: { display_name: 'Ada' } },
    ]) as unknown as Query<typeof circles.useCircleMembers>,
  )
  given()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('greets the member and shows the counts and every section', () => {
  renderHome()

  expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Maya' })).toBeInTheDocument()
  expect(screen.getByText("Dad's care · Care Circle of 3")).toBeInTheDocument()
  const counts = screen.getByRole('list', { name: 'This week' })
  expect(within(counts).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([
    '2 tasks',
    '1 appointment',
    '1 overdue',
  ])

  const answer = screen.getByRole('region', { name: 'Needs your answer · 1' })
  expect(within(answer).getByText('Call the pharmacy')).toBeInTheDocument()
  expect(within(answer).getByText('Ada asked you · Due tomorrow')).toBeInTheDocument()
  expect(within(answer).getByRole('button', { name: 'Accept' })).toBeInTheDocument()
  expect(within(answer).getByRole('button', { name: 'Decline' })).toBeInTheDocument()

  const today = screen.getByRole('region', { name: 'Today · Thursday 24' })
  expect(within(today).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/i/meds',
    '/i/cardiology',
  ])
  expect(within(today).getByText('Overdue')).toBeInTheDocument()

  const someone = screen.getByRole('region', { name: 'Needs someone' })
  expect(within(someone).getByRole('link', { name: /Physio ride/ })).toHaveAttribute('href', '/i/physio')
  expect(within(someone).getByRole('button', { name: "I'll do it" })).toBeInTheDocument()

  const coverage = screen.getByRole('region', { name: 'Coverage requests' })
  expect(within(coverage).getByRole('link')).toHaveAttribute('href', '/i/cover')
  expect(within(coverage).getByText('Needs coverage')).toBeInTheDocument()

  const update = screen.getByRole('region', { name: 'Latest update' })
  expect(within(update).getByText('Stuck at work until seven.')).toBeInTheDocument()
  expect(within(update).getByText('Jonah')).toBeInTheDocument()
})

test('a new circle shows a welcome and an empty state in every section', () => {
  given({ weekItems: [], open: [], update: null, count: 0 })
  renderHome()

  expect(screen.getByText(/Nothing is planned yet/)).toBeInTheDocument()
  expect(screen.getByText('Nothing is waiting for your answer.')).toBeInTheDocument()
  expect(screen.getByText('Nothing is planned for today.')).toBeInTheDocument()
  expect(screen.getByText('Everything has someone for now.')).toBeInTheDocument()
  expect(screen.getByText('Nobody has asked for cover.')).toBeInTheDocument()
  expect(screen.getByText(/No updates yet/)).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'This week' })).toHaveTextContent('0 tasks0 appointments0 overdue')
})

test("a quiet week isn't mistaken for a new circle", () => {
  given({ weekItems: [], open: [], update: null, count: 2 })
  renderHome()

  expect(screen.queryByText(/Nothing is planned yet/)).not.toBeInTheDocument()
  expect(screen.getByText('Nothing is planned for today.')).toBeInTheDocument()
})

test('Accept answers the request in one tap, at the version shown', async () => {
  vi.mocked(api.acceptAssignment).mockResolvedValue(attention[1])
  renderHome()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
  })
  expect(vi.mocked(api.acceptAssignment).mock.calls[0][0]).toEqual({ item_id: 'pharmacy', version: 3 })
})

test('Decline answers the request in one tap', async () => {
  vi.mocked(api.declineAssignment).mockResolvedValue(attention[1])
  renderHome()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Decline' }))
  })
  expect(vi.mocked(api.declineAssignment).mock.calls[0][0]).toEqual({ item_id: 'pharmacy', version: 3 })
})

test("I'll do it claims the item, and says so in plain language if someone got there first", async () => {
  vi.mocked(api.claim).mockRejectedValue(new RpcError('already_claimed', { name: 'Jonah' }))
  renderHome()

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: "I'll do it" }))
  })
  expect(vi.mocked(api.claim).mock.calls[0][0]).toEqual({ item_id: 'physio', version: 3 })
  const someone = screen.getByRole('region', { name: 'Needs someone' })
  expect(within(someone).getByRole('alert')).toHaveTextContent('Jonah has already taken this.')
})

test('I can do it takes a coverage request in one tap, and says who got there first', async () => {
  vi.mocked(api.acceptCoverage).mockRejectedValue(new RpcError('coverage_resolved', { name: 'Ada' }))
  renderHome()

  const coverage = screen.getByRole('region', { name: 'Coverage requests' })
  expect(within(coverage).getByText(/Jonah needs cover/)).toBeInTheDocument()
  await act(async () => {
    fireEvent.click(within(coverage).getByRole('button', { name: 'I can do it' }))
  })
  expect(vi.mocked(api.acceptCoverage).mock.calls[0][0]).toEqual({ item_id: 'cover', version: 3 })
  expect(within(coverage).getByRole('alert')).toHaveTextContent('Ada is already covering this.')
})

test("your own coverage request has no I can do it; it opens the item", () => {
  given({
    open: [
      item({ id: 'mine', title: 'Evening visit', starts_at: '2026-09-27T01:00:00Z', state: 'needs_coverage' }),
    ],
  })
  renderHome()

  const coverage = screen.getByRole('region', { name: 'Coverage requests' })
  expect(within(coverage).queryByRole('button', { name: 'I can do it' })).not.toBeInTheDocument()
  expect(within(coverage).getByRole('link')).toHaveAttribute('href', '/i/mine')
})

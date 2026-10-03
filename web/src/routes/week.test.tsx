import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import type { Item } from '@/lib/items'
import * as queries from '@/lib/queries'
import Week from './week'

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
  useItemsInRange: vi.fn(),
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

function item(overrides: Partial<Item>): Item {
  return {
    id: 'item',
    circle_id: 'circle-1',
    kind: 'task',
    title: 'Task',
    starts_at: '2026-09-24T00:00:00Z',
    ends_at: null,
    state: 'assigned',
    owner_id: 'maya',
    proposed_assignee_id: null,
    location: null,
    location_lat: null,
    location_lng: null,
    private_notes: null,
    series_id: null,
    occurrence_index: null,
    follow_up_of: null,
    created_by: 'maya',
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
    version: 1,
    ...overrides,
  }
}

// Week of Mon 21 – Sun 27 September 2026, Vancouver time.
const thisWeek = [
  item({
    id: 'meds',
    title: 'Refill blood pressure meds',
    starts_at: '2026-09-24T00:00:00Z', // Wed 23, 5 pm: overdue
    owner_id: 'jonah',
  }),
  item({
    id: 'cardiology',
    kind: 'appointment',
    title: 'Cardiology appointment',
    starts_at: '2026-09-24T21:00:00Z', // Thu 24, 2 pm
    owner_id: 'maya',
  }),
  item({
    id: 'physio',
    kind: 'appointment',
    title: 'Physio ride',
    starts_at: '2026-09-25T16:30:00Z', // Fri 25
    state: 'needs_someone',
    owner_id: null,
  }),
  item({
    id: 'pharmacy',
    title: 'Call the pharmacy',
    starts_at: '2026-09-26T00:00:00Z', // Fri 25, 5 pm
    state: 'awaiting_acceptance',
    owner_id: null,
    proposed_assignee_id: 'maya',
  }),
]

function mockItems(items: Item[] | 'pending' | 'error') {
  vi.mocked(queries.useItemsInRange).mockReturnValue(
    (items === 'pending'
      ? { isPending: true, isError: false, isSuccess: false }
      : items === 'error'
        ? { isPending: false, isError: true, isSuccess: false, refetch: vi.fn() }
        : { isPending: false, isError: false, isSuccess: true, data: items }) as unknown as Query<
      typeof queries.useItemsInRange
    >,
  )
}

function renderWeek(path = '/week') {
  const router = createMemoryRouter([{ path: '/week', element: <Week /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
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
    data: [
      { user_id: 'maya', role: 'admin', relationship: 'child', joined_at: '', profiles: { display_name: 'Maya Reyes' } },
      { user_id: 'jonah', role: 'member', relationship: 'child', joined_at: '', profiles: { display_name: 'Jonah' } },
    ],
  } as unknown as Query<typeof circles.useCircleMembers>)
  mockItems(thisWeek)
})

afterEach(() => {
  vi.useRealTimers()
})

function lastRange() {
  const [from, to] = vi.mocked(queries.useItemsInRange).mock.lastCall!
  return { from, to }
}

test('shows the week in the circle time zone, grouped by day, with today marked', () => {
  renderWeek()

  expect(screen.getByText("Dad's care")).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 1, name: 'This week' })).toBeInTheDocument()
  expect(screen.getByText('Mon 21 – Sun 27 September · 2 tasks, 2 appointments')).toBeInTheDocument()
  expect(lastRange()).toEqual({ from: '2026-09-21T07:00:00.000Z', to: '2026-09-28T07:00:00.000Z' })

  const days = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(days).toEqual(['Wednesday 23', 'Thursday 24 · Today', 'Friday 25'])

  const friday = screen.getByRole('region', { name: 'Friday 25' })
  const links = within(friday).getAllByRole('link')
  expect(links.map((link) => link.getAttribute('href'))).toEqual(['/i/physio', '/i/pharmacy'])
  expect(links[0]).toHaveTextContent('Nobody has claimed this')
  expect(links[1]).toHaveTextContent('Asked Maya')
  expect(links[1]).toHaveTextContent('Awaiting Maya')

  const wednesday = screen.getByRole('region', { name: 'Wednesday 23' })
  expect(within(wednesday).getByText('Overdue')).toBeInTheDocument()
  expect(screen.queryByText('Back to this week')).not.toBeInTheDocument()
})

test('filters to one member: what they own or have been asked to do', () => {
  renderWeek()

  fireEvent.click(screen.getByRole('button', { name: 'Maya' }))
  expect(screen.getByRole('button', { name: 'Maya' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
    '/i/cardiology',
    '/i/pharmacy',
  ])
  expect(screen.getByText(/1 task, 1 appointment/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
  expect(screen.getAllByRole('link')).toHaveLength(4)
})

test('a filter can always be cleared, even when only one member is left', () => {
  vi.mocked(circles.useCircleMembers).mockReturnValue({
    isPending: false,
    data: [
      { user_id: 'maya', role: 'admin', relationship: 'child', joined_at: '', profiles: { display_name: 'Maya' } },
    ],
  } as unknown as Query<typeof circles.useCircleMembers>)
  renderWeek('/week?member=maya')
  fireEvent.click(screen.getByRole('button', { name: 'Everyone' }))
  expect(screen.getAllByRole('link')).toHaveLength(4)
})

test('a member with nothing this week sees an empty state', () => {
  mockItems(thisWeek.filter((row) => row.owner_id !== 'jonah'))
  renderWeek('/week?member=jonah')
  expect(screen.getByText('Nothing for Jonah this week.')).toBeInTheDocument()
})

test('moves to the previous and next week, and back to this week', () => {
  const router = renderWeek()

  fireEvent.click(screen.getByRole('button', { name: 'Next week' }))
  expect(router.state.location.search).toBe('?week=2026-09-28')
  expect(lastRange()).toEqual({ from: '2026-09-28T07:00:00.000Z', to: '2026-10-05T07:00:00.000Z' })
  expect(screen.getByText(/^Mon 28 September – Sun 4 October/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Back to this week' }))
  expect(router.state.location.search).toBe('')

  fireEvent.click(screen.getByRole('button', { name: 'Previous week' }))
  expect(lastRange()).toEqual({ from: '2026-09-14T07:00:00.000Z', to: '2026-09-21T07:00:00.000Z' })
})

test('a week across the clocks going forward ends at the earlier local midnight', () => {
  renderWeek('/week?week=2026-03-02')
  expect(lastRange()).toEqual({ from: '2026-03-02T08:00:00.000Z', to: '2026-03-09T07:00:00.000Z' })
})

test('shows a loading state', () => {
  mockItems('pending')
  renderWeek()
  expect(screen.getByRole('status')).toHaveTextContent('Loading…')
})

test('shows an error state', () => {
  mockItems('error')
  renderWeek()
  expect(screen.getByRole('alert')).toHaveTextContent("This week couldn't load")
})

test('shows an empty week', () => {
  mockItems([])
  renderWeek('/week?week=2026-10-05')
  expect(screen.getByText('Nothing is planned this week.')).toBeInTheDocument()
  expect(screen.getByText(/0 tasks, 0 appointments/)).toBeInTheDocument()
})

test('the header follows the week: This week, Next week, Last week, then Week of <Monday>', () => {
  const heading = (name: string) => screen.getByRole('heading', { level: 1, name })
  renderWeek('/week?week=2026-09-21')
  expect(heading('This week')).toBeInTheDocument()
  cleanup()
  renderWeek('/week?week=2026-09-28')
  expect(heading('Next week')).toBeInTheDocument()
  cleanup()
  renderWeek('/week?week=2026-09-14')
  expect(heading('Last week')).toBeInTheDocument()
  cleanup()
  renderWeek('/week?week=2026-10-12')
  expect(heading('Week of 12 October')).toBeInTheDocument()
})

test('the header is right across a daylight-saving change', () => {
  // Toronto, not Vancouver: from tz data 2026c, British Columbia stays on daylight time.
  vi.mocked(circles.useMyMembership).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      role: 'admin',
      relationship: 'parent',
      circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Toronto' },
    },
  } as Query<typeof circles.useMyMembership>)
  // Sun 1 Nov 2026, 11 p.m. in Toronto: clocks went back at 2 a.m. that day, so this is
  // Monday in UTC and would be next week if the offset before the change were used.
  vi.setSystemTime(new Date('2026-11-02T04:00:00Z'))
  const heading = (name: string) => screen.getByRole('heading', { level: 1, name })
  renderWeek()
  expect(heading('This week')).toBeInTheDocument()
  cleanup()
  renderWeek('/week?week=2026-11-02')
  expect(heading('Next week')).toBeInTheDocument()
  cleanup()
  renderWeek('/week?week=2026-10-19')
  expect(heading('Last week')).toBeInTheDocument()
  cleanup()
  renderWeek('/week?week=2026-11-09')
  expect(heading('Week of 9 November')).toBeInTheDocument()
})

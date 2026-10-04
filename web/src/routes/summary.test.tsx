import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import { RpcError } from '@/lib/errors'
import * as queries from '@/lib/queries'
import { platform } from '@/platform'
import Summary from './summary'

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
  useWeeklySummary: vi.fn(),
  useItem: vi.fn(),
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  claim: vi.fn(),
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

// Week of Mon 26 October – Sun 1 November 2026, Toronto time.
const lines = [
  { kind: 'completed', item_id: 'groceries', item_title: 'Groceries drop-off', person_id: 'maya', at: '2026-10-28T16:00:00Z', count: null },
  { kind: 'unowned', item_id: 'physio-1', item_title: 'Physio ride', person_id: null, at: '2026-10-30T13:30:00Z', count: null },
  { kind: 'updates', item_id: null, item_title: null, person_id: 'maya', at: '2026-10-29T16:00:00Z', count: 2 },
  { kind: 'overdue', item_id: 'meds', item_title: 'Refill meds', person_id: 'jonah', at: '2026-10-28T21:00:00Z', count: null },
  { kind: 'needs_someone', item_id: 'physio-2', item_title: 'Physio ride', person_id: null, at: '2026-11-04T14:30:00Z', count: null },
]

function mockSummary(data: unknown) {
  vi.mocked(queries.useWeeklySummary).mockReturnValue({
    isPending: false,
    isError: false,
    data,
  } as unknown as Query<typeof queries.useWeeklySummary>)
}

function renderSummary(path = '/summary') {
  const router = createMemoryRouter(
    [
      { path: '/summary', element: <Summary /> },
      { path: '/i/:itemId', element: <p>Item detail</p> },
    ],
    { initialEntries: [path] },
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
  vi.setSystemTime(new Date('2026-11-03T15:00:00Z')) // Tue 3 November, 10 am in Toronto
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
      circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Toronto' },
    },
  } as Query<typeof circles.useMyMembership>)
  vi.mocked(circles.useCircleMembers).mockReturnValue({
    isPending: false,
    data: [
      { user_id: 'maya', role: 'admin', relationship: 'child', joined_at: '', profiles: { display_name: 'Maya Reyes' } },
      { user_id: 'jonah', role: 'member', relationship: 'child', joined_at: '', profiles: { display_name: 'Jonah' } },
    ],
  } as unknown as Query<typeof circles.useCircleMembers>)
  vi.mocked(queries.useItem).mockReturnValue({
    data: { id: 'physio-2', version: 4 },
  } as unknown as Query<typeof queries.useItem>)
  mockSummary(lines)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

test('opens on the latest summary, made last Sunday, as sentences', () => {
  renderSummary()

  expect(vi.mocked(queries.useWeeklySummary)).toHaveBeenLastCalledWith('2026-10-26')
  expect(screen.getByRole('heading', { level: 1, name: "What happened, what's next" })).toBeInTheDocument()
  expect(screen.getByText('Last week · Mon 26 October – Sun 1 November')).toBeInTheDocument()

  const happened = screen.getByRole('region', { name: 'What happened' })
  expect(within(happened).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
    'Maya did “Groceries drop-off” on Wednesday.',
    'Nobody took “Physio ride” on Friday.',
    'Maya posted 2 updates.',
  ])

  const open = screen.getByRole('region', { name: "What's still open" })
  expect(within(open).getByText('“Refill meds”: Jonah has it, overdue since Wednesday, October 28.')).toBeInTheDocument()
  expect(within(open).getByRole('link', { name: 'Open Refill meds' })).toHaveAttribute('href', '/i/meds')
  expect(
    within(open).getByText('“Physio ride” on Wednesday, November 4 at 9:30 a.m. needs someone.'),
  ).toBeInTheDocument()
  expect(screen.getByText(/never interprets health information/)).toBeInTheDocument()
})

test('Claim takes the item at its current version', async () => {
  vi.mocked(api.claim).mockResolvedValue({} as never)
  renderSummary()

  fireEvent.click(screen.getByRole('button', { name: "I'll do Physio ride" }))
  await waitFor(() => expect(api.claim).toHaveBeenCalled())
  expect(vi.mocked(api.claim).mock.calls[0][0]).toEqual({ item_id: 'physio-2', version: 4 })
})

test('a claim that lost the race says who has it', async () => {
  vi.mocked(api.claim).mockRejectedValue(new RpcError('already_claimed', { name: 'Jonah' }))
  renderSummary()

  fireEvent.click(screen.getByRole('button', { name: "I'll do Physio ride" }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Jonah has already taken this.')
})

test('previous and next week move through the URL; next stops at this week', () => {
  const router = renderSummary()

  fireEvent.click(screen.getByRole('button', { name: "Previous week's summary" }))
  expect(router.state.location.search).toBe('?week=2026-10-19')
  expect(vi.mocked(queries.useWeeklySummary)).toHaveBeenLastCalledWith('2026-10-19')

  fireEvent.click(screen.getByRole('button', { name: 'Back to the latest summary' }))
  expect(router.state.location.search).toBe('')

  fireEvent.click(screen.getByRole('button', { name: "Next week's summary" }))
  expect(router.state.location.search).toBe('?week=2026-11-02')
  expect(screen.getByText('This week · Mon 2 – Sun 8 November')).toBeInTheDocument()
  expect(screen.getByText(/So far/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: "Next week's summary" })).toBeDisabled()
})

test('the Sunday notification link opens its week', () => {
  renderSummary('/summary?week=2026-10-21')
  expect(vi.mocked(queries.useWeeklySummary)).toHaveBeenLastCalledWith('2026-10-19')
})

test('Share with family sends item and people names only, with a link to the week', async () => {
  const share = vi.spyOn(platform, 'share').mockResolvedValue('shared')
  vi.spyOn(platform, 'appUrl').mockImplementation((path) => `https://kindred.example${path}`)
  renderSummary()

  fireEvent.click(screen.getByRole('button', { name: 'Share with family' }))
  await waitFor(() => expect(share).toHaveBeenCalled())
  const content = share.mock.calls[0][0]
  expect(content.url).toBe('https://kindred.example/summary?week=2026-10-26')
  expect(content.text).toContain("Dad's care, Mon 26 October – Sun 1 November")
  expect(content.text).toContain('• Maya did “Groceries drop-off” on Wednesday.')
  expect(content.text).toContain('• Maya posted 2 updates.')
  expect(content.text).toContain("What's still open")
})

test('an empty week says so', () => {
  mockSummary([])
  renderSummary()
  expect(screen.getByText('Nothing was marked done or missed this week.')).toBeInTheDocument()
  expect(screen.getByText('Nothing is overdue or waiting for someone.')).toBeInTheDocument()
})

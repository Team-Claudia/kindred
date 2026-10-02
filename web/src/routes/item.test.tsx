import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import { RpcError } from '@/lib/errors'
import type { Item } from '@/lib/items'
import * as queries from '@/lib/queries'
import ItemScreen from './item'

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
  useItem: vi.fn(),
  useItemHistory: vi.fn(),
  usePendingRequest: vi.fn(),
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  claim: vi.fn(),
  acceptAssignment: vi.fn(),
  cancelItem: vi.fn(),
  assign: vi.fn(),
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

function item(overrides: Partial<Item>): Item {
  return {
    id: 'pharmacy',
    circle_id: 'circle-1',
    kind: 'task',
    title: 'Call the pharmacy',
    starts_at: '2026-09-26T00:00:00Z', // Fri 25, 5 pm in Vancouver
    ends_at: null,
    state: 'needs_someone',
    owner_id: null,
    proposed_assignee_id: null,
    location: null,
    location_lat: null,
    location_lng: null,
    private_notes: 'Ask about the new dose',
    series_id: null,
    follow_up_of: null,
    created_by: 'ada',
    created_at: '2026-09-22T18:00:00Z',
    updated_at: '2026-09-22T18:00:00Z',
    version: 4,
    ...overrides,
  }
}

function mockItem(value: Item | Error) {
  vi.mocked(queries.useItem).mockReturnValue(
    (value instanceof Error
      ? { isPending: false, isError: true, isSuccess: false, error: value, refetch: vi.fn() }
      : { isPending: false, isError: false, isSuccess: true, data: value }) as unknown as Query<
      typeof queries.useItem
    >,
  )
}

function renderItem() {
  const router = createMemoryRouter(
    [
      { path: '/i/:itemId', element: <ItemScreen /> },
      { path: '/', element: <p>Home screen</p> },
    ],
    { initialEntries: ['/i/pharmacy'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const buttons = () => screen.queryAllByRole('button').map((button) => button.textContent)

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:00:00Z'))
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
      { user_id: 'maya', role: 'admin', relationship: 'parent', joined_at: '', profiles: { display_name: 'Maya' } },
      { user_id: 'jonah', role: 'member', relationship: 'parent', joined_at: '', profiles: { display_name: 'Jonah' } },
      { user_id: 'ada', role: 'member', relationship: 'grandparent', joined_at: '', profiles: { display_name: 'Ada' } },
    ],
  } as unknown as Query<typeof circles.useCircleMembers>)
  vi.mocked(queries.useItemHistory).mockReturnValue({ data: [] } as unknown as Query<
    typeof queries.useItemHistory
  >)
  vi.mocked(queries.usePendingRequest).mockReturnValue({ data: null } as unknown as Query<
    typeof queries.usePendingRequest
  >)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('a non-member sees that they have no access, with a way Home', () => {
  mockItem(Object.assign(new Error('no rows'), { code: 'PGRST116' }))
  const router = renderItem()

  expect(screen.getByRole('heading', { name: "You don't have access to this" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Go to Home' }))
  expect(router.state.location.pathname).toBe('/')
})

test('Needs someone: details, and I’ll do it claims it in one tap', async () => {
  mockItem(item({}))
  vi.mocked(api.claim).mockResolvedValue(item({ state: 'assigned', owner_id: 'maya', version: 5 }))
  renderItem()

  expect(screen.getByRole('heading', { level: 1, name: 'Call the pharmacy' })).toBeInTheDocument()
  expect(screen.getByText('Needs someone')).toBeInTheDocument()
  expect(screen.getByText('Nobody has claimed this')).toBeInTheDocument()
  expect(screen.getByText('Friday, September 25, 5:00 p.m.')).toBeInTheDocument()
  expect(screen.getByText('Ada · Tuesday, September 22')).toBeInTheDocument()
  expect(screen.getByText('Ask about the new dose')).toBeInTheDocument()
  expect(buttons()).toEqual(["I'll do it", 'Ask someone', 'Edit', 'Cancel task'])

  fireEvent.click(screen.getByRole('button', { name: "I'll do it" }))
  await waitFor(() => expect(api.claim).toHaveBeenCalledWith({ item_id: 'pharmacy', version: 4 }))
})

test('the person asked sees who asked, and can accept or decline', async () => {
  mockItem(item({ state: 'awaiting_acceptance', proposed_assignee_id: 'maya' }))
  vi.mocked(queries.usePendingRequest).mockReturnValue({
    data: { assigner_id: 'ada', assignee_id: 'maya' },
  } as unknown as Query<typeof queries.usePendingRequest>)
  vi.mocked(api.acceptAssignment).mockResolvedValue(item({ state: 'assigned', owner_id: 'maya' }))
  renderItem()

  expect(screen.getByRole('heading', { name: 'Ada asked you to do this' })).toBeInTheDocument()
  expect(screen.getAllByText('Awaiting you')).not.toHaveLength(0)
  expect(buttons()).toEqual(['Accept', 'Decline', 'Edit', 'Cancel task'])

  fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
  await waitFor(() =>
    expect(api.acceptAssignment).toHaveBeenCalledWith({ item_id: 'pharmacy', version: 4 }),
  )
})

test('anyone else sees who it is awaiting, and can withdraw or ask someone else', () => {
  mockItem(item({ state: 'awaiting_acceptance', proposed_assignee_id: 'jonah' }))
  renderItem()

  expect(screen.getAllByText('Awaiting Jonah')).toHaveLength(2) // badge and owner row
  expect(buttons()).toEqual(['Withdraw', 'Ask someone else', 'Edit', 'Cancel task'])
})

test('Assigned: the owner can mark it done; everyone can reassign', () => {
  mockItem(item({ state: 'assigned', owner_id: 'maya' }))
  renderItem()
  expect(screen.getByText('Maya (you)')).toBeInTheDocument()
  expect(buttons()).toEqual(['Mark done', 'Reassign', 'Edit', 'Cancel task'])
})

test('a typed error shows the PRD wording', async () => {
  mockItem(item({}))
  vi.mocked(api.claim).mockRejectedValue(new RpcError('already_claimed', { name: 'Jonah' }))
  renderItem()

  fireEvent.click(screen.getByRole('button', { name: "I'll do it" }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Jonah has already taken this.')
})

test('cancelling asks to confirm first', async () => {
  mockItem(item({}))
  vi.mocked(api.cancelItem).mockResolvedValue(item({ state: 'cancelled' }))
  renderItem()

  fireEvent.click(screen.getByRole('button', { name: 'Cancel task' }))
  expect(api.cancelItem).not.toHaveBeenCalled()
  const confirm = screen.getByRole('group', { name: 'Cancel this task?' })
  fireEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }))
  expect(screen.queryByRole('group', { name: 'Cancel this task?' })).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Cancel task' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, cancel it' }))
  await waitFor(() => expect(api.cancelItem).toHaveBeenCalledWith({ item_id: 'pharmacy', version: 4 }))
})

test('Ask someone picks a member and explains they must accept', async () => {
  mockItem(item({}))
  vi.mocked(api.assign).mockResolvedValue(item({ state: 'awaiting_acceptance', proposed_assignee_id: 'jonah' }))
  renderItem()

  fireEvent.click(screen.getByRole('button', { name: 'Ask someone' }))
  const sheet = await screen.findByRole('dialog', { name: 'Ask someone to do this' })
  fireEvent.click(within(sheet).getByRole('radio', { name: /Jonah/ }))
  expect(sheet).toHaveTextContent('Jonah is asked to accept. Until they do, it shows as Awaiting Jonah')
  fireEvent.click(within(sheet).getByRole('button', { name: 'Ask Jonah' }))
  await waitFor(() => expect(api.assign).toHaveBeenCalledWith({ item_id: 'pharmacy', version: 4 }, 'jonah'))
})

test('Completed is read-only and says who completed it', () => {
  mockItem(item({ state: 'completed', owner_id: 'jonah' }))
  vi.mocked(queries.useItemHistory).mockReturnValue({
    data: [
      { id: 1, type: 'created', actor_id: 'ada', at: '2026-09-22T18:00:00Z' },
      { id: 2, type: 'completed', actor_id: 'jonah', at: '2026-09-24T17:00:00Z' },
    ],
  } as unknown as Query<typeof queries.useItemHistory>)
  renderItem()

  expect(screen.getByText('Completed')).toBeInTheDocument()
  expect(screen.getByText('Jonah · Thursday, September 24')).toBeInTheDocument()
  expect(screen.getByText("This is done, so it can't be changed.")).toBeInTheDocument()
  expect(buttons()).toEqual([])
})

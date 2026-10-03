import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import * as circles from '@/lib/circles'
import { platform } from '@/platform'
import Circle from './circle'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  createInvite: vi.fn(),
  setAdmin: vi.fn(),
  removeMember: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: () => ({ status: 'signed_in', session: { user: { id: 'maya' } } }),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/circles')>()),
  useMyMembership: vi.fn(),
  useCircleMembers: vi.fn(),
}))
// Tested on their own; this is about the screen around them.
vi.mock('@/components/calendar-feed-card', () => ({ CalendarFeedCard: () => null }))
vi.mock('@/components/account-card', () => ({ AccountCard: () => null }))
vi.mock('@/components/push-settings-card', () => ({ PushSettingsCard: () => null }))
vi.mock('@/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform')>()
  return { platform: { ...actual.platform, share: vi.fn(), copyText: vi.fn() } }
})

type Query<F extends (...args: never[]) => unknown> = ReturnType<F>

function given({ admin }: { admin: boolean }) {
  vi.mocked(circles.useMyMembership).mockReturnValue({
    data: {
      role: admin ? 'admin' : 'member',
      relationship: 'parent',
      circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Vancouver' },
    },
  } as Query<typeof circles.useMyMembership>)
  vi.mocked(circles.useCircleMembers).mockReturnValue({
    data: [
      { user_id: 'maya', role: admin ? 'admin' : 'member', relationship: 'parent', joined_at: '', profiles: { display_name: 'Maya Reyes' } },
      { user_id: 'jonah', role: 'member', relationship: 'grandparent', joined_at: '', profiles: { display_name: 'Jonah Reyes' } },
      { user_id: 'ada', role: 'admin', relationship: 'friend', joined_at: '', profiles: { display_name: 'Ada Lee' } },
    ],
  } as Query<typeof circles.useCircleMembers>)
}

function renderCircle() {
  const router = createMemoryRouter(
    [
      { path: '/circle', element: <Circle /> },
      { path: '/terms', element: <h1>Terms page</h1> },
      { path: '/privacy', element: <h1>Privacy page</h1> },
    ],
    { initialEntries: ['/circle'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function row(name: string) {
  return screen.getByText(name).closest('li') as HTMLElement
}

beforeEach(() => {
  vi.mocked(api.createInvite).mockResolvedValue('ABCD1234')
})

afterEach(() => vi.clearAllMocks())

test('lists everyone with how they relate to the care recipient', () => {
  given({ admin: false })
  renderCircle()
  expect(screen.getByRole('heading', { name: "Dad's Care Circle", level: 1 })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Members · 3' })).toBeInTheDocument()
  expect(within(row('Maya Reyes')).getByText("Dad's child")).toBeInTheDocument()
  expect(within(row('Maya Reyes')).getByText('You')).toBeInTheDocument()
  expect(within(row('Jonah Reyes')).getByText("Dad's grandchild")).toBeInTheDocument()
  expect(within(row('Jonah Reyes')).getByText('Member')).toBeInTheDocument()
  expect(within(row('Ada Lee')).getByText("Dad's friend")).toBeInTheDocument()
  expect(within(row('Ada Lee')).getByText('Admin')).toBeInTheDocument()
})

test('a non-admin sees no Remove or Make admin', () => {
  given({ admin: false })
  renderCircle()
  expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Make admin/ })).not.toBeInTheDocument()
})

test('an admin sees Remove on others, and Make admin on non-admins, never on themselves', () => {
  given({ admin: true })
  renderCircle()
  expect(within(row('Maya Reyes')).queryByRole('button')).not.toBeInTheDocument()
  expect(within(row('Jonah Reyes')).getByRole('button', { name: 'Make admin: Jonah' })).toBeInTheDocument()
  expect(within(row('Jonah Reyes')).getByRole('button', { name: 'Remove Jonah' })).toBeInTheDocument()
  expect(within(row('Ada Lee')).queryByRole('button', { name: /Make admin/ })).not.toBeInTheDocument()
  expect(within(row('Ada Lee')).getByRole('button', { name: 'Remove Ada' })).toBeInTheDocument()
})

test('an admin can make someone an admin', async () => {
  given({ admin: true })
  vi.mocked(api.setAdmin).mockResolvedValue(undefined)
  renderCircle()
  fireEvent.click(screen.getByRole('button', { name: 'Make admin: Jonah' }))
  await vi.waitFor(() => expect(api.setAdmin).toHaveBeenCalled())
  expect(vi.mocked(api.setAdmin).mock.calls[0][0]).toBe('jonah')
})

test('removing asks first, then removes', async () => {
  given({ admin: true })
  vi.mocked(api.removeMember).mockResolvedValue(undefined)
  renderCircle()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Jonah' }))
  expect(screen.getByText('Remove Jonah from the Care Circle?')).toBeInTheDocument()
  expect(api.removeMember).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
  await vi.waitFor(() => expect(api.removeMember).toHaveBeenCalled())
  expect(vi.mocked(api.removeMember).mock.calls[0][0]).toBe('jonah')
})

test('Keep closes the question without removing', () => {
  given({ admin: true })
  renderCircle()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Jonah' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep Jonah' }))
  expect(screen.queryByText('Remove Jonah from the Care Circle?')).not.toBeInTheDocument()
  expect(api.removeMember).not.toHaveBeenCalled()
})

test('a failed removal says why', async () => {
  given({ admin: true })
  vi.mocked(api.removeMember).mockRejectedValue(new (await import('@/lib/errors')).RpcError('not_admin'))
  renderCircle()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Jonah' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, remove' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Only a Care Circle admin can do that.')
})

test('shares a new invite link, which works for 14 days', async () => {
  given({ admin: false })
  vi.mocked(platform.share).mockResolvedValue('shared')
  renderCircle()
  expect(screen.getByText(/works for 14 days/)).toBeInTheDocument()
  fireEvent.click(await screen.findByRole('button', { name: 'Share invite link' }))
  await vi.waitFor(() => expect(platform.share).toHaveBeenCalled())
  expect(vi.mocked(platform.share).mock.calls[0][0]).toEqual({
    text: "Join Dad's Care Circle on Kindred",
    url: `${window.location.origin}/join/ABCD1234`,
  })
})

test('copies the invite link', async () => {
  given({ admin: false })
  vi.mocked(platform.copyText).mockResolvedValue(true)
  renderCircle()
  await screen.findByRole('button', { name: 'Share invite link' })
  fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
  expect(await screen.findByText('Link copied')).toBeInTheDocument()
  expect(platform.copyText).toHaveBeenCalledWith(`${window.location.origin}/join/ABCD1234`)
})

test.each([
  ['Terms of use', 'Terms page'],
  ['Privacy policy', 'Privacy page'],
])('links %s', async (link, page) => {
  given({ admin: false })
  renderCircle()
  fireEvent.click(screen.getByRole('link', { name: link }))
  expect(await screen.findByRole('heading', { name: page })).toBeInTheDocument()
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import { platform } from '@/platform'
import Welcome from './welcome'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', () => ({
  createCircle: vi.fn(),
  createInvite: vi.fn(),
  setAdmin: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof circles>()),
  useProfile: vi.fn(),
  useMyMembership: vi.fn(),
  useCircleMembers: vi.fn(),
}))
vi.mock('@/platform', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform')>()
  return { ...actual, platform: { ...actual.platform, share: vi.fn() } }
})

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

function renderWelcome() {
  const router = createMemoryRouter(
    [
      { path: '/welcome', element: <Welcome /> },
      { path: '/', element: <h1>Home</h1> },
    ],
    { initialEntries: ['/welcome'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function inCircle(inCircle: boolean) {
  vi.mocked(circles.useMyMembership).mockReturnValue({
    isPending: false,
    data: inCircle
      ? { role: 'admin', relationship: 'parent', circles: { id: 'circle-1', care_recipient_name: 'Dad' } }
      : null,
  } as Query<typeof circles.useMyMembership>)
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({
    status: 'signed_in',
    session: {
      user: {
        id: 'user-1',
        email: 'maya@example.test',
        user_metadata: { full_name: 'Maya Reyes' },
      },
    },
  } as unknown as AuthState)
  vi.mocked(circles.useProfile).mockReturnValue({
    isPending: false,
    data: null,
  } as Query<typeof circles.useProfile>)
  vi.mocked(circles.useCircleMembers).mockReturnValue({
    data: [
      {
        user_id: 'user-1',
        role: 'admin',
        relationship: 'parent',
        joined_at: '2026-10-01T00:00:00Z',
        profiles: { display_name: 'Maya Reyes' },
      },
      {
        user_id: 'user-2',
        role: 'member',
        relationship: 'grandparent',
        joined_at: '2026-10-02T00:00:00Z',
        profiles: { display_name: 'Ada Reyes' },
      },
    ],
  } as Query<typeof circles.useCircleMembers>)
  vi.mocked(api.createInvite).mockResolvedValue('ABCD1234')
  inCircle(false)
})

test('creates a circle in two steps, with the name filled in from Google', async () => {
  vi.mocked(api.createCircle).mockResolvedValue('circle-1')
  renderWelcome()

  expect(screen.getByText('Step 1 of 3 · You')).toBeInTheDocument()
  expect(screen.getByLabelText('Your name')).toHaveValue('Maya Reyes')

  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(
    screen.getByText('Agree to the terms of use and privacy policy to continue.'),
  ).toBeInTheDocument()

  expect(screen.getByRole('link', { name: 'terms of use' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'privacy policy' })).toHaveAttribute('href', '/privacy')
  fireEvent.click(screen.getByLabelText('I agree to the terms of use and privacy policy.'))
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('Step 2 of 3 · Your loved one')).toBeInTheDocument()

  // The care recipient's name is required (US 2.1).
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
  expect(screen.getByText('Enter what the family calls them.')).toBeInTheDocument()
  expect(api.createCircle).not.toHaveBeenCalled()

  // Asked as "<Name> is my…" (task 4.9), once the name is in.
  expect(screen.getByLabelText('They are my…')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('What the family calls them'), {
    target: { value: ' Dad ' },
  })
  fireEvent.change(screen.getByLabelText('Dad is my…'), {
    target: { value: 'parent' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

  await vi.waitFor(() => expect(api.createCircle).toHaveBeenCalled())
  expect(vi.mocked(api.createCircle).mock.calls[0][0]).toEqual({
    care_recipient_name: 'Dad',
    relationship: 'parent',
    time_zone: expect.any(String),
    display_name: 'Maya Reyes',
  })
})

test('shares an invite link and lists who has joined', async () => {
  inCircle(true)
  vi.mocked(platform.share).mockResolvedValue('shared')
  renderWelcome()

  expect(screen.getByText('Step 3 of 3 · Care Circle')).toBeInTheDocument()
  expect(screen.getByText('Care Circle · 2 people')).toBeInTheDocument()
  expect(screen.getByText('You · Admin')).toBeInTheDocument()
  expect(screen.getByText('Joined')).toBeInTheDocument()
  // From the member's side (task 4.9): Dad is Ada's grandparent.
  expect(screen.getByText("Dad's grandchild")).toBeInTheDocument()

  fireEvent.click(await screen.findByRole('button', { name: 'Share invite link' }))
  await vi.waitFor(() => expect(platform.share).toHaveBeenCalled())
  expect(vi.mocked(platform.share).mock.calls[0][0]).toEqual({
    text: "Join Dad's Care Circle on Kindred",
    url: `${window.location.origin}/join/ABCD1234`,
  })
})

test('offers Copy link when sharing is unavailable', async () => {
  inCircle(true)
  vi.mocked(platform.share).mockResolvedValue('unsupported')
  renderWelcome()

  fireEvent.click(await screen.findByRole('button', { name: 'Share invite link' }))
  expect(await screen.findByRole('button', { name: 'Copy link' })).toBeInTheDocument()
  expect(screen.getByText(`${window.location.origin}/join/ABCD1234`)).toBeInTheDocument()
})

test('lets an admin make another member an admin', async () => {
  inCircle(true)
  vi.mocked(api.setAdmin).mockResolvedValue(undefined)
  renderWelcome()

  fireEvent.click(screen.getByLabelText(/Also make Ada an admin/))
  await vi.waitFor(() => expect(api.setAdmin).toHaveBeenCalled())
  expect(vi.mocked(api.setAdmin).mock.calls[0][0]).toBe('user-2')
})

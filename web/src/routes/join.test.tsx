import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import { RpcError } from '@/lib/errors'
import Join from './join'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', () => ({ invitePreview: vi.fn(), joinCircle: vi.fn() }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof circles>()),
  useProfile: vi.fn(),
}))

const preview: api.InvitePreview = {
  care_recipient_name: 'Dad',
  inviter_name: 'Maya',
  member_names: ['Maya', 'Ada'],
  member_count: 2,
  expires_at: '2026-10-09T12:00:00Z',
  is_member: false,
  in_other_circle: false,
}

const signedIn = {
  status: 'signed_in',
  session: { user: { id: 'user-1', email: 'jonah@example.test', user_metadata: {} } },
} as unknown as AuthState

function renderJoin() {
  const router = createMemoryRouter(
    [
      { path: '/join/:code', element: <Join /> },
      { path: '/', element: <h1>Home</h1> },
    ],
    { initialEntries: ['/join/ABCD1234'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ status: 'signed_out' })
  vi.mocked(circles.useProfile).mockReturnValue({
    isPending: false,
    data: { display_name: 'Jonah Reyes' },
  } as ReturnType<typeof circles.useProfile>)
  vi.mocked(api.invitePreview).mockResolvedValue(preview)
})

test('shows a signed-out visitor who invited them and who is already in', async () => {
  renderJoin()
  expect(
    await screen.findByRole('heading', { name: "Maya invited you to Dad's Care Circle" }),
  ).toBeInTheDocument()
  expect(screen.getByText('Maya and Ada are already in')).toBeInTheDocument()
  expect(api.invitePreview).toHaveBeenCalledWith('ABCD1234')
})

test('sends a signed-out visitor to sign in and back to the invite', async () => {
  renderJoin()
  const google = await screen.findByRole('link', { name: 'Continue with Google' })
  const email = screen.getByRole('link', { name: 'Email me a code' })
  for (const link of [google, email]) {
    expect(link).toHaveAttribute('href', '/sign-in?next=%2Fjoin%2FABCD1234')
  }
})

test('explains an expired invite in plain language', async () => {
  vi.mocked(api.invitePreview).mockRejectedValue(new RpcError('invite_expired'))
  renderJoin()
  expect(
    await screen.findByRole('heading', { name: 'This invite link has expired' }),
  ).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
})

test('explains an unknown invite in plain language', async () => {
  vi.mocked(api.invitePreview).mockRejectedValue(new RpcError('invite_not_found'))
  renderJoin()
  expect(
    await screen.findByRole('heading', { name: "This invite link doesn't work" }),
  ).toBeInTheDocument()
})

test('asks someone in another circle to leave it first', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn)
  vi.mocked(api.invitePreview).mockResolvedValue({ ...preview, in_other_circle: true })
  renderJoin()
  expect(
    await screen.findByRole('heading', { name: "You're already in a Care Circle" }),
  ).toBeInTheDocument()
})

test('opens Home for someone already in the circle', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn)
  vi.mocked(api.invitePreview).mockResolvedValue({ ...preview, is_member: true })
  renderJoin()
  expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
  expect(api.joinCircle).not.toHaveBeenCalled()
})

test('joins a signed-in visitor with their name and relationship', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn)
  vi.mocked(api.joinCircle).mockResolvedValue('circle-1')
  renderJoin()

  const join = await screen.findByRole('button', { name: "Join Dad's Care Circle" })
  expect(screen.getByLabelText('Your name')).toHaveValue('Jonah Reyes')

  fireEvent.click(join)
  expect(
    screen.getByText('Agree to the terms of use and privacy policy to continue.'),
  ).toBeInTheDocument()
  expect(api.joinCircle).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('Dad is your…'), { target: { value: 'parent' } })
  fireEvent.click(screen.getByLabelText('I agree to the terms of use and privacy policy.'))
  fireEvent.click(join)

  expect(await screen.findByRole('heading', { name: 'Home' })).toBeInTheDocument()
  expect(vi.mocked(api.joinCircle).mock.calls[0][0]).toEqual({
    code: 'ABCD1234',
    relationship: 'parent',
    display_name: 'Jonah Reyes',
  })
})

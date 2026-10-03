import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { signOut, useAuth, type AuthState } from '@/lib/auth'
import { platform } from '@/platform'
import { DemoBanner } from './demo-banner'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock('@/platform', () => ({
  platform: { disablePush: vi.fn(), deviceSetting: { get: vi.fn(), set: vi.fn() } },
}))

function signedIn(isAnonymous: boolean): AuthState {
  return {
    status: 'signed_in',
    session: { user: { id: 'user-1', is_anonymous: isAnonymous, user_metadata: {} } } as never,
  }
}

function renderBanner() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <DemoBanner /> },
      { path: '/sign-in', element: <p>Sign-in screen</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => vi.clearAllMocks())

test('a demo guest sees the banner; Sign in for real signs out and goes to sign-in', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(true))
  vi.mocked(platform.disablePush).mockResolvedValue(undefined as never)
  vi.mocked(signOut).mockResolvedValue()
  renderBanner()

  expect(screen.getByRole('heading', { name: "You're trying the demo" })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Sign in for real' }))
  expect(await screen.findByText('Sign-in screen')).toBeInTheDocument()
  expect(platform.disablePush).toHaveBeenCalledOnce()
  expect(signOut).toHaveBeenCalledOnce()
})

test('a failed sign-out says so', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(true))
  vi.mocked(platform.disablePush).mockResolvedValue(undefined as never)
  vi.mocked(signOut).mockRejectedValue(new Error('offline'))
  renderBanner()

  fireEvent.click(screen.getByRole('button', { name: 'Sign in for real' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't sign out.")
  expect(screen.getByRole('button', { name: 'Sign in for real' })).toBeEnabled()
})

test('members who signed in for real see no banner', () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(false))
  renderBanner()
  expect(screen.queryByText("You're trying the demo")).not.toBeInTheDocument()
})

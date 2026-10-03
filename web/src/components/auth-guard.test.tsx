import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { joinDemoCircle } from '@/lib/api'
import { myCircleKey, signOut, useAuth, type AuthState } from '@/lib/auth'
import { AuthGuard } from './auth-guard'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/live', () => ({ useLiveUpdates: vi.fn() }))
vi.mock('@/lib/push-resync', () => ({ useKeepPushSubscription: vi.fn(), forgetPushResync: vi.fn() }))
vi.mock('@/platform', () => ({ platform: { disablePush: vi.fn(() => Promise.resolve()) } }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  joinDemoCircle: vi.fn(),
}))
// Not in a circle until something puts one in the cache, as joining does.
vi.mock('@/lib/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth')>()
  return {
    ...actual,
    useAuth: vi.fn(),
    signOut: vi.fn(),
    useMyCircleId: (userId: string | undefined) =>
      useQuery({
        queryKey: [...actual.myCircleKey, userId],
        enabled: userId !== undefined,
        queryFn: () => Promise.resolve<string | null>(null),
      }),
  }
})

function signedIn(isAnonymous: boolean): AuthState {
  return {
    status: 'signed_in',
    session: { user: { id: 'user-1', is_anonymous: isAnonymous, user_metadata: {} } } as never,
  }
}

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { element: <AuthGuard requireCircle />, children: [{ path: '/', element: <p>Home screen</p> }] },
      { element: <AuthGuard />, children: [{ path: '/welcome', element: <p>Welcome screen</p> }] },
      { path: '/sign-in', element: <p>Sign-in screen</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return queryClient
}

afterEach(() => vi.clearAllMocks())

test('a demo guest with no circle joins the sample circle and lands on Home', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(true))
  vi.mocked(joinDemoCircle).mockResolvedValue('sample-circle')
  const queryClient = renderAt('/')

  expect(await screen.findByText('Home screen')).toBeInTheDocument()
  expect(joinDemoCircle).toHaveBeenCalled()
  expect(queryClient.getQueryData([...myCircleKey, 'user-1'])).toBe('sample-circle')
})

test('if joining fails, the guest can try again', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(true))
  vi.mocked(joinDemoCircle).mockRejectedValueOnce(new Error('offline')).mockResolvedValue('sample-circle')
  renderAt('/')

  expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't open the demo.")
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Home screen')).toBeInTheDocument()
})

test('a guest whose account is gone can start again from sign-in', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(true))
  vi.mocked(joinDemoCircle).mockRejectedValue(new Error('user not found'))
  vi.mocked(signOut).mockResolvedValue()
  renderAt('/')

  fireEvent.click(await screen.findByRole('button', { name: 'Start again' }))
  expect(await screen.findByText('Sign-in screen')).toBeInTheDocument()
  expect(signOut).toHaveBeenCalledOnce()
})

test('a demo guest never sees Welcome', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(true))
  vi.mocked(joinDemoCircle).mockResolvedValue('sample-circle')
  renderAt('/welcome')
  expect(await screen.findByText('Home screen')).toBeInTheDocument()
})

test('a real account with no circle goes to Welcome, not the demo', async () => {
  vi.mocked(useAuth).mockReturnValue(signedIn(false))
  renderAt('/')
  expect(await screen.findByText('Welcome screen')).toBeInTheDocument()
  expect(joinDemoCircle).not.toHaveBeenCalled()
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { invitePreview } from '@/lib/api'
import { useAuth, useMyCircleId, type AuthState } from '@/lib/auth'
import { platform } from '@/platform'
import { routes } from './router'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  invitePreview: vi.fn(),
}))
// No Realtime in tests (task 2.3).
vi.mock('@/lib/live', () => ({ useLiveUpdates: vi.fn(), useLiveNotifications: vi.fn() }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
  useMyCircleId: vi.fn(),
}))

const signedIn: AuthState = {
  status: 'signed_in',
  session: { user: { id: 'user-1', user_metadata: {} } } as never,
}

function given(auth: AuthState, circleId: string | null = 'circle-1') {
  vi.mocked(useAuth).mockReturnValue(auth)
  vi.mocked(useMyCircleId).mockReturnValue({
    isPending: false,
    isError: false,
    data: circleId,
  } as ReturnType<typeof useMyCircleId>)
}

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

// Home shows the Add to Home Screen guide in a browser tab; these tests are
// about the screens behind it. Most run as a signed-in member of a circle.
beforeEach(() => {
  vi.spyOn(platform, 'isStandalone').mockReturnValue(true)
  // Keep the notification permission screen (task 1.4) out of the way too.
  vi.spyOn(platform, 'notificationPermission').mockReturnValue('unsupported')
  given(signedIn)
})

afterEach(() => {
  vi.restoreAllMocks()
})

test.each([
  ['/updates', 'Updates'],
  ['/circle', 'Care Circle'],
  ['/notifications', 'What you missed'],
])('%s renders its placeholder', (path, title) => {
  renderAt(path)
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
})

test.each(['/', '/week', '/updates', '/summary'])('%s shows the bottom tabs', (path) => {
  renderAt(path)
  const tabs = screen.getByRole('navigation', { name: 'Main' })
  for (const name of ['Home', 'This week', 'Updates', 'Summary']) {
    expect(within(tabs).getByRole('link', { name })).toBeInTheDocument()
  }
})

test.each(['/circle', '/notifications', '/i/123'])('%s has Back instead of tabs', (path) => {
  renderAt(path)
  expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
})

test('Home has the bell and the Care Circle button', () => {
  renderAt('/')
  expect(screen.getByRole('link', { name: 'Notifications' })).toHaveAttribute('href', '/notifications')
  expect(screen.getByRole('link', { name: 'Care Circle and settings' })).toHaveAttribute(
    'href',
    '/circle',
  )
})

test('Home shows the Add to Home Screen guide in a browser tab', () => {
  vi.mocked(platform.isStandalone).mockReturnValue(false)
  vi.spyOn(platform.deviceSetting, 'get').mockReturnValue(null)
  renderAt('/')
  expect(screen.getByRole('heading', { name: 'Add Kindred to your Home Screen' })).toBeInTheDocument()
})

// The sign-in guard (task 1.1).

test('signed-out people go to sign-in, keeping where they were going', () => {
  given({ status: 'signed_out' })
  const router = renderAt('/i/123?from=share')
  expect(router.state.location.pathname).toBe('/sign-in')
  expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/i/123?from=share')}`)
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
})

test('signed-out people opening Home go to plain /sign-in', () => {
  given({ status: 'signed_out' })
  const router = renderAt('/')
  expect(router.state.location.pathname).toBe('/sign-in')
  expect(router.state.location.search).toBe('')
})

test('signed-out people opening /welcome sign in first', () => {
  given({ status: 'signed_out' })
  const router = renderAt('/welcome')
  expect(router.state.location.pathname).toBe('/sign-in')
  expect(router.state.location.search).toBe(`?next=${encodeURIComponent('/welcome')}`)
})

test('signed-in people not in a circle go to /welcome', () => {
  given(signedIn, null)
  const router = renderAt('/week')
  expect(router.state.location.pathname).toBe('/welcome')
})

test.each([
  ['signed out', { status: 'signed_out' } as AuthState],
  ['signed in with no circle', signedIn],
])('an invite link opens for someone %s', (_label, auth) => {
  given(auth, null)
  vi.mocked(invitePreview).mockReturnValue(new Promise(() => {}))
  const router = renderAt('/join/ABCD1234')
  expect(router.state.location.pathname).toBe('/join/ABCD1234')
})

test('after signing in, /sign-in continues to the original destination', () => {
  const router = renderAt(`/sign-in?next=${encodeURIComponent('/join/ABCD1234')}`)
  expect(router.state.location.pathname).toBe('/join/ABCD1234')
})

test.each([
  ['/privacy', 'Privacy'],
  ['/terms', 'Terms of use'],
])('%s loads signed out and signed in', (path, title) => {
  given({ status: 'signed_out' })
  renderAt(path)
  expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
  cleanup()
  given(signedIn)
  renderAt(path)
  expect(screen.getByRole('heading', { name: title, level: 1 })).toBeInTheDocument()
})

test('sign-in links the terms of use and privacy policy', () => {
  given({ status: 'signed_out' })
  renderAt('/sign-in')
  expect(screen.getByRole('link', { name: 'Terms of use' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')
})

test('nothing redirects while the session is still loading', () => {
  given({ status: 'loading' })
  const router = renderAt('/i/123')
  expect(router.state.location.pathname).toBe('/i/123')
  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

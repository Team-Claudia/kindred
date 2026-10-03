import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { leaveCircle, setDisplayName } from '@/lib/api'
import { signOut } from '@/lib/auth'
import { useProfile } from '@/lib/circles'
import { RpcError } from '@/lib/errors'
import { platform } from '@/platform'
import { AccountCard } from './account-card'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  leaveCircle: vi.fn(),
  setDisplayName: vi.fn(),
}))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  signOut: vi.fn(),
  useAuth: () => ({ status: 'signed_in', session: { user: { id: 'user-1' } } }),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/circles')>()),
  useProfile: vi.fn(),
}))
vi.mock('@/platform', () => ({ platform: { disablePush: vi.fn() } }))

function renderCard() {
  const router = createMemoryRouter(
    [
      { path: '/circle', element: <AccountCard /> },
      { path: '/welcome', element: <p>Welcome screen</p> },
      { path: '/sign-in', element: <p>Sign-in screen</p> },
    ],
    { initialEntries: ['/circle'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(useProfile).mockReturnValue({
    data: { display_name: 'Maya Reyes' },
  } as ReturnType<typeof useProfile>)
})

afterEach(() => vi.clearAllMocks())

test('shows your name and saves a new one', async () => {
  vi.mocked(setDisplayName).mockResolvedValue(undefined)
  renderCard()
  const name = screen.getByLabelText('Your name')
  expect(name).toHaveValue('Maya Reyes')
  expect(screen.queryByRole('button', { name: 'Save name' })).not.toBeInTheDocument()

  fireEvent.change(name, { target: { value: '  Maya R.  ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
  await vi.waitFor(() => expect(setDisplayName).toHaveBeenCalled())
  expect(vi.mocked(setDisplayName).mock.calls[0][0]).toBe('Maya R.')
})

test('a blank name is not saved', () => {
  renderCard()
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: '   ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save name' }))
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your name.')
  expect(setDisplayName).not.toHaveBeenCalled()
})

test('leaving asks first, then leaves and goes to Welcome', async () => {
  vi.mocked(leaveCircle).mockResolvedValue(undefined as never)
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Leave this Care Circle' }))
  expect(leaveCircle).not.toHaveBeenCalled()
  expect(screen.getByText('Leave this Care Circle?')).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }))
  expect(await screen.findByText('Welcome screen')).toBeInTheDocument()
  expect(leaveCircle).toHaveBeenCalledOnce()
})

test('Stay closes the question without leaving', () => {
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Leave this Care Circle' }))
  fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
  expect(screen.getByRole('button', { name: 'Leave this Care Circle' })).toBeInTheDocument()
  expect(leaveCircle).not.toHaveBeenCalled()
})

test('a failed leave says why and stays put', async () => {
  vi.mocked(leaveCircle).mockRejectedValue(new RpcError('not_member'))
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Leave this Care Circle' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, leave' }))
  expect(await screen.findByRole('alert')).toBeInTheDocument()
  expect(screen.queryByText('Welcome screen')).not.toBeInTheDocument()
})

test('signing out stops push on this phone first, then goes to sign-in', async () => {
  vi.mocked(platform.disablePush).mockResolvedValue()
  vi.mocked(signOut).mockResolvedValue()
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByText('Sign-in screen')).toBeInTheDocument()
  expect(platform.disablePush).toHaveBeenCalledOnce()
  expect(vi.mocked(platform.disablePush).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(signOut).mock.invocationCallOrder[0],
  )
})

test('signs out even if push could not be stopped', async () => {
  vi.mocked(platform.disablePush).mockRejectedValue(new Error('offline'))
  vi.mocked(signOut).mockResolvedValue()
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(await screen.findByText('Sign-in screen')).toBeInTheDocument()
})

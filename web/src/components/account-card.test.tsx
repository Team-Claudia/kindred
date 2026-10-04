import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { deleteAccount, exportAccount, leaveCircle, setDisplayName } from '@/lib/api'
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
  exportAccount: vi.fn(),
  deleteAccount: vi.fn(),
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
vi.mock('@/platform', () => ({
  platform: { disablePush: vi.fn(), saveFile: vi.fn(), deviceSetting: { get: vi.fn(), set: vi.fn() } },
}))

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

// ---------------------------------------------------------------------------
// Download my data and Delete my account (task 4.5e)
// ---------------------------------------------------------------------------

test('Download my data saves a JSON file of the export', async () => {
  vi.mocked(exportAccount).mockResolvedValue({ profile: { display_name: 'Maya Reyes' } })
  vi.mocked(platform.saveFile).mockResolvedValue('saved')
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Download my data' }))
  expect(await screen.findByText('Your data is saved.')).toBeInTheDocument()
  const file = vi.mocked(platform.saveFile).mock.calls[0][0]
  expect(file.type).toBe('application/json')
  expect(file.name).toMatch(/^kindred-my-data-\d{4}-\d{2}-\d{2}\.json$/)
  expect(JSON.parse(file.text)).toEqual({ profile: { display_name: 'Maya Reyes' } })
})

test('when the share sheet needs another tap, Save my data opens it again', async () => {
  vi.mocked(exportAccount).mockResolvedValue({ a: 1 })
  vi.mocked(platform.saveFile).mockResolvedValueOnce('needs_tap').mockResolvedValueOnce('saved')
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Download my data' }))
  expect(await screen.findByText('Your data is ready.')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Save my data' }))
  expect(await screen.findByText('Your data is saved.')).toBeInTheDocument()
  expect(exportAccount).toHaveBeenCalledOnce()
  expect(platform.saveFile).toHaveBeenCalledTimes(2)
})

test('a failed export says so', async () => {
  vi.mocked(exportAccount).mockRejectedValue(new Error('offline'))
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Download my data' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't get your data.")
  expect(platform.saveFile).not.toHaveBeenCalled()
})

test('deleting asks first and says plainly what happens', () => {
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  expect(deleteAccount).not.toHaveBeenCalled()
  const confirm = screen.getByRole('group', { name: 'Delete your account?' })
  expect(confirm).toHaveTextContent('goes back to Needs someone')
  expect(confirm).toHaveTextContent('the rest of your Care Circle is told')
  expect(confirm).toHaveTextContent('"Former member"')
  expect(confirm).toHaveTextContent("This can't be undone.")
})

test('Keep my account closes the question without deleting', () => {
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep my account' }))
  expect(screen.queryByRole('group', { name: 'Delete your account?' })).not.toBeInTheDocument()
  expect(deleteAccount).not.toHaveBeenCalled()
})

test('confirming deletes the account, signs out on this phone and goes to sign-in', async () => {
  vi.mocked(deleteAccount).mockResolvedValue()
  vi.mocked(platform.disablePush).mockResolvedValue()
  vi.mocked(signOut).mockResolvedValue()
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
  expect(await screen.findByText('Sign-in screen')).toBeInTheDocument()
  expect(deleteAccount).toHaveBeenCalledOnce()
  expect(signOut).toHaveBeenCalledWith('local')
  expect(vi.mocked(deleteAccount).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(signOut).mock.invocationCallOrder[0],
  )
})

test('a failed delete says so, stays signed in and can be tried again', async () => {
  vi.mocked(deleteAccount).mockRejectedValue(new Error('offline'))
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete your account.")
  expect(signOut).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeEnabled()
})

test('opening Delete closes Leave, so only one question shows', () => {
  renderCard()
  fireEvent.click(screen.getByRole('button', { name: 'Leave this Care Circle' }))
  fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
  expect(screen.queryByText('Leave this Care Circle?')).not.toBeInTheDocument()
  expect(screen.getByText('Delete your account?')).toBeInTheDocument()
})

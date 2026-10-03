import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { sendEmailCode, signInWithGoogle, useAuth, verifyEmailCode } from '@/lib/auth'
import { platform } from '@/platform'
import SignIn from './sign-in'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(() => ({ status: 'signed_out' })),
  signInWithGoogle: vi.fn(),
  sendEmailCode: vi.fn(),
  verifyEmailCode: vi.fn(),
}))

function renderSignIn(path = '/sign-in') {
  render(
    <RouterProvider
      router={createMemoryRouter([{ path: '/sign-in', element: <SignIn /> }], {
        initialEntries: [path],
      })}
    />,
  )
}

beforeEach(() => {
  vi.mocked(useAuth).mockReturnValue({ status: 'signed_out' })
  vi.mocked(sendEmailCode).mockReset().mockResolvedValue()
  vi.mocked(verifyEmailCode).mockReset().mockResolvedValue()
})

test('Continue with Google returns to the original destination', () => {
  renderSignIn(`/sign-in?next=${encodeURIComponent('/join/ABCD1234')}`)
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(signInWithGoogle).toHaveBeenCalledWith('/join/ABCD1234')
})

test('Try the demo is not available yet', () => {
  renderSignIn()
  expect(screen.getByRole('button', { name: 'Try the demo' })).toBeDisabled()
  expect(screen.getByText(/Coming soon\./)).toBeInTheDocument()
})

test('signs in with an emailed code', async () => {
  renderSignIn()
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: ' maya@example.com ' } })
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))

  expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
  expect(sendEmailCode).toHaveBeenCalledWith('maya@example.com')

  // Pasting a code with a space still fills all six digits and checks it.
  fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '482 913' } })
  await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledWith('maya@example.com', '482913'))
})

test('a wrong code says so and can be retried', async () => {
  vi.mocked(verifyEmailCode).mockRejectedValueOnce({ status: 403, code: 'otp_expired' })
  renderSignIn()
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maya@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
  fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '000000' } })

  expect(await screen.findByRole('alert')).toHaveTextContent("That code didn't work.")

  fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
  expect(await screen.findByRole('status')).toHaveTextContent('We sent a new code.')
  expect(sendEmailCode).toHaveBeenCalledTimes(2)
})

test('Use a different email goes back to the email step', async () => {
  renderSignIn()
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'maya@example.com' } })
  fireEvent.click(screen.getByRole('button', { name: 'Email me a code' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Use a different email' }))
  expect(screen.getByRole('heading', { name: "What's your email?" })).toBeInTheDocument()
  expect(screen.getByLabelText('Email')).toHaveValue('maya@example.com')
})

describe('on an iPhone (task 4.10)', () => {
  function onIPhone({ standalone }: { standalone: boolean }) {
    vi.spyOn(platform, 'isIOS').mockReturnValue(true)
    vi.spyOn(platform, 'isStandalone').mockReturnValue(standalone)
  }

  beforeEach(() => {
    const settings = new Map<string, string>()
    vi.spyOn(platform.deviceSetting, 'get').mockImplementation((key) => settings.get(key) ?? null)
    vi.spyOn(platform.deviceSetting, 'set').mockImplementation((key, value) => {
      settings.set(key, value)
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('in Safari, asks to add Kindred to the Home Screen before signing in', () => {
    onIPhone({ standalone: false })
    renderSignIn()
    expect(
      screen.getByRole('heading', { name: 'Add Kindred to your Home Screen' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sign in here instead' }))
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  test('"Sign in here instead" is remembered on this device for a while', () => {
    onIPhone({ standalone: false })
    renderSignIn()
    fireEvent.click(screen.getByRole('button', { name: 'Sign in here instead' }))
    cleanup()
    renderSignIn()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  })

  test('in the Home Screen app, signs in straight away', () => {
    onIPhone({ standalone: true })
    renderSignIn()
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument()
  })

  test('an item link opened in Safari says where to find it in the app', () => {
    onIPhone({ standalone: false })
    renderSignIn(`/sign-in?next=${encodeURIComponent('/i/item-1')}`)
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent('Using the Kindred app?')
    expect(note).toHaveTextContent('Open it from your Home Screen.')
    expect(note).toHaveTextContent('under This week, or on Home')
    // Signing in here still works.
    fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
    expect(signInWithGoogle).toHaveBeenCalledWith('/i/item-1')
  })
})

test('on a computer, signs in straight away with no app note', () => {
  renderSignIn(`/sign-in?next=${encodeURIComponent('/i/item-1')}`)
  expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument()
  expect(screen.queryByRole('note')).not.toBeInTheDocument()
})

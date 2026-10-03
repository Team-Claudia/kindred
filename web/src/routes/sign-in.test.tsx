import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { sendEmailCode, signInAsGuest, signInWithGoogle, useAuth, verifyEmailCode } from '@/lib/auth'
import SignIn from './sign-in'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(() => ({ status: 'signed_out' })),
  signInWithGoogle: vi.fn(),
  signInAsGuest: vi.fn(),
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
  vi.mocked(signInAsGuest).mockReset().mockResolvedValue()
})

test('Continue with Google returns to the original destination', () => {
  renderSignIn(`/sign-in?next=${encodeURIComponent('/join/ABCD1234')}`)
  fireEvent.click(screen.getByRole('button', { name: 'Continue with Google' }))
  expect(signInWithGoogle).toHaveBeenCalledWith('/join/ABCD1234')
})

test('Try the demo signs in as a guest', async () => {
  renderSignIn()
  expect(screen.getByText("Look around a sample family's Care Circle. No account needed.")).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }))
  expect(signInAsGuest).toHaveBeenCalledOnce()
  expect(await screen.findByRole('button', { name: 'Opening the demo…' })).toBeDisabled()
})

test('Try the demo says when it fails, and can be tried again', async () => {
  vi.mocked(signInAsGuest).mockRejectedValueOnce({ status: 429, code: 'over_request_rate_limit' })
  renderSignIn()
  fireEvent.click(screen.getByRole('button', { name: 'Try the demo' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Lots of people are trying the demo')
  expect(screen.getByRole('button', { name: 'Try the demo' })).toBeEnabled()
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

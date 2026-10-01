import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { platform } from '@/platform'
import { routes } from './router'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

function renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

// Home shows the Add to Home Screen guide in a browser tab; these tests are
// about the screens behind it.
beforeEach(() => {
  vi.spyOn(platform, 'isStandalone').mockReturnValue(true)
})

afterEach(() => {
  vi.restoreAllMocks()
})

test.each([
  ['/', 'Home'],
  ['/week', 'This week'],
  ['/updates', 'Updates'],
  ['/summary', 'Summary'],
  ['/circle', 'Care Circle'],
  ['/notifications', 'Notifications'],
  ['/i/123', 'Task or appointment'],
  ['/sign-in', 'Sign in'],
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

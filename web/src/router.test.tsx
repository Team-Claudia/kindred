import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { routes } from './router'

test.each([
  ['/', 'Home'],
  ['/week', 'This week'],
  ['/updates', 'Updates'],
  ['/summary', 'Summary'],
  ['/circle', 'Care Circle'],
  ['/notifications', 'Notifications'],
  ['/i/123', 'Task or appointment'],
  ['/join/ABCD1234', 'Join a Care Circle'],
  ['/sign-in', 'Sign in'],
  ['/welcome', 'Welcome'],
])('%s renders its placeholder', (path, title) => {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
  expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
})

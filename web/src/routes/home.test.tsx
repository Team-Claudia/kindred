import { render, screen } from '@testing-library/react'
import '@/i18n'
import Home from './home'

test('shows the greeting from the en-CA catalogue', () => {
  render(<Home />)
  expect(screen.getByRole('heading', { name: 'Hello Kindred' })).toBeInTheDocument()
})

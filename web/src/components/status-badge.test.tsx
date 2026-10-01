import { render, screen } from '@testing-library/react'
import '@/i18n'
import { ASSIGNMENT_STATES, type BadgeStatus } from '@/lib/status'
import { StatusBadge } from './status-badge'

const labels: Record<BadgeStatus, string> = {
  needs_someone: 'Needs someone',
  awaiting_acceptance: 'Awaiting acceptance',
  assigned: 'Assigned',
  needs_coverage: 'Needs coverage',
  completed: 'Completed',
  cancelled: 'Cancelled',
  overdue: 'Overdue',
}

test.each([...ASSIGNMENT_STATES, 'overdue' as const])('%s shows its name as text', (status) => {
  render(<StatusBadge status={status} />)
  const badge = screen.getByText(labels[status])
  expect(badge).toHaveAttribute('data-status', status)
  // Colour comes from that state's token pair.
  expect(badge.className).toContain(`bg-state-${status.replace('_', '-')}`)
  expect(badge.className).toContain(`text-state-${status.replace('_', '-')}-foreground`)
})

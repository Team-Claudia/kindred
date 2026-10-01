import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import { ItemRow, type ItemRowItem } from './item-row'

const timeZone = 'America/Vancouver'
const now = new Date('2026-09-24T19:00:00Z') // Thu 24 Sep, noon in Vancouver
const names = new Map([
  ['maya', 'Maya'],
  ['jonah', 'Jonah'],
])

function item(overrides: Partial<ItemRowItem>): ItemRowItem {
  return {
    id: 'item-1',
    kind: 'task',
    title: 'Refill blood pressure meds',
    starts_at: '2026-09-25T00:00:00Z', // Thu 5 pm
    state: 'assigned',
    owner_id: 'jonah',
    proposed_assignee_id: null,
    location: null,
    updated_at: '2026-09-20T00:00:00Z',
    ...overrides,
  }
}

function renderRow(row: ItemRowItem) {
  const router = createMemoryRouter(
    [{ path: '/', element: <ItemRow item={row} names={names} timeZone={timeZone} now={now} /> }],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  return screen.getByRole('link')
}

function badges(link: HTMLElement) {
  return [...link.querySelectorAll('[data-status]')].map((badge) => badge.textContent)
}

test('a task with a confirmed owner shows the due time, owner, state and kind', () => {
  const link = renderRow(item({}))
  expect(link).toHaveAttribute('href', '/i/item-1')
  expect(link).toHaveTextContent('Refill blood pressure meds')
  expect(link).toHaveTextContent('Due 5:00 p.m. · Jonah')
  expect(badges(link)).toEqual(['Assigned'])
  expect(link).toHaveTextContent('Task')
})

test('an appointment shows its time and place, without "Due"', () => {
  const link = renderRow(
    item({ kind: 'appointment', title: 'Cardiology', starts_at: '2026-09-25T21:00:00Z', owner_id: 'maya', location: 'Riverside Clinic' }),
  )
  expect(link).toHaveTextContent('2:00 p.m. · Maya · Riverside Clinic')
  expect(link).toHaveTextContent('Appointment')
})

test('awaiting acceptance says who was asked and does not present them as the owner', () => {
  const link = renderRow(item({ state: 'awaiting_acceptance', owner_id: null, proposed_assignee_id: 'maya' }))
  expect(link).toHaveTextContent('Due 5:00 p.m. · Asked Maya')
  expect(badges(link)).toEqual(['Awaiting Maya'])
})

test('needs someone says nobody has claimed it', () => {
  const link = renderRow(item({ state: 'needs_someone', owner_id: null }))
  expect(link).toHaveTextContent('Nobody has claimed this')
  expect(badges(link)).toEqual(['Needs someone'])
  expect(link).toHaveTextContent('?')
})

test('a past item that is not done shows Overdue alongside its state', () => {
  const link = renderRow(item({ starts_at: '2026-09-24T18:00:00Z' }))
  expect(badges(link)).toEqual(['Overdue', 'Assigned'])
  expect(link).toHaveAttribute('data-overdue', 'true')
})

test('a completed item shows when it was done and by whom, and is not overdue', () => {
  const link = renderRow(
    item({ state: 'completed', starts_at: '2026-09-24T18:00:00Z', updated_at: '2026-09-24T18:04:00Z' }),
  )
  expect(link).toHaveTextContent('Done 11:04 a.m. · Jonah')
  expect(badges(link)).toEqual(['Completed'])
})

test('an owner who has left the circle is shown as a former member', () => {
  const link = renderRow(item({ owner_id: 'gone' }))
  expect(link).toHaveTextContent('Due 5:00 p.m. · Former member')
})

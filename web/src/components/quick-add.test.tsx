import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
import * as queries from '@/lib/queries'
import { QuickAdd } from './quick-add'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth')>()),
  useAuth: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof circles>()),
  useMyMembership: vi.fn(),
  useCircleMembers: vi.fn(),
}))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof api>()),
  createItem: vi.fn(),
  postUpdate: vi.fn(),
}))
vi.mock('@/lib/queries', async (importOriginal) => ({
  ...(await importOriginal<typeof queries>()),
  useItemsInRange: vi.fn(),
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

function renderQuickAdd() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <QuickAdd /> },
      { path: '/i/:itemId', element: <p>Item screen</p> },
      { path: '/updates', element: <p>Updates screen</p> },
    ],
    { initialEntries: ['/'] },
  )
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-24T19:00:00Z')) // Thu 24 Sep, noon in Vancouver
  vi.mocked(useAuth).mockReturnValue({
    status: 'signed_in',
    session: { user: { id: 'maya' } },
  } as unknown as AuthState)
  vi.mocked(circles.useMyMembership).mockReturnValue({
    isPending: false,
    isError: false,
    data: {
      role: 'admin',
      relationship: 'parent',
      circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Vancouver' },
    },
  } as Query<typeof circles.useMyMembership>)
  vi.mocked(circles.useCircleMembers).mockReturnValue({
    isPending: false,
    isSuccess: true,
    data: [
      { user_id: 'maya', role: 'admin', relationship: 'parent', joined_at: '', profiles: { display_name: 'Maya' } },
      { user_id: 'jonah', role: 'member', relationship: 'parent', joined_at: '', profiles: { display_name: 'Jonah' } },
    ],
  } as unknown as Query<typeof circles.useCircleMembers>)
  vi.mocked(api.createItem).mockResolvedValue('new-item')
  vi.mocked(api.postUpdate).mockResolvedValue('new-update')
  vi.mocked(queries.useItemsInRange).mockReturnValue({
    isPending: false,
    data: [
      { id: 'cardio', kind: 'appointment', title: 'Cardiology', starts_at: '2026-09-23T21:00:00Z', state: 'assigned' },
      { id: 'meds', kind: 'task', title: 'Refill meds', starts_at: '2026-09-26T00:00:00Z', state: 'needs_someone' },
    ],
  } as unknown as Query<typeof queries.useItemsInRange>)
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('adds a task for nobody yet, then opens it', async () => {
  const router = renderQuickAdd()

  fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
  const chooser = await screen.findByRole('dialog', { name: 'What do you want to add?' })
  fireEvent.click(within(chooser).getByRole('button', { name: /^Task/ }))

  const sheet = await screen.findByRole('dialog', { name: 'New task' })
  expect(within(sheet).getByLabelText('Due date')).toHaveValue('2026-09-24')
  expect(sheet).toHaveTextContent('It shows as Needs someone until someone takes it.')

  // Nothing is sent until the form is complete.
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add task' }))
  expect(within(sheet).getByText('Give it a name.')).toBeInTheDocument()
  expect(api.createItem).not.toHaveBeenCalled()

  fireEvent.change(within(sheet).getByLabelText('Task'), { target: { value: 'Refill meds' } })
  fireEvent.change(within(sheet).getByLabelText('Time (optional)'), { target: { value: '17:00' } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add task' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/i/new-item'))
  expect(api.createItem).toHaveBeenCalledWith({
    kind: 'task',
    title: 'Refill meds',
    starts_at: '2026-09-25T00:00:00.000Z',
  })
})

test('asking someone explains they have to accept', async () => {
  renderQuickAdd()

  fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
  fireEvent.click(await screen.findByRole('button', { name: /^Appointment/ }))
  const sheet = await screen.findByRole('dialog', { name: 'New appointment' })

  fireEvent.click(within(sheet).getByRole('radio', { name: /Jonah/ }))
  expect(sheet).toHaveTextContent(
    'Jonah is asked to accept. Until they do, it shows as Awaiting Jonah, not as theirs.',
  )
  fireEvent.click(within(sheet).getByRole('radio', { name: /Maya \(you\)/ }))
  expect(sheet).toHaveTextContent("You picked yourself, so it's yours straight away.")

  fireEvent.change(within(sheet).getByLabelText('Appointment'), { target: { value: 'Cardiology' } })
  fireEvent.change(within(sheet).getByLabelText('Start time'), { target: { value: '14:00' } })
  fireEvent.change(within(sheet).getByLabelText('Location'), { target: { value: 'Riverside Clinic' } })
  fireEvent.click(within(sheet).getByRole('radio', { name: /Jonah/ }))
  fireEvent.click(within(sheet).getByRole('button', { name: 'Add appointment' }))

  await waitFor(() =>
    expect(api.createItem).toHaveBeenCalledWith({
      kind: 'appointment',
      title: 'Cardiology',
      starts_at: '2026-09-24T21:00:00.000Z',
      location: 'Riverside Clinic',
      assignee_id: 'jonah',
    }),
  )
})

test('Update or note posts an update, linked or not, then opens Updates', async () => {
  const router = renderQuickAdd()

  fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
  fireEvent.click(await screen.findByRole('button', { name: /Update or note/ }))
  const sheet = await screen.findByRole('dialog', { name: 'New update' })
  expect(sheet).toHaveTextContent('Maya, posting to the Care Circle')
  expect(within(sheet).getByRole('radio', { name: 'Nothing in particular' })).toBeChecked()
  expect(sheet).toHaveTextContent('Everyone in the Care Circle is notified.')

  // A blank update isn't sent.
  fireEvent.click(within(sheet).getByRole('button', { name: 'Post to updates' }))
  expect(within(sheet).getByText('Write what happened.')).toBeInTheDocument()
  expect(api.postUpdate).not.toHaveBeenCalled()

  fireEvent.change(within(sheet).getByLabelText('What happened?'), {
    target: { value: '  Back from cardiology, next visit in six weeks. ' },
  })
  fireEvent.click(within(sheet).getByRole('radio', { name: /Cardiology/ }))
  expect(sheet).toHaveTextContent(
    'Everyone in the Care Circle is notified, and the update also shows on Cardiology.',
  )
  fireEvent.click(within(sheet).getByRole('button', { name: 'Post to updates' }))

  await waitFor(() => expect(router.state.location.pathname).toBe('/updates'))
  expect(api.postUpdate).toHaveBeenCalledWith({
    body: 'Back from cardiology, next visit in six weeks.',
    item_id: 'cardio',
  })
})

test('an update over 2,000 characters is not sent', async () => {
  renderQuickAdd()

  fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
  fireEvent.click(await screen.findByRole('button', { name: /Update or note/ }))
  const sheet = await screen.findByRole('dialog', { name: 'New update' })
  fireEvent.change(within(sheet).getByLabelText('What happened?'), { target: { value: 'a'.repeat(2001) } })
  fireEvent.click(within(sheet).getByRole('button', { name: 'Post' }))

  expect(within(sheet).getByText('Keep it under 2,000 characters.')).toBeInTheDocument()
  expect(api.postUpdate).not.toHaveBeenCalled()
})

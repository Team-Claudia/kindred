import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import '@/i18n'
import * as api from '@/lib/api'
import { useAuth, type AuthState } from '@/lib/auth'
import * as circles from '@/lib/circles'
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
}))

type Query<T extends (...args: never[]) => unknown> = ReturnType<T>

function renderQuickAdd() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <QuickAdd /> },
      { path: '/i/:itemId', element: <p>Item screen</p> },
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
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

test('adds a task for nobody yet, then opens it', async () => {
  const router = renderQuickAdd()

  fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
  const chooser = await screen.findByRole('dialog', { name: 'What do you want to add?' })
  expect(within(chooser).getByRole('button', { name: /Update or note/ })).toBeDisabled()
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

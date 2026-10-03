import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import { availability } from '@/lib/api'
import * as circles from '@/lib/circles'
import { MemberPicker } from './member-picker'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  availability: vi.fn(),
}))
vi.mock('@/lib/circles', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/circles')>()),
  useMyMembership: vi.fn(),
}))

const SLOT = { start: '2026-10-16T13:30:00.000Z', end: '2026-10-16T14:30:00.000Z' }
const members = [
  { user_id: 'maya', role: 'admin', relationship: 'child', joined_at: '', profiles: { display_name: 'Maya Reyes' } },
  { user_id: 'jonah', role: 'member', relationship: 'child', joined_at: '', profiles: { display_name: 'Jonah Reyes' } },
  { user_id: 'ada', role: 'member', relationship: 'friend', joined_at: '', profiles: { display_name: 'Ada Lee' } },
] as circles.CircleMember[]

function renderPicker(slot: typeof SLOT | null, onChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemberPicker legend="Ask someone" members={members} viewerId="maya" value={null} onChange={onChange} slot={slot} />
    </QueryClientProvider>,
  )
  return onChange
}

beforeEach(() => {
  vi.mocked(circles.useMyMembership).mockReturnValue({
    data: { role: 'admin', relationship: 'child', circles: { id: 'circle-1', care_recipient_name: 'Dad', time_zone: 'America/Toronto' } },
  } as ReturnType<typeof circles.useMyMembership>)
})

afterEach(() => vi.clearAllMocks())

function badgeOf(name: RegExp) {
  return screen.getByRole('radio', { name }).closest('label')!.querySelector('[data-availability]')
}

test('with a slot, each member shows Free, Busy or Unknown as text', async () => {
  vi.mocked(availability).mockResolvedValue({ maya: 'free', jonah: 'busy', ada: 'unknown' })
  renderPicker(SLOT)
  expect(await screen.findByText('Free')).toBeInTheDocument()
  expect(badgeOf(/Maya/)).toHaveTextContent('Free')
  expect(badgeOf(/Jonah/)).toHaveTextContent('Busy')
  expect(badgeOf(/Ada/)).toHaveTextContent('Unknown')
  expect(badgeOf(/Jonah/)).toHaveAttribute('data-availability', 'busy')
  expect(availability).toHaveBeenCalledWith('circle-1', SLOT)
  expect(screen.getByText(/Unknown means they haven't connected it/)).toBeInTheDocument()
})

test('a busy member can still be chosen', async () => {
  vi.mocked(availability).mockResolvedValue({ maya: 'free', jonah: 'busy', ada: 'unknown' })
  const onChange = renderPicker(SLOT)
  await screen.findByText('Busy')
  fireEvent.click(screen.getByRole('radio', { name: /Jonah/ }))
  expect(onChange).toHaveBeenCalledWith('jonah')
})

test('shows Checking… while asking', () => {
  vi.mocked(availability).mockReturnValue(new Promise(() => {}))
  renderPicker(SLOT)
  expect(screen.getAllByText('Checking…')).toHaveLength(3)
})

test('everyone is Unknown if the check fails', async () => {
  vi.mocked(availability).mockRejectedValue(new Error('offline'))
  renderPicker(SLOT)
  await vi.waitFor(() => expect(screen.getAllByText('Unknown')).toHaveLength(3))
})

test('a member missing from the answer is Unknown', async () => {
  vi.mocked(availability).mockResolvedValue({ maya: 'busy' })
  renderPicker(SLOT)
  await screen.findByText('Busy')
  expect(badgeOf(/Ada/)).toHaveTextContent('Unknown')
})

test('with no slot, nothing is checked or shown', () => {
  renderPicker(null)
  expect(availability).not.toHaveBeenCalled()
  expect(document.querySelector('[data-availability]')).toBeNull()
})

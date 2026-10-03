import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import { isPushTurnedOff } from '@/lib/push-resync'
import { platform } from '@/platform'
import { PushSettingsCard } from './push-settings-card'

vi.mock('@/lib/supabase', () => ({ supabase: {} }))

const settings = new Map<string, string>()

vi.mock('@/platform', () => ({
  platform: {
    isStandalone: vi.fn(),
    notificationPermission: vi.fn(),
    pushEnabled: vi.fn(),
    enablePush: vi.fn(),
    disablePush: vi.fn(),
    deviceSetting: {
      get: (key: string) => settings.get(key) ?? null,
      set: (key: string, value: string) => settings.set(key, value),
    },
  },
}))

const mocked = vi.mocked(platform)

beforeEach(() => {
  settings.clear()
  mocked.isStandalone.mockReturnValue(true)
  mocked.notificationPermission.mockReturnValue('granted')
  mocked.pushEnabled.mockResolvedValue(false)
})

afterEach(() => vi.clearAllMocks())

async function status() {
  return (await screen.findByText(/^(On|Off|Blocked|Not set up|Not available)$/)).textContent
}

test.each([
  ['On', () => mocked.pushEnabled.mockResolvedValue(true)],
  ['Off', () => mocked.pushEnabled.mockResolvedValue(false)],
  ['Blocked', () => mocked.notificationPermission.mockReturnValue('denied')],
  ['Not set up', () => mocked.isStandalone.mockReturnValue(false)],
  ['Not available', () => mocked.notificationPermission.mockReturnValue('unsupported')],
])('shows %s for this phone', async (label, arrange) => {
  arrange()
  render(<PushSettingsCard />)
  expect(await status()).toBe(label)
})

test('blocked says where to allow them, with no switch', async () => {
  mocked.notificationPermission.mockReturnValue('denied')
  render(<PushSettingsCard />)
  expect(await screen.findByText(/blocked in iPhone Settings/)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('outside the Home Screen app, says to add Kindred there first', async () => {
  mocked.isStandalone.mockReturnValue(false)
  render(<PushSettingsCard />)
  expect(await screen.findByText(/Add Kindred to your Home Screen first/)).toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})

test('turns notifications on', async () => {
  mocked.enablePush.mockResolvedValue('enabled')
  render(<PushSettingsCard />)
  fireEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
  expect(await screen.findByRole('button', { name: 'Turn off notifications' })).toBeInTheDocument()
  expect(await status()).toBe('On')
  expect(mocked.enablePush).toHaveBeenCalledOnce()
  expect(isPushTurnedOff()).toBe(false)
})

test('says Blocked if the member says no to the phone', async () => {
  mocked.enablePush.mockResolvedValue('denied')
  render(<PushSettingsCard />)
  fireEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
  expect(await screen.findByText('Blocked')).toBeInTheDocument()
})

test('turns notifications off, and keeps them off', async () => {
  mocked.pushEnabled.mockResolvedValue(true)
  mocked.disablePush.mockResolvedValue()
  render(<PushSettingsCard />)
  fireEvent.click(await screen.findByRole('button', { name: 'Turn off notifications' }))
  expect(await screen.findByRole('button', { name: 'Turn on notifications' })).toBeInTheDocument()
  expect(mocked.disablePush).toHaveBeenCalledOnce()
  // So the sign-in resync doesn't turn them back on (lib/push-resync.ts).
  expect(isPushTurnedOff()).toBe(true)
})

test('says so if turning them on fails', async () => {
  mocked.enablePush.mockRejectedValue(new Error('offline'))
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(<PushSettingsCard />)
  fireEvent.click(await screen.findByRole('button', { name: 'Turn on notifications' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
})

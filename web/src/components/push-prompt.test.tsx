import { fireEvent, render, screen } from '@testing-library/react'
import '@/i18n'
import { platform } from '@/platform'
import { PushPrompt } from './push-prompt'

vi.mock('@/platform', () => ({
  platform: {
    isStandalone: vi.fn(),
    notificationPermission: vi.fn(),
    deviceSetting: { get: vi.fn(), set: vi.fn() },
    enablePush: vi.fn(),
  },
}))

const mocked = vi.mocked(platform)

beforeEach(() => {
  mocked.isStandalone.mockReturnValue(true)
  mocked.notificationPermission.mockReturnValue('default')
  mocked.deviceSetting.get.mockReturnValue(null)
  mocked.enablePush.mockResolvedValue('enabled')
})

afterEach(() => vi.clearAllMocks())

test('shows in the Home Screen app before the phone has asked', () => {
  render(<PushPrompt />)
  expect(screen.getByRole('heading', { name: 'Turn on notifications?' })).toBeInTheDocument()
})

// Runs first: the re-save happens once per app launch.
test('re-saves the subscription once permission is granted', () => {
  mocked.notificationPermission.mockReturnValue('granted')
  render(<PushPrompt />)
  expect(mocked.enablePush).toHaveBeenCalledOnce()
  render(<PushPrompt />)
  expect(mocked.enablePush).toHaveBeenCalledOnce()
})

test.each([
  ['in a browser tab', () => mocked.isStandalone.mockReturnValue(false)],
  ['once the phone has asked', () => mocked.notificationPermission.mockReturnValue('granted')],
  ['after Not now', () => mocked.deviceSetting.get.mockReturnValue('1')],
])('stays hidden %s', (_, arrange) => {
  arrange()
  render(<PushPrompt />)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('Not now hides it and remembers', () => {
  render(<PushPrompt />)
  fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
  expect(mocked.deviceSetting.set).toHaveBeenCalledWith('pushPromptDismissed', '1')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('Turn on notifications enables push and closes', async () => {
  render(<PushPrompt />)
  fireEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }))
  await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(mocked.enablePush).toHaveBeenCalled()
})

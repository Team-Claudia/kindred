import { renderHook } from '@testing-library/react'
import { platform } from '@/platform'
import {
  forgetPushResync,
  resyncSubscription,
  setPushTurnedOff,
  useKeepPushSubscription,
} from './push-resync'

const settings = new Map<string, string>()

vi.mock('@/platform', () => ({
  platform: {
    isStandalone: vi.fn(),
    notificationPermission: vi.fn(),
    enablePush: vi.fn(),
    onAppVisible: vi.fn(),
    deviceSetting: {
      get: (key: string) => settings.get(key) ?? null,
      set: (key: string, value: string) => settings.set(key, value),
    },
  },
}))

const mocked = vi.mocked(platform)
let onVisible: (() => void) | undefined
const stopWatching = vi.fn()

beforeEach(() => {
  settings.clear()
  forgetPushResync()
  mocked.isStandalone.mockReturnValue(true)
  mocked.notificationPermission.mockReturnValue('granted')
  mocked.enablePush.mockResolvedValue('enabled')
  mocked.onAppVisible.mockImplementation((callback) => {
    onVisible = callback
    return stopWatching
  })
})

afterEach(() => vi.clearAllMocks())

test('saves the subscription once per signed-in member', () => {
  resyncSubscription('maya')
  resyncSubscription('maya')
  expect(mocked.enablePush).toHaveBeenCalledOnce()
  resyncSubscription('jonah')
  expect(mocked.enablePush).toHaveBeenCalledTimes(2)
})

test('saves it again after a sign-out, even for the same member', () => {
  resyncSubscription('maya')
  forgetPushResync()
  resyncSubscription('maya')
  expect(mocked.enablePush).toHaveBeenCalledTimes(2)
})

test.each([
  ['in a browser tab', () => mocked.isStandalone.mockReturnValue(false)],
  ['before notifications are allowed', () => mocked.notificationPermission.mockReturnValue('default')],
  ['once the member turned them off for this phone', () => setPushTurnedOff(true)],
])('does nothing %s', (_, arrange) => {
  arrange()
  resyncSubscription('maya')
  expect(mocked.enablePush).not.toHaveBeenCalled()
})

test('a sign-out forgets that the last member turned them off', () => {
  setPushTurnedOff(true)
  forgetPushResync()
  resyncSubscription('jonah')
  expect(mocked.enablePush).toHaveBeenCalledOnce()
})

test('saves it on sign-in and again each time Kindred comes back on screen', () => {
  const { unmount } = renderHook(() => useKeepPushSubscription('maya'))
  expect(mocked.enablePush).toHaveBeenCalledOnce()
  onVisible?.()
  onVisible?.()
  expect(mocked.enablePush).toHaveBeenCalledTimes(3)
  unmount()
  expect(stopWatching).toHaveBeenCalledOnce()
})

test('does nothing while signed out', () => {
  renderHook(() => useKeepPushSubscription(undefined))
  expect(mocked.enablePush).not.toHaveBeenCalled()
  expect(mocked.onAppVisible).not.toHaveBeenCalled()
})

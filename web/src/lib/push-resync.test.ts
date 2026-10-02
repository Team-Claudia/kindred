import { renderHook } from '@testing-library/react'
import { platform } from '@/platform'
import { forgetPushResync, resyncSubscription, useKeepPushSubscription } from './push-resync'

vi.mock('@/platform', () => ({
  platform: {
    isStandalone: vi.fn(),
    notificationPermission: vi.fn(),
    enablePush: vi.fn(),
    onAppVisible: vi.fn(),
  },
}))

const mocked = vi.mocked(platform)
let onVisible: (() => void) | undefined
const stopWatching = vi.fn()

beforeEach(() => {
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
])('does nothing %s', (_, arrange) => {
  arrange()
  resyncSubscription('maya')
  expect(mocked.enablePush).not.toHaveBeenCalled()
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

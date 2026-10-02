import { deletePushSubscription, savePushSubscription } from '@/lib/api'
import { base64UrlToBytes } from './push'
import { disablePush, enablePush, notificationPermission } from '.'

vi.mock('@/lib/api', () => ({ savePushSubscription: vi.fn(), deletePushSubscription: vi.fn() }))

const save = vi.mocked(savePushSubscription)
const subscription = {
  toJSON: () => ({ endpoint: 'https://push.example.test/sub', keys: { p256dh: 'p', auth: 'a' } }),
}
const pushManager = { getSubscription: vi.fn(), subscribe: vi.fn() }
const requestPermission = vi.fn<() => Promise<NotificationPermission>>()

function setStandalone(standalone: boolean) {
  vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: standalone } as MediaQueryList)
}

function setPushSupport() {
  vi.stubGlobal('PushManager', class {})
  vi.stubGlobal('Notification', { permission: 'default', requestPermission })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  })
}

beforeEach(() => {
  vi.stubEnv('VITE_VAPID_PUBLIC_KEY', 'AQID')
  pushManager.getSubscription.mockResolvedValue(null)
  pushManager.subscribe.mockResolvedValue(subscription)
  requestPermission.mockResolvedValue('granted')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  Reflect.deleteProperty(navigator, 'serviceWorker')
})

test('asks to add Kindred to the Home Screen when it runs in a browser tab', async () => {
  setStandalone(false)
  setPushSupport()
  await expect(enablePush()).resolves.toBe('needs_install')
  expect(requestPermission).not.toHaveBeenCalled()
})

test('is unsupported without PushManager', async () => {
  setStandalone(true)
  await expect(enablePush()).resolves.toBe('unsupported')
  expect(notificationPermission()).toBe('unsupported')
})

test('is denied when the member says no', async () => {
  setStandalone(true)
  setPushSupport()
  requestPermission.mockResolvedValue('denied')
  await expect(enablePush()).resolves.toBe('denied')
  expect(pushManager.subscribe).not.toHaveBeenCalled()
  expect(save).not.toHaveBeenCalled()
})

test('subscribes with the VAPID key and saves the subscription', async () => {
  setStandalone(true)
  setPushSupport()
  await expect(enablePush()).resolves.toBe('enabled')
  expect(pushManager.subscribe).toHaveBeenCalledWith({
    userVisibleOnly: true,
    applicationServerKey: new Uint8Array([1, 2, 3]),
  })
  expect(save).toHaveBeenCalledWith('https://push.example.test/sub', { p256dh: 'p', auth: 'a' })
})

test('reuses an existing subscription', async () => {
  setStandalone(true)
  setPushSupport()
  pushManager.getSubscription.mockResolvedValue(subscription)
  await expect(enablePush()).resolves.toBe('enabled')
  expect(pushManager.subscribe).not.toHaveBeenCalled()
  expect(save).toHaveBeenCalledOnce()
})

test('decodes base64url keys', () => {
  expect(Array.from(base64UrlToBytes('-_8'))).toEqual([251, 255])
})

describe('disablePush', () => {
  test('removes this device from the server, then unsubscribes it', async () => {
    setPushSupport()
    const unsubscribe = vi.fn().mockResolvedValue(true)
    pushManager.getSubscription.mockResolvedValue({ endpoint: 'https://push.example.test/sub', unsubscribe })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: () => Promise.resolve({ pushManager }) },
    })
    await disablePush()
    expect(deletePushSubscription).toHaveBeenCalledWith('https://push.example.test/sub')
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  test('still unsubscribes the phone when the server call fails', async () => {
    setPushSupport()
    const unsubscribe = vi.fn().mockResolvedValue(true)
    pushManager.getSubscription.mockResolvedValue({ endpoint: 'https://push.example.test/sub', unsubscribe })
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: () => Promise.resolve({ pushManager }) },
    })
    vi.mocked(deletePushSubscription).mockRejectedValueOnce(new Error('offline'))
    await expect(disablePush()).rejects.toThrow('offline')
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  test('does nothing when this device has no subscription', async () => {
    setPushSupport()
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration: () => Promise.resolve({ pushManager }) },
    })
    await disablePush()
    expect(deletePushSubscription).not.toHaveBeenCalled()
  })
})

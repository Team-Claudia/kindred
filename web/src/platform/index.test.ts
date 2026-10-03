import { appUrl, copyText, deviceSetting, onAppVisible, onPageRestored, share, whatsAppUrl } from './index'

const content = { text: 'Physio ride on Friday', url: 'https://kindred.example/i/123' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function stubNavigator(extra: Partial<Navigator>) {
  vi.stubGlobal('navigator', { ...navigator, ...extra })
}

describe('share', () => {
  test('is unsupported without the Web Share API', async () => {
    stubNavigator({ share: undefined })
    expect(await share(content)).toBe('unsupported')
  })

  test('opens the share sheet when it can', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ share: shareSpy })
    expect(await share(content)).toBe('shared')
    expect(shareSpy).toHaveBeenCalledWith(content)
  })

  test('is cancelled when the member closes the sheet', async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException('', 'AbortError')) })
    expect(await share(content)).toBe('cancelled')
  })

  test('falls back when the sheet fails to open', async () => {
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')) })
    expect(await share(content)).toBe('unsupported')
  })
})

describe('copyText', () => {
  test('copies to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ clipboard: { writeText } as unknown as Clipboard })
    expect(await copyText('hello')).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  test('reports failure when the clipboard refuses', async () => {
    stubNavigator({
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard,
    })
    expect(await copyText('hello')).toBe(false)
  })

  test('reports failure without a clipboard', async () => {
    stubNavigator({ clipboard: undefined })
    expect(await copyText('hello')).toBe(false)
  })
})

test('whatsAppUrl fills in the text and link', () => {
  const url = new URL(whatsAppUrl(content))
  expect(url.origin).toBe('https://wa.me')
  expect(url.searchParams.get('text')).toBe(`${content.text} ${content.url}`)
})

test('appUrl makes a full link from a path', () => {
  expect(appUrl('/i/123')).toBe(`${window.location.origin}/i/123`)
})

describe('deviceSetting', () => {
  test('stores and reads a value', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
    deviceSetting.set('test-key', 'yes')
    expect(deviceSetting.get('test-key')).toBe('yes')
  })

  test('copes with blocked storage', () => {
    const blocked = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(() => deviceSetting.set('test-key', 'yes')).not.toThrow()
    expect(deviceSetting.get('test-key')).toBeNull()
  })
})

describe('onAppVisible', () => {
  function setVisibility(state: DocumentVisibilityState) {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  }

  test('calls back when the app comes back on screen, until stopped', () => {
    const callback = vi.fn()
    const stop = onAppVisible(callback)
    setVisibility('hidden')
    expect(callback).not.toHaveBeenCalled()
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)
    stop()
    setVisibility('hidden')
    setVisibility('visible')
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

describe('onPageRestored', () => {
  function pageshow(persisted: boolean) {
    window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted }))
  }

  test('calls back only when the page comes back from the back/forward cache, until stopped', () => {
    const callback = vi.fn()
    const stop = onPageRestored(callback)
    pageshow(false)
    expect(callback).not.toHaveBeenCalled()
    pageshow(true)
    expect(callback).toHaveBeenCalledTimes(1)
    stop()
    pageshow(true)
    expect(callback).toHaveBeenCalledTimes(1)
  })
})

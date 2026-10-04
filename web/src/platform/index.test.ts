import {
  appUrl,
  copyText,
  deviceSetting,
  isIOS,
  mapsUrl,
  onAppVisible,
  onPageRestored,
  openMaps,
  saveFile,
  share,
  whatsAppUrl,
} from './index'

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

describe('saveFile', () => {
  const file = { name: 'kindred-data.json', type: 'application/json', text: '{"a":1}' }

  function stubDownload() {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    // jsdom has no object URLs.
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:file'), revokeObjectURL: vi.fn() })
    return click
  }

  test('hands the file to the share sheet when it can take files', async () => {
    const shareSpy = vi.fn().mockResolvedValue(undefined)
    stubNavigator({ canShare: () => true, share: shareSpy })
    expect(await saveFile(file)).toBe('saved')
    const shared = shareSpy.mock.calls[0][0] as ShareData
    expect(shared.files?.[0].name).toBe('kindred-data.json')
    expect(await shared.files?.[0].text()).toBe('{"a":1}')
  })

  test('is cancelled when the member closes the sheet', async () => {
    stubNavigator({ canShare: () => true, share: vi.fn().mockRejectedValue(new DOMException('', 'AbortError')) })
    expect(await saveFile(file)).toBe('cancelled')
  })

  test('asks for another tap when the sheet needs one', async () => {
    stubNavigator({
      canShare: () => true,
      share: vi.fn().mockRejectedValue(new DOMException('', 'NotAllowedError')),
    })
    expect(await saveFile(file)).toBe('needs_tap')
  })

  test('downloads the file when the share sheet can\'t take files', async () => {
    stubNavigator({ canShare: () => false })
    const click = stubDownload()
    expect(await saveFile(file)).toBe('saved')
    expect(click).toHaveBeenCalledOnce()
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('kindred-data.json')
  })

  test('downloads the file without the Web Share API', async () => {
    stubNavigator({ canShare: undefined, share: undefined })
    const click = stubDownload()
    expect(await saveFile(file)).toBe('saved')
    expect(click).toHaveBeenCalledOnce()
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

describe('isIOS', () => {
  test.each([
    ['an iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 5, true],
    ['an iPad, which says it is a Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5, true],
    ['a Mac', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0, false],
    ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)', 5, false],
  ])('is right for %s', (_label, userAgent, maxTouchPoints, expected) => {
    stubNavigator({ userAgent, maxTouchPoints })
    expect(isIOS()).toBe(expected)
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

describe('maps', () => {
  const place = { lat: 43.6588, lng: -79.3887 }

  test('directions go to Apple Maps on iOS and Google Maps elsewhere, with the coordinates only', () => {
    expect(mapsUrl(place, true)).toBe('https://maps.apple.com/?daddr=43.6588%2C-79.3887')
    expect(mapsUrl(place, false)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=43.6588%2C-79.3887',
    )
  })

  test('openMaps opens Apple Maps on an iPhone', () => {
    stubNavigator({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', maxTouchPoints: 5 })
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    openMaps(place)
    expect(open).toHaveBeenCalledWith(
      'https://maps.apple.com/?daddr=43.6588%2C-79.3887',
      '_blank',
      'noopener,noreferrer',
    )
  })
})

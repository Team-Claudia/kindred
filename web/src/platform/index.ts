// Browser-specific features live behind this adapter, so they can be swapped
// for Capacitor plugins later (ADR-002). Screens import from here, never call
// browser APIs directly.

import {
  notificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  type NotificationPermissionState,
  type PushResult,
} from './push'

export type { NotificationPermissionState, PushResult }
export { notificationPermission }

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'

export interface Platform {
  /**
   * Opens the share sheet. Resolves 'cancelled' if the member closes it and
   * 'unsupported' if there's no share sheet or it failed to open; then offer
   * Copy link and WhatsApp instead (components/share-button.tsx).
   */
  share(content: ShareContent): Promise<ShareResult>
  /** Whether the share sheet is available; if not, offer Copy link instead. */
  canShare(): boolean
  /** Copies text to the clipboard. Resolves false if the browser refused. */
  copyText(text: string): Promise<boolean>
  /** A wa.me link that opens WhatsApp with the text and link filled in. */
  whatsAppUrl(content: ShareContent): string
  /** The full URL of an app path, for sharing (e.g. '/i/123'). */
  appUrl(path: string): string
  /** Whether Kindred is running from the Home Screen rather than a browser tab. */
  isStandalone(): boolean
  /** Asks for notification permission and saves the push subscription (task 1.4). */
  enablePush(): Promise<PushResult>
  /** Stops push to this device for the signed-in member (before signing out). */
  disablePush(): Promise<void>
  /** The notification permission so far: 'default' until the member is asked. */
  notificationPermission(): NotificationPermissionState
  /** Hands the calendar feed URL to the phone's calendar app to subscribe. */
  addCalendarFeed(url: string): void
  /**
   * Small per-device settings (e.g. "remind me later"). Not for anything that
   * must persist: storage can be missing or blocked, so reads return null and
   * writes are dropped then.
   */
  deviceSetting: { get(key: string): string | null; set(key: string, value: string): void }
  /**
   * Calls `callback` each time Kindred comes back on screen (iPhone suspends
   * background tabs and Home Screen apps). Returns a function that stops it.
   */
  onAppVisible(callback: () => void): () => void
}

export interface ShareContent {
  text: string
  url: string
}

export function canShare(): boolean {
  return typeof navigator.share === 'function'
}

export async function share(content: ShareContent): Promise<ShareResult> {
  if (!canShare()) return 'unsupported'
  try {
    await navigator.share(content)
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    // e.g. NotAllowedError when the sheet is blocked: fall back to Copy link.
    return 'unsupported'
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard) return false
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function whatsAppUrl({ text, url }: ShareContent): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
}

export function appUrl(path: string): string {
  return new URL(path, window.location.origin).href
}

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export async function enablePush(): Promise<PushResult> {
  // iPhone only offers push to apps added to the Home Screen.
  if (!isStandalone()) return 'needs_install'
  return subscribeToPush()
}

export const disablePush: Platform['disablePush'] = unsubscribeFromPush

export function addCalendarFeed(url: string): void {
  // webcal:// makes iOS offer to subscribe rather than download the file once.
  window.location.href = url.replace(/^https?:/, 'webcal:')
}

export const deviceSetting: Platform['deviceSetting'] = {
  get(key) {
    try {
      return window.localStorage.getItem(`kindred:${key}`)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(`kindred:${key}`, value)
    } catch {
      // Private mode or blocked storage: it's only a convenience, so skip it.
    }
  },
}

export function onAppVisible(callback: () => void): () => void {
  const listener = () => {
    if (document.visibilityState === 'visible') callback()
  }
  document.addEventListener('visibilitychange', listener)
  return () => document.removeEventListener('visibilitychange', listener)
}

export const platform: Platform = {
  share,
  canShare,
  copyText,
  whatsAppUrl,
  appUrl,
  isStandalone,
  enablePush,
  disablePush,
  notificationPermission,
  addCalendarFeed,
  deviceSetting,
  onAppVisible,
}

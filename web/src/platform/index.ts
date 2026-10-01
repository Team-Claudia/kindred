// Browser-specific features live behind this adapter, so they can be swapped
// for Capacitor plugins later (ADR-002). Screens import from here, never call
// browser APIs directly.

export type ShareResult = 'shared' | 'cancelled' | 'unsupported'
export type PushResult = 'enabled' | 'denied' | 'needs_install' | 'unsupported'

export interface Platform {
  /** Opens the share sheet. Resolves 'cancelled' if the member closes it. */
  share(content: { text: string; url: string }): Promise<ShareResult>
  /** Whether the share sheet is available; if not, offer Copy link instead. */
  canShare(): boolean
  /** Whether Kindred is running from the Home Screen rather than a browser tab. */
  isStandalone(): boolean
  /** Asks for notification permission and saves the push subscription (task 1.4). */
  enablePush(): Promise<PushResult>
  /** Hands the calendar feed URL to the phone's calendar app to subscribe. */
  addCalendarFeed(url: string): void
}

export function canShare(): boolean {
  return typeof navigator.share === 'function'
}

export async function share(content: { text: string; url: string }): Promise<ShareResult> {
  if (!canShare()) return 'unsupported'
  try {
    await navigator.share(content)
    return 'shared'
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
    throw error
  }
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export async function enablePush(): Promise<PushResult> {
  // Filled in by task 1.4 (push spike).
  throw new Error('enablePush is not implemented yet')
}

export function addCalendarFeed(url: string): void {
  // webcal:// makes iOS offer to subscribe rather than download the file once.
  window.location.href = url.replace(/^https?:/, 'webcal:')
}

export const platform: Platform = { share, canShare, isStandalone, enablePush, addCalendarFeed }

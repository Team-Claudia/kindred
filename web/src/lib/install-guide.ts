import { useState } from 'react'
import { platform } from '@/platform'

const DISMISSED_KEY = 'install-guide-dismissed-at'
/** "Remind me later" (or "Sign in here instead") hides the guide for this long. */
export const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000

function recentlyDismissed(dismissedAt: string | null, now: number): boolean {
  const dismissed = Number(dismissedAt)
  return Boolean(dismissedAt) && Number.isFinite(dismissed) && now - dismissed < REMIND_AFTER_MS
}

export function shouldShowInstallGuide(
  standalone: boolean,
  dismissedAt: string | null,
  now: number,
): boolean {
  if (standalone) return false
  return !recentlyDismissed(dismissedAt, now)
}

/**
 * Whether to ask someone to add Kindred to the Home Screen before they sign
 * in (task 4.10). Only on an iPhone or iPad in Safari: the Home Screen app
 * keeps its own sign-in, separate from Safari's, so signing in here first
 * means signing in twice. Never in the Home Screen app or on a computer.
 */
export function shouldInstallFirst(
  ios: boolean,
  standalone: boolean,
  dismissedAt: string | null,
  now: number,
): boolean {
  return ios && !standalone && !recentlyDismissed(dismissedAt, now)
}

function useGuide(decide: (dismissedAt: string | null) => boolean) {
  const [show, setShow] = useState(() => decide(platform.deviceSetting.get(DISMISSED_KEY)))

  const dismiss = () => {
    platform.deviceSetting.set(DISMISSED_KEY, String(Date.now()))
    setShow(false)
  }

  return { show, dismiss }
}

/** Whether to show the Add to Home Screen guide on Home, and a way to put it off. */
export function useInstallGuide() {
  return useGuide((dismissedAt) =>
    shouldShowInstallGuide(platform.isStandalone(), dismissedAt, Date.now()),
  )
}

/**
 * Whether to show the guide before sign-in and join, and "Sign in here
 * instead". Putting it off also puts off the guide on Home, so someone who
 * chose Safari isn't asked again straight after signing in.
 */
export function useInstallFirst() {
  return useGuide((dismissedAt) =>
    shouldInstallFirst(platform.isIOS(), platform.isStandalone(), dismissedAt, Date.now()),
  )
}

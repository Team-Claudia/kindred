import { useState } from 'react'
import { platform } from '@/platform'

const DISMISSED_KEY = 'install-guide-dismissed-at'
/** "Remind me later" hides the guide for this long. */
export const REMIND_AFTER_MS = 3 * 24 * 60 * 60 * 1000

export function shouldShowInstallGuide(
  standalone: boolean,
  dismissedAt: string | null,
  now: number,
): boolean {
  if (standalone) return false
  const dismissed = Number(dismissedAt)
  return !dismissedAt || !Number.isFinite(dismissed) || now - dismissed >= REMIND_AFTER_MS
}

/** Whether to show the Add to Home Screen guide, and a way to put it off. */
export function useInstallGuide() {
  const [show, setShow] = useState(() =>
    shouldShowInstallGuide(
      platform.isStandalone(),
      platform.deviceSetting.get(DISMISSED_KEY),
      Date.now(),
    ),
  )

  const remindLater = () => {
    platform.deviceSetting.set(DISMISSED_KEY, String(Date.now()))
    setShow(false)
  }

  return { show, remindLater }
}

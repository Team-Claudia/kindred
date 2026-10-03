import { platform } from '@/platform'

// Whether notifications are on for the phone Kindred is running on, and if
// not, why (Care Circle and settings, task 4.3).
export type PushStatus = 'on' | 'off' | 'blocked' | 'needs_install' | 'unsupported'

export async function readPushStatus(): Promise<PushStatus> {
  // iPhone only offers push to Home Screen apps (platform.enablePush).
  if (!platform.isStandalone()) return 'needs_install'
  const permission = platform.notificationPermission()
  if (permission === 'unsupported') return 'unsupported'
  if (permission === 'denied') return 'blocked'
  return (await platform.pushEnabled()) ? 'on' : 'off'
}

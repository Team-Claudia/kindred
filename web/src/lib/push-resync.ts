import { useEffect } from 'react'
import { platform } from '@/platform'

// Keeps this phone's push subscription saved for whoever is signed in
// (ADR-010), so nobody has to close and reopen the app to get notifications.

let resyncedFor: string | undefined

// Set when the member turns notifications off for this phone in Care Circle
// and settings (task 4.3), so the resync below doesn't quietly turn them on again.
const TURNED_OFF_KEY = 'pushTurnedOff'

export function setPushTurnedOff(off: boolean) {
  platform.deviceSetting.set(TURNED_OFF_KEY, off ? '1' : '0')
}

export function isPushTurnedOff(): boolean {
  return platform.deviceSetting.get(TURNED_OFF_KEY) === '1'
}

/**
 * Called on sign-out, which removes this phone's subscription, so the next
 * sign-in (even by the same member) saves it again.
 */
export function forgetPushResync() {
  resyncedFor = undefined
}

/**
 * Re-saves this phone's subscription for `userId`, once per member unless
 * `always` is set. It recovers from a save that failed after the member said
 * yes, from a subscription the phone quietly replaced or the push service
 * expired, and from a sign-out (which removes it).
 */
export function resyncSubscription(userId: string | undefined, always = false) {
  if (!userId || (!always && resyncedFor === userId)) return
  if (!platform.isStandalone() || platform.notificationPermission() !== 'granted') return
  if (isPushTurnedOff()) return
  resyncedFor = userId
  platform.enablePush().catch((error: unknown) => console.error(error))
}

/**
 * For the whole signed-in app: saves the subscription when someone signs in,
 * and again each time Kindred comes back on screen, so a stale one repairs
 * itself without closing the app.
 */
export function useKeepPushSubscription(userId: string | undefined) {
  useEffect(() => {
    resyncSubscription(userId)
    if (!userId) return
    return platform.onAppVisible(() => resyncSubscription(userId, true))
  }, [userId])
}

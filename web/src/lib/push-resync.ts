import { platform } from '@/platform'

// Keeps this phone's push subscription saved for whoever is signed in
// (ADR-010). Used by the push prompt on Home and by sign-out.

let resyncedFor: string | undefined

/**
 * Called on sign-out, which removes this phone's subscription, so the next
 * sign-in (even by the same member) saves it again.
 */
export function forgetPushResync() {
  resyncedFor = undefined
}

// Once permission is granted, re-save this phone's subscription once per app
// launch and signed-in member. That recovers from a save that failed after the
// member said yes, picks up a subscription the phone has quietly replaced, and
// subscribes again for whoever signs in after a sign-out (which removes it).
export function resyncSubscription(userId: string | undefined) {
  if (!userId || resyncedFor === userId) return
  if (!platform.isStandalone() || platform.notificationPermission() !== 'granted') return
  resyncedFor = userId
  platform.enablePush().catch((error: unknown) => console.error(error))
}

// Web push (task 1.4, ADR-010). On iPhone, push only works once Kindred is on
// the Home Screen (iOS 16.4+), so enablePush asks for that first.

import { deletePushSubscription, savePushSubscription } from '@/lib/api'

export type PushResult = 'enabled' | 'denied' | 'needs_install' | 'unsupported'
export type NotificationPermissionState = NotificationPermission | 'unsupported'

function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

// The VAPID public key is base64url; PushManager wants the raw bytes.
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + '='.repeat((4 - (value.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** Whether the phone has been asked for notification permission, and its answer. */
export function notificationPermission(): NotificationPermissionState {
  return pushSupported() ? Notification.permission : 'unsupported'
}

/** Whether this device has a push subscription, i.e. notifications are on here. */
export async function hasPushSubscription(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false
  const registration = await navigator.serviceWorker.getRegistration()
  return Boolean(await registration?.pushManager.getSubscription())
}

/**
 * Asks for notification permission, subscribes this device to push and saves
 * the subscription. platform.enablePush checks for the Home Screen first.
 */
export async function subscribeToPush(): Promise<Exclude<PushResult, 'needs_install'>> {
  if (!pushSupported()) return 'unsupported'

  const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!publicKey) throw new Error('VITE_VAPID_PUBLIC_KEY is not set')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'

  const registration = await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    }))

  const { endpoint, keys } = subscription.toJSON()
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('Push subscription is incomplete')
  await savePushSubscription(endpoint, { p256dh: keys.p256dh, auth: keys.auth })
  return 'enabled'
}

/**
 * Stops push to this device for the signed-in member, before signing out, so
 * the next person to use the phone doesn't get their notifications. Best
 * effort: the server copy is removed first, then the phone's own, which
 * happens even if the server call fails.
 */
export async function unsubscribeFromPush(): Promise<void> {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration()
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  try {
    await deletePushSubscription(subscription.endpoint)
  } finally {
    // Even if the server call fails (e.g. offline), this kills the endpoint,
    // so the push service stops delivering to it.
    await subscription.unsubscribe()
  }
}

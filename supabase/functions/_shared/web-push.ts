// Web Push with VAPID (ADR-010), shared by push-test and outbox-worker.
//
// Secrets: VAPID_PRIVATE_KEY and VAPID_SUBJECT (exactly "mailto:" + address, no
// spaces; Apple rejects a malformed subject with 403 BadJwtToken).
// VAPID_PUBLIC_KEY is optional: when unset it is derived from the private key.

import { Buffer } from 'node:buffer'
import { createECDH } from 'node:crypto'
// @deno-types="npm:@types/web-push@3.6.4"
import webpush from 'npm:web-push@3.6.7'

export type Subscription = { id: number; endpoint: string; keys: { p256dh: string; auth: string } }

// What the service worker (web/public/push-sw.js) reads. Never care details:
// generic text and the in-app path to open.
export type PushPayload = { title?: string; body?: string; url: string }

function vapidPublicKey(privateKey: string): string {
  const configured = Deno.env.get('VAPID_PUBLIC_KEY')
  if (configured) return configured
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(Buffer.from(privateKey, 'base64url'))
  return ecdh.getPublicKey().toString('base64url')
}

// Sets the VAPID details from the function secrets. Returns false (and logs)
// when they are missing, so the caller can report it.
export function configureVapid(): boolean {
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!privateKey || !subject) {
    console.error('VAPID_PRIVATE_KEY and VAPID_SUBJECT must be set')
    return false
  }
  webpush.setVapidDetails(subject, vapidPublicKey(privateKey), privateKey)
  return true
}

// Sends one push. Resolves 'gone' when the push service says the subscription
// no longer exists (404 or 410), so the caller can delete it.
export async function sendPush(
  subscription: Subscription,
  payload: PushPayload,
): Promise<'sent' | 'gone'> {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: subscription.keys },
      JSON.stringify(payload),
      // The timeout keeps a stalled push service well inside outbox-worker's
      // 2-minute claim on the job.
      { TTL: 60 * 60, urgency: 'high', timeout: 10_000 },
    )
    return 'sent'
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode
    if (status === 404 || status === 410) return 'gone'
    throw error
  }
}

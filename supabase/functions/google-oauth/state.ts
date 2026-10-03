// The OAuth `state` for google-oauth (task 4.5a): which member started
// connecting, until when, signed with HMAC-SHA256 so it can't be forged or
// changed. The finish step also checks the member finishing is the signed-in
// caller, so a link someone else started can't connect their Google account
// to your Kindred account, or yours to theirs.

const encoder = new TextEncoder()

/** How long a member has to get through Google's screens. */
export const STATE_TTL_MS = 10 * 60 * 1000

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (c) => c.charCodeAt(0))
  } catch {
    return null
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ])
}

/** A signed state for `userId`, valid for STATE_TTL_MS from `now`. */
export async function signState(userId: string, secret: string, now = Date.now()): Promise<string> {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(12)))
  const payload = base64url(encoder.encode(JSON.stringify({ u: userId, e: now + STATE_TTL_MS, n: nonce })))
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(payload)))
  return `${payload}.${base64url(signature)}`
}

/** The member a state was signed for, or null if it's forged, changed or expired. */
export async function verifyState(state: string, secret: string, now = Date.now()): Promise<string | null> {
  const [payload, signature, extra] = state.split('.')
  if (!payload || !signature || extra !== undefined) return null
  const signatureBytes = fromBase64url(signature)
  if (!signatureBytes) return null
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), signatureBytes, encoder.encode(payload))
  if (!valid) return null

  const payloadBytes = fromBase64url(payload)
  if (!payloadBytes) return null
  try {
    const { u, e } = JSON.parse(new TextDecoder().decode(payloadBytes))
    if (typeof u !== 'string' || typeof e !== 'number' || e < now) return null
    return u
  } catch {
    return null
  }
}

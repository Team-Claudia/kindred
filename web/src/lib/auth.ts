import type { AuthError, Session, User } from '@supabase/supabase-js'
import { useQuery } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import { supabase } from './supabase'

// Sign-in (ADR-004): Google, a 6-digit email code, or Try the demo (an
// anonymous guest). Screens use these helpers rather than calling
// supabase.auth themselves.

export type AuthState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }

let state: AuthState = { status: 'loading' }
const listeners = new Set<() => void>()
let listening = false

function subscribe(listener: () => void) {
  if (!listening) {
    listening = true
    // Fires INITIAL_SESSION once the client has read any stored session or a
    // Google redirect in the URL, then again on every sign-in and sign-out.
    supabase.auth.onAuthStateChange((_event, session) => {
      state = session ? { status: 'signed_in', session } : { status: 'signed_out' }
      listeners.forEach((notify) => notify())
    })
  }
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current sign-in state; re-renders when it changes. */
export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => state)
}

/** Whether the signed-in person is a Try the demo guest (an anonymous sign-in). */
export function isAnonymous(auth: AuthState): boolean {
  return auth.status === 'signed_in' && auth.session.user.is_anonymous === true
}

/**
 * Where to go after signing in. Only same-site paths are allowed, so a crafted
 * link can't send someone elsewhere.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/'
  if (next === '/sign-in' || next.startsWith('/sign-in?')) return '/'
  return next
}

/** The sign-in path that returns to `destination` afterwards. */
export function signInPath(destination: string): string {
  const next = safeNext(destination)
  return next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`
}

/** Leaves for Google. Google returns to `next` on this site, signed in. */
export async function signInWithGoogle(next: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${safeNext(next)}` },
  })
  if (error) throw error
}

/** Emails a 6-digit code. New and returning people take the same step. */
export async function sendEmailCode(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw error
}

/** Checks the 6-digit code; on success the auth state becomes signed_in. */
export async function verifyEmailCode(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw error
}

/**
 * Try the demo: signs in as an anonymous guest, with no email or Google
 * account. The sign-in guard then adds them to the sample circle.
 */
export async function signInAsGuest(): Promise<void> {
  const { error } = await supabase.auth.signInAnonymously()
  if (error) throw error
}

/**
 * Signs out. 'local' only forgets the session on this phone, without asking
 * the server, for when the account has just been deleted.
 */
export async function signOut(scope: 'global' | 'local' = 'global'): Promise<void> {
  const { error } = await supabase.auth.signOut({ scope })
  if (error) throw error
}

/** The name from the Google profile, if the person signed in with Google. */
export function googleName(user: User): string | undefined {
  const metadata = user.user_metadata as { full_name?: unknown; name?: unknown }
  const name = [metadata.full_name, metadata.name].find(
    (value): value is string => typeof value === 'string' && value.trim() !== '',
  )
  return name?.trim()
}

export type AuthErrorKind = 'rate_limited' | 'code_invalid' | 'unknown'

/** Groups Supabase Auth errors into the few messages the sign-in screens show. */
export function authErrorKind(error: unknown): AuthErrorKind {
  const { code, status } = (error ?? {}) as Partial<AuthError>
  if (status === 429 || code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit') {
    return 'rate_limited'
  }
  if (code === 'otp_expired' || status === 403) return 'code_invalid'
  return 'unknown'
}

// "Is the signed-in person in a circle?" Invalidate myCircleKey after
// creating, joining or leaving a circle.
export const myCircleKey = ['my-circle'] as const

/** The signed-in person's circle ID, or null if they aren't in one. */
export function useMyCircleId(userId: string | undefined) {
  return useQuery({
    queryKey: [...myCircleKey, userId],
    enabled: userId !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data?.circle_id ?? null
    },
  })
}

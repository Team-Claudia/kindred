// The account function's request handling (task 4.5e, ADR-015), with the
// database and Google passed in, so handler.test.ts can check the order and
// the auth checks without either.

import { corsHeaders, json } from '../_shared/google.ts'

export type Caller = { id: string; isAnonymous: boolean }

export interface AccountDeps {
  /** The signed-in member for a JWT, or null if it isn't valid. */
  getUser(jwt: string): Promise<Caller | null>
  /** account_export(user_id): the member's data, or null if there's none. */
  exportAccount(userId: string): Promise<unknown>
  /**
   * delete_account(user_id): deletes the account in one transaction and
   * returns the Google refresh token it removed, if any.
   */
  deleteAccount(userId: string): Promise<{ googleRefreshToken: string | null }>
  /** Asks Google to revoke a refresh token. Best effort: never throws. */
  revokeGoogleToken(token: string): Promise<void>
}

export async function handleAccount(req: Request, deps: AccountDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!jwt) return json({ error: 'unauthorized' }, 401)
  const caller = await deps.getUser(jwt)
  if (!caller) return json({ error: 'unauthorized' }, 401)
  // Try the demo guests have no account of their own to export or delete;
  // the nightly clean-up deletes them.
  if (caller.isAnonymous) return json({ error: 'guest' }, 403)

  const body: unknown = await req.json().catch(() => null)
  const action = body && typeof body === 'object' ? (body as { action?: unknown }).action : null

  try {
    if (action === 'export') {
      const data = await deps.exportAccount(caller.id)
      if (!data) return json({ error: 'not_found' }, 404)
      return json(data, 200, { 'Cache-Control': 'private, no-store' })
    }

    if (action === 'delete') {
      // Everything in the database happens first, in one transaction: the
      // Google token leaves Vault, the feed link stops working, open items go
      // back to Needs someone with the others told, shared history becomes
      // "Former member", and the profile and auth.users row are deleted. If
      // that fails nothing has changed and the member can try again.
      const { googleRefreshToken } = await deps.deleteAccount(caller.id)
      // Then Google forgets Kindred's access too. Kindred no longer holds the
      // token either way, so a failure here leaves nothing usable behind.
      if (googleRefreshToken) await deps.revokeGoogleToken(googleRefreshToken)
      return json({ status: 'deleted' })
    }
  } catch (error) {
    console.error(`account: ${String(action)} failed`, error instanceof Error ? error.message : 'unknown')
    return json({ error: 'unknown' }, 500)
  }

  return json({ error: 'invalid_input' }, 400)
}

// account (task 4.5e, plan §4.4, ADR-015, PRD US 1.3): Download my data and
// Delete my account, from Care Circle and settings.
//
// The app POSTs with the member's JWT (verify_jwt is off; the function checks
// it, as availability does):
// - {action: "export"} → a JSON copy of the member's own data and the content
//   they authored (account_export).
// - {action: "delete"} → delete_account, which does everything in the
//   database in one transaction (see handler.ts), then Google is asked to
//   revoke the member's refresh token → {status: "deleted"}.
// Demo guests (anonymous) get 403 guest.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { fetchWithTimeout, GOOGLE_REVOKE_URL } from '../_shared/google.ts'
import { handleAccount } from './handler.ts'

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

Deno.serve((req) =>
  handleAccount(req, {
    async getUser(jwt) {
      const { data, error } = await admin.auth.getUser(jwt)
      // Auth checks the JWT's signature before looking the user up, so
      // user_not_found means a genuine JWT for an account that's been deleted.
      if (error?.code === 'user_not_found') return 'deleted'
      if (error || !data.user) return null
      return { id: data.user.id, isAnonymous: data.user.is_anonymous === true }
    },

    async exportAccount(userId) {
      const { data, error } = await admin.rpc('account_export', { user_id: userId })
      if (error) throw new Error(error.message)
      return data
    },

    async deleteAccount(userId) {
      const { data, error } = await admin.rpc('delete_account', { user_id: userId })
      if (error) throw new Error(error.message)
      const token = (data as { google_refresh_token?: unknown } | null)?.google_refresh_token
      return { googleRefreshToken: typeof token === 'string' && token !== '' ? token : null }
    },

    async revokeGoogleToken(token) {
      try {
        const res = await fetchWithTimeout(GOOGLE_REVOKE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token }),
        })
        await res.body?.cancel()
        // 400 invalid_token when the member already removed Kindred in their
        // Google account. Only the status is logged, never the token.
        if (!res.ok) console.warn('account: Google revoke failed', res.status)
      } catch (error) {
        console.warn('account: Google unreachable', error instanceof Error ? error.name : 'unknown')
      }
    },
  })
)

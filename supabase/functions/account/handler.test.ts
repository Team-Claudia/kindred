// Tests for the account function (task 4.5e). Run with:
//   deno test supabase/functions/account/
import { assertEquals } from 'jsr:@std/assert@1'
import { type AccountDeps, type Caller, handleAccount } from './handler.ts'

const ALICE: Caller = { id: 'a0000000-0000-0000-0000-00000000000a', isAnonymous: false }
const GUEST: Caller = { id: '90000000-0000-0000-0000-000000000009', isAnonymous: true }

// Fake dependencies that record what was called, in order.
function fakes(options: {
  caller?: Caller | null
  token?: string | null
  exported?: unknown
  deleteFails?: boolean
} = {}) {
  const calls: string[] = []
  const deps: AccountDeps = {
    getUser(jwt) {
      calls.push(`getUser:${jwt}`)
      return Promise.resolve(options.caller === undefined ? ALICE : options.caller)
    },
    exportAccount(userId) {
      calls.push(`export:${userId}`)
      return Promise.resolve(options.exported === undefined ? { account: { id: userId } } : options.exported)
    },
    deleteAccount(userId) {
      calls.push(`delete:${userId}`)
      if (options.deleteFails) return Promise.reject(new Error('connection lost'))
      return Promise.resolve({ googleRefreshToken: options.token ?? null })
    },
    revokeGoogleToken(token) {
      calls.push(`revoke:${token}`)
      return Promise.resolve()
    },
  }
  return { calls, deps }
}

function post(body: unknown, jwt: string | null = 'alice-jwt'): Request {
  return new Request('http://localhost/account', {
    method: 'POST',
    headers: jwt ? { Authorization: `Bearer ${jwt}` } : {},
    body: JSON.stringify(body),
  })
}

Deno.test('delete: the database first, then Google revokes the token', async () => {
  const { calls, deps } = fakes({ token: 'refresh-1' })
  const res = await handleAccount(post({ action: 'delete' }), deps)
  assertEquals(res.status, 200)
  assertEquals(await res.json(), { status: 'deleted' })
  assertEquals(calls, ['getUser:alice-jwt', `delete:${ALICE.id}`, 'revoke:refresh-1'])
})

Deno.test('delete: with no Google connection there is nothing to revoke', async () => {
  const { calls, deps } = fakes({ token: null })
  const res = await handleAccount(post({ action: 'delete' }), deps)
  assertEquals(res.status, 200)
  assertEquals(calls, ['getUser:alice-jwt', `delete:${ALICE.id}`])
})

Deno.test('delete: if the database fails, Google is left alone and the member can retry', async () => {
  const { calls, deps } = fakes({ token: 'refresh-1', deleteFails: true })
  const res = await handleAccount(post({ action: 'delete' }), deps)
  assertEquals(res.status, 500)
  assertEquals(await res.json(), { error: 'unknown' })
  assertEquals(calls, ['getUser:alice-jwt', `delete:${ALICE.id}`])
})

Deno.test('export: the caller\'s own data, never cached', async () => {
  const { calls, deps } = fakes()
  const res = await handleAccount(post({ action: 'export' }), deps)
  assertEquals(res.status, 200)
  assertEquals(res.headers.get('Cache-Control'), 'private, no-store')
  assertEquals(await res.json(), { account: { id: ALICE.id } })
  assertEquals(calls, ['getUser:alice-jwt', `export:${ALICE.id}`])
})

Deno.test('export: no data is 404', async () => {
  const { deps } = fakes({ exported: null })
  const res = await handleAccount(post({ action: 'export' }), deps)
  assertEquals(res.status, 404)
})

Deno.test('no JWT, or one that is not valid, is 401 and touches nothing', async () => {
  for (const [jwt, caller] of [[null, ALICE], ['bad-jwt', null]] as const) {
    const { calls, deps } = fakes({ caller })
    const res = await handleAccount(post({ action: 'delete' }, jwt), deps)
    assertEquals(res.status, 401)
    assertEquals(calls.filter((call) => !call.startsWith('getUser')), [])
  }
})

Deno.test('a demo guest can neither export nor delete', async () => {
  for (const action of ['export', 'delete']) {
    const { calls, deps } = fakes({ caller: GUEST })
    const res = await handleAccount(post({ action }), deps)
    assertEquals(res.status, 403)
    assertEquals(await res.json(), { error: 'guest' })
    assertEquals(calls, ['getUser:alice-jwt'])
  }
})

Deno.test('the account acted on is always the caller\'s, whatever the body says', async () => {
  const { calls, deps } = fakes()
  await handleAccount(post({ action: 'delete', user_id: 'b0000000-0000-0000-0000-00000000000b' }), deps)
  assertEquals(calls, ['getUser:alice-jwt', `delete:${ALICE.id}`])
})

Deno.test('an unknown action, or no body, is 400', async () => {
  const { calls, deps } = fakes()
  assertEquals((await handleAccount(post({ action: 'wipe' }), deps)).status, 400)
  assertEquals((await handleAccount(post('nonsense'), deps)).status, 400)
  assertEquals(calls.filter((call) => !call.startsWith('getUser')), [])
})

Deno.test('only POST, with CORS for the browser', async () => {
  const { deps } = fakes()
  const options = await handleAccount(new Request('http://localhost/account', { method: 'OPTIONS' }), deps)
  assertEquals(options.status, 200)
  assertEquals(options.headers.get('Access-Control-Allow-Origin'), '*')
  const get = await handleAccount(new Request('http://localhost/account'), deps)
  assertEquals(get.status, 405)
})

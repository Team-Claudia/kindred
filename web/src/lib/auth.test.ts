import type { User } from '@supabase/supabase-js'
import { authErrorKind, googleName, safeNext, signInPath } from './auth'

vi.mock('./supabase', () => ({ supabase: {} }))

test.each([
  [null, '/'],
  ['', '/'],
  ['/join/ABCD1234', '/join/ABCD1234'],
  ['/i/123?x=1', '/i/123?x=1'],
  ['https://evil.example', '/'],
  ['//evil.example', '/'],
  ['/\\evil.example', '/'],
  ['/sign-in', '/'],
  ['/sign-in?next=/week', '/'],
])('safeNext(%j) is %j', (next, expected) => {
  expect(safeNext(next)).toBe(expected)
})

test('signInPath keeps the destination unless it is Home', () => {
  expect(signInPath('/')).toBe('/sign-in')
  expect(signInPath('/join/ABCD1234')).toBe('/sign-in?next=%2Fjoin%2FABCD1234')
})

test('googleName reads the Google profile name', () => {
  const user = (metadata: object) => ({ user_metadata: metadata }) as User
  expect(googleName(user({ full_name: ' Maya Example ', name: 'Maya' }))).toBe('Maya Example')
  expect(googleName(user({ name: 'Jonah' }))).toBe('Jonah')
  expect(googleName(user({ full_name: '  ' }))).toBeUndefined()
  expect(googleName(user({}))).toBeUndefined()
})

test('authErrorKind groups Supabase errors', () => {
  expect(authErrorKind({ status: 429, code: 'over_email_send_rate_limit' })).toBe('rate_limited')
  expect(authErrorKind({ status: 403, code: 'otp_expired' })).toBe('code_invalid')
  expect(authErrorKind(new Error('offline'))).toBe('unknown')
  expect(authErrorKind(undefined)).toBe('unknown')
})

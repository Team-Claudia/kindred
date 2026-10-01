import { errorCodes, errorMessage, RpcError, toRpcError } from './errors'
import enCA from '@/i18n/locales/en-CA.json'

test('every error code has a plain-language message', () => {
  for (const code of [...errorCodes, 'unknown'] as const) {
    expect(enCA.errors).toHaveProperty(code)
  }
})

test('turns an RPC error into its message', () => {
  const error = toRpcError({ message: 'coverage_limit_reached', details: '' })
  expect(error.code).toBe('coverage_limit_reached')
  expect(errorMessage(error)).toBe("You've reached your limit of 2 coverage requests this month.")
})

test('uses the name from DETAIL when the RPC sends one', () => {
  const error = toRpcError({ message: 'coverage_resolved', details: '{"name":"Daniel"}' })
  expect(errorMessage(error)).toBe('Daniel is already covering this.')
  expect(errorMessage(new RpcError('coverage_resolved'))).toBe(
    'Someone is already covering this.',
  )
})

test('falls back to a general message for anything unexpected', () => {
  expect(toRpcError({ message: 'connection reset', details: '' }).code).toBe('unknown')
  expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Try again.')
})

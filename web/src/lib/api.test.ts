import { claim, coverageRemaining } from './api'
import { RpcError } from './errors'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: {
    rest: { rpc: vi.fn() },
    // Mirrors supabase-js, whose rpc reads `this`, so an unbound call fails.
    rpc(this: { rest: { rpc: (...args: unknown[]) => unknown } }, ...args: unknown[]) {
      return this.rest.rpc(...args)
    },
  },
}))

const restRpc = (supabase as unknown as { rest: { rpc: ReturnType<typeof vi.fn> } }).rest.rpc

test('calls the RPC by name with its arguments', async () => {
  restRpc.mockResolvedValueOnce({ data: 2, error: null })
  await expect(coverageRemaining()).resolves.toBe(2)
  expect(restRpc).toHaveBeenCalledWith('coverage_remaining', undefined)
})

test('throws a typed error when the RPC raises one', async () => {
  restRpc.mockResolvedValueOnce({
    data: null,
    error: { message: 'already_claimed', details: '{"name":"Priya"}' },
  })
  const result = claim({ item_id: 'item-1', version: 3 })
  await expect(result).rejects.toBeInstanceOf(RpcError)
  await expect(result).rejects.toMatchObject({ code: 'already_claimed', params: { name: 'Priya' } })
  expect(restRpc).toHaveBeenLastCalledWith('claim', { item_id: 'item-1', version: 3 })
})

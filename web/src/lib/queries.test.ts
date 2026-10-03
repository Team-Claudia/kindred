import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { comingUpLimit, queryKeys, useItemsComingUp } from './queries'

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() } }))
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: vi.fn(),
}))

test('Coming up for you asks for only your accepted items from then on, soonest three', async () => {
  const calls: [string, ...unknown[]][] = []
  const builder: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'in', 'gte', 'order', 'limit']) {
    builder[name] = (...args: unknown[]) => {
      calls.push([name, ...args])
      return builder
    }
  }
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: [], error: null })
  vi.mocked(supabase.from).mockReturnValue(builder as never)

  useItemsComingUp('maya', '2026-09-25T07:00:00.000Z')
  const options = vi.mocked(useQuery).mock.calls[0]![0] as unknown as {
    queryKey: readonly unknown[]
    queryFn: () => Promise<unknown>
  }
  await options.queryFn()

  expect(options.queryKey).toEqual(queryKeys.itemsComingUp('maya', '2026-09-25T07:00:00.000Z'))
  expect(options.queryKey[0]).toBe('items') // so live updates refresh it
  expect(supabase.from).toHaveBeenCalledWith('items')
  expect(calls).toEqual([
    ['select', '*'],
    ['eq', 'owner_id', 'maya'],
    ['in', 'state', ['assigned', 'needs_coverage']],
    ['gte', 'starts_at', '2026-09-25T07:00:00.000Z'],
    ['order', 'starts_at'],
    ['limit', 3],
  ])
  expect(comingUpLimit).toBe(3)
})

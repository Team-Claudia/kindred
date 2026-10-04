import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { platform } from '@/platform'
import {
  keysForTable,
  listenToCircle,
  listenToNotifications,
  liveTables,
  useLiveNotifications,
  useLiveUpdates,
} from './live'
import { supabase } from './supabase'

type ChangeHandler = () => void
type StatusHandler = (status: string) => void

interface FakeChannel {
  topic: string
  handlers: Map<string, ChangeHandler>
  filters: string[]
  status?: StatusHandler
  on: ReturnType<typeof vi.fn>
  subscribe: ReturnType<typeof vi.fn>
}

const channels: FakeChannel[] = []

vi.mock('./supabase', () => ({
  supabase: {
    channel: vi.fn((topic: string) => {
      const channel: FakeChannel = {
        topic,
        handlers: new Map(),
        filters: [],
        on: vi.fn((_type: string, options: { table: string; filter: string }, handler: ChangeHandler) => {
          channel.handlers.set(options.table, handler)
          channel.filters.push(options.filter)
          return channel
        }),
        subscribe: vi.fn((status: StatusHandler) => {
          channel.status = status
          return channel
        }),
      }
      channels.push(channel)
      return channel
    }),
    removeChannel: vi.fn(() => Promise.resolve('ok')),
  },
}))

const listener = () => ({ onChange: vi.fn(), onReconnect: vi.fn() })

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.runOnlyPendingTimers()
  vi.useRealTimers()
  vi.clearAllMocks()
  channels.length = 0
})

describe('listenToCircle', () => {
  test("opens one channel for the circle, listening to each table's rows in that circle", () => {
    const stop = listenToCircle('circle-1', listener())
    expect(supabase.channel).toHaveBeenCalledWith('circle:circle-1')
    const [channel] = channels
    expect([...channel.handlers.keys()]).toEqual([...liveTables])
    expect(new Set(channel.filters)).toEqual(new Set(['circle_id=eq.circle-1']))
    stop()
  })

  test('tells listeners which table changed', () => {
    const first = listener()
    const second = listener()
    const stopFirst = listenToCircle('circle-1', first)
    const stopSecond = listenToCircle('circle-1', second)
    expect(channels).toHaveLength(1)
    channels[0].handlers.get('items')!()
    expect(first.onChange).toHaveBeenCalledWith('items')
    expect(second.onChange).toHaveBeenCalledWith('items')
    stopFirst()
    stopSecond()
  })

  test('reports a reconnect, but not the first connection', () => {
    const live = listener()
    const stop = listenToCircle('circle-1', live)
    channels[0].status!('SUBSCRIBED')
    expect(live.onReconnect).not.toHaveBeenCalled()
    channels[0].status!('CHANNEL_ERROR')
    channels[0].status!('SUBSCRIBED')
    expect(live.onReconnect).toHaveBeenCalledTimes(1)
    stop()
  })

  test('closes the channel once nobody is listening', () => {
    const stop = listenToCircle('circle-1', listener())
    stop()
    expect(supabase.removeChannel).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0])
  })

  test('keeps the channel when a listener comes straight back (StrictMode)', () => {
    listenToCircle('circle-1', listener())()
    const stop = listenToCircle('circle-1', listener())
    vi.runAllTimers()
    expect(supabase.removeChannel).not.toHaveBeenCalled()
    expect(channels).toHaveLength(1)
    stop()
  })

  test('switches channel when the circle changes', () => {
    const stopOld = listenToCircle('circle-1', listener())
    const stopNew = listenToCircle('circle-2', listener())
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0])
    expect(channels[1].topic).toBe('circle:circle-2')
    stopOld()
    stopNew()
  })
})

describe('useLiveUpdates', () => {
  function setup(circleId: string | null) {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const hook = renderHook(({ id }) => useLiveUpdates(id), { wrapper, initialProps: { id: circleId } })
    return { invalidate, hook }
  }

  test('refreshes the keys for the tables that changed, once per burst', () => {
    const { invalidate, hook } = setup('circle-1')
    channels[0].handlers.get('items')!()
    channels[0].handlers.get('activity_events')!()
    channels[0].handlers.get('items')!()
    expect(invalidate).not.toHaveBeenCalled()
    vi.runAllTimers()
    const refreshed = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    const expected = new Set([...keysForTable.items, ...keysForTable.activity_events].map((k) => JSON.stringify(k)))
    expect(refreshed.map((k) => JSON.stringify(k)).sort()).toEqual([...expected].sort())
    hook.unmount()
  })

  test('refreshes updates when one is posted', () => {
    const { invalidate, hook } = setup('circle-1')
    channels[0].handlers.get('updates')!()
    vi.runAllTimers()
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['updates'] })
    hook.unmount()
  })

  test('refreshes everything when the app comes back on screen', () => {
    let visible: (() => void) | undefined
    const stopWatching = vi.fn()
    vi.spyOn(platform, 'onAppVisible').mockImplementation((callback) => {
      visible = callback
      return stopWatching
    })
    const { invalidate, hook } = setup('circle-1')
    visible!()
    expect(invalidate).toHaveBeenCalledWith()
    hook.unmount()
    expect(stopWatching).toHaveBeenCalled()
  })

  test('closes the channel on sign-out', () => {
    const { hook } = setup('circle-1')
    hook.rerender({ id: null })
    vi.runAllTimers()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0])
  })

  test('does nothing without a circle', () => {
    const { hook } = setup(null)
    expect(supabase.channel).not.toHaveBeenCalled()
    hook.unmount()
  })
})

describe('listenToNotifications', () => {
  test("opens the member's own channel, beside the circle's, for their notifications rows only", () => {
    const stopCircle = listenToCircle('circle-1', listener())
    const live = listener()
    const stop = listenToNotifications('user-1', live)
    expect(channels.map((channel) => channel.topic)).toEqual(['circle:circle-1', 'notifications:user-1'])
    const channel = channels[1]
    expect([...channel.handlers.keys()]).toEqual(['notifications'])
    expect(channel.filters).toEqual(['user_id=eq.user-1'])
    channel.handlers.get('notifications')!()
    expect(live.onChange).toHaveBeenCalled()
    stop()
    stopCircle()
    vi.runAllTimers()
    expect(supabase.removeChannel).toHaveBeenCalledTimes(2)
  })

  test('switches channel when someone else signs in', () => {
    const stopOld = listenToNotifications('user-1', listener())
    const stopNew = listenToNotifications('user-2', listener())
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0])
    expect(channels[1].topic).toBe('notifications:user-2')
    stopOld()
    stopNew()
  })
})

describe('useLiveNotifications', () => {
  function setup(userId: string | undefined) {
    const queryClient = new QueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children)
    const hook = renderHook(({ id }) => useLiveNotifications(id), { wrapper, initialProps: { id: userId } })
    return { invalidate, hook }
  }

  test('refreshes the list and the bell once when rows change, as Mark all read on another phone does', () => {
    const { invalidate, hook } = setup('user-1')
    const changed = channels[0].handlers.get('notifications')!
    changed()
    changed()
    changed()
    expect(invalidate).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] })
    hook.unmount()
  })

  test('refreshes on reconnect and when the app comes back on screen', () => {
    let visible: (() => void) | undefined
    vi.spyOn(platform, 'onAppVisible').mockImplementation((callback) => {
      visible = callback
      return () => {}
    })
    const { invalidate, hook } = setup('user-1')
    channels[0].status!('SUBSCRIBED')
    channels[0].status!('SUBSCRIBED')
    expect(invalidate).toHaveBeenCalledTimes(1)
    visible!()
    expect(invalidate).toHaveBeenCalledTimes(2)
    expect(invalidate).toHaveBeenLastCalledWith({ queryKey: ['notifications'] })
    hook.unmount()
  })

  test('closes the channel on sign-out', () => {
    const { hook } = setup('user-1')
    hook.rerender({ id: undefined })
    vi.runAllTimers()
    expect(supabase.removeChannel).toHaveBeenCalledWith(channels[0])
  })
})

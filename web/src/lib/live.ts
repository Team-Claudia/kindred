import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { platform } from '@/platform'
import { queryKeys } from './queries'
import { supabase } from './supabase'

// Live updates between phones (implementation plan §4.3, ADR-014). The
// signed-in app keeps one Realtime channel for its circle, `circle:<id>`, and
// refreshes the TanStack Query keys a change affects. A second channel,
// `notifications:<user id>`, carries the member's own notifications for the
// bell (task 4.5f). Realtime checks each change against the table's select
// policy, so members only hear about their own circle and their own
// notifications. While the phone has Kindred in the background it hears nothing,
// so coming back on screen refreshes everything.

export const liveTables = ['items', 'activity_events', 'coverage_requests', 'updates'] as const

export type LiveTable = (typeof liveTables)[number]

// Prefix of every weekly summary key (queryKeys.weeklySummary).
const weeklySummaries = ['weekly-summary'] as const

/**
 * The query keys to refresh when a table changes. Keys are prefixes, so
 * ['items'] also refreshes ranges, single items and Home's lists. When a
 * screen starts reading a new table, add its keys here.
 */
export const keysForTable: Record<LiveTable, readonly QueryKey[]> = {
  // Updates show their linked item's title, so they refresh too.
  items: [queryKeys.items, weeklySummaries, queryKeys.coverageRemaining, queryKeys.updates],
  activity_events: [queryKeys.items, weeklySummaries],
  coverage_requests: [queryKeys.items, queryKeys.coverageRemaining],
  updates: [queryKeys.updates],
}

export interface LiveListener {
  /** A row in `table` changed. */
  onChange(table: LiveTable): void
  /** The channel connected again after dropping, so changes may have been missed. */
  onReconnect(): void
}

// What a channel tells its listeners: which of its tables changed.
interface ChannelListener {
  onChange(table: string): void
  onReconnect(): void
}

interface Subscription {
  topic: string
  channel: RealtimeChannel
  listeners: Set<ChannelListener>
  teardown?: ReturnType<typeof setTimeout>
}

// The open channel of each kind: the circle's, and the member's own
// notifications. Each kind has at most one at a time.
type ChannelKind = 'circle' | 'notifications'
const active: Partial<Record<ChannelKind, Subscription>> = {}

function open(topic: string, tables: readonly { table: string; filter: string }[]): Subscription {
  const subscription: Subscription = {
    topic,
    channel: supabase.channel(topic),
    listeners: new Set(),
  }
  for (const { table, filter } of tables) {
    subscription.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      () => subscription.listeners.forEach((listener) => listener.onChange(table)),
    )
  }
  let connected = false
  subscription.channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    if (connected) subscription.listeners.forEach((listener) => listener.onReconnect())
    connected = true
  })
  return subscription
}

function close(kind: ChannelKind, subscription: Subscription) {
  clearTimeout(subscription.teardown)
  if (active[kind] === subscription) delete active[kind]
  void supabase.removeChannel(subscription.channel)
}

/**
 * Listens to the `kind` channel for `topic`, opening it if it isn't open (and
 * closing that kind's channel for another topic). Returns a function that
 * stops listening; the channel closes once nobody is. Closing waits a moment,
 * so a screen that unmounts and mounts again straight away (React's
 * StrictMode does this) keeps the same channel rather than racing a new one
 * against the old one leaving.
 */
function listen(
  kind: ChannelKind,
  topic: string,
  tables: readonly { table: string; filter: string }[],
  listener: ChannelListener,
): () => void {
  const current = active[kind]
  if (current && current.topic !== topic) close(kind, current)
  const subscription = (active[kind] ??= open(topic, tables))
  clearTimeout(subscription.teardown)
  subscription.teardown = undefined
  subscription.listeners.add(listener)

  return () => {
    subscription.listeners.delete(listener)
    if (subscription.listeners.size > 0) return
    clearTimeout(subscription.teardown)
    subscription.teardown = setTimeout(() => {
      if (subscription.listeners.size === 0) close(kind, subscription)
    }, 0)
  }
}

/** Listens to the circle's channel, `circle:<id>`: the liveTables rows in that circle. */
export function listenToCircle(circleId: string, listener: LiveListener): () => void {
  const filter = `circle_id=eq.${circleId}`
  return listen(
    'circle',
    `circle:${circleId}`,
    liveTables.map((table) => ({ table, filter })),
    {
      // The channel only has liveTables.
      onChange: (table) => listener.onChange(table as LiveTable),
      onReconnect: () => listener.onReconnect(),
    },
  )
}

/**
 * Listens to the member's own notifications rows, `notifications:<user id>`,
 * for the bell's unread count and the list (task 4.5f). Realtime checks the
 * notifications select policy, so a member only hears about their own.
 */
export function listenToNotifications(
  userId: string,
  listener: { onChange(): void; onReconnect(): void },
): () => void {
  return listen(
    'notifications',
    `notifications:${userId}`,
    [{ table: 'notifications', filter: `user_id=eq.${userId}` }],
    listener,
  )
}

// One action can change several rows at once (an item, its history and a
// coverage request), so changes that arrive together refresh once.
const BATCH_MS = 150

/**
 * Keeps the signed-in app's data live for `circleId`: refreshes queries when
 * the circle's rows change, when the channel reconnects and when Kindred
 * comes back on screen. Pass undefined or null (signed out, no circle) to
 * stop. Mount it once for the app, not per screen.
 */
export function useLiveUpdates(circleId: string | null | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!circleId) return

    const pending = new Set<LiveTable>()
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      timer = undefined
      const keys = new Map<string, QueryKey>()
      for (const table of pending) {
        for (const key of keysForTable[table]) keys.set(JSON.stringify(key), key)
      }
      pending.clear()
      for (const queryKey of keys.values()) void queryClient.invalidateQueries({ queryKey })
    }
    const refreshAll = () => void queryClient.invalidateQueries()

    const stopListening = listenToCircle(circleId, {
      onChange(table) {
        pending.add(table)
        timer ??= setTimeout(flush, BATCH_MS)
      },
      onReconnect: refreshAll,
    })
    const stopWatching = platform.onAppVisible(refreshAll)

    return () => {
      stopListening()
      stopWatching()
      clearTimeout(timer)
    }
  }, [circleId, queryClient])
}

/**
 * Keeps the member's notifications live (the bell's unread count and
 * /notifications): refreshes ['notifications'] when one of their rows is
 * written or marked read, on any phone, when the channel reconnects and when
 * Kindred comes back on screen. Pass undefined (signed out) to stop. Mount it
 * once for the app, not per screen.
 */
export function useLiveNotifications(userId: string | null | undefined) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!userId) return

    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      clearTimeout(timer)
      timer = undefined
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
    }

    const stopListening = listenToNotifications(userId, {
      // Mark all read changes every unread row at once, so refresh once.
      onChange() {
        timer ??= setTimeout(refresh, BATCH_MS)
      },
      onReconnect: refresh,
    })
    const stopWatching = platform.onAppVisible(refresh)

    return () => {
      stopListening()
      stopWatching()
      clearTimeout(timer)
    }
  }, [userId, queryClient])
}

import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect } from 'react'
import { platform } from '@/platform'
import { queryKeys } from './queries'
import { supabase } from './supabase'

// Live updates between phones (implementation plan §4.3, ADR-014). The
// signed-in app keeps one Realtime channel for its circle, `circle:<id>`, and
// refreshes the TanStack Query keys a change affects. Realtime checks each
// change against the table's select policy, so members only hear about their
// own circle. While the phone has Kindred in the background it hears nothing,
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

interface Subscription {
  circleId: string
  channel: RealtimeChannel
  listeners: Set<LiveListener>
  teardown?: ReturnType<typeof setTimeout>
}

let active: Subscription | null = null

function open(circleId: string): Subscription {
  const subscription: Subscription = {
    circleId,
    channel: supabase.channel(`circle:${circleId}`),
    listeners: new Set(),
  }
  for (const table of liveTables) {
    subscription.channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `circle_id=eq.${circleId}` },
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

function close(subscription: Subscription) {
  clearTimeout(subscription.teardown)
  if (active === subscription) active = null
  void supabase.removeChannel(subscription.channel)
}

/**
 * Listens to the circle's channel, opening it if it isn't open. Returns a
 * function that stops listening; the channel closes once nobody is. Closing
 * waits a moment, so a screen that unmounts and mounts again straight away
 * (React's StrictMode does this) keeps the same channel rather than racing a
 * new one against the old one leaving.
 */
export function listenToCircle(circleId: string, listener: LiveListener): () => void {
  if (active && active.circleId !== circleId) close(active)
  active ??= open(circleId)
  const subscription = active
  clearTimeout(subscription.teardown)
  subscription.teardown = undefined
  subscription.listeners.add(listener)

  return () => {
    subscription.listeners.delete(listener)
    if (subscription.listeners.size > 0) return
    clearTimeout(subscription.teardown)
    subscription.teardown = setTimeout(() => {
      if (subscription.listeners.size === 0) close(subscription)
    }, 0)
  }
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

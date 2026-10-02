import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from './api'
import { supabase } from './supabase'

// TanStack Query hooks (implementation plan §4.3). Reads are plain supabase-js
// queries over RLS-filtered tables; writes are RPCs from api.ts. The circle's
// Realtime channel invalidates these keys when rows change. Later tasks add
// the hooks their screens need and fill in the filters.

export const queryKeys = {
  items: ['items'] as const,
  item: (itemId: string) => ['items', itemId] as const,
  // Under 'items', so anything that refreshes items refreshes ranges too.
  itemsInRange: (from: string, to: string) => ['items', 'range', from, to] as const,
  updates: ['updates'] as const,
  members: ['members'] as const,
  notifications: ['notifications'] as const,
  coverageRemaining: ['coverage-remaining'] as const,
  weeklySummary: (weekStart: string) => ['weekly-summary', weekStart] as const,
  // Home (task 2.3). Under 'items' and 'updates', so the live channel refreshes them.
  itemsNeedingAttention: (before: string) => ['items', 'attention', before] as const,
  latestUpdate: ['updates', 'latest'] as const,
  itemCount: ['items', 'count'] as const,
}

async function rows<T>(query: PromiseLike<{ data: T | null; error: Error | null }>) {
  const { data, error } = await query
  if (error) throw error
  return data as T
}

export function useItems() {
  return useQuery({
    queryKey: queryKeys.items,
    queryFn: () => rows(supabase.from('items').select('*').order('starts_at')),
  })
}

/**
 * Items starting from `from` (inclusive) up to `to` (exclusive), both ISO
 * instants, in time order. This week passes the week's start and end in the
 * circle's time zone (lib/dates.ts weekOf).
 */
export function useItemsInRange(from: string, to: string) {
  return useQuery({
    queryKey: queryKeys.itemsInRange(from, to),
    queryFn: () =>
      rows(
        supabase
          .from('items')
          .select('*')
          .gte('starts_at', from)
          .lt('starts_at', to)
          .order('starts_at'),
      ),
  })
}

export function useItem(itemId: string) {
  return useQuery({
    queryKey: queryKeys.item(itemId),
    queryFn: () => rows(supabase.from('items').select('*').eq('id', itemId).single()),
  })
}

export function useUpdates() {
  return useQuery({
    queryKey: queryKeys.updates,
    queryFn: () =>
      rows(supabase.from('updates').select('*').order('created_at', { ascending: false })),
  })
}

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: () => rows(supabase.from('circle_members').select('*')),
  })
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () =>
      rows(supabase.from('notifications').select('*').order('created_at', { ascending: false })),
  })
}

export function useCoverageRemaining() {
  return useQuery({ queryKey: queryKeys.coverageRemaining, queryFn: api.coverageRemaining })
}

export function useWeeklySummary(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.weeklySummary(weekStart),
    queryFn: () => api.weeklySummary(weekStart),
  })
}

// Home (task 2.3)

// Item states that still need someone to act. Completed and Cancelled don't.
const openStates = ['needs_someone', 'awaiting_acceptance', 'assigned', 'needs_coverage']

/**
 * Open items Home lists outside today: everything waiting on an answer,
 * someone or cover, plus anything still open from before `before` (the start
 * of today), which is overdue. Assigned items from today on are left out; the
 * today range has those. Each comes with its pending assignment request, for
 * who asked.
 */
export function useItemsNeedingAttention(before: string) {
  return useQuery({
    queryKey: queryKeys.itemsNeedingAttention(before),
    queryFn: () =>
      rows(
        supabase
          .from('items')
          .select('*, assignment_requests(assigner_id)')
          .in('state', openStates)
          .or(`state.neq.assigned,starts_at.lt."${before}"`)
          .eq('assignment_requests.status', 'pending')
          .order('starts_at'),
      ),
  })
}

export type ItemNeedingAttention = NonNullable<
  ReturnType<typeof useItemsNeedingAttention>['data']
>[number]

/** How many items the circle has ever had, so Home can tell a brand-new circle. */
export function useItemCount() {
  return useQuery({
    queryKey: queryKeys.itemCount,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true })
      if (error) throw error
      return count ?? 0
    },
  })
}

/** The circle's newest update, or null if nobody has posted one. */
export function useLatestUpdate() {
  return useQuery({
    queryKey: queryKeys.latestUpdate,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('updates')
        .select('id, author_id, body, created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// Wraps any api.ts write and refreshes item data once it settles, so the
// screen shows the latest state whether the write succeeded or was stale.
export function useItemMutation<Args, Result>(mutationFn: (args: Args) => Promise<Result>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.items }),
  })
}

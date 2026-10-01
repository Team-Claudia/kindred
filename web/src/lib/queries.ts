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
  updates: ['updates'] as const,
  members: ['members'] as const,
  notifications: ['notifications'] as const,
  coverageRemaining: ['coverage-remaining'] as const,
  weeklySummary: (weekStart: string) => ['weekly-summary', weekStart] as const,
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

// Wraps any api.ts write and refreshes item data once it settles, so the
// screen shows the latest state whether the write succeeded or was stale.
export function useItemMutation<Args, Result>(mutationFn: (args: Args) => Promise<Result>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.items }),
  })
}

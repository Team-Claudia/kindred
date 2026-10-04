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
  // Item detail (task 2.2). Under the item, so refreshing items refreshes these.
  itemHistory: (itemId: string) => ['items', itemId, 'history'] as const,
  itemRequest: (itemId: string) => ['items', itemId, 'request'] as const,
  // Under 'items', so anything that refreshes items refreshes ranges too.
  itemsInRange: (from: string, to: string) => ['items', 'range', from, to] as const,
  updates: ['updates'] as const,
  // Updates (task 4.1). Under 'updates' or the item, so the live channel refreshes them.
  itemUpdates: (itemId: string) => ['updates', 'item', itemId] as const,
  followUps: (itemId: string) => ['items', itemId, 'follow-ups'] as const,
  // A series' rule never changes, so it's read once (task 4.5c).
  series: (seriesId: string) => ['series', seriesId] as const,
  members: ['members'] as const,
  // The member's own notifications (task 4.5f), keyed by user so another
  // account on the same phone never sees them. The bell's count sits under
  // the list, so refreshing ['notifications'] refreshes both.
  notifications: ['notifications'] as const,
  notificationList: (userId: string) => ['notifications', userId] as const,
  unreadNotifications: (userId: string) => ['notifications', userId, 'unread'] as const,
  coverageRemaining: ['coverage-remaining'] as const,
  weeklySummary: (weekStart: string) => ['weekly-summary', weekStart] as const,
  // Home (task 2.3). Under 'items' and 'updates', so the live channel refreshes them.
  itemsNeedingAttention: (before: string) => ['items', 'attention', before] as const,
  // Coming up for you (task 4.11), under 'items' like the rest of Home.
  itemsComingUp: (ownerId: string, from: string) => ['items', 'coming-up', ownerId, from] as const,
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
    // Retrying won't make a missing item appear.
    retry: (failures, error) => !isItemNotFound(error) && failures < 3,
  })
}

/** How an occurrence's series repeats ('daily', 'weekly' or 'monthly'); idle for a one-off item. */
export function useSeriesRepeat(seriesId: string | null) {
  return useQuery({
    queryKey: queryKeys.series(seriesId ?? ''),
    queryFn: async () => {
      // single() over rows() types the row as null, so restore it.
      const series = (await rows(
        supabase.from('series').select('repeat').eq('id', seriesId ?? '').single(),
      )) as unknown as { repeat: api.Repeat }
      return series.repeat
    },
    enabled: seriesId !== null,
    staleTime: Infinity,
  })
}

/**
 * Whether useItem failed because there's no such item for this member. RLS
 * returns no row for other circles' items, so "not found" and "no access"
 * look the same: .single() found no row, or the ID isn't a UUID at all.
 */
export function isItemNotFound(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'PGRST116' || code === '22P02'
}

/** An item's history, oldest first (activity_events: created, claimed, completed, …). */
export function useItemHistory(itemId: string) {
  return useQuery({
    queryKey: queryKeys.itemHistory(itemId),
    queryFn: () =>
      rows(
        supabase
          .from('activity_events')
          .select('id, type, actor_id, at, data')
          .eq('item_id', itemId)
          .order('at')
          .order('id'),
      ),
  })
}

/** The item's pending assignment request, if any: who asked whom. */
export function usePendingRequest(itemId: string) {
  return useQuery({
    queryKey: queryKeys.itemRequest(itemId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assignment_requests')
        .select('assigner_id, assignee_id')
        .eq('item_id', itemId)
        .eq('status', 'pending')
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

// An update with its linked item's title and kind, for the chip that opens it.
const updateColumns = 'id, author_id, body, created_at, item_id, items(id, title, kind)'

/** The circle's Updates thread, newest first (task 4.1). */
export function useUpdates() {
  return useQuery({
    queryKey: queryKeys.updates,
    queryFn: () =>
      rows(
        supabase
          .from('updates')
          .select(updateColumns)
          .order('created_at', { ascending: false })
          .order('id'),
      ),
  })
}

export type UpdateWithItem = NonNullable<ReturnType<typeof useUpdates>['data']>[number]

/** Updates linked to one item, newest first. */
export function useItemUpdates(itemId: string) {
  return useQuery({
    queryKey: queryKeys.itemUpdates(itemId),
    queryFn: () =>
      rows(
        supabase
          .from('updates')
          .select(updateColumns)
          .eq('item_id', itemId)
          .order('created_at', { ascending: false })
          .order('id'),
      ),
  })
}

/** An appointment's follow-up tasks (items.follow_up_of), in date order. */
export function useFollowUps(itemId: string) {
  return useQuery({
    queryKey: queryKeys.followUps(itemId),
    queryFn: () =>
      rows(supabase.from('items').select('*').eq('follow_up_of', itemId).order('starts_at')),
  })
}

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members,
    queryFn: () => rows(supabase.from('circle_members').select('*')),
  })
}

/** How many notifications /notifications shows, newest first. */
export const notificationLimit = 100

/**
 * The member's notifications, newest first (task 4.5f). outbox-worker writes
 * one for every request, change, update, reminder and overdue alert, whether
 * or not it was pushed.
 */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notificationList(userId ?? ''),
    queryFn: () =>
      rows(
        supabase
          .from('notifications')
          .select('id, kind, item_id, line, created_at, read_at')
          .eq('user_id', userId!)
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .limit(notificationLimit),
      ),
    enabled: userId !== undefined,
  })
}

export type Notification = NonNullable<ReturnType<typeof useNotifications>['data']>[number]

/** How many of the member's notifications are unread, for the bell on Home. */
export function useUnreadNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.unreadNotifications(userId ?? ''),
    queryFn: async () => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .is('read_at', null)
      if (error) throw error
      return count ?? 0
    },
    enabled: userId !== undefined,
  })
}

/**
 * Marks one notification read, or all of them without an ID. The list and
 * the bell clear straight away; the other phones hear it over Realtime.
 */
export function useMarkNotificationsRead(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (notificationId?: number) => api.markNotificationsRead(notificationId),
    onMutate: async (notificationId) => {
      if (!userId) return
      const listKey = queryKeys.notificationList(userId)
      await queryClient.cancelQueries({ queryKey: listKey })
      const now = new Date().toISOString()
      let cleared = 0
      queryClient.setQueryData<Notification[]>(listKey, (list) =>
        list?.map((notification) => {
          if (notification.read_at || (notificationId !== undefined && notification.id !== notificationId)) {
            return notification
          }
          cleared += 1
          return { ...notification, read_at: now }
        }),
      )
      queryClient.setQueryData<number>(queryKeys.unreadNotifications(userId), (count) =>
        count === undefined ? count : notificationId === undefined ? 0 : Math.max(0, count - cleared),
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications }),
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

/** How many of your own upcoming items Home shows before "See all". */
export const comingUpLimit = 3

/**
 * Coming up for you: `ownerId`'s next accepted items (Assigned or Needs
 * coverage) at or after `from`, soonest first, at any date. Filtered and
 * limited in the query, so it never fetches the whole circle.
 */
export function useItemsComingUp(ownerId: string, from: string) {
  return useQuery({
    queryKey: queryKeys.itemsComingUp(ownerId, from),
    queryFn: () =>
      rows(
        supabase
          .from('items')
          .select('*')
          .eq('owner_id', ownerId)
          .in('state', ['assigned', 'needs_coverage'])
          .gte('starts_at', from)
          .order('starts_at')
          .limit(comingUpLimit),
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

// Calendar feed (task 3.4). calendar_feed creates the member's settings on
// first use, so reading it is safe to repeat. Keyed by user, so a different
// account on the same phone never sees someone else's secret link.
export const calendarFeedKey = (userId: string | undefined) => ['calendar-feed', userId] as const

export function useCalendarFeed(userId: string | undefined) {
  return useQuery({
    queryKey: calendarFeedKey(userId),
    queryFn: api.calendarFeed,
    enabled: userId !== undefined,
    staleTime: Infinity,
  })
}

export function useSetCalendarFeedTasks(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.setCalendarFeedTasks,
    onSuccess: (feed) => queryClient.setQueryData(calendarFeedKey(userId), feed),
  })
}

// Notification preferences (task 4.5d). Keyed by user, like the feed.
export const notificationPrefsKey = (userId: string | undefined) => ['notification-prefs', userId] as const

export function useNotificationPrefs(userId: string | undefined) {
  return useQuery({
    queryKey: notificationPrefsKey(userId),
    queryFn: api.notificationPrefs,
    enabled: userId !== undefined,
    staleTime: Infinity,
  })
}

export function useSetNotificationPref(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { category: api.PrefCategory; enabled: boolean }) =>
      api.setNotificationPref(args.category, args.enabled),
    onSuccess: (prefs) => queryClient.setQueryData(notificationPrefsKey(userId), prefs),
  })
}

// Google Calendar connection (task 4.5a). Keyed by user, like the feed.
export const googleCalendarKey = (userId: string | undefined) => ['google-calendar', userId] as const

export function useGoogleCalendarConnected(userId: string | undefined) {
  return useQuery({
    queryKey: googleCalendarKey(userId),
    queryFn: api.googleCalendarConnected,
    enabled: userId !== undefined,
  })
}

export function useDisconnectGoogleCalendar(userId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: api.disconnectGoogleCalendar,
    onSuccess: () => {
      queryClient.setQueryData(googleCalendarKey(userId), false)
      // Your own row in any open picker turns back to Unknown.
      return queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

/**
 * Who's free for `slot` (task 4.5a): each member's free, busy or unknown.
 * The function keeps answers for 5 minutes, so the app does too.
 */
export function useAvailability(circleId: string | undefined, slot: api.AvailabilitySlot | null) {
  return useQuery({
    queryKey: ['availability', circleId, slot?.start, slot?.end] as const,
    queryFn: () => api.availability(circleId!, slot!),
    enabled: Boolean(circleId && slot),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

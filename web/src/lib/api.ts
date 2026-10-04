import type { Database } from './database.types'
import { RpcError, toRpcError } from './errors'
import type { ItemShareKind } from './share-text'
import { supabase } from './supabase'

// One typed wrapper per RPC (implementation plan §4.2). All writes go through
// these; screens never write tables directly. Each wrapper throws an RpcError
// that errorMessage() turns into plain language.

type Functions = Database['public']['Functions']
type FunctionName = keyof Functions
type Args<F extends FunctionName> = Functions[F]['Args']
type Returns<F extends FunctionName> = Functions[F]['Returns']

export type Item = Database['public']['Tables']['items']['Row']
export type ItemKind = 'task' | 'appointment'
export type ItemState =
  | 'needs_someone'
  | 'awaiting_acceptance'
  | 'assigned'
  | 'needs_coverage'
  | 'completed'
  | 'cancelled'
export type Repeat = 'daily' | 'weekly' | 'monthly'
export type WeeklySummaryLine = Returns<'weekly_summary'>[number]

// Arguments for the RPCs that act on one item at its current version.
export type ItemVersion = { item_id: string; version: number }

export type CreateItemArgs = Omit<Args<'create_item'>, 'kind' | 'repeat'> & {
  kind: ItemKind
  repeat?: Repeat
}

export type ItemPatch = Partial<
  Pick<Item, 'title' | 'starts_at' | 'ends_at' | 'location' | 'private_notes'>
>

async function call<F extends FunctionName>(fn: F, args?: Args<F>): Promise<Returns<F>> {
  // supabase-js can't infer through a generic function name, so loosen the
  // call and restore the types from database.types.ts on the way out.
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args?: object,
  ) => PromiseLike<{ data: unknown; error: { message: string; details: string } | null }>
  const { data, error } = await rpc(fn, args)
  if (error) throw toRpcError(error)
  return data as Returns<F>
}

// Care Circle
export const createCircle = (args: Args<'create_circle'>) => call('create_circle', args)
export const createInvite = () => call('create_invite')
export const joinCircle = (args: Args<'join_circle'>) => call('join_circle', args)
export const leaveCircle = () => call('leave_circle')
export const removeMember = (memberId: string) => call('remove_member', { member_id: memberId })
export const setAdmin = (memberId: string) => call('set_admin', { member_id: memberId })
export const setDisplayName = (displayName: string) =>
  call('set_display_name', { display_name: displayName })

// What /join/:code shows before the visitor joins; signed-out visitors can call it.
export type InvitePreview = Returns<'invite_preview'>[number]
export async function invitePreview(code: string): Promise<InvitePreview> {
  const [preview] = await call('invite_preview', { code })
  if (!preview) throw new RpcError('invite_not_found')
  return preview
}

// Tasks and appointments
export const createItem = (args: CreateItemArgs) => call('create_item', args)
export const updateItem = (item: ItemVersion, patch: ItemPatch) =>
  call('update_item', { ...item, patch })
export const assign = (item: ItemVersion, assigneeId: string) =>
  call('assign', { ...item, assignee_id: assigneeId })
export const acceptAssignment = (item: ItemVersion) => call('accept_assignment', item)
export const declineAssignment = (item: ItemVersion) => call('decline_assignment', item)
export const withdrawAssignment = (item: ItemVersion) => call('withdraw_assignment', item)
export const claim = (item: ItemVersion) => call('claim', item)
export const completeItem = (item: ItemVersion) => call('complete_item', item)
export const cancelItem = (item: ItemVersion) => call('cancel_item', item)

// Coverage
export const coverageRemaining = () => call('coverage_remaining')
export const requestCoverage = (item: ItemVersion) => call('request_coverage', item)
export const cancelCoverage = (item: ItemVersion) => call('cancel_coverage', item)
export const acceptCoverage = (item: ItemVersion) => call('accept_coverage', item)

// Updates, notifications and sharing
export const postUpdate = (args: Args<'post_update'>) => call('post_update', args)
export const markNotificationsRead = (notificationId?: number) =>
  call('mark_notifications_read', { notification_id: notificationId })
export const logShare = (itemId: string, shareKind: ItemShareKind) =>
  call('log_share', { item_id: itemId, share_kind: shareKind })

// Push subscriptions (task 1.4). keys holds the browser's p256dh and auth keys.
export type PushKeys = { p256dh: string; auth: string }
export const savePushSubscription = (endpoint: string, keys: PushKeys) =>
  call('save_push_subscription', { endpoint, keys })
export const deletePushSubscription = (endpoint: string) =>
  call('delete_push_subscription', { endpoint })

// Sends a test push to the caller's own devices (temporary, task 1.4).
// Resolves with how many devices it was sent to.
export async function sendTestPush(): Promise<{ sent: number }> {
  const { data, error } = await supabase.functions.invoke<{ sent: number }>('push-test', {
    method: 'POST',
  })
  if (error || !data) throw new RpcError('unknown', {}, error)
  return data
}

// Demo circle ("Try the demo")
export const joinDemoCircle = () => call('join_demo_circle')

// Weekly summary (read-only; ADR-016). weekStart is a yyyy-mm-dd date.
export const weeklySummary = (weekStart: string) =>
  call('weekly_summary', { week_start: weekStart })

// Calendar feed (task 3.4). The caller's secret feed token, created on first
// use, and whether tasks are in the feed as well as appointments.
export type CalendarFeed = Returns<'calendar_feed'>[number]
export async function calendarFeed(): Promise<CalendarFeed> {
  const [feed] = await call('calendar_feed')
  if (!feed) throw new RpcError('unknown')
  return feed
}
export async function setCalendarFeedTasks(enabled: boolean): Promise<CalendarFeed> {
  const [feed] = await call('set_calendar_feed_tasks', { enabled })
  if (!feed) throw new RpcError('unknown')
  return feed
}

// Notification preferences (task 4.5d, US 11.4). One push switch per category;
// a member who never saved any gets the defaults.
export type NotificationPrefs = Returns<'my_notification_prefs'>[number]
export type PrefCategory = keyof NotificationPrefs
async function onePrefsRow(rows: Promise<NotificationPrefs[]>): Promise<NotificationPrefs> {
  const [prefs] = await rows
  if (!prefs) throw new RpcError('unknown')
  return prefs
}
export const notificationPrefs = () => onePrefsRow(call('my_notification_prefs'))
export const setNotificationPref = (category: PrefCategory, enabled: boolean) =>
  onePrefsRow(call('set_notification_pref', { category, enabled }))

// Google Calendar free/busy (task 4.5a, ADR-008). Connecting goes through the
// google-oauth Edge Function; the refresh token never reaches the app.
export const googleCalendarConnected = () => call('google_calendar_connected')
export const disconnectGoogleCalendar = () => call('disconnect_google_calendar')

/**
 * Where to send the member to connect: Google's consent screen, or
 * 'not_configured' until the team's one-time Google setup is done (plan §8.3).
 */
export async function startGoogleConnect(): Promise<{ url: string } | 'not_configured'> {
  const { data, error } = await supabase.functions.invoke<{ url?: string; status?: string }>(
    'google-oauth',
    { method: 'POST', body: { action: 'start' } },
  )
  if (error || !data) throw new RpcError('unknown', {}, error)
  if (data.status === 'not_configured') return 'not_configured'
  if (!data.url) throw new RpcError('unknown')
  return { url: data.url }
}

/** Finishes connecting with the code and state Google sent back. */
export async function finishGoogleConnect(code: string, state: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<{ status?: string }>('google-oauth', {
    method: 'POST',
    body: { action: 'finish', code, state },
  })
  if (error || data?.status !== 'connected') throw new RpcError('unknown', {}, error)
}

export type Availability = 'free' | 'busy' | 'unknown'
export type AvailabilitySlot = { start: string; end: string }

/**
 * Who's free (task 4.5a): each member of the circle as free, busy or unknown
 * for the slot. Only members who connected Google Calendar can be free or busy.
 */
export async function availability(
  circleId: string,
  slot: AvailabilitySlot,
): Promise<Record<string, Availability>> {
  const { data, error } = await supabase.functions.invoke<Record<string, Availability>>('availability', {
    method: 'POST',
    body: { circle_id: circleId, start: slot.start, end: slot.end },
  })
  if (error || !data) throw new RpcError('unknown', {}, error)
  return data
}

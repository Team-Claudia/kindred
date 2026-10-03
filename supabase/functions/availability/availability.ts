// "Who's free?" (task 4.5a, ADR-008): the pure parts of the availability
// function, tested in availability.test.ts.

export type Availability = 'free' | 'busy' | 'unknown'

export type Slot = { start: Date; end: Date }

/** The longest slot anyone can ask about; a sheet only ever asks about one item. */
export const MAX_SLOT_MS = 24 * 60 * 60 * 1000

/** How long a member's answer is kept in memory. Never stored anywhere else. */
export const CACHE_TTL_MS = 5 * 60 * 1000

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function instant(value: unknown): Date | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

/** The request body, or null if it isn't {circle_id, start, end} with start < end. */
export function parseRequest(body: unknown): { circleId: string; slot: Slot } | null {
  if (!body || typeof body !== 'object') return null
  const { circle_id, start, end } = body as Record<string, unknown>
  if (typeof circle_id !== 'string' || !UUID.test(circle_id)) return null
  const from = instant(start)
  const to = instant(end)
  if (!from || !to || to <= from || to.getTime() - from.getTime() > MAX_SLOT_MS) return null
  return { circleId: circle_id.toLowerCase(), slot: { start: from, end: to } }
}

/**
 * Turns Google's freeBusy.query reply for the `primary` calendar into a status.
 * Busy if any busy period overlaps the slot; Free if none does; Unknown if
 * Google reported an error for the calendar or the reply isn't what we asked
 * for. Only the busy times are read: Google sends nothing else.
 */
export function statusFromFreeBusy(reply: unknown, slot: Slot): Availability {
  if (!reply || typeof reply !== 'object') return 'unknown'
  const calendars = (reply as { calendars?: unknown }).calendars
  if (!calendars || typeof calendars !== 'object') return 'unknown'
  const primary = (calendars as Record<string, unknown>).primary
  if (!primary || typeof primary !== 'object') return 'unknown'
  const { busy, errors } = primary as { busy?: unknown; errors?: unknown }
  if (Array.isArray(errors) && errors.length > 0) return 'unknown'
  if (!Array.isArray(busy)) return 'unknown'

  for (const period of busy) {
    if (!period || typeof period !== 'object') return 'unknown'
    const from = instant((period as { start?: unknown }).start)
    const to = instant((period as { end?: unknown }).end)
    if (!from || !to) return 'unknown'
    if (from < slot.end && to > slot.start) return 'busy'
  }
  return 'free'
}

/** freeBusy.query's request body for one member's primary calendar. */
export function freeBusyRequest(slot: Slot): { timeMin: string; timeMax: string; items: { id: string }[] } {
  return { timeMin: slot.start.toISOString(), timeMax: slot.end.toISOString(), items: [{ id: 'primary' }] }
}

/** A small in-memory cache with an expiry per entry. */
export class TtlCache<V> {
  #entries = new Map<string, { value: V; expires: number }>()
  constructor(private readonly maxEntries = 1000) {}

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.#entries.get(key)
    if (!entry) return undefined
    if (entry.expires <= now) {
      this.#entries.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: string, value: V, ttlMs: number, now = Date.now()): void {
    // Oldest first: drop the oldest entry when full.
    if (!this.#entries.has(key) && this.#entries.size >= this.maxEntries) {
      const oldest = this.#entries.keys().next().value
      if (oldest !== undefined) this.#entries.delete(oldest)
    }
    this.#entries.set(key, { value, expires: now + ttlMs })
  }
}

/** The cache key for one member's answer about one slot. */
export function cacheKey(memberId: string, slot: Slot): string {
  return `${memberId}|${slot.start.toISOString()}|${slot.end.toISOString()}`
}

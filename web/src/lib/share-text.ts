import type { TFunction } from 'i18next'
import type { ShareContent } from '@/platform'
import { formatDate, formatTime } from './dates'
import { hasNoTime } from './item-form'
import type { Item } from './items'

// The pre-written messages Kindred puts in the share sheet (task 3.2, PRD
// Epic 9, ADR-011). One builder per kind of share; all share text lives here.
//
// The text lands in a family group chat, so it's plain and short: title, when,
// who, and the link. Builders only ever read the fields in ShareItem, so
// private notes and update text can never leak into a message (US 9.4–9.5).
// Dates and times are in the circle's time zone (BR-09).

/**
 * The kinds of item share, as log_share records them (plan §4.2). Invites
 * aren't items, so they're shared but not logged.
 */
export const ITEM_SHARE_KINDS = ['task', 'appointment', 'assignment_request', 'coverage_request'] as const
export type ItemShareKind = (typeof ITEM_SHARE_KINDS)[number]

/** The only item fields share text may use. */
export type ShareItem = Pick<Item, 'kind' | 'title' | 'starts_at' | 'ends_at' | 'location'>

export interface ShareContext {
  t: TFunction
  /** e.g. 'en-CA' */
  locale: string
  /** The circle's time zone. */
  timeZone: string
  /** The item's link, from platform.appUrl(`/i/${id}`). */
  url: string
}

/**
 * When the item is, in the circle's time zone: "Friday, October 3" for a task
 * with no time, "Friday, October 3 at 5:00 p.m." for one with a time, and
 * "Friday, October 3, 2:00 p.m. – 3:00 p.m." for an appointment with an end.
 */
export function shareWhen(item: ShareItem, { t, locale, timeZone }: Omit<ShareContext, 'url'>): string {
  const date = formatDate(item.starts_at, timeZone, locale)
  if (hasNoTime(item, timeZone)) return date
  const start = formatTime(item.starts_at, timeZone, locale)
  const time =
    item.kind === 'appointment' && item.ends_at
      ? t('share.timeRange', { start, end: formatTime(item.ends_at, timeZone, locale) })
      : start
  return t('share.dateTime', { date, time })
}

/** One fact per line: chat apps keep line breaks, and times end in "p.m." */
function lines(url: string, ...parts: (string | null | undefined)[]): ShareContent {
  return { text: parts.filter(Boolean).join('\n'), url }
}

/** A task (US 9.1): title, due date, who has it or "Needs someone". */
export function taskShare(item: ShareItem, ownerName: string | null, ctx: ShareContext): ShareContent {
  const { t, url } = ctx
  return lines(
    url,
    item.title,
    t('share.due', { when: shareWhen(item, ctx) }),
    ownerName ? t('share.ownerHasIt', { name: ownerName }) : t('share.needsSomeone'),
  )
}

/** An appointment (US 9.4): title, date and time, location, who's taking them. */
export function appointmentShare(item: ShareItem, takerName: string | null, ctx: ShareContext): ShareContent {
  const { t, url } = ctx
  return lines(
    url,
    item.title,
    shareWhen(item, ctx),
    item.location?.trim(),
    takerName ? t('share.taking', { name: takerName }) : t('share.nobodyTaking'),
  )
}

/**
 * An assignment request (US 9.2): asks the person for their answer, e.g.
 * "Jonah, can you take this? Tap to accept or decline.", then what and when.
 * `askedName` is null if they have no name.
 */
export function assignmentRequestShare(
  item: ShareItem,
  askedName: string | null,
  ctx: ShareContext,
): ShareContent {
  const { t, url } = ctx
  return lines(
    url,
    askedName
      ? t('share.assignmentRequest', { name: askedName })
      : t('share.assignmentRequestUnnamed'),
    item.title,
    shareWhen(item, ctx),
  )
}

/**
 * A coverage request (US 9.3): "<Name> needs cover for <title>", when, link.
 * `requesterName` is whoever asked for cover (the owner), or null.
 */
export function coverageRequestShare(
  item: ShareItem,
  requesterName: string | null,
  ctx: ShareContext,
): ShareContent {
  const { t, url } = ctx
  return lines(
    url,
    requesterName
      ? t('share.coverageRequest', { name: requesterName, title: item.title })
      : t('share.coverageRequestUnnamed', { title: item.title }),
    shareWhen(item, ctx),
    t('share.coverageAsk'),
  )
}

/** A Care Circle invite: "Join Dad's Care Circle on Kindred", with the join link. */
export function inviteShare(careRecipientName: string, url: string, t: TFunction): ShareContent {
  return { text: t('share.invite', { name: careRecipientName }), url }
}

/** Who an item's share text names. Each is a display name, or null if none. */
export interface ShareNames {
  /** The confirmed owner (or, for Needs coverage, the person asking for cover). */
  owner: string | null
  /** The person asked, while Awaiting acceptance. */
  asked: string | null
}

/**
 * The share for an item in its current state, or null once it's Completed or
 * Cancelled: Awaiting acceptance shares as an assignment request, Needs
 * coverage as a coverage request, and otherwise as a task or an appointment.
 */
export function itemShare(
  item: ShareItem & Pick<Item, 'state'>,
  names: ShareNames,
  ctx: ShareContext,
): { kind: ItemShareKind; content: ShareContent } | null {
  switch (item.state) {
    case 'awaiting_acceptance':
      return { kind: 'assignment_request', content: assignmentRequestShare(item, names.asked, ctx) }
    case 'needs_coverage':
      return { kind: 'coverage_request', content: coverageRequestShare(item, names.owner, ctx) }
    case 'needs_someone':
    case 'assigned': {
      const owner = item.state === 'assigned' ? names.owner : null
      return item.kind === 'appointment'
        ? { kind: 'appointment', content: appointmentShare(item, owner, ctx) }
        : { kind: 'task', content: taskShare(item, owner, ctx) }
    }
    default:
      return null
  }
}

import { Bell, CalendarDays, CircleCheck, Clock, MessageSquare, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ErrorState, LoadingState } from '@/components/states'
import { TestPushButton } from '@/components/test-push-button'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useMyMembership } from '@/lib/circles'
import { dayKey } from '@/lib/dates'
import { notificationPath } from '@/lib/notifications'
import { useMarkNotificationsRead, useNotifications, type Notification } from '@/lib/queries'
import { formatPostedAt } from '@/lib/updates'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

// Notifications, /notifications (wireframe 29, PRD US 11.6): everything
// Kindred has notified the member about, newest first, whether or not it was
// pushed. Tapping one opens what it's about and marks it read; Mark all read
// clears the lot. The member's notifications channel (lib/live.ts) keeps it
// and the bell on Home current across their phones.

export default function Notifications() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const membership = useMyMembership(userId)
  const notifications = useNotifications(userId)
  const markRead = useMarkNotificationsRead(userId)
  const timeZone = membership.data?.circles?.time_zone
  const now = useNow()

  const anyUnread = notifications.data?.some((notification) => !notification.read_at) ?? false

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-3xl font-bold break-words">{t('notifications.heading')}</h1>
          {anyUnread && (
            <Button variant="ghost" onClick={() => markRead.mutate(undefined)}>
              {t('notifications.markAllRead')}
            </Button>
          )}
        </div>
        <p className="text-muted-foreground">{t('notifications.intro')}</p>
      </header>

      {markRead.isError && (
        <p role="alert" className="text-sm break-words">
          {t('notifications.markError')}
        </p>
      )}

      {notifications.isPending || membership.isPending ? (
        <LoadingState />
      ) : notifications.isError || !timeZone ? (
        <ErrorState
          message={t('notifications.error')}
          onRetry={() => {
            void membership.refetch()
            void notifications.refetch()
          }}
        />
      ) : notifications.data.length === 0 ? (
        <p className="rounded-xl border border-dashed p-4 break-words text-muted-foreground">
          {t('notifications.empty')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {notifications.data.map((notification) => (
            <li key={notification.id}>
              <NotificationRow
                notification={notification}
                timeZone={timeZone}
                today={dayKey(now, timeZone)}
                onOpen={() => {
                  if (!notification.read_at) markRead.mutate(notification.id)
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Temporary (task 1.4): task 4.6 removes it. */}
      <TestPushButton />
    </main>
  )
}

function iconFor(kind: string): LucideIcon {
  if (kind === 'reminder' || kind === 'overdue') return Clock
  if (kind === 'update_posted') return MessageSquare
  if (kind.endsWith('_requested')) return CircleCheck
  if (kind === 'weekly_summary') return Bell
  return CalendarDays
}

function NotificationRow({
  notification,
  timeZone,
  today,
  onOpen,
}: {
  notification: Notification
  timeZone: string
  today: ReturnType<typeof dayKey>
  onOpen: () => void
}) {
  const { t, i18n } = useTranslation()
  const unread = !notification.read_at
  const Icon = iconFor(notification.kind)

  return (
    <Link
      to={notificationPath(notification)}
      onClick={onOpen}
      className="flex min-h-tap items-start gap-3 py-4"
    >
      <span
        aria-hidden
        className={cn(
          'flex size-tap shrink-0 items-center justify-center rounded-lg border bg-muted',
          unread && 'border-2 border-foreground',
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn('break-words', unread ? 'font-semibold' : 'text-muted-foreground')}>
          {notification.line}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {unread && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
              <span aria-hidden className="size-1.5 rounded-full bg-primary-foreground" />
              {t('notifications.unread')}
            </span>
          )}
          <time dateTime={notification.created_at}>
            {formatPostedAt(t, i18n.language, notification.created_at, timeZone, today)}
          </time>
        </span>
      </span>
    </Link>
  )
}

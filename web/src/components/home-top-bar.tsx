import { Bell, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useAuth } from '@/lib/auth'
import { badgeText } from '@/lib/notifications'
import { useUnreadNotificationCount } from '@/lib/queries'

/**
 * Top of Home: the bell opens notifications, the member's initial opens Care
 * Circle and settings. Until profiles are wired up, `name` is left out and a
 * person icon stands in for the initial. The bell shows how many
 * notifications are unread (task 4.5f), kept live by lib/live.ts.
 */
export function HomeTopBar({ name }: { name?: string | null }) {
  const { t } = useTranslation()
  const auth = useAuth()
  const unread = useUnreadNotificationCount(
    auth.status === 'signed_in' ? auth.session.user.id : undefined,
  ).data
  const initial = name?.trim().charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <span className="text-xl font-semibold">{t('common.appName')}</span>
      <div className="flex items-center gap-1">
        <Link
          to="/notifications"
          aria-label={
            unread ? t('shell.notificationsUnread', { count: unread }) : t('shell.notifications')
          }
          className="relative flex size-tap items-center justify-center rounded-full"
        >
          <Bell aria-hidden className="size-6" />
          {!!unread && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-primary-foreground"
            >
              {badgeText(unread)}
            </span>
          )}
        </Link>
        <Link
          to="/circle"
          aria-label={t('shell.circle')}
          className="flex size-tap items-center justify-center rounded-full border border-primary bg-primary font-semibold text-primary-foreground"
        >
          {initial || <UserRound aria-hidden className="size-5" />}
        </Link>
      </div>
    </header>
  )
}

import { Bell, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

/**
 * Top of Home: the bell opens notifications, the member's initial opens Care
 * Circle and settings. Until profiles are wired up, `name` is left out and a
 * person icon stands in for the initial. (The bell's unread dot comes later.)
 */
export function HomeTopBar({ name }: { name?: string | null }) {
  const { t } = useTranslation()
  const initial = name?.trim().charAt(0).toUpperCase()

  return (
    <header className="flex items-center justify-between gap-2 border-b px-4 py-2">
      <span className="text-xl font-semibold">{t('common.appName')}</span>
      <div className="flex items-center gap-1">
        <Link
          to="/notifications"
          aria-label={t('shell.notifications')}
          className="flex size-tap items-center justify-center rounded-full"
        >
          <Bell aria-hidden className="size-6" />
        </Link>
        <Link
          to="/circle"
          aria-label={t('shell.circle')}
          className="flex size-tap items-center justify-center rounded-full border bg-muted font-semibold"
        >
          {initial || <UserRound aria-hidden className="size-5" />}
        </Link>
      </div>
    </header>
  )
}

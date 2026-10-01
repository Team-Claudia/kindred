import { CalendarDays, ChevronLeft, FileText, House, MessageSquare } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', labelKey: 'screens.home', Icon: House },
  { to: '/week', labelKey: 'screens.week', Icon: CalendarDays },
  { to: '/updates', labelKey: 'screens.updates', Icon: MessageSquare },
  { to: '/summary', labelKey: 'screens.summary', Icon: FileText },
] as const

/**
 * The phone-width frame every signed-in screen sits in (a laptop shows it
 * centred). It handles the safe-area insets and scrolls the screen inside it.
 * With `tabs`, it adds the bottom navigation; without, a top bar with Back,
 * for screens opened from Home (Care Circle, notifications, item detail).
 */
export function AppShell({ tabs: withTabs = false }: { tabs?: boolean }) {
  const { t } = useTranslation()

  return (
    <div className="fixed inset-0 flex justify-center bg-muted pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]">
      <div className="flex w-full max-w-md flex-col bg-background md:border-x">
        {!withTabs && <BackBar />}
        <div
          className={cn(
            'flex-1 overflow-y-auto overscroll-contain',
            withTabs && 'pt-[env(safe-area-inset-top)]',
            !withTabs && 'pb-[env(safe-area-inset-bottom)]',
          )}
        >
          <Outlet />
        </div>
        {withTabs && (
          <nav aria-label={t('shell.tabs')} className="border-t pb-[env(safe-area-inset-bottom)]">
            <ul className="grid grid-cols-4">
              {tabs.map(({ to, labelKey, Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-tap flex-col items-center justify-center gap-1 px-1 py-2 text-center text-xs leading-tight break-words',
                        isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
                      )
                    }
                  >
                    <Icon aria-hidden className="size-6 shrink-0" />
                    <span>{t(labelKey)}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  )
}

function BackBar() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()

  // Opened straight from a link or notification, there's no history to go
  // back to (and no browser Back button on the Home Screen), so go Home.
  const goBack = () => (location.key === 'default' ? navigate('/') : navigate(-1))

  return (
    <header className="border-b px-2 pt-[env(safe-area-inset-top)]">
      <Button variant="ghost" size="icon" onClick={() => void goBack()} aria-label={t('shell.back')}>
        <ChevronLeft aria-hidden className="size-6" />
      </Button>
    </header>
  )
}

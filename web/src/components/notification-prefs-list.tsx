import { useTranslation } from 'react-i18next'
import { useAuth } from '@/lib/auth'
import { errorMessage } from '@/lib/errors'
import type { PrefCategory } from '@/lib/api'
import { useNotificationPrefs, useSetNotificationPref } from '@/lib/queries'
import { cn } from '@/lib/utils'

// PRD order (US 11.4). Comments has no UI in the prototype, so it isn't listed.
const CATEGORIES: PrefCategory[] = [
  'requests',
  'reminders',
  'changes',
  'updates',
  'weekly_summary',
  'everything_else',
]

// One push switch per category (task 4.5d). Everything still shows in Kindred;
// these only change what is pushed to the member's phones.
export function NotificationPrefsList() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const prefs = useNotificationPrefs(userId)
  const save = useSetNotificationPref(userId)

  if (prefs.isError) {
    return (
      <div className="flex flex-col gap-2">
        <p role="alert" className="text-sm">
          {t('notificationPrefs.loadError')}
        </p>
        <button
          type="button"
          className="min-h-11 self-start rounded-md border px-4 text-sm font-medium"
          onClick={() => prefs.refetch()}
        >
          {t('common.tryAgain')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-base font-semibold">{t('notificationPrefs.heading')}</h3>
      <ul className="flex flex-col divide-y">
        {CATEGORIES.map((category) => {
          const on = prefs.data?.[category]
          const state = on === undefined ? 'checking' : on ? 'on' : 'off'
          const label = t(`notificationPrefs.category.${category}.label`)
          return (
            <li key={category} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-medium">{label}</p>
                <p className="text-sm text-muted-foreground">
                  {t(`notificationPrefs.category.${category}.includes`)}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on === true}
                aria-label={label}
                disabled={on === undefined || save.isPending}
                onClick={() => save.mutate({ category, enabled: !on })}
                className={cn(
                  'min-h-11 min-w-16 shrink-0 rounded-full px-3 text-sm font-medium disabled:opacity-60',
                  state === 'on'
                    ? 'bg-state-assigned text-state-assigned-foreground'
                    : 'bg-state-completed text-state-completed-foreground',
                )}
              >
                {t(`notificationPrefs.state.${state}`)}
              </button>
            </li>
          )
        })}
      </ul>
      {save.isError && (
        <p role="alert" className="text-sm">
          {errorMessage(save.error)}
        </p>
      )}
      <p className="text-sm text-muted-foreground">{t('notificationPrefs.note')}</p>
    </div>
  )
}

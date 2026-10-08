import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDate } from '@/lib/dates'
import type { OverdueAlert } from '@/lib/overdue-alert'
import { attentionCardClass } from '@/lib/status'
import { cn } from '@/lib/utils'

/**
 * Item detail when an item is overdue (wireframe 28, simplified, task 4.5b):
 * since when, and who the overdue alert told. Ownership doesn't change until
 * someone acts, so the usual actions follow below.
 */
export function OverdueNotice({
  startsAt,
  alert,
  nameOf,
  timeZone,
}: {
  startsAt: string
  alert: OverdueAlert | null
  nameOf: (userId: string) => string
  timeZone: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const told = alert?.told ?? []
  const names = new Intl.ListFormat(locale, { type: 'conjunction' }).format(told.map(nameOf))

  return (
    <section className={cn('flex flex-col gap-2 rounded-xl p-4', attentionCardClass(true))}>
      <h2 className="flex items-center gap-2 font-semibold">
        <Clock aria-hidden className="size-5 shrink-0" />
        {t('overdueAlert.since', { date: formatDate(startsAt, timeZone, locale) })}
      </h2>
      {alert && told.length > 0 && (
        <p>
          {t('overdueAlert.told', {
            count: told.length,
            names,
            date: formatDate(alert.at, timeZone, locale),
          })}
        </p>
      )}
      <p>{t('overdueAlert.body')}</p>
    </section>
  )
}

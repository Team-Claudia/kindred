import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ItemRow } from '@/components/item-row'
import { EmptyState, ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useCircleMembers, useMyMembership } from '@/lib/circles'
import {
  addDays,
  dayKey,
  formatDayLong,
  formatDayShort,
  formatMonth,
  groupByDay,
  isDayKey,
  sameMonth,
  weekOf,
  weekStart,
  weekStartOf,
  type DayKey,
} from '@/lib/dates'
import { countByKind, filterByMember, memberNames } from '@/lib/items'
import { useItemsInRange } from '@/lib/queries'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

// The This week tab (wireframe 12): the circle's tasks and appointments for
// one week, Monday to Sunday in the circle's time zone (BR-09), grouped by
// day. The week and member filter are in the URL (?week=YYYY-MM-DD&member=id),
// so coming back from an item keeps them.

export default function Week() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const membership = useMyMembership(userId)

  if (membership.isPending) return <LoadingState />
  const circle = membership.data?.circles
  if (membership.isError || !circle) {
    return <ErrorState message={t('week.error')} onRetry={() => void membership.refetch()} />
  }
  return <WeekAgenda careRecipient={circle.care_recipient_name} timeZone={circle.time_zone} />
}

function WeekAgenda({ careRecipient, timeZone }: { careRecipient: string; timeZone: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const now = useNow()
  const [params, setParams] = useSearchParams()

  const today = dayKey(now, timeZone)
  const thisWeek = weekStart(now, timeZone)
  const weekParam = params.get('week')
  const monday = isDayKey(weekParam) ? weekStartOf(weekParam) : thisWeek
  const week = useMemo(() => weekOf(monday, timeZone), [monday, timeZone])
  const items = useItemsInRange(week.start.toISOString(), week.end.toISOString())

  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )
  const memberParam = params.get('member')
  const memberId =
    memberParam && (members.isPending || names.has(memberParam)) ? memberParam : null

  const shown = useMemo(
    () => filterByMember(items.data ?? [], memberId),
    [items.data, memberId],
  )
  const days = useMemo(() => groupByDay(shown, timeZone), [shown, timeZone])
  const counts = countByKind(shown)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }
  const goToWeek = (day: DayKey) => update({ week: day === thisWeek ? null : day })

  const sunday = week.days[6]
  const range = t('week.range', {
    start: sameMonth(monday, sunday)
      ? formatDayShort(monday, locale)
      : t('week.dayMonth', { day: formatDayShort(monday, locale), month: formatMonth(monday, locale) }),
    end: t('week.dayMonth', { day: formatDayShort(sunday, locale), month: formatMonth(sunday, locale) }),
  })

  return (
    <>
      <header className="border-b px-4 py-3">
        <p className="text-lg font-semibold break-words">{t('week.careOf', { name: careRecipient })}</p>
      </header>
      <main className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-3xl font-semibold">{t('screens.week')}</h1>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('week.previous')}
                onClick={() => goToWeek(addDays(monday, -7))}
              >
                <ChevronLeft aria-hidden className="size-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('week.next')}
                onClick={() => goToWeek(addDays(monday, 7))}
              >
                <ChevronRight aria-hidden className="size-6" />
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground" aria-live="polite">
            {range}
            {items.isSuccess && (
              <>
                {' · '}
                {t('week.counts', {
                  tasks: t('week.tasks', { count: counts.tasks }),
                  appointments: t('week.appointments', { count: counts.appointments }),
                })}
              </>
            )}
          </p>
          {monday !== thisWeek && (
            <Button variant="link" className="self-start px-0" onClick={() => goToWeek(thisWeek)}>
              {t('week.backToThisWeek')}
            </Button>
          )}
        </div>

        {names.size > 1 && (
          <div role="group" aria-labelledby="week-show" className="flex flex-wrap items-center gap-2">
            <span id="week-show" className="text-sm font-semibold tracking-wider uppercase">
              {t('week.show')}
            </span>
            <FilterChip selected={memberId === null} onClick={() => update({ member: null })}>
              {t('week.everyone')}
            </FilterChip>
            {[...names].map(([id, name]) => (
              <FilterChip key={id} selected={memberId === id} onClick={() => update({ member: id })}>
                {name}
              </FilterChip>
            ))}
          </div>
        )}

        {items.isPending ? (
          <LoadingState />
        ) : items.isError ? (
          <ErrorState message={t('week.error')} onRetry={() => void items.refetch()} />
        ) : days.size === 0 ? (
          <EmptyState
            message={
              memberId
                ? t('week.emptyMember', { name: names.get(memberId) })
                : t('week.empty')
            }
          />
        ) : (
          [...days].map(([day, dayItems]) => {
            const label = formatDayLong(day, locale)
            return (
              <section key={day} aria-labelledby={`day-${day}`} className="flex flex-col gap-3">
                <h2
                  id={`day-${day}`}
                  className="text-sm font-semibold tracking-wider text-muted-foreground uppercase"
                >
                  {day === today ? t('week.today', { day: label }) : label}
                </h2>
                <ul className="flex flex-col gap-3">
                  {dayItems.map((item) => (
                    <li key={item.id}>
                      <ItemRow item={item} names={names} timeZone={timeZone} now={now} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })
        )}
      </main>
    </>
  )
}

function FilterChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'min-h-tap rounded-full border px-4 py-2 leading-tight break-words',
        selected ? 'border-primary bg-primary text-primary-foreground' : 'bg-background',
      )}
    >
      {children}
    </button>
  )
}

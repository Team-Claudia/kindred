import { useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ShareButton } from '@/components/share-button'
import { ErrorState, LoadingState } from '@/components/states'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useCircleMembers, useMyMembership } from '@/lib/circles'
import {
  addDays,
  formatDayMonth,
  formatDayShort,
  formatMonth,
  instantAt,
  isDayKey,
  sameMonth,
  weekRelation,
  weekStart,
  weekStartOf,
  type DayKey,
} from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { memberNames, type Item } from '@/lib/items'
import { useItem, useItemMutation, useWeeklySummary } from '@/lib/queries'
import { weeklySummaryShare } from '@/lib/share-text'
import { useNow } from '@/lib/use-now'
import {
  latestSummaryWeek,
  summarySections,
  summarySentence,
  toSummaryLines,
  type SummaryLine,
} from '@/lib/weekly-summary'
import { platform } from '@/platform'

// The Summary tab, /summary (task 4.5g, wireframe 14, ADR-016, PRD US 10.3):
// what happened in a week (Monday to Sunday in the circle's time zone) and
// what's still open, as fixed sentences built from weekly_summary's lines.
// It opens on the latest summary (ready at 08:00 on Sunday); the week is in
// the URL (?week=YYYY-MM-DD), which the Sunday notification links to.

export default function Summary() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const membership = useMyMembership(userId)

  if (membership.isPending) return <LoadingState />
  const circle = membership.data?.circles
  if (membership.isError || !circle) {
    return <ErrorState message={t('summary.error')} onRetry={() => void membership.refetch()} />
  }
  return <WeeklySummary careRecipient={circle.care_recipient_name} timeZone={circle.time_zone} />
}

function WeeklySummary({ careRecipient, timeZone }: { careRecipient: string; timeZone: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const now = useNow()
  const [params, setParams] = useSearchParams()

  const latest = latestSummaryWeek(now, timeZone)
  const thisWeek = weekStart(now, timeZone)
  const weekParam = params.get('week')
  // Up to this week, which shows what's happened so far.
  const monday =
    isDayKey(weekParam) && weekStartOf(weekParam) <= thisWeek ? weekStartOf(weekParam) : latest
  const goToWeek = (day: DayKey) => {
    const next = new URLSearchParams(params)
    if (day === latest) next.delete('week')
    else next.set('week', day)
    setParams(next, { replace: true })
  }

  const summary = useWeeklySummary(monday)
  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )

  const sunday = addDays(monday, 6)
  const relation = weekRelation(monday, thisWeek)
  const title =
    relation === 'this'
      ? t('week.titleThis')
      : relation === 'last'
        ? t('week.titleLast')
        : t('week.titleOf', { date: formatDayMonth(monday, locale) })
  const range = t('week.range', {
    start: sameMonth(monday, sunday)
      ? formatDayShort(monday, locale)
      : t('week.dayMonth', { day: formatDayShort(monday, locale), month: formatMonth(monday, locale) }),
    end: t('week.dayMonth', { day: formatDayShort(sunday, locale), month: formatMonth(sunday, locale) }),
  })
  const ready = now >= instantAt(sunday, '08:00', timeZone)

  const sections = useMemo(() => {
    const lines = toSummaryLines(summary.data ?? [])
    const ctx = { t, locale, timeZone, names }
    const { happened, open } = summarySections(lines)
    const withSentence = (line: SummaryLine) => ({ line, sentence: summarySentence(line, ctx) })
    return { happened: happened.map(withSentence), open: open.map(withSentence) }
  }, [summary.data, t, locale, timeZone, names])

  const share = weeklySummaryShare(
    {
      heading: t('summary.shareHeading', { name: careRecipient, week: range }),
      happened: sections.happened.map((s) => s.sentence),
      open: sections.open.map((s) => s.sentence),
    },
    platform.appUrl(`/summary?week=${monday}`),
    t,
  )

  return (
    <>
      <header className="border-b px-4 py-3">
        <p className="text-lg font-semibold break-words">{t('week.careOf', { name: careRecipient })}</p>
      </header>
      <main className="flex flex-col gap-6 px-4 py-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{t('summary.title')}</h1>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-muted-foreground" aria-live="polite">
              {t('summary.weekLabel', { title, range })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                aria-label={t('summary.previous')}
                onClick={() => goToWeek(addDays(monday, -7))}
              >
                <ChevronLeft aria-hidden className="size-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t('summary.next')}
                disabled={monday >= thisWeek}
                onClick={() => goToWeek(addDays(monday, 7))}
              >
                <ChevronRight aria-hidden className="size-6" />
              </Button>
            </div>
          </div>
          {!ready && <p className="text-muted-foreground">{t('summary.soFar')}</p>}
          {monday !== latest && (
            <Button variant="link" className="self-start px-0" onClick={() => goToWeek(latest)}>
              {t('summary.backToLatest')}
            </Button>
          )}
        </div>

        {summary.isPending ? (
          <LoadingState />
        ) : summary.isError ? (
          <ErrorState message={t('summary.error')} onRetry={() => void summary.refetch()} />
        ) : (
          <>
            <section
              aria-labelledby="summary-happened"
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground"
            >
              <h2 id="summary-happened" className="text-sm font-semibold">
                {t('summary.happened')}
              </h2>
              {sections.happened.length === 0 ? (
                <p className="text-muted-foreground">{t('summary.happenedEmpty')}</p>
              ) : (
                <ul className="flex list-disc flex-col gap-2 pl-5">
                  {sections.happened.map(({ line, sentence }, i) => (
                    <li key={`${line.kind}-${line.item_id ?? line.person_id ?? 'none'}-${i}`} className="break-words">
                      {sentence}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section
              aria-labelledby="summary-open"
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-card-foreground"
            >
              <h2 id="summary-open" className="text-sm font-semibold">
                {t('summary.stillOpen')}
              </h2>
              {sections.open.length === 0 ? (
                <p className="text-muted-foreground">{t('summary.openEmpty')}</p>
              ) : (
                <ul className="flex flex-col gap-4">
                  {sections.open.map(({ line, sentence }) => (
                    <li key={`${line.kind}-${line.item_id}`} className="flex flex-col gap-2">
                      <p className="break-words">{sentence}</p>
                      {line.item_id &&
                        (line.kind === 'needs_someone' ? (
                          <ClaimButton itemId={line.item_id} title={line.item_title ?? ''} />
                        ) : (
                          <Button variant="outline" className="self-start rounded-full" asChild>
                            <Link
                              to={`/i/${line.item_id}`}
                              aria-label={t('summary.openLabel', { title: line.item_title ?? '' })}
                            >
                              {t('summary.open')}
                            </Link>
                          </Button>
                        ))}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className="rounded-xl bg-muted p-4 break-words">{t('summary.note')}</p>

            <div className="flex flex-col gap-2">
              <ShareButton content={share} label={t('summary.share')} variant="default" size="lg" />
              <p className="text-center text-sm text-muted-foreground">{t('summary.shareHint')}</p>
            </div>
          </>
        )}
      </main>
    </>
  )
}

/** One-tap Claim for an item that needs someone, at its current version. */
function ClaimButton({ itemId, title }: { itemId: string; title: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  // useItem's data is typed never (single() over rows()), so restore the row type.
  const item = (useItem(itemId).data ?? null) as Item | null
  const claim = useItemMutation(api.claim)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        className="self-start rounded-full"
        aria-label={t('summary.claimLabel', { title })}
        disabled={!item || claim.isPending}
        onClick={() => {
          if (!item) return
          setError(null)
          claim.mutate(
            { item_id: itemId, version: item.version },
            {
              onError: (e) => setError(errorMessage(e)),
              onSettled: () =>
                void queryClient.invalidateQueries({ queryKey: ['weekly-summary'] }),
            },
          )
        }}
      >
        {claim.isPending ? t('summary.claiming') : t('summary.claim')}
      </Button>
      {error && (
        <p role="alert" className="text-sm break-words text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

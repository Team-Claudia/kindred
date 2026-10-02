import type { TFunction } from 'i18next'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { HomeTopBar } from '@/components/home-top-bar'
import { InstallGuide } from '@/components/install-guide'
import { ItemRow } from '@/components/item-row'
import { PushPrompt } from '@/components/push-prompt'
import { QuickAdd } from '@/components/quick-add'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { firstName, useCircleMembers, useMyMembership, useProfile } from '@/lib/circles'
import {
  dayKey,
  formatDayLong,
  formatDayShort,
  formatMonth,
  formatTime,
  startOfDay,
  weekOf,
  weekStart,
  type DayKey,
} from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import {
  coverageRequests,
  homeCounts,
  needsSomeone,
  needsYourAnswer,
  relativeDay,
  timeOfDay,
  todayItems,
} from '@/lib/home'
import { useInstallGuide } from '@/lib/install-guide'
import { isOverdue, memberNames } from '@/lib/items'
import {
  useItemCount,
  useItemMutation,
  useItemsInRange,
  useItemsNeedingAttention,
  useLatestUpdate,
  type ItemNeedingAttention,
} from '@/lib/queries'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

// The Home tab (wireframe 11): what needs the member now. The greeting and
// counts, then Needs your answer, Today, Needs someone, Coverage requests and
// the latest update. Sections come from lib/home.ts; the circle's live
// channel (lib/live.ts) keeps them current.

export default function Home() {
  const installGuide = useInstallGuide()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const profile = useProfile(userId)

  // In a Safari tab, ask to add Kindred to the Home Screen first: on iPhone,
  // push only works from there.
  if (installGuide.show) return <InstallGuide onRemindLater={installGuide.remindLater} />

  const name = profile.data?.display_name
  return (
    <>
      <HomeTopBar name={name} />
      {userId && <HomeContent userId={userId} name={firstName(name)} />}
      {/* From the Home Screen, explain notifications before the phone asks (task 1.4). */}
      <PushPrompt />
    </>
  )
}

function HomeContent({ userId, name }: { userId: string; name: string }) {
  const { t } = useTranslation()
  const membership = useMyMembership(userId)

  if (membership.isPending) return <LoadingState />
  const circle = membership.data?.circles
  if (membership.isError || !circle) {
    return <ErrorState message={t('home.error')} onRetry={() => void membership.refetch()} />
  }
  return (
    <HomeSections
      userId={userId}
      name={name}
      careRecipient={circle.care_recipient_name}
      timeZone={circle.time_zone}
    />
  )
}

type Section = 'answer' | 'someone'

function HomeSections({
  userId,
  name,
  careRecipient,
  timeZone,
}: {
  userId: string
  name: string
  careRecipient: string
  timeZone: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const now = useNow()
  const today = dayKey(now, timeZone)

  // This week's items, under the same key as This week, so the counts match.
  // Today is always in this week.
  const monday = weekStart(now, timeZone)
  const week = useMemo(() => weekOf(monday, timeZone), [monday, timeZone])
  const weekItems = useItemsInRange(week.start.toISOString(), week.end.toISOString())
  const attention = useItemsNeedingAttention(startOfDay(today, timeZone).toISOString())
  const latest = useLatestUpdate()
  const itemCount = useItemCount()

  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )

  const [notice, setNotice] = useState<{ section: Section; message: string } | null>(null)
  const report = (section: Section) => (error: unknown) =>
    setNotice({ section, message: errorMessage(error) })

  const open = attention.data ?? []
  const answer = needsYourAnswer(open, userId)
  const todayList = todayItems([...(weekItems.data ?? []), ...open], today, timeZone, now)
  const someone = needsSomeone(open)
  const coverage = coverageRequests(open)
  const counts = homeCounts(weekItems.data ?? [], todayList, now)

  const when = (iso: string, prefix: 'due' | 'at') => formatWhen(t, locale, iso, timeZone, today, prefix)
  const memberCount = members.data?.length
  const update = latest.data
  const author = update?.author_id ? names.get(update.author_id) : undefined

  const loaded = weekItems.isSuccess && attention.isSuccess
  const failed = weekItems.isError || attention.isError
  const brandNew = itemCount.data === 0

  return (
    <main className="flex flex-col gap-8 px-4 py-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl leading-tight font-semibold break-words">
          {name
            ? t('home.greeting', { context: timeOfDay(now, timeZone), name })
            : t('home.greetingNoName', { context: timeOfDay(now, timeZone) })}
        </h1>
        <p className="break-words text-muted-foreground">
          {memberCount
            ? t('home.circleLine', { name: careRecipient, count: memberCount })
            : t('week.careOf', { name: careRecipient })}
        </p>
        {loaded && (
          <ul
            aria-label={t('home.countsLabel')}
            className="mt-2 flex flex-wrap gap-2 rounded-xl bg-muted p-3"
          >
            <CountChip>{t('week.tasks', { count: counts.tasks })}</CountChip>
            <CountChip>{t('week.appointments', { count: counts.appointments })}</CountChip>
            <CountChip overdue={counts.overdue > 0}>
              {t('home.overdue', { count: counts.overdue })}
            </CountChip>
          </ul>
        )}
      </div>

      {failed ? (
        <ErrorState
          message={t('home.error')}
          onRetry={() => {
            void weekItems.refetch()
            void attention.refetch()
          }}
        />
      ) : !loaded ? (
        <LoadingState />
      ) : (
        <>
          {brandNew && (
            <p className="rounded-xl border bg-card p-4 break-words text-card-foreground">
              {t('home.newCircle')}
            </p>
          )}

          <HomeSection id="home-answer" title={t('home.needsAnswer', { count: answer.length })}>
            {notice?.section === 'answer' && <Notice>{notice.message}</Notice>}
            {answer.length === 0 ? (
              <Empty>{t('home.needsAnswerEmpty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {answer.map((item) => (
                  <li key={item.id}>
                    <AnswerCard
                      item={item}
                      askedBy={askedBy(item, names)}
                      when={when(item.starts_at, item.kind === 'task' ? 'due' : 'at')}
                      overdue={isOverdue(item, now)}
                      onStart={() => setNotice(null)}
                      onError={report('answer')}
                    />
                  </li>
                ))}
              </ul>
            )}
          </HomeSection>

          <HomeSection
            id="home-today"
            title={t('home.today', { day: formatDayLong(today, locale) })}
          >
            {todayList.length === 0 ? (
              <Empty>{t('home.todayEmpty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {todayList.map((item) => (
                  <li key={item.id}>
                    <ItemRow item={item} names={names} timeZone={timeZone} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </HomeSection>

          <HomeSection id="home-someone" title={t('home.needsSomeone')}>
            {notice?.section === 'someone' && <Notice>{notice.message}</Notice>}
            {someone.length === 0 ? (
              <Empty>{t('home.needsSomeoneEmpty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {someone.map((item) => (
                  <li key={item.id}>
                    <ClaimCard
                      item={item}
                      when={when(item.starts_at, item.kind === 'task' ? 'due' : 'at')}
                      overdue={isOverdue(item, now)}
                      onStart={() => setNotice(null)}
                      onError={report('someone')}
                    />
                  </li>
                ))}
              </ul>
            )}
          </HomeSection>

          {/* "I can do it" comes with task 3.1; until then each row opens the item. */}
          <HomeSection id="home-coverage" title={t('home.coverage')}>
            {coverage.length === 0 ? (
              <Empty>{t('home.coverageEmpty')}</Empty>
            ) : (
              <ul className="flex flex-col gap-3">
                {coverage.map((item) => (
                  <li key={item.id}>
                    <ItemRow item={item} names={names} timeZone={timeZone} now={now} />
                  </li>
                ))}
              </ul>
            )}
          </HomeSection>
        </>
      )}

      <HomeSection id="home-update" title={t('home.latestUpdate')}>
        {latest.isPending ? (
          <LoadingState />
        ) : latest.isError ? (
          <ErrorState message={t('home.error')} onRetry={() => void latest.refetch()} />
        ) : update ? (
          <Link
            to="/updates"
            className="flex min-h-tap gap-3 rounded-xl border bg-card p-4 text-card-foreground"
          >
            <Avatar name={author} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-lg font-semibold break-words">
                  {author ?? t('item.formerMember')}
                </span>
                <span className="text-sm text-muted-foreground">
                  {when(update.created_at, 'at')}
                </span>
              </span>
              <span className="break-words whitespace-pre-line">{update.body}</span>
            </span>
          </Link>
        ) : (
          <Empty>{t('home.latestUpdateEmpty')}</Empty>
        )}
      </HomeSection>

      <QuickAdd />
    </main>
  )
}

/** "Due Fri 26, 5:00 p.m.", "Today, 2:00 p.m.", in the circle's time zone. */
function formatWhen(
  t: TFunction,
  locale: string,
  iso: string,
  timeZone: string,
  today: DayKey,
  prefix: 'due' | 'at',
) {
  const day = dayKey(iso, timeZone)
  const relative = relativeDay(day, today)
  const short = formatDayShort(day, locale)
  return t(`home.${prefix}`, {
    context: relative === 'week' || relative === 'later' ? undefined : relative,
    day: relative === 'later' ? t('week.dayMonth', { day: short, month: formatMonth(day, locale) }) : short,
    time: formatTime(iso, timeZone, locale),
  })
}

function askedBy(item: ItemNeedingAttention, names: ReadonlyMap<string, string>) {
  const assigner = item.assignment_requests[0]?.assigner_id
  return assigner ? names.get(assigner) : undefined
}

function HomeSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2
        id={id}
        className="text-sm font-semibold tracking-wider break-words text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed p-4 break-words text-muted-foreground">
      {children}
    </p>
  )
}

function Notice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border-2 border-destructive p-4 break-words">
      {children}
    </p>
  )
}

function CountChip({ overdue = false, children }: { overdue?: boolean; children: ReactNode }) {
  return (
    <li
      className={cn(
        'rounded-full border bg-background px-4 py-1.5 leading-tight',
        overdue &&
          'border-2 border-state-overdue-foreground bg-state-overdue font-semibold text-state-overdue-foreground',
      )}
    >
      {children}
    </li>
  )
}

function Avatar({ name, dashed = false }: { name?: string; dashed?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-tap shrink-0 items-center justify-center rounded-full border font-semibold',
        dashed ? 'border-dashed border-muted-foreground' : 'bg-muted',
      )}
    >
      {name?.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

interface ActionCardProps {
  item: ItemNeedingAttention
  when: string
  overdue: boolean
  onStart: () => void
  onError: (error: unknown) => void
}

/** Needs your answer: who asked and when, with Accept and Decline. */
function AnswerCard({ item, askedBy, when, overdue, onStart, onError }: ActionCardProps & { askedBy?: string }) {
  const { t } = useTranslation()
  const accept = useItemMutation(api.acceptAssignment)
  const decline = useItemMutation(api.declineAssignment)
  const busy = accept.isPending || decline.isPending
  const run = (mutation: typeof accept) => {
    onStart()
    mutation.mutate({ item_id: item.id, version: item.version }, { onError })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-foreground bg-card p-4 text-card-foreground">
      <Link to={`/i/${item.id}`} className="flex min-h-tap flex-col gap-1">
        <span className="text-lg leading-snug font-semibold break-words">{item.title}</span>
        <span className="break-words text-muted-foreground">
          {askedBy ? t('home.askedYou', { name: askedBy }) : t('home.askedYouNoName')}
          {' · '}
          {when}
        </span>
        <span className="flex flex-wrap gap-2 pt-1">
          {overdue && <StatusBadge status="overdue" />}
          <StatusBadge status="awaiting_acceptance" />
        </span>
      </Link>
      <div className="grid grid-cols-2 gap-3">
        <Button disabled={busy} onClick={() => run(accept)}>
          {accept.isPending ? t('home.accepting') : t('home.accept')}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run(decline)}>
          {decline.isPending ? t('home.declining') : t('home.decline')}
        </Button>
      </div>
    </div>
  )
}

/** Needs someone: an unclaimed item with I'll do it. */
function ClaimCard({ item, when, overdue, onStart, onError }: ActionCardProps) {
  const { t } = useTranslation()
  const claim = useItemMutation(api.claim)

  return (
    <div className="flex flex-wrap items-start gap-3 rounded-xl border-2 border-foreground bg-card p-4 text-card-foreground">
      <Link to={`/i/${item.id}`} className="flex min-h-tap min-w-0 flex-1 basis-48 gap-3">
        <Avatar dashed />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lg leading-snug font-semibold break-words">{item.title}</span>
          <span className="break-words text-muted-foreground">
            {when}
            {' · '}
            {t('item.nobody')}
          </span>
          <span className="flex flex-wrap gap-2 pt-1">
            {overdue && <StatusBadge status="overdue" />}
            <StatusBadge status="needs_someone" />
          </span>
        </span>
      </Link>
      <Button
        variant="outline"
        className="rounded-full"
        disabled={claim.isPending}
        onClick={() => {
          onStart()
          claim.mutate({ item_id: item.id, version: item.version }, { onError })
        }}
      >
        {claim.isPending ? t('home.claiming') : t('home.claim')}
      </Button>
    </div>
  )
}

import { useQueryClient } from '@tanstack/react-query'
import { Check, MessageSquare } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { AssignSheet } from '@/components/assign-sheet'
import { CoverageSheet, type CoverageStep } from '@/components/coverage-sheet'
import { ItemFormSheet } from '@/components/item-form-sheet'
import { ItemRow } from '@/components/item-row'
import { ShareButton } from '@/components/share-button'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { UpdateCard } from '@/components/update-card'
import { UpdateSheet } from '@/components/update-sheet'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useCircleMembers, useMyMembership } from '@/lib/circles'
import { dayKey, firstOfNextMonth, formatDate, formatMonthDay, formatTime } from '@/lib/dates'
import { errorMessage, RpcError } from '@/lib/errors'
import { currentHolder, isAskedViewer, itemActions, type ItemAction } from '@/lib/item-actions'
import { hasNoTime } from '@/lib/item-form'
import { isOverdue, memberNames, type Item } from '@/lib/items'
import {
  isItemNotFound,
  queryKeys,
  useCoverageRemaining,
  useFollowUps,
  useItem,
  useItemHistory,
  useItemMutation,
  useItemUpdates,
  usePendingRequest,
} from '@/lib/queries'
import { coverageRequestShare, itemShare } from '@/lib/share-text'
import { ASSIGNMENT_STATES, type AssignmentState } from '@/lib/status'
import { useNow } from '@/lib/use-now'
import { platform } from '@/platform'

// Item detail, /i/:itemId (wireframes 21–23): what needs doing, when, who has
// confirmed it or been asked, and one tap for each action this member can
// take now (lib/item-actions.ts). Every change is an RPC; afterwards the item
// is refreshed, so after a typed error the screen shows where it now stands.

export default function ItemScreen() {
  const { t } = useTranslation()
  const { itemId = '' } = useParams()
  const auth = useAuth()
  const viewerId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const membership = useMyMembership(viewerId)
  const item = useItem(itemId)

  if (item.isPending || membership.isPending) return <LoadingState />
  // RLS hides other circles' items, so "not found" and "not yours" look the same.
  if (item.isError && isItemNotFound(item.error)) return <NoAccess />
  const circle = membership.data?.circles
  if (item.isError || membership.isError || !circle || !viewerId) {
    return (
      <ErrorState
        message={t('itemDetail.error')}
        onRetry={() => {
          void item.refetch()
          void membership.refetch()
        }}
      />
    )
  }
  const row: Item | null = item.data
  if (!row) return <NoAccess />
  // Keyed, so opening another item (e.g. a new follow-up) starts fresh.
  return <ItemDetail key={itemId} item={row} viewerId={viewerId} timeZone={circle.time_zone} />
}

function NoAccess() {
  const { t } = useTranslation()
  return (
    <main className="flex flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-semibold">{t('itemDetail.noAccessTitle')}</h1>
      <p className="text-muted-foreground">{t('itemDetail.noAccessBody')}</p>
      <Button asChild size="lg">
        <Link to="/">{t('itemDetail.goHome')}</Link>
      </Button>
    </main>
  )
}

function asState(state: string): AssignmentState {
  return (ASSIGNMENT_STATES as readonly string[]).includes(state)
    ? (state as AssignmentState)
    : 'needs_someone'
}

type AssignAction = Extract<ItemAction, 'ask' | 'askSomeoneElse' | 'reassign'>

function ItemDetail({ item, viewerId, timeZone }: { item: Item; viewerId: string; timeZone: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const now = useNow()
  const queryClient = useQueryClient()
  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )
  const history = useItemHistory(item.id)
  const request = usePendingRequest(item.id)

  const [assigning, setAssigning] = useState<AssignAction | null>(null)
  const [editing, setEditing] = useState(false)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [running, setRunning] = useState<ItemAction | null>(null)
  const [coverageStep, setCoverageStep] = useState<CoverageStep | null>(null)
  const coverageLeft = useCoverageRemaining()
  // Updates and follow-ups (task 4.1).
  const navigate = useNavigate()
  const updates = useItemUpdates(item.id)
  const followUps = useFollowUps(item.id)
  const [addingUpdate, setAddingUpdate] = useState(false)
  const [creatingFollowUp, setCreatingFollowUp] = useState(false)

  // Runs one RPC. The returned row shows straight away; useItemMutation then
  // refetches the item (and its history) whether it worked or not.
  const mutation = useItemMutation((run: () => Promise<Item>) => run())
  const act = (action: ItemAction, run: () => Promise<Item>, after?: () => void) => {
    setError(null)
    setRunning(action)
    mutation.mutate(run, {
      onSuccess: (row) => queryClient.setQueryData(queryKeys.item(item.id), row),
      onError: setError,
      onSettled: () => {
        setRunning(null)
        after?.()
      },
    })
  }

  const state = asState(item.state)
  const kind = item.kind === 'appointment' ? 'appointment' : 'task'
  const isTask = kind === 'task'
  const overdue = isOverdue(item, now)
  const at = { item_id: item.id, version: item.version }
  const actions = itemActions(item, viewerId)
  const asked = isAskedViewer(item, viewerId)

  const nameOf = (userId: string) => {
    const name = names.get(userId) ?? t('item.formerMember')
    return userId === viewerId ? t('itemDetail.nameYou', { name }) : name
  }
  const askedName = item.proposed_assignee_id
    ? item.proposed_assignee_id === viewerId
      ? undefined
      : (names.get(item.proposed_assignee_id) ?? t('item.formerMember'))
    : undefined

  // Who has it: confirmed, asked, or nobody (PRD §7.4).
  const owner =
    state === 'awaiting_acceptance' && item.proposed_assignee_id
      ? asked
        ? t('itemDetail.awaitingYou')
        : t('status.awaitingNamed', { name: askedName })
      : item.owner_id && state !== 'needs_someone'
        ? nameOf(item.owner_id)
        : t('item.nobody')

  // Needs coverage: still the owner's until someone takes it (wireframe 26).
  const ownerLabel =
    state === 'needs_coverage' && item.owner_id
      ? t('coverage.ownerUntilCovered', { name: nameOf(item.owner_id) })
      : owner
  const ownerName = item.owner_id ? names.get(item.owner_id) : undefined

  const date = formatDate(item.starts_at, timeZone, locale)
  const time = formatTime(item.starts_at, timeZone, locale)
  const when = isTask
    ? hasNoTime(item, timeZone)
      ? date
      : t('itemDetail.dateTime', { date, time })
    : t('itemDetail.dateTime', {
        date,
        time: item.ends_at
          ? t('itemDetail.timeRange', { start: time, end: formatTime(item.ends_at, timeZone, locale) })
          : time,
      })

  const completed = [...(history.data ?? [])].reverse().find((event) => event.type === 'completed')
  const asker =
    asked && request.data?.assignee_id === viewerId ? request.data.assigner_id : null

  const assignTitles: Record<AssignAction, string> = {
    ask: t('assignSheet.title'),
    askSomeoneElse: t('assignSheet.title'),
    reassign: t('assignSheet.reassignTitle'),
  }

  const handlers: Record<ItemAction, () => void> = {
    claim: () => act('claim', () => api.claim(at)),
    ask: () => setAssigning('ask'),
    accept: () => act('accept', () => api.acceptAssignment(at)),
    decline: () => act('decline', () => api.declineAssignment(at)),
    withdraw: () => act('withdraw', () => api.withdrawAssignment(at)),
    askSomeoneElse: () => setAssigning('askSomeoneElse'),
    complete: () => act('complete', () => api.completeItem(at)),
    reassign: () => setAssigning('reassign'),
    edit: () => setEditing(true),
    cancel: () => setConfirmingCancel(true),
    requestCoverage: () => setCoverageStep(coverageLeft.data === 0 ? 'limit' : 'confirm'),
    cancelCoverage: () => act('cancelCoverage', () => api.cancelCoverage(at), refreshCoverage),
    acceptCoverage: () => act('acceptCoverage', () => api.acceptCoverage(at)),
  }

  // Share (task 3.2): text for the item's state, with a link back to it. Only
  // open items can be shared; a failed log_share is never shown to the member.
  const shareNameOf = (userId: string | null) =>
    userId ? (names.get(userId) ?? t('item.formerMember')) : null
  const share = itemShare(
    item,
    { owner: shareNameOf(item.owner_id), asked: shareNameOf(item.proposed_assignee_id) },
    { t, locale, timeZone, url: platform.appUrl(`/i/${item.id}`) },
  )


  // Asking for cover is the confirm sheet's second tap. If the allowance ran
  // out meanwhile (e.g. on another phone), the sheet shows the limit instead.
  // If the member closed the sheet while it ran, it stays closed.
  function refreshCoverage() {
    void queryClient.invalidateQueries({ queryKey: queryKeys.coverageRemaining })
  }
  const askForCover = () => {
    setError(null)
    setRunning('requestCoverage')
    mutation.mutate(() => api.requestCoverage(at), {
      onSuccess: (row) => {
        queryClient.setQueryData(queryKeys.item(item.id), row)
        setCoverageStep((step) => step && 'asked')
      },
      onError: (failure) => {
        if (failure instanceof RpcError && failure.code === 'coverage_limit_reached') {
          setCoverageStep((step) => step && 'limit')
        } else {
          setCoverageStep(null)
          setError(failure)
        }
      },
      onSettled: () => {
        setRunning(null)
        refreshCoverage()
      },
    })
  }
  const actionLabel = (action: ItemAction) =>
    action === 'cancel'
      ? t(`itemDetail.actions.cancel_${kind}`)
      : action === 'requestCoverage' && coverageLeft.data !== undefined
        ? t('coverage.needCoverageLeft', { count: coverageLeft.data })
        : t(`itemDetail.actions.${action}`)

  const primary = new Set<ItemAction>(['claim', 'accept', 'complete', 'acceptCoverage'])
  const busy = running !== null

  return (
    <main className="flex flex-col gap-6 px-4 py-6">
      {asked && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-foreground p-4">
          <h2 className="font-semibold tracking-wider uppercase">
            {asker && names.has(asker)
              ? t('itemDetail.askedYou', { name: names.get(asker) })
              : t('itemDetail.askedYouUnknown')}
          </h2>
          <p>{t('itemDetail.askedYouBody')}</p>
        </section>
      )}

      {state === 'needs_coverage' && (
        <section className="flex flex-col gap-2 rounded-xl border-2 border-foreground p-4">
          <h2 className="font-semibold tracking-wider uppercase">
            {item.owner_id === viewerId
              ? t('coverage.youAsked')
              : ownerName
                ? t('coverage.needsCover', { name: ownerName })
                : t('coverage.needsCoverUnknown')}
          </h2>
          <p>{item.owner_id === viewerId ? t('coverage.youAskedBody') : t('coverage.needsCoverBody')}</p>
        </section>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {overdue && <StatusBadge status="overdue" />}
          <StatusBadge status={state} name={asked ? t('itemDetail.you') : askedName} />
          <span className="inline-flex items-center rounded-full border px-3 py-1 text-sm leading-tight">
            {t(`item.kind.${kind}`)}
          </span>
        </div>
        <h1 className="text-3xl font-bold break-words">{item.title}</h1>
      </div>

      <dl className="flex flex-col">
        <Row label={t('itemDetail.owner')}>{ownerLabel}</Row>
        <Row label={t(isTask ? 'itemDetail.due' : 'itemDetail.when')}>{when}</Row>
        {!isTask && item.location && <Row label={t('itemDetail.where')}>{item.location}</Row>}
        <Row label={t('itemDetail.addedBy')}>
          {t('itemDetail.byOn', {
            name: item.created_by ? nameOf(item.created_by) : t('item.formerMember'),
            date: formatDate(item.created_at, timeZone, locale),
          })}
        </Row>
        {state === 'completed' && completed && (
          <Row label={t('itemDetail.completedBy')}>
            {t('itemDetail.byOn', {
              name: completed.actor_id ? nameOf(completed.actor_id) : t('item.formerMember'),
              date: formatDate(completed.at, timeZone, locale),
            })}
          </Row>
        )}
        {item.follow_up_of && <FollowUpOfRow appointmentId={item.follow_up_of} />}
      </dl>

      {item.private_notes && (
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold tracking-wider uppercase">{t('itemDetail.notes')}</h2>
          <p className="break-words whitespace-pre-wrap">{item.private_notes}</p>
        </section>
      )}

      {updates.data && updates.data.length > 0 && (
        <section aria-labelledby="item-updates" className="flex flex-col gap-3">
          <h2 id="item-updates" className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            {t('updates.onItem', { count: updates.data.length })}
          </h2>
          <ul className="flex flex-col gap-3">
            {updates.data.map((update) => (
              <li key={update.id}>
                <UpdateCard
                  update={update}
                  names={names}
                  timeZone={timeZone}
                  today={dayKey(now, timeZone)}
                  showItem={false}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!isTask && followUps.data && followUps.data.length > 0 && (
        <section aria-labelledby="item-follow-ups" className="flex flex-col gap-3">
          <h2 id="item-follow-ups" className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">
            {t('updates.followUps')}
          </h2>
          <ul className="flex flex-col gap-3">
            {followUps.data.map((followUp) => (
              <li key={followUp.id}>
                <ItemRow item={followUp} names={names} timeZone={timeZone} now={now} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label={t('itemDetail.actionsLabel')} className="flex flex-col gap-3">
        {error !== null && (
          <p role="alert" className="rounded-lg border-2 border-destructive p-4 font-semibold">
            {errorMessage(error)}
          </p>
        )}

        {actions.length === 0 && (state === 'completed' || state === 'cancelled') && (
          <p className="text-muted-foreground">{t(`itemDetail.readOnly_${state}`)}</p>
        )}

        {confirmingCancel ? (
          <div role="group" aria-labelledby="cancel-confirm" className="flex flex-col gap-3 rounded-xl border-2 border-destructive p-4">
            <h2 id="cancel-confirm" className="text-lg font-semibold">
              {t(`itemDetail.cancelConfirm_${kind}`)}
            </h2>
            <p>{t('itemDetail.cancelConfirmBody')}</p>
            <Button
              variant="destructive"
              size="lg"
              disabled={busy}
              onClick={() => act('cancel', () => api.cancelItem(at), () => setConfirmingCancel(false))}
            >
              {running === 'cancel' ? t('itemDetail.working') : t('itemDetail.cancelYes')}
            </Button>
            <Button variant="outline" size="lg" autoFocus onClick={() => setConfirmingCancel(false)}>
              {t('itemDetail.cancelNo')}
            </Button>
          </div>
        ) : (
          actions.map((action) => (
            <Button
              key={action}
              size="lg"
              variant={primary.has(action) ? 'default' : action === 'cancel' ? 'ghost' : 'outline'}
              className={action === 'cancel' ? 'text-destructive' : undefined}
              disabled={busy}
              onClick={handlers[action]}
            >
              {(action === 'accept' || action === 'complete' || action === 'acceptCoverage') && (
                <Check aria-hidden className="size-5" />
              )}
              {running === action ? t('itemDetail.working') : actionLabel(action)}
            </Button>
          ))
        )}
        {!confirmingCancel && actions.includes('acceptCoverage') && (
          <p className="text-center text-sm text-muted-foreground">{t('coverage.acceptHint')}</p>
        )}
      </section>

      {/* Wait for names, so the message never says "Former member" by mistake. */}
      {share && members.isSuccess && (
        <ShareButton
          size="lg"
          content={share.content}
          onShared={() => void api.logShare(item.id, share.kind).catch(() => {})}
        />
      )}

      <div className="flex flex-col gap-3">
        <Button size="lg" variant="outline" onClick={() => setAddingUpdate(true)}>
          <MessageSquare aria-hidden className="size-5" />
          {t('updates.addUpdate')}
        </Button>
        {!isTask && (
          <Button size="lg" variant="outline" onClick={() => setCreatingFollowUp(true)}>
            {t('updates.createFollowUp')}
          </Button>
        )}
      </div>

      <UpdateSheet
        open={addingUpdate}
        onOpenChange={setAddingUpdate}
        timeZone={timeZone}
        linkTo={item}
        onPosted={() => setAddingUpdate(false)}
      />

      {creatingFollowUp && (
        <ItemFormSheet
          open
          onOpenChange={(open) => !open && setCreatingFollowUp(false)}
          kind="task"
          followUpOf={{ id: item.id, title: item.title }}
          timeZone={timeZone}
          onSaved={(itemId) => {
            setCreatingFollowUp(false)
            void navigate(`/i/${itemId}`)
          }}
        />
      )}

      <AssignSheet
        open={assigning !== null}
        onOpenChange={(open) => !open && setAssigning(null)}
        title={assigning ? assignTitles[assigning] : ''}
        subtitle={`${item.title} · ${when}`}
        viewerId={viewerId}
        exclude={currentHolder(item)}
        busy={busy}
        onAssign={(memberId) =>
          act(assigning ?? 'ask', () => api.assign(at, memberId), () => setAssigning(null))
        }
      />

      <CoverageSheet
        step={coverageStep}
        onClose={() => setCoverageStep(null)}
        subtitle={`${item.title} · ${when}`}
        remaining={coverageLeft.data}
        resetsOn={formatMonthDay(firstOfNextMonth(now, timeZone), locale)}
        share={coverageRequestShare(item, names.get(viewerId) ?? null, {
          t,
          locale,
          timeZone,
          url: platform.appUrl(`/i/${item.id}`),
        })}
        onShared={() => void api.logShare(item.id, 'coverage_request').catch(() => {})}
        busy={busy}
        onConfirm={askForCover}
        onAskOnePerson={() => {
          setCoverageStep(null)
          setAssigning('reassign')
        }}
      />

      <ItemFormSheet
        open={editing}
        onOpenChange={setEditing}
        item={item}
        timeZone={timeZone}
        onSaved={() => {
          setError(null)
          setEditing(false)
        }}
        onConflict={(conflict) => {
          setEditing(false)
          setError(conflict)
        }}
      />
    </main>
  )
}

// "Follow-up to <appointment>" on a follow-up task, linking back to it.
function FollowUpOfRow({ appointmentId }: { appointmentId: string }) {
  const { t } = useTranslation()
  const appointment = useItem(appointmentId)
  // useItem's data is typed never (single() over rows()), so restore the row type.
  const parent = (appointment.data ?? null) as Item | null
  return (
    <Row label={t('updates.followUpTo')}>
      {parent ? (
        <Link to={`/i/${parent.id}`} className="inline-flex min-h-tap items-center underline">
          {parent.title}
        </Link>
      ) : (
        <span className="text-muted-foreground">
          {appointment.isPending ? t('updates.followUpToLoading') : t('itemDetail.noAccessTitle')}
        </span>
      )}
    </Row>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3">
      <dt className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  )
}

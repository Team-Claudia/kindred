import { useQueryClient } from '@tanstack/react-query'
import { Check } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { AssignSheet } from '@/components/assign-sheet'
import { ItemFormSheet } from '@/components/item-form-sheet'
import { ShareButton } from '@/components/share-button'
import { ErrorState, LoadingState } from '@/components/states'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useCircleMembers, useMyMembership } from '@/lib/circles'
import { formatDate, formatTime } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { currentHolder, isAskedViewer, itemActions, type ItemAction } from '@/lib/item-actions'
import { hasNoTime } from '@/lib/item-form'
import { isOverdue, memberNames, type Item } from '@/lib/items'
import {
  isItemNotFound,
  queryKeys,
  useItem,
  useItemHistory,
  useItemMutation,
  usePendingRequest,
} from '@/lib/queries'
import { itemShare } from '@/lib/share-text'
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
  return <ItemDetail item={row} viewerId={viewerId} timeZone={circle.time_zone} />
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

  const primary = new Set<ItemAction>(['claim', 'accept', 'complete'])
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
        <Row label={t('itemDetail.owner')}>{owner}</Row>
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
      </dl>

      {item.private_notes && (
        <section className="flex flex-col gap-2 rounded-xl border p-4">
          <h2 className="text-sm font-semibold tracking-wider uppercase">{t('itemDetail.notes')}</h2>
          <p className="break-words whitespace-pre-wrap">{item.private_notes}</p>
        </section>
      )}

      {/* Later: linked updates and follow-ups (task 4.1). */}

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
          /* Coverage buttons (task 3.1) go with these. */
          actions.map((action) => (
            <Button
              key={action}
              size="lg"
              variant={primary.has(action) ? 'default' : action === 'cancel' ? 'ghost' : 'outline'}
              className={action === 'cancel' ? 'text-destructive' : undefined}
              disabled={busy}
              onClick={handlers[action]}
            >
              {(action === 'accept' || action === 'complete') && <Check aria-hidden className="size-5" />}
              {running === action
                ? t('itemDetail.working')
                : action === 'cancel'
                  ? t(`itemDetail.actions.cancel_${kind}`)
                  : t(`itemDetail.actions.${action}`)}
            </Button>
          ))
        )}
      </section>

      {share && (
        <ShareButton
          size="lg"
          content={share.content}
          onShared={() => void api.logShare(item.id, share.kind).catch(() => {})}
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-3">
      <dt className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  )
}

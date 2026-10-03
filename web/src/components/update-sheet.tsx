import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useId, useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetClose } from '@/components/sheet'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useCircleMembers } from '@/lib/circles'
import { addDays, dayKey, formatDayShort, startOfDay } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { memberNames } from '@/lib/items'
import { queryKeys, useItemsInRange } from '@/lib/queries'
import { linkChoices, UPDATE_MAX_LENGTH, updateProblem, type LinkableItem } from '@/lib/updates'
import { useNow } from '@/lib/use-now'
import { cn } from '@/lib/utils'

// New update (wireframe 19, PRD US 10.1): free text, optionally linked to one
// recent or upcoming task or appointment, posted with post_update. Everyone
// else in the circle is pushed (generic copy only, ADR-010). Text only: no
// photos or mentions in the prototype.

export function UpdateSheet({
  open,
  onOpenChange,
  timeZone,
  linkTo,
  onPosted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The circle's time zone, for which items count as recent or upcoming. */
  timeZone: string
  /** Pre-link the update to this item (Add update on item detail). */
  linkTo?: LinkableItem | null
  /** Called with the new update's ID once it's posted. */
  onPosted: (updateId: string) => void
}) {
  const { t } = useTranslation()
  const formId = useId()

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={t('updateSheet.title')}
      full
      headerStart={
        <SheetClose asChild>
          <Button variant="ghost">{t('updateSheet.cancel')}</Button>
        </SheetClose>
      }
      headerEnd={
        <Button variant="ghost" type="submit" form={formId} className="font-semibold">
          {t('updateSheet.post')}
        </Button>
      }
    >
      {/* Mounted only while open, so each opening starts blank. */}
      <UpdateForm formId={formId} timeZone={timeZone} linkTo={linkTo ?? null} onPosted={onPosted} />
    </Sheet>
  )
}

function UpdateForm({
  formId,
  timeZone,
  linkTo,
  onPosted,
}: {
  formId: string
  timeZone: string
  linkTo: LinkableItem | null
  onPosted: (updateId: string) => void
}) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const bodyId = useId()
  const auth = useAuth()
  const viewerId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )
  const me = viewerId ? names.get(viewerId) : undefined

  // Recent and upcoming items: from a week ago to a month ahead.
  const now = useNow()
  const today = dayKey(now, timeZone)
  const range = useItemsInRange(
    startOfDay(addDays(today, -7), timeZone).toISOString(),
    startOfDay(addDays(today, 31), timeZone).toISOString(),
  )
  const choices = linkChoices(range.data ?? [], now, linkTo)

  const [body, setBody] = useState('')
  const [itemId, setItemId] = useState<string | null>(linkTo?.id ?? null)
  const [submitted, setSubmitted] = useState(false)
  const problem = updateProblem(body)
  const linked = choices.find((choice) => choice.id === itemId)

  const post = useMutation({
    mutationFn: (args: Parameters<typeof api.postUpdate>[0]) => api.postUpdate(args),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.updates }),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (problem || post.isPending) return
    post.mutate(
      { body: body.trim(), ...(itemId && { item_id: itemId }) },
      { onSuccess: (updateId) => onPosted(updateId) },
    )
  }

  const shownProblem = submitted ? problem : null
  const described = [`${bodyId}-hint`, shownProblem && `${bodyId}-error`].filter(Boolean).join(' ')

  return (
    <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-5">
      <p className="flex items-center gap-3 text-muted-foreground">
        <span
          aria-hidden
          className="flex size-tap shrink-0 items-center justify-center rounded-full border bg-muted font-semibold text-foreground"
        >
          {me?.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <span className="break-words">
          {me ? t('updateSheet.postingAs', { name: me }) : t('updateSheet.postingAsUnknown')}
        </span>
      </p>

      <div className="flex min-w-0 flex-col gap-2">
        <label htmlFor={bodyId} className="text-sm font-semibold tracking-wider uppercase">
          {t('updateSheet.body')}
        </label>
        <textarea
          id={bodyId}
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          aria-invalid={Boolean(shownProblem) || undefined}
          aria-describedby={described}
          className={cn(
            'min-h-tap w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base',
            shownProblem && 'border-2 border-destructive',
          )}
        />
        <p id={`${bodyId}-hint`} className="text-sm text-muted-foreground">
          {t('updateSheet.bodyHint')}
        </p>
        {shownProblem && (
          <p id={`${bodyId}-error`} className="text-sm font-semibold text-destructive">
            {t(`updateSheet.problems.${shownProblem}`, { max: UPDATE_MAX_LENGTH.toLocaleString(i18n.language) })}
          </p>
        )}
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold tracking-wider uppercase">
          {t('updateSheet.linkTo')}
        </legend>
        <div className="flex flex-wrap gap-2">
          {choices.map((choice) => (
            <LinkChip
              key={choice.id}
              name={formId}
              checked={itemId === choice.id}
              onSelect={() => setItemId(choice.id)}
              label={choice.title}
              detail={`${t(`item.kind.${choice.kind === 'appointment' ? 'appointment' : 'task'}`)} · ${formatDayShort(dayKey(choice.starts_at, timeZone), i18n.language)}`}
            />
          ))}
          <LinkChip
            name={formId}
            checked={itemId === null}
            onSelect={() => setItemId(null)}
            label={t('updateSheet.nothing')}
          />
        </div>
        {range.isPending && !linkTo && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('updateSheet.linkLoading')}
          </p>
        )}
      </fieldset>

      <p aria-live="polite" className="rounded-lg bg-muted p-4 text-sm">
        {linked
          ? t('updateSheet.whoIsTold', { context: 'linked', title: linked.title })
          : t('updateSheet.whoIsTold')}
      </p>

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {post.isError && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {errorMessage(post.error)}
          </p>
        )}
        <Button type="submit" size="lg" disabled={post.isPending}>
          {post.isPending ? t('updateSheet.posting') : t('updateSheet.postToUpdates')}
        </Button>
      </div>
    </form>
  )
}

function LinkChip({
  name,
  checked,
  onSelect,
  label,
  detail,
}: {
  name: string
  checked: boolean
  onSelect: () => void
  label: string
  detail?: string
}) {
  return (
    <label
      className={cn(
        'flex min-h-tap max-w-full cursor-pointer flex-col justify-center rounded-full border px-4 py-2 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-ring',
        checked && 'border-2 border-foreground font-semibold',
      )}
    >
      <input type="radio" name={name} checked={checked} onChange={onSelect} className="sr-only" />
      <span className="break-words">{label}</span>
      {detail && <span className="text-sm font-normal break-words text-muted-foreground">{detail}</span>}
    </label>
  )
}

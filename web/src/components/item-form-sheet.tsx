import { useId, useMemo, useState, type ComponentProps, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MemberPicker } from '@/components/member-picker'
import { Sheet, SheetClose } from '@/components/sheet'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { useCircleMembers } from '@/lib/circles'
import { dayKey } from '@/lib/dates'
import { errorMessage, RpcError } from '@/lib/errors'
import {
  createItemArgs,
  itemPatch,
  itemToForm,
  limits,
  needsReconfirm,
  newItemForm,
  validateItemForm,
  type ItemForm,
  type ItemFormField,
} from '@/lib/item-form'
import { memberNames, type Item, type ItemKind } from '@/lib/items'
import { useItemMutation } from '@/lib/queries'
import { cn } from '@/lib/utils'

// The create/edit sheet (wireframes 16 and 18): one form for tasks and
// appointments. Creating goes through create_item; editing sends only what
// changed to update_item at the item's version. Repeat, the map preview and
// who's free are task 4.5.

/** Errors after which an edit is out of date: close and show the latest item. */
const refreshErrors = new Set(['stale_version', 'invalid_state'])

export type ItemFormSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The circle's time zone: dates and times are read in it (BR-09). */
  timeZone: string
  /** Called with the item's ID once it's saved. */
  onSaved: (itemId: string) => void
} & (
  | {
      kind: ItemKind
      item?: undefined
      /** Create it as a follow-up to this appointment (items.follow_up_of, US 10.2). */
      followUpOf?: { id: string; title: string }
    }
  | {
      item: Item
      kind?: undefined
      /** The edit is out of date (stale_version, invalid_state); the sheet closes. */
      onConflict: (error: RpcError) => void
    }
)

export function ItemFormSheet(props: ItemFormSheetProps) {
  const { t } = useTranslation()
  const formId = useId()
  const kind: ItemKind = props.item
    ? props.item.kind === 'appointment'
      ? 'appointment'
      : 'task'
    : props.kind
  const title = props.item
    ? t(kind === 'task' ? 'itemForm.editTask' : 'itemForm.editAppointment')
    : t(kind === 'task' ? 'itemForm.newTask' : 'itemForm.newAppointment')

  return (
    <Sheet
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
      full
      headerStart={
        <SheetClose asChild>
          <Button variant="ghost">{t('itemForm.cancel')}</Button>
        </SheetClose>
      }
      headerEnd={
        <Button variant="ghost" type="submit" form={formId} className="font-semibold">
          {t('itemForm.save')}
        </Button>
      }
    >
      {/* Mounted only while open, so each opening starts from a fresh form. */}
      <ItemFormBody
        item={props.item}
        kind={kind}
        timeZone={props.timeZone}
        formId={formId}
        onSaved={props.onSaved}
        onConflict={props.item ? props.onConflict : undefined}
        followUpOf={props.item ? undefined : props.followUpOf}
      />
    </Sheet>
  )
}

function ItemFormBody({
  item: latest,
  kind,
  timeZone,
  formId,
  onSaved,
  onConflict,
  followUpOf,
}: {
  item: Item | undefined
  kind: ItemKind
  timeZone: string
  formId: string
  onSaved: (itemId: string) => void
  onConflict: ((error: RpcError) => void) | undefined
  followUpOf: { id: string; title: string } | undefined
}) {
  const { t } = useTranslation()
  // The item as it was when the sheet opened. The form is compared with and
  // saved at this version, so if someone else changes it meanwhile (and it's
  // refetched), saving gets stale_version instead of undoing their change.
  const [item] = useState(latest)
  const auth = useAuth()
  const viewerId = auth.status === 'signed_in' ? auth.session.user.id : ''
  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )

  const [form, setForm] = useState<ItemForm>(() =>
    item ? itemToForm(item, timeZone) : newItemForm(kind, dayKey(new Date(), timeZone)),
  )
  const [submitted, setSubmitted] = useState(false)
  const problems = validateItemForm(form)
  const valid = Object.keys(problems).length === 0
  const shownProblems = submitted ? problems : {}
  const patch = item && valid ? itemPatch(form, item, timeZone) : null

  const save = useItemMutation(async (values: ItemForm): Promise<string> => {
    if (!item) {
      return api.createItem({
        ...createItemArgs(values, timeZone),
        ...(followUpOf && { follow_up_of: followUpOf.id }),
      })
    }
    const changes = itemPatch(values, item, timeZone)
    if (Object.keys(changes).length > 0) {
      await api.updateItem({ item_id: item.id, version: item.version }, changes)
    }
    return item.id
  })

  const set = <K extends keyof ItemForm>(key: K, value: ItemForm[K]) =>
    setForm((current) => ({ ...current, [key]: value }))

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!valid || save.isPending) return
    save.mutate(form, {
      onSuccess: (itemId) => onSaved(itemId),
      onError: (error) => {
        if (onConflict && error instanceof RpcError && refreshErrors.has(error.code)) {
          onConflict(error)
        }
      },
    })
  }

  const field = (name: ItemFormField) => {
    const problem = shownProblems[name]
    const max = name === 'title' ? limits.title : name === 'location' ? limits.location : limits.notes
    return {
      invalid: Boolean(problem),
      message: problem ? t(`itemForm.problems.${problem}`, { max }) : undefined,
    }
  }

  const isTask = kind === 'task'
  const ownerName = item?.owner_id ? names.get(item.owner_id) : undefined

  return (
    <form id={formId} noValidate onSubmit={onSubmit} className="flex flex-1 flex-col gap-5">
      {followUpOf && (
        <p className="rounded-lg bg-muted p-4 break-words">
          {t('itemForm.followUpTo', { title: followUpOf.title })}
        </p>
      )}
      <Field
        label={t(isTask ? 'itemForm.taskTitle' : 'itemForm.appointmentTitle')}
        {...field('title')}
      >
        {(fieldProps) => (
          <input
            {...fieldProps}
            type="text"
            autoComplete="off"
            enterKeyHint="next"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
          />
        )}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t(isTask ? 'itemForm.dueDate' : 'itemForm.date')} {...field('date')}>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="date"
              value={form.date}
              onChange={(event) => set('date', event.target.value)}
            />
          )}
        </Field>
        <Field label={t(isTask ? 'itemForm.dueTime' : 'itemForm.startTime')} {...field('time')}>
          {(fieldProps) => (
            <input
              {...fieldProps}
              type="time"
              value={form.time}
              onChange={(event) => set('time', event.target.value)}
            />
          )}
        </Field>
      </div>

      {!isTask && (
        <>
          <Field label={t('itemForm.endTime')} {...field('endTime')}>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="time"
                value={form.endTime}
                onChange={(event) => set('endTime', event.target.value)}
              />
            )}
          </Field>
          <Field label={t('itemForm.location')} {...field('location')}>
            {(fieldProps) => (
              <input
                {...fieldProps}
                type="text"
                autoComplete="off"
                value={form.location}
                onChange={(event) => set('location', event.target.value)}
              />
            )}
          </Field>
        </>
      )}

      <Field label={t('itemForm.notes')} hint={t('itemForm.notesHint')} {...field('notes')}>
        {(fieldProps) => (
          <textarea
            {...fieldProps}
            rows={3}
            value={form.notes}
            onChange={(event) => set('notes', event.target.value)}
          />
        )}
      </Field>

      {/* Assigning is part of creating; an existing item changes hands from its detail screen. */}
      {!item && viewerId && (
        <MemberPicker
          legend={t('itemForm.askSomeone')}
          members={members.data ?? []}
          viewerId={viewerId}
          value={form.assigneeId}
          onChange={(memberId) => set('assigneeId', memberId)}
          allowNobody
        />
      )}

      {item && patch && needsReconfirm(patch, item, viewerId) && ownerName && (
        <p aria-live="polite" className="rounded-lg bg-muted p-4 text-sm">
          {t('itemForm.reconfirm', { name: ownerName })}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-2">
        {submitted && !valid && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {t('itemForm.fixProblems')}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {errorMessage(save.error)}
          </p>
        )}
        <Button type="submit" size="lg" disabled={save.isPending}>
          {save.isPending
            ? t('itemForm.saving')
            : item
              ? t('itemForm.saveChanges')
              : t(isTask ? 'itemForm.addTask' : 'itemForm.addAppointment')}
        </Button>
      </div>
    </form>
  )
}

type FieldProps = Pick<
  ComponentProps<'input'>,
  'id' | 'className' | 'aria-invalid' | 'aria-describedby'
>

function Field({
  label,
  hint,
  invalid,
  message,
  children,
}: {
  label: string
  hint?: string
  invalid: boolean
  message?: string
  children: (props: FieldProps) => ReactNode
}) {
  const id = useId()
  const described = [hint && `${id}-hint`, message && `${id}-error`].filter(Boolean).join(' ')
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold tracking-wider uppercase">
        {label}
      </label>
      {children({
        id,
        'aria-invalid': invalid || undefined,
        'aria-describedby': described || undefined,
        className: cn(
          'min-h-tap w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base',
          invalid && 'border-2 border-destructive',
        ),
      })}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="text-sm font-semibold text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

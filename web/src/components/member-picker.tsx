import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { Availability, AvailabilitySlot } from '@/lib/api'
import { firstName, relationshipLabel, useMyMembership, type CircleMember } from '@/lib/circles'
import { useAvailability } from '@/lib/queries'
import { cn } from '@/lib/utils'

// "Ask someone to do it" (wireframes 16, 18 and 20): one row per member with
// their relationship, and optionally Nobody yet. Given a `slot`, each member
// also shows Free, Busy or Unknown from Google Calendar (task 4.5a). It's
// only a hint: anyone can still be chosen.

export function MemberPicker({
  legend,
  members,
  viewerId,
  value,
  onChange,
  allowNobody = false,
  exclude,
  slot = null,
}: {
  legend: string
  members: readonly CircleMember[]
  viewerId: string
  value: string | null
  onChange: (memberId: string | null) => void
  /** Offer "Nobody yet" (the create sheet). */
  allowNobody?: boolean
  /** A member who can't be picked, e.g. who the item already belongs to. */
  exclude?: string | null
  /** When the item happens, to show who's free; null for no time (e.g. a task due any time that day). */
  slot?: AvailabilitySlot | null
}) {
  const { t } = useTranslation()
  const group = useId()
  // For "Dad's child" under each name; already loaded by the screens that open this.
  const circle = useMyMembership(viewerId).data?.circles
  const recipientName = circle?.care_recipient_name
  const availability = useAvailability(circle?.id, slot)
  const shown = members.filter((member) => member.user_id !== exclude)

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {slot && <p className="text-sm text-muted-foreground">{t('availability.note')}</p>}
      {shown.map((member) => {
        const name = memberName(t, member, viewerId)
        return (
          <PickerRow
            key={member.user_id}
            group={group}
            checked={value === member.user_id}
            onSelect={() => onChange(member.user_id)}
            initial={name.charAt(0).toUpperCase() || '?'}
            label={name}
            detail={relationshipLabel(t, member.relationship, recipientName)}
            availability={
              !slot
                ? undefined
                : availability.isPending
                  ? 'checking'
                  : (availability.data?.[member.user_id] ?? 'unknown')
            }
          />
        )
      })}
      {allowNobody && (
        <PickerRow
          group={group}
          checked={value === null}
          onSelect={() => onChange(null)}
          initial="?"
          dashed
          label={t('itemForm.nobodyYet')}
          detail={t('itemForm.nobodyYetDetail')}
        />
      )}
      {/* What the choice means (PRD §7.3: nobody is responsible until they agree). */}
      {(value !== null || allowNobody) && (
        <p aria-live="polite" className="mt-2 rounded-lg bg-muted p-4 text-sm">
          {value === null
            ? t('itemForm.explainNobody')
            : value === viewerId
              ? t('itemForm.explainSelf')
              : t('itemForm.explainOther', {
                  name: firstNameOf(t, members.find((member) => member.user_id === value)),
                })}
        </p>
      )}
    </fieldset>
  )
}

function PickerRow({
  group,
  checked,
  onSelect,
  initial,
  label,
  detail,
  dashed = false,
  availability,
}: {
  group: string
  checked: boolean
  onSelect: () => void
  initial: string
  label: string
  detail?: string | null
  dashed?: boolean
  availability?: Availability | 'checking'
}) {
  return (
    <label
      className={cn(
        'flex min-h-tap cursor-pointer items-center gap-3 rounded-xl border p-3',
        checked && 'border-2 border-primary',
      )}
    >
      <input
        type="radio"
        name={group}
        checked={checked}
        onChange={onSelect}
        className="size-5 shrink-0 accent-foreground"
      />
      <span
        aria-hidden
        className={cn(
          'flex size-tap shrink-0 items-center justify-center rounded-full border font-semibold',
          dashed ? 'border-dashed border-muted-foreground' : 'bg-muted',
        )}
      >
        {initial}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold break-words">{label}</span>
        {detail && <span className="text-sm break-words text-muted-foreground">{detail}</span>}
      </span>
      {availability && <AvailabilityBadge availability={availability} />}
    </label>
  )
}

// Full class names, so Tailwind finds them. Colours are the availability
// token pairs in tokens.css; the word is always shown too.
const availabilityStyles: Record<Availability | 'checking', string> = {
  free: 'bg-availability-free text-availability-free-foreground',
  busy: 'bg-availability-busy text-availability-busy-foreground',
  unknown: 'bg-availability-unknown text-availability-unknown-foreground',
  checking: 'text-muted-foreground',
}

function AvailabilityBadge({ availability }: { availability: Availability | 'checking' }) {
  const { t } = useTranslation()
  return (
    <span
      data-availability={availability}
      className={cn(
        'ml-auto shrink-0 rounded-full px-3 py-1 text-sm font-medium leading-tight',
        availabilityStyles[availability],
      )}
    >
      {t(`availability.${availability}`)}
    </span>
  )
}

type T = ReturnType<typeof useTranslation>['t']

function firstNameOf(t: T, member: CircleMember | undefined): string {
  return firstName(member?.profiles?.display_name) || t('circleSetup.unnamedMember')
}

/** A member's first name, with "(you)" for the viewer. */
function memberName(t: T, member: CircleMember, viewerId: string): string {
  const name = firstNameOf(t, member)
  return member.user_id === viewerId ? t('itemForm.you', { name }) : name
}

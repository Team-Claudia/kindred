import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MemberPicker } from '@/components/member-picker'
import { Sheet, SheetClose } from '@/components/sheet'
import { Button } from '@/components/ui/button'
import type { AvailabilitySlot } from '@/lib/api'
import { useCircleMembers } from '@/lib/circles'
import { memberNames } from '@/lib/items'

/**
 * "Ask someone to do this" (wireframe 20): pick a member for Ask someone, Ask
 * someone else or Reassign, with who's free at `slot` (task 4.5a). Picking
 * yourself takes it straight away (BR-03). `exclude` is whoever already has it.
 */
export function AssignSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  viewerId,
  exclude,
  slot = null,
  busy,
  onAssign,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** What's being assigned, e.g. "Physio ride · Friday, September 26, 9:30 a.m." */
  subtitle: string
  viewerId: string
  exclude: string | null
  /** When the item happens, for Free / Busy / Unknown; null if it has no time. */
  slot?: AvailabilitySlot | null
  busy: boolean
  onAssign: (memberId: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description={subtitle}>
      {/* Mounted only while open, so each opening starts with nobody picked. */}
      <AssignBody viewerId={viewerId} exclude={exclude} slot={slot} busy={busy} onAssign={onAssign} />
    </Sheet>
  )
}

function AssignBody({
  viewerId,
  exclude,
  slot,
  busy,
  onAssign,
}: {
  viewerId: string
  exclude: string | null
  slot: AvailabilitySlot | null
  busy: boolean
  onAssign: (memberId: string) => void
}) {
  const { t } = useTranslation()
  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )
  const [picked, setPicked] = useState<string | null>(null)
  const choices = (members.data ?? []).filter((member) => member.user_id !== exclude)
  const pickedName = picked ? names.get(picked) : undefined

  return (
    <>
      {members.isSuccess && choices.length === 0 ? (
        <p className="text-muted-foreground">{t('assignSheet.nobodyElse')}</p>
      ) : (
        <MemberPicker
          legend={t('assignSheet.choose')}
          members={members.data ?? []}
          viewerId={viewerId}
          value={picked}
          onChange={setPicked}
          exclude={exclude}
          slot={slot}
        />
      )}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <SheetClose asChild>
          <Button variant="outline" size="lg">
            {t('assignSheet.cancel')}
          </Button>
        </SheetClose>
        <Button
          size="lg"
          className="h-auto min-h-12 py-2 whitespace-normal"
          disabled={!picked || busy}
          onClick={() => picked && onAssign(picked)}
        >
          {picked === viewerId
            ? t('assignSheet.takeIt')
            : pickedName
              ? t('assignSheet.askName', { name: pickedName })
              : t('assignSheet.choose')}
        </Button>
      </div>
    </>
  )
}

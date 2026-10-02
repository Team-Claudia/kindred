import { CalendarDays, MessageSquare, Plus, SquareCheck, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ItemFormSheet } from '@/components/item-form-sheet'
import { Sheet, SheetClose } from '@/components/sheet'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useMyMembership } from '@/lib/circles'
import type { ItemKind } from '@/lib/items'
import { cn } from '@/lib/utils'

/**
 * Quick add (wireframe 15): a button that stays at the bottom of Home and
 * opens "What do you want to add?", then the create sheet for a task or an
 * appointment. Once saved, the new item opens so its status is clear.
 * "Update or note" is task 4.1.
 */
export function QuickAdd() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const auth = useAuth()
  const membership = useMyMembership(auth.status === 'signed_in' ? auth.session.user.id : undefined)
  const circle = membership.data?.circles
  const [choosing, setChoosing] = useState(false)
  const [kind, setKind] = useState<ItemKind | null>(null)

  // The circle's time zone is needed to read dates, so wait for it.
  if (!circle) return null

  const choose = (chosen: ItemKind) => {
    setChoosing(false)
    setKind(chosen)
  }

  return (
    <>
      <div className="pointer-events-none sticky bottom-0 bg-linear-to-t from-background via-background px-4 pt-4 pb-4">
        <Button size="lg" className="pointer-events-auto w-full text-base" onClick={() => setChoosing(true)}>
          <Plus aria-hidden className="size-5" />
          {t('quickAdd.button')}
        </Button>
      </div>

      <Sheet
        open={choosing}
        onOpenChange={setChoosing}
        title={t('quickAdd.title')}
        description={t('quickAdd.intro', { name: circle.care_recipient_name })}
      >
        <KindOption
          Icon={SquareCheck}
          title={t('quickAdd.taskTitle')}
          detail={t('quickAdd.taskDetail')}
          onClick={() => choose('task')}
        />
        <KindOption
          Icon={CalendarDays}
          title={t('quickAdd.appointmentTitle')}
          detail={t('quickAdd.appointmentDetail')}
          onClick={() => choose('appointment')}
        />
        <KindOption
          Icon={MessageSquare}
          title={t('quickAdd.updateTitle')}
          detail={t('quickAdd.updateDetail')}
          disabled
        />
        <SheetClose asChild>
          <Button variant="outline" size="lg">
            {t('quickAdd.cancel')}
          </Button>
        </SheetClose>
      </Sheet>

      {kind && (
        <ItemFormSheet
          open
          onOpenChange={(open) => !open && setKind(null)}
          kind={kind}
          timeZone={circle.time_zone}
          onSaved={(itemId) => {
            setKind(null)
            void navigate(`/i/${itemId}`)
          }}
        />
      )}
    </>
  )
}

function KindOption({
  Icon,
  title,
  detail,
  onClick,
  disabled = false,
}: {
  Icon: LucideIcon
  title: string
  detail: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-tap items-center gap-4 rounded-xl border p-4 text-left',
        disabled && 'opacity-60',
      )}
    >
      <span
        aria-hidden
        className="flex size-tap shrink-0 items-center justify-center rounded-lg border bg-muted"
      >
        <Icon className="size-5" />
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-lg font-semibold break-words">{title}</span>
        <span className="break-words text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}

import { MessageSquare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ItemFormSheet } from '@/components/item-form-sheet'
import { ErrorState, LoadingState } from '@/components/states'
import { UpdateCard } from '@/components/update-card'
import { UpdateSheet } from '@/components/update-sheet'
import { useAuth } from '@/lib/auth'
import { useCircleMembers, useMyMembership } from '@/lib/circles'
import { dayKey } from '@/lib/dates'
import { memberNames } from '@/lib/items'
import { useUpdates } from '@/lib/queries'
import { useNow } from '@/lib/use-now'

// Updates, /updates (wireframe 13, PRD Epic 10): the circle's updates, newest
// first, each with its author, when, the text and the linked item. Not a
// chat: the family's messaging app stays the place to talk things over. The
// circle's live channel refreshes ['updates'] when anyone posts.

export default function Updates() {
  const { t } = useTranslation()
  const auth = useAuth()
  const membership = useMyMembership(auth.status === 'signed_in' ? auth.session.user.id : undefined)
  const circle = membership.data?.circles
  const updates = useUpdates()
  const members = useCircleMembers()
  const names = useMemo(
    () => memberNames(members.data ?? [], t('circleSetup.unnamedMember')),
    [members.data, t],
  )
  const now = useNow()
  const navigate = useNavigate()
  const [posting, setPosting] = useState(false)
  const [followUpOf, setFollowUpOf] = useState<{ id: string; title: string } | null>(null)

  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold">{t('screens.updates')}</h1>
        <p className="text-muted-foreground">{t('updates.intro')}</p>
      </header>

      {membership.isPending || updates.isPending ? (
        <LoadingState />
      ) : !circle || membership.isError || updates.isError ? (
        <ErrorState
          message={t('updates.error')}
          onRetry={() => {
            void membership.refetch()
            void updates.refetch()
          }}
        />
      ) : (
        <>
          <button
            type="button"
            onClick={() => setPosting(true)}
            className="flex min-h-tap items-center gap-3 rounded-xl border px-4 py-3 text-left text-muted-foreground"
          >
            <MessageSquare aria-hidden className="size-5 shrink-0" />
            <span className="break-words">{t('updates.share')}</span>
          </button>

          {updates.data.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 break-words text-muted-foreground">
              {t('updates.empty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {updates.data.map((update) => (
                <li key={update.id}>
                  <UpdateCard
                    update={update}
                    names={names}
                    timeZone={circle.time_zone}
                    today={dayKey(now, circle.time_zone)}
                    onFollowUp={setFollowUpOf}
                  />
                </li>
              ))}
            </ul>
          )}

          <UpdateSheet
            open={posting}
            onOpenChange={setPosting}
            timeZone={circle.time_zone}
            onPosted={() => setPosting(false)}
          />

          {followUpOf && (
            <ItemFormSheet
              open
              onOpenChange={(open) => !open && setFollowUpOf(null)}
              kind="task"
              followUpOf={followUpOf}
              timeZone={circle.time_zone}
              onSaved={(itemId) => {
                setFollowUpOf(null)
                void navigate(`/i/${itemId}`)
              }}
            />
          )}
        </>
      )}
    </main>
  )
}

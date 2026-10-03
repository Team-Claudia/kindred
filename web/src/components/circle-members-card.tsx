import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MemberRow } from '@/components/member-list'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { circleKeys, firstName, useCircleMembers, type CircleMember } from '@/lib/circles'
import { errorMessage } from '@/lib/errors'
import { queryKeys } from '@/lib/queries'

// The member list on Care Circle and settings (task 4.3, US 2.2). Everyone
// sees it; admins also get Make admin and Remove on other members.
export function CircleMembersCard({
  viewerId,
  isAdmin,
  recipientName,
}: {
  viewerId: string
  isAdmin: boolean
  recipientName: string | undefined
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const members = useCircleMembers()
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: circleKeys.members }),
      queryClient.invalidateQueries({ queryKey: queryKeys.members }),
      // A removed member's items go back to the circle.
      queryClient.invalidateQueries({ queryKey: queryKeys.items }),
    ])
  const promote = useMutation({ mutationFn: api.setAdmin, onSettled: refresh })
  const remove = useMutation({
    mutationFn: api.removeMember,
    onSuccess: () => setConfirmRemove(null),
    onSettled: refresh,
  })
  const busy = promote.isPending || remove.isPending
  const actionError = promote.error ?? remove.error

  const list = members.data ?? []

  function adminActions(member: CircleMember) {
    if (!isAdmin || member.user_id === viewerId) return null
    const name = firstName(member.profiles?.display_name) || t('circleSetup.unnamedMember')

    if (confirmRemove === member.user_id) {
      return (
        <div className="flex flex-col gap-3 rounded-lg bg-muted p-4" role="group" aria-labelledby={`remove-${member.user_id}`}>
          <p id={`remove-${member.user_id}`} className="font-semibold">
            {t('circle.removeConfirm', { name })}
          </p>
          <p className="text-sm text-muted-foreground">{t('circle.removeExplainer')}</p>
          <Button variant="destructive" disabled={busy} onClick={() => remove.mutate(member.user_id)}>
            {remove.isPending ? t('circle.working') : t('circle.removeYes')}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => setConfirmRemove(null)}>
            {t('circle.removeNo', { name })}
          </Button>
        </div>
      )
    }

    return (
      <div className="flex flex-wrap gap-2 pl-16">
        {member.role !== 'admin' && (
          <Button
            variant="outline"
            disabled={busy}
            aria-label={t('circle.makeAdminNamed', { name })}
            onClick={() => promote.mutate(member.user_id)}
          >
            {t('circle.makeAdmin')}
          </Button>
        )}
        <Button
          variant="outline"
          disabled={busy}
          aria-label={t('circle.removeNamed', { name })}
          onClick={() => {
            remove.reset()
            setConfirmRemove(member.user_id)
          }}
        >
          {t('circle.remove')}
        </Button>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-1" aria-labelledby="members-heading">
      <h2
        id="members-heading"
        className="font-mono text-sm font-medium tracking-wider text-muted-foreground uppercase"
      >
        {t('circle.members', { count: list.length })}
      </h2>
      {members.isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm">
            {t('circle.membersError')}
          </p>
          <Button variant="outline" onClick={() => void members.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </div>
      ) : (
        <ul className="divide-y">
          {list.map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              viewerId={viewerId}
              recipientName={recipientName}
            >
              {adminActions(member)}
            </MemberRow>
          ))}
        </ul>
      )}
      {actionError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errorMessage(actionError)}
        </p>
      )}
    </section>
  )
}

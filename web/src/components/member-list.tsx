import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Avatar } from '@/components/circle-setup'
import { memberDisplayName, relationshipLabel, type CircleMember } from '@/lib/circles'

// One row of a Care Circle member list: initial, full name, how they relate to
// the care recipient ("Dad's child", task 4.9) and a You / Admin badge. Used by
// the invite step of setup (wireframe 06) and Care Circle and settings
// (wireframe 30), which adds admin actions underneath.

export function MemberRow({
  member,
  viewerId,
  recipientName,
  otherBadge = 'member',
  children,
}: {
  member: CircleMember
  viewerId: string
  recipientName: string | undefined
  /** What a non-admin who isn't you is labelled: "Member", or "Joined" while inviting. */
  otherBadge?: 'member' | 'joined'
  /** Actions on this member, e.g. Make admin and Remove. */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const name = memberDisplayName(t, member)
  const relation = relationshipLabel(t, member.relationship, recipientName)
  const isMe = member.user_id === viewerId
  const isAdmin = member.role === 'admin'
  const badge = isMe
    ? isAdmin
      ? t('circleSetup.youAdmin')
      : t('circleSetup.you')
    : isAdmin
      ? t('circleSetup.admin')
      : t(`circleSetup.${otherBadge}`)

  return (
    <li className="flex flex-col gap-3 py-3">
      <div className="flex items-center gap-4">
        <Avatar name={name} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold break-words">{name}</span>
          {relation && <span className="text-sm break-words text-muted-foreground">{relation}</span>}
        </div>
        <span className="shrink-0 rounded-full border px-3 py-1 text-sm">{badge}</span>
      </div>
      {children}
    </li>
  )
}

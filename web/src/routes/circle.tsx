import { useTranslation } from 'react-i18next'
import { AccountCard } from '@/components/account-card'
import { CalendarFeedCard } from '@/components/calendar-feed-card'
import { CircleMembersCard } from '@/components/circle-members-card'
import { GoogleCalendarCard } from '@/components/google-calendar-card'
import { InviteCard } from '@/components/invite-card'
import { LegalLinks } from '@/components/legal'
import { PushSettingsCard } from '@/components/push-settings-card'
import { useAuth } from '@/lib/auth'
import { useMyMembership } from '@/lib/circles'

// Care Circle and settings (task 4.3, wireframe 30), opened from your initial
// at the top of Home. One section per part of the wireframe, top to bottom;
// anything not built yet is left out rather than shown disabled.
export default function Circle() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const membership = useMyMembership(userId)
  const circle = membership.data?.circles
  const recipientName = circle?.care_recipient_name

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <h1 className="text-3xl font-semibold">
        {recipientName ? t('circle.title', { name: recipientName }) : t('screens.circle')}
      </h1>

      {/* Members, and admin actions on them */}
      {userId && (
        <CircleMembersCard
          viewerId={userId}
          isAdmin={membership.data?.role === 'admin'}
          recipientName={recipientName}
        />
      )}

      {/* Invite someone */}
      {circle && <InviteCard circleId={circle.id} recipientName={circle.care_recipient_name} />}

      {/* Your calendar: the feed out, and free/busy in from Google (task 4.5a). */}
      <CalendarFeedCard />
      <GoogleCalendarCard />

      {/* Notifications on this phone. Per-category switches are Tier 2. */}
      <PushSettingsCard />

      {/* Your account: name, leave, sign out. Export and Delete account are Tier 2. */}
      <AccountCard />

      <LegalLinks />
    </main>
  )
}

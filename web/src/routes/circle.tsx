import { useTranslation } from 'react-i18next'
import { AccountCard } from '@/components/account-card'
import { CalendarFeedCard } from '@/components/calendar-feed-card'
import { CircleMembersCard } from '@/components/circle-members-card'
import { DemoBanner } from '@/components/demo-banner'
import { GoogleCalendarCard } from '@/components/google-calendar-card'
import { InviteCard } from '@/components/invite-card'
import { LegalLinks } from '@/components/legal'
import { PushSettingsCard } from '@/components/push-settings-card'
import { isAnonymous, useAuth } from '@/lib/auth'
import { useMyMembership } from '@/lib/circles'

// Care Circle and settings (task 4.3, wireframe 30), opened from your initial
// at the top of Home. One section per part of the wireframe, top to bottom;
// anything not built yet is left out rather than shown disabled.
//
// Try the demo guests (task 4.2) can't invite anyone, get a calendar feed or
// leave the sample circle; their way out is Sign in for real.
export default function Circle() {
  const { t } = useTranslation()
  const auth = useAuth()
  const guest = isAnonymous(auth)
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

      {/* Try the demo guests: Sign in for real, in place of invite and account */}
      {guest && <DemoBanner />}

      {/* Invite someone */}
      {circle && !guest && <InviteCard circleId={circle.id} recipientName={circle.care_recipient_name} />}

      {/* Your calendar: the feed out, and free/busy in from Google (task 4.5a). Hidden for demo guests. */}
      {!guest && <CalendarFeedCard />}
      {!guest && <GoogleCalendarCard />}

      {/* Notifications on this phone. Per-category switches are Tier 2. */}
      <PushSettingsCard />

      {/* Your account: name, leave, sign out. Export and Delete account are Tier 2. */}
      {!guest && <AccountCard />}

      <LegalLinks />
    </main>
  )
}

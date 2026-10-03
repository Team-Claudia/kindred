import { AccountCard } from '@/components/account-card'
import { CalendarFeedCard } from '@/components/calendar-feed-card'
import { DemoBanner } from '@/components/demo-banner'
import { PlaceholderScreen } from '@/components/placeholder-screen'
import { isAnonymous, useAuth } from '@/lib/auth'

// Task 4.3 builds the rest of Care Circle and settings around the calendar
// feed and the account card (leave, sign out). Try the demo guests can't
// leave the sample circle or get a calendar feed; their way out is Sign in for
// real (task 4.2).
export default function Circle() {
  const guest = isAnonymous(useAuth())
  return (
    <PlaceholderScreen titleKey="screens.circle">
      {guest ? (
        <DemoBanner />
      ) : (
        <>
          <CalendarFeedCard />
          <AccountCard />
        </>
      )}
    </PlaceholderScreen>
  )
}

import { AccountCard } from '@/components/account-card'
import { CalendarFeedCard } from '@/components/calendar-feed-card'
import { PlaceholderScreen } from '@/components/placeholder-screen'

// Task 4.3 builds the rest of Care Circle and settings around the calendar
// feed and the account card (leave, sign out).
export default function Circle() {
  return (
    <PlaceholderScreen titleKey="screens.circle">
      <CalendarFeedCard />
      <AccountCard />
    </PlaceholderScreen>
  )
}

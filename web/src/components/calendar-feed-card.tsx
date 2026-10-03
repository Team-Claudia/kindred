import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth'
import { useCalendarFeed, useSetCalendarFeedTasks } from '@/lib/queries'
import { platform } from '@/platform'

/** The member's secret feed URL, served by the calendar-feed function via the Vercel rewrite. */
function calendarFeedUrl(token: string): string {
  return platform.appUrl(`/cal/${token}.ics`)
}

type CopyStatus = 'idle' | 'copied' | 'failed'

// "Add Kindred to my calendar" (task 3.4, ADR-008): subscribes the phone's
// calendar app to the member's personal feed of accepted items, or copies the
// link for Google Calendar on a computer.
export function CalendarFeedCard() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const feed = useCalendarFeed(userId)
  const setTasks = useSetCalendarFeedTasks(userId)
  const [copy, setCopy] = useState<CopyStatus>('idle')

  const url = feed.data ? calendarFeedUrl(feed.data.token) : null

  async function copyLink() {
    if (!url) return
    setCopy((await platform.copyText(url)) ? 'copied' : 'failed')
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="calendar-feed-heading">
      <h2 id="calendar-feed-heading" className="text-lg font-semibold">
        {t('calendarFeed.heading')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('calendarFeed.explainer')}</p>

      {feed.isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm">
            {t('calendarFeed.error')}
          </p>
          <Button variant="outline" onClick={() => feed.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </div>
      ) : (
        <>
          <Button disabled={!url} onClick={() => url && platform.addCalendarFeed(url)}>
            {t('calendarFeed.add')}
          </Button>
          <Button variant="outline" disabled={!url} onClick={copyLink}>
            {t('common.copyLink')}
          </Button>
          <p role="status" className="text-sm">
            {copy === 'copied' && t('common.linkCopied')}
            {copy === 'failed' && t('common.copyFailed')}
          </p>
          {/* Shown when copying fails, so the member can press and hold to copy it. */}
          {copy === 'failed' && url && <p className="text-sm break-all select-all">{url}</p>}
          <p className="text-sm text-muted-foreground">{t('calendarFeed.google')}</p>
          <p className="text-sm text-muted-foreground">{t('calendarFeed.private')}</p>

          <label htmlFor="calendar-feed-tasks" className="flex min-h-tap cursor-pointer items-start gap-3 py-2">
            <input
              id="calendar-feed-tasks"
              type="checkbox"
              className="mt-0.5 size-6 shrink-0 accent-primary"
              checked={feed.data?.feed_tasks ?? false}
              disabled={!feed.data || setTasks.isPending}
              onChange={(event) => setTasks.mutate(event.target.checked)}
            />
            <span>{t('calendarFeed.tasks')}</span>
          </label>
          {setTasks.isError && (
            <p role="alert" className="text-sm">
              {t('calendarFeed.tasksError')}
            </p>
          )}
        </>
      )}

      <p className="text-sm text-muted-foreground">{t('calendarFeed.delay')}</p>
      {/* Task 4.12: iOS checks subscribed calendars rarely unless told to, and
          a web app can't change that setting, so say how. */}
      {platform.isIOS() && (
        <>
          <p className="text-sm text-muted-foreground">{t('calendarFeed.iosTip')}</p>
          <p className="text-sm text-muted-foreground">{t('calendarFeed.iosCheckNow')}</p>
        </>
      )}
    </section>
  )
}

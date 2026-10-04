import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { isAnonymous, myCircleKey, signInPath, useAuth, useMyCircleId } from '@/lib/auth'
import { useLiveNotifications, useLiveUpdates } from '@/lib/live'
import { useKeepPushSubscription } from '@/lib/push-resync'
import { useSignOut } from '@/lib/use-sign-out'

function Loading() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-svh items-center justify-center" aria-busy="true">
      <p className="text-muted-foreground">{t('auth.loading')}</p>
    </main>
  )
}

/**
 * Wraps routes that need someone signed in. Signed-out people go to /sign-in
 * and come back here afterwards. With `requireCircle`, signed-in people who
 * aren't in a circle yet go to /welcome to start one, and members get live
 * updates for their circle.
 *
 * Try the demo guests (anonymous sign-ins) are only ever in the sample circle
 * (BR-12): one with no circle (just signed in, or removed by the nightly
 * reset) joins it here, and /welcome sends them Home.
 */
export function AuthGuard({ requireCircle = false }: { requireCircle?: boolean }) {
  const { t } = useTranslation()
  const location = useLocation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const circle = useMyCircleId(requireCircle ? userId : undefined)
  // One live channel for the whole signed-in app (Home, This week, item
  // detail…), closed on sign-out or leaving the circle (task 2.3).
  useLiveUpdates(requireCircle && userId ? circle.data : undefined)
  // And the member's own notifications, for the bell on Home (task 4.5f).
  useLiveNotifications(requireCircle ? userId : undefined)
  // Keep this phone subscribed to push for whoever is signed in.
  useKeepPushSubscription(userId)

  const guest = isAnonymous(auth)
  const queryClient = useQueryClient()
  const joinDemo = useMutation({
    mutationFn: api.joinDemoCircle,
    onSuccess: (circleId) => queryClient.setQueryData([...myCircleKey, userId], circleId),
  })
  const needsDemo = requireCircle && guest && circle.data === null
  const { isPending: joining, isError: joinFailed, mutate: join } = joinDemo
  useEffect(() => {
    if (needsDemo && !joining && !joinFailed) join()
  }, [needsDemo, joining, joinFailed, join])

  if (auth.status === 'loading') return <Loading />
  if (auth.status === 'signed_out') {
    return <Navigate to={signInPath(location.pathname + location.search)} replace />
  }
  if (!requireCircle) return guest ? <Navigate to="/" replace /> : <Outlet />

  if (circle.isPending) return <Loading />
  if (joinFailed) return <DemoJoinFailed onRetry={joinDemo.reset} />
  if (circle.isError) {
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6">
        <p role="alert">{t('auth.errors.circleCheck')}</p>
        <Button variant="outline" onClick={() => void circle.refetch()}>
          {t('auth.tryAgain')}
        </Button>
      </main>
    )
  }
  if (needsDemo) return <Loading />
  if (circle.data === null) return <Navigate to="/welcome" replace />
  return <Outlet />
}

/**
 * Joining the demo failed. Offline, Try again works; if the guest account is
 * gone (the nightly clean-up deletes guests after a day), only starting again
 * from the sign-in screen does.
 */
function DemoJoinFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  const signOut = useSignOut()
  const [busy, setBusy] = useState(false)
  const [signOutFailed, setSignOutFailed] = useState(false)

  async function startAgain() {
    setBusy(true)
    setSignOutFailed(false)
    try {
      await signOut()
    } catch {
      setSignOutFailed(true)
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6">
      <p role="alert">{t('auth.errors.demoJoin')}</p>
      <Button variant="outline" disabled={busy} onClick={onRetry}>
        {t('auth.tryAgain')}
      </Button>
      <Button variant="outline" disabled={busy} onClick={() => void startAgain()}>
        {t('demo.startAgain')}
      </Button>
      {signOutFailed && <p className="text-sm">{t('account.signOutError')}</p>}
    </main>
  )
}

import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { signInPath, useAuth, useMyCircleId } from '@/lib/auth'
import { useLiveUpdates } from '@/lib/live'

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

  if (auth.status === 'loading') return <Loading />
  if (auth.status === 'signed_out') {
    return <Navigate to={signInPath(location.pathname + location.search)} replace />
  }
  if (!requireCircle) return <Outlet />

  if (circle.isPending) return <Loading />
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
  if (circle.data === null) return <Navigate to="/welcome" replace />
  return <Outlet />
}

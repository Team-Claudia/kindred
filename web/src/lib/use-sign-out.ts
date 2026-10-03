import { useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { platform } from '@/platform'
import { signOut } from './auth'
import { forgetPushResync } from './push-resync'

/**
 * Signs out and goes to the sign-in screen. Throws if signing out fails, so
 * the caller can say so.
 */
export function useSignOut() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useCallback(async () => {
    // So the next person on this phone doesn't get this person's
    // notifications. Best effort: signing out matters more.
    await platform.disablePush().catch(() => undefined)
    forgetPushResync()
    await signOut()
    // Clear first, so no guard reads the old circle from the cache.
    queryClient.clear()
    navigate('/sign-in', { replace: true })
  }, [navigate, queryClient])
}

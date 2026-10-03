import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { googleCalendarKey, useDisconnectGoogleCalendar, useGoogleCalendarConnected } from '@/lib/queries'
import { platform } from '@/platform'

type Notice = 'justConnected' | 'declined' | 'notSetUp' | 'error' | null

// "Connect Google Calendar" (task 4.5a, ADR-008, US 5.1). Connecting leaves
// for Google's consent screen (free/busy only) through the google-oauth
// function. Google sends the member back to /circle?google_code=…&
// google_state=…, and this card finishes connecting as the signed-in member,
// or to /circle?google=declined|error.
export function GoogleCalendarCard() {
  const { t } = useTranslation()
  const auth = useAuth()
  const userId = auth.status === 'signed_in' ? auth.session.user.id : undefined
  const queryClient = useQueryClient()
  const connected = useGoogleCalendarConnected(userId)
  const disconnect = useDisconnectGoogleCalendar(userId)
  const [searchParams, setSearchParams] = useSearchParams()
  const code = searchParams.get('google_code')
  const state = searchParams.get('google_state')
  const outcome = searchParams.get('google')
  // Back from Google without a code: Cancel (declined) or a failure.
  const [notice, setNotice] = useState<Notice>(() =>
    code && state ? null : outcome === 'declined' ? 'declined' : outcome || code ? 'error' : null,
  )

  const start = useMutation({
    mutationFn: api.startGoogleConnect,
    onSuccess: (result) => {
      if (result === 'not_configured') setNotice('notSetUp')
      else platform.openExternal(result.url)
    },
    onError: () => setNotice('error'),
  })

  const finish = useMutation({
    mutationFn: ({ code, state }: { code: string; state: string }) => api.finishGoogleConnect(code, state),
    onSuccess: () => {
      setNotice('justConnected')
      queryClient.setQueryData(googleCalendarKey(userId), true)
      return queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
    onError: () => setNotice('error'),
  })

  // Back from Google: finish once, then take the code out of the address.
  const finishConnect = finish.mutate
  const handled = useRef(false)
  useEffect(() => {
    if (handled.current || !userId || (!code && !outcome)) return
    handled.current = true
    if (code && state) finishConnect({ code, state })
    setSearchParams(
      (params) => {
        params.delete('google_code')
        params.delete('google_state')
        params.delete('google')
        return params
      },
      { replace: true },
    )
  }, [code, state, outcome, userId, finishConnect, setSearchParams])

  const isConnected = connected.data === true
  const busy = start.isPending || finish.isPending || disconnect.isPending

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="google-calendar-heading">
      <h2 id="google-calendar-heading" className="text-lg font-semibold">
        {t('googleCalendar.heading')}
      </h2>
      <p className="text-sm text-muted-foreground">{t('googleCalendar.explainer')}</p>
      <p className="text-sm text-muted-foreground">{t('googleCalendar.private')}</p>

      {connected.isError ? (
        <div className="flex flex-col gap-2">
          <p role="alert" className="text-sm">
            {t('googleCalendar.loadError')}
          </p>
          <Button variant="outline" onClick={() => connected.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </div>
      ) : isConnected ? (
        <>
          <p className="text-sm font-medium">{t('googleCalendar.connected')}</p>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => {
              setNotice(null)
              disconnect.mutate()
            }}
          >
            {disconnect.isPending ? t('googleCalendar.disconnecting') : t('googleCalendar.disconnect')}
          </Button>
        </>
      ) : (
        <Button
          disabled={!connected.isSuccess || busy}
          onClick={() => {
            setNotice(null)
            start.mutate()
          }}
        >
          {start.isPending || finish.isPending ? t('googleCalendar.connecting') : t('googleCalendar.connect')}
        </Button>
      )}

      <p role="status" className="text-sm">
        {notice && t(`googleCalendar.${notice}`)}
      </p>
      {disconnect.isError && (
        <p role="alert" className="text-sm">
          {t('googleCalendar.disconnectError')}
        </p>
      )}
    </section>
  )
}

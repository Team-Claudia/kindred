import { useQuery } from '@tanstack/react-query'
import { Share } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ShareButton } from '@/components/share-button'
import { Button } from '@/components/ui/button'
import * as api from '@/lib/api'
import { circleKeys } from '@/lib/circles'
import { errorMessage } from '@/lib/errors'
import { inviteShare } from '@/lib/share-text'
import { platform } from '@/platform'

type CopyStatus = 'idle' | 'copied' | 'failed'

// "Invite someone" (task 4.3, US 3.1): a fresh invite link, shared through the
// phone's share sheet or copied. Any member can invite.
export function InviteCard({ circleId, recipientName }: { circleId: string; recipientName: string }) {
  const { t } = useTranslation()
  const [copy, setCopy] = useState<CopyStatus>('idle')
  // Made as soon as the screen opens, so tapping Share opens the share sheet
  // straight away (iOS only allows it right after a tap). A query, not a
  // mutation, so it runs once however often the screen renders.
  const invite = useQuery({
    queryKey: circleKeys.newInvite(circleId),
    queryFn: api.createInvite,
    staleTime: Infinity,
    retry: 2,
    refetchOnWindowFocus: false,
  })

  const url = invite.data ? platform.appUrl(`/join/${invite.data}`) : null

  async function copyLink() {
    if (!url) return
    setCopy((await platform.copyText(url)) ? 'copied' : 'failed')
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4" aria-labelledby="invite-heading">
      <h2 id="invite-heading" className="text-lg font-semibold">
        {t('invite.heading')}
      </h2>
      {url ? (
        <>
          <ShareButton label={t('invite.share')} content={inviteShare(recipientName, url, t)} />
          <Button variant="outline" onClick={() => void copyLink()}>
            {t('common.copyLink')}
          </Button>
          <p role="status" className="text-sm">
            {copy === 'copied' && t('common.linkCopied')}
            {copy === 'failed' && t('common.copyFailed')}
          </p>
          {/* Shown when copying fails, so the member can press and hold to copy it. */}
          {copy === 'failed' && <p className="text-sm break-all select-all">{url}</p>}
        </>
      ) : invite.isError ? (
        <>
          <p role="alert" className="text-sm">
            {errorMessage(invite.error)}
          </p>
          <Button variant="outline" onClick={() => void invite.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </>
      ) : (
        <Button variant="outline" disabled>
          <Share aria-hidden />
          {t('invite.preparing')}
        </Button>
      )}
      <p className="text-sm text-muted-foreground">{t('invite.hint')}</p>
    </section>
  )
}

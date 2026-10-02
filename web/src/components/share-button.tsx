import { Share } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { platform, type ShareContent } from '@/platform'

type CopyStatus = 'idle' | 'copied' | 'failed'

/**
 * Opens the phone's share sheet. Where there isn't one (e.g. a laptop), shows
 * the link with Copy link and Send on WhatsApp instead (ADR-011). `onShared`
 * runs once the share sheet reports it was shared, not on cancel.
 */
export function ShareButton({
  content,
  label,
  onShared,
  ...buttonProps
}: { content: ShareContent; label?: string; onShared?: () => void } & Omit<
  ComponentProps<typeof Button>,
  'content'
>) {
  const { t } = useTranslation()
  const [fallback, setFallback] = useState(false)
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')

  const onShare = async () => {
    const result = await platform.share(content)
    if (result === 'shared') onShared?.()
    if (result === 'unsupported') {
      setCopyStatus('idle')
      setFallback(true)
    }
  }

  const onCopy = async () => {
    setCopyStatus((await platform.copyText(content.url)) ? 'copied' : 'failed')
  }

  return (
    <div className="flex flex-col gap-3">
      <Button variant="outline" {...buttonProps} onClick={() => void onShare()}>
        <Share aria-hidden />
        {label ?? t('common.share')}
      </Button>
      {fallback && (
        <section
          aria-label={t('common.shareFallbackTitle')}
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <p className="font-semibold">{t('common.shareFallbackTitle')}</p>
          <p className="text-sm break-all text-muted-foreground select-all">{content.url}</p>
          <Button onClick={() => void onCopy()}>{t('common.copyLink')}</Button>
          <Button variant="outline" asChild>
            <a href={platform.whatsAppUrl(content)} target="_blank" rel="noopener noreferrer">
              {t('common.sendOnWhatsApp')}
            </a>
          </Button>
          <Button variant="ghost" onClick={() => setFallback(false)}>
            {t('common.close')}
          </Button>
          <p role="status" className="text-sm">
            {copyStatus === 'copied' && t('common.linkCopied')}
            {copyStatus === 'failed' && t('common.copyFailed')}
          </p>
        </section>
      )}
    </div>
  )
}

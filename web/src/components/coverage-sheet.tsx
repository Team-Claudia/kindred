import { useTranslation } from 'react-i18next'
import { ShareButton } from '@/components/share-button'
import { Sheet, SheetClose } from '@/components/sheet'
import { Button } from '@/components/ui/button'
import type { ShareContent } from '@/platform'

export type CoverageStep = 'confirm' | 'asked' | 'limit'

/**
 * Asking the family for cover (task 3.1), as one bottom sheet with three steps:
 * - confirm (wireframe 25): how many requests are left this month, then
 *   Ask for cover, the second tap;
 * - asked: done, with Share with the family for the family chat;
 * - limit (wireframe 27): none left this month, so no request is made; the
 *   member can message the family or ask one person directly instead.
 */
export function CoverageSheet({
  step,
  onClose,
  subtitle,
  remaining,
  resetsOn,
  share,
  busy,
  onConfirm,
  onAskOnePerson,
}: {
  step: CoverageStep | null
  onClose: () => void
  /** What it's for, e.g. "Cardiology · Friday, September 26, 2:00 p.m." */
  subtitle: string
  /** Requests left this month, once known. */
  remaining: number | undefined
  /** When the allowance resets, e.g. "November 1". */
  resetsOn: string
  share: ShareContent
  busy: boolean
  onConfirm: () => void
  onAskOnePerson: () => void
}) {
  const { t } = useTranslation()
  const title =
    step === 'limit'
      ? t('coverage.limitTitle')
      : step === 'asked'
        ? t('coverage.askedTitle')
        : t('coverage.confirmTitle')

  return (
    <Sheet open={step !== null} onOpenChange={(open) => !open && onClose()} title={title} description={subtitle}>
      {step === 'confirm' && (
        <>
          <section className="flex flex-col gap-1 rounded-xl border-2 border-foreground p-4">
            <h3 className="text-sm font-semibold tracking-wider uppercase">{t('coverage.allowanceTitle')}</h3>
            <p>
              {remaining !== undefined && (
                <strong>{t('coverage.remaining', { count: remaining })} </strong>
              )}
              {t('coverage.allowanceBody', { date: resetsOn })}
            </p>
          </section>
          <p className="rounded-xl bg-muted p-4">{t('coverage.confirmBody')}</p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <SheetClose asChild>
              <Button variant="outline" size="lg" disabled={busy}>
                {t('coverage.cancel')}
              </Button>
            </SheetClose>
            <Button size="lg" disabled={busy} onClick={onConfirm}>
              {busy ? t('itemDetail.working') : t('coverage.confirm')}
            </Button>
          </div>
        </>
      )}

      {step === 'asked' && (
        <>
          <p>{t('coverage.askedBody')}</p>
          {/* Slot for task 3.2: item detail passes `share`; once 3.2 is merged it
              should come from coverageRequestShare and log with logShare. */}
          <ShareButton size="lg" content={share} label={t('coverage.shareWithFamily')} />
          <SheetClose asChild>
            <Button variant="ghost" size="lg">
              {t('coverage.done')}
            </Button>
          </SheetClose>
        </>
      )}

      {step === 'limit' && (
        <>
          <p>{t('coverage.limitBody', { date: resetsOn })}</p>
          <div className="flex flex-col gap-1">
            <ShareButton size="lg" content={share} label={t('coverage.messageFamily')} />
            <p className="text-sm text-muted-foreground">{t('coverage.messageFamilyHint')}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Button variant="outline" size="lg" onClick={onAskOnePerson}>
              {t('coverage.askOnePerson')}
            </Button>
            <p className="text-sm text-muted-foreground">{t('coverage.askOnePersonHint')}</p>
          </div>
          <SheetClose asChild>
            <Button variant="ghost" size="lg">
              {t('coverage.keepIt')}
            </Button>
          </SheetClose>
        </>
      )}
    </Sheet>
  )
}

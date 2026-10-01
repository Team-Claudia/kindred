import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

// Shared loading, empty and error states for any screen or list.

export function LoadingState({ label }: { label?: string }) {
  const { t } = useTranslation()
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      <span>{label ?? t('common.loading')}</span>
    </div>
  )
}

export function EmptyState({ message, action }: { message?: string; action?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center text-muted-foreground">
      <p>{message ?? t('common.empty')}</p>
      {action}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="flex flex-col items-center gap-4 py-8 text-center">
      <p>{message ?? t('common.error')}</p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          {t('common.tryAgain')}
        </Button>
      )}
    </div>
  )
}

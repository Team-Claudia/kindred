import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A bottom sheet (wireframes 15 and 20): slides over the screen from the
 * bottom, phone width on a laptop. Radix handles focus, Escape and closing
 * when the backdrop is tapped. With `full`, it fills the screen instead, for
 * longer forms (wireframes 16 and 18), with a top bar in place of the grab
 * handle.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  full = false,
  headerStart,
  headerEnd,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  full?: boolean
  /** Full-screen only: either side of the title, e.g. Cancel and Save. */
  headerStart?: ReactNode
  headerEnd?: ReactNode
  children: ReactNode
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-foreground/40" />
        <Dialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto flex w-full max-w-md flex-col bg-background pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)] text-foreground shadow-lg outline-none',
            full ? 'top-0' : 'max-h-[90dvh] rounded-t-2xl',
          )}
        >
          {full ? (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b px-2 pt-[env(safe-area-inset-top)]">
              <div className="justify-self-start">{headerStart}</div>
              <Dialog.Title className="text-center text-lg font-semibold">{title}</Dialog.Title>
              <div className="justify-self-end">{headerEnd}</div>
            </div>
          ) : (
            <div className="px-4 pt-3">
              <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
              <Dialog.Title className="text-2xl font-bold break-words">{title}</Dialog.Title>
            </div>
          )}
          {description && (
            <Dialog.Description className={cn('px-4 text-muted-foreground', full && 'sr-only')}>
              {description}
            </Dialog.Description>
          )}
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export const SheetClose = Dialog.Close

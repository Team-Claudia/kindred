// Browser-specific features live behind this adapter, so they can be swapped
// for Capacitor plugins later (ADR-002). Screens import from here, never call
// browser APIs directly. share, canShare, enablePush and addCalendarFeed are
// added by the tasks that need them.

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

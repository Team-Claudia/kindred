// Web push handlers (task 1.4, ADR-010), loaded into the generated service
// worker with workbox.importScripts (vite.config.ts).
//
// Payloads never carry care details: at most a generic title and body, plus
// the in-app path to open when the notification is tapped, e.g.
//   { "title": "Mom's Care Circle", "body": "A new update was posted", "url": "/i/<id>" }
// The default text below is only used when the payload has none.

const DEFAULT_TITLE = 'Kindred'
const DEFAULT_BODY = 'You have something new in Kindred.'

function readPayload(event) {
  if (!event.data) return {}
  try {
    const data = event.data.json()
    return data && typeof data === 'object' ? data : {}
  } catch {
    return {}
  }
}

// Only ever open pages inside the app; anything else falls back to Home.
function sameOriginUrl(url) {
  const home = self.location.origin + '/'
  if (typeof url !== 'string') return home
  try {
    const target = new URL(url, self.location.origin)
    return target.origin === self.location.origin ? target.href : home
  } catch {
    return home
  }
}

self.addEventListener('push', (event) => {
  const payload = readPayload(event)
  const title = typeof payload.title === 'string' ? payload.title : DEFAULT_TITLE
  const body = typeof payload.body === 'string' ? payload.body : DEFAULT_BODY

  // Always show a notification: iOS stops delivering push to apps that don't.
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/favicon.svg',
      data: { url: sameOriginUrl(payload.url) },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = sameOriginUrl(event.notification.data && event.notification.data.url)

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const existing = windows.find((client) => new URL(client.url).origin === self.location.origin)
      if (existing) {
        try {
          const focused = await existing.focus()
          if (focused.url !== url) await focused.navigate(url)
          return
        } catch {
          // The window couldn't be reused (e.g. it isn't controlled yet); open a new one.
        }
      }
      await self.clients.openWindow(url)
    })(),
  )
})

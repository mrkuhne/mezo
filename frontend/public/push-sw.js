// Web Push handlers, imported into the vite-plugin-pwa (Workbox generateSW) service worker via
// workbox.importScripts. Kept as a separate plain file so the generated worker — precache manifest,
// autoUpdate, the woff2 globs — stays owned by the plugin (bd mezo-h4wp.6.1).
//
// Payload contract (backend PushSender.payload): { title, body, url }.
// iOS requires a notification to be shown for EVERY push (userVisibleOnly) — so there is no
// silent path here, and no early return before showNotification.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = {}
  }
  const title = data.title || 'Mezo'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      // One notification per logical event: a re-sent duplicate replaces rather than stacks.
      tag: data.url || 'mezo',
      data: { url: data.url || '/today' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/today'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})

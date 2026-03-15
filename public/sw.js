self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'MoneyfestLending'
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/favicon-96x96.png',
    badge: '/favicon-96x96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/admin/applications' },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  if (event.action === 'dismiss') return
  const url = event.notification.data?.url || '/admin/applications'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    })
  )
})

/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SKIP_WAITING') return

  event.waitUntil(
    Promise.all([
      self.skipWaiting(),
      self.clients.claim(),
    ])
  )
})

precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('push', (event: PushEvent) => {
  const data = (event.data?.json?.() ?? {}) as { title?: string; body?: string }
  const title = data.title ?? 'Jobs Dashboard'
  const body = data.body ?? ''
  const reg = self.registration
  event.waitUntil(
    reg.showNotification(title, {
      body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
    })
  )
})

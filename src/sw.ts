/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()
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

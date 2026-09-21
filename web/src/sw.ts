/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.skipWaiting();
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

interface PushPayload {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  data?: { url?: string; deliveryId?: string; type?: string };
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try { payload = event.data ? event.data.json() : {}; }
  catch { payload = { title: 'AXIOM PULSE', body: event.data ? event.data.text() : '' }; }

  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-512.png',
    badge: payload.badge || '/icons/icon-192.png',
    data: { url: payload.data?.url || '/', ...payload.data },
    tag: payload.data?.deliveryId,
    renotify: true,
    requireInteraction: payload.data?.type === 'delivery_time',
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'AXIOM PULSE', options));
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data?.url as string) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => 'focus' in c) as WindowClient | undefined;
      if (existing) { existing.navigate(url); return existing.focus(); }
      return self.clients.openWindow(url);
    }),
  );
});

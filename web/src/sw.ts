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
  catch { payload = { title: 'Mahanex Pulse', body: event.data ? event.data.text() : '' }; }

  // The Notification spec throws a TypeError if `renotify` is true while
  // `tag` is empty — and showNotification() throwing here kills the whole
  // push event with nothing displayed, not even a fallback. A push with no
  // deliveryId (the test-notification button; maybe others in the future)
  // has no tag to renotify against, so renotify must stay off for those.
  const tag = payload.data?.deliveryId;
  const options: NotificationOptions & { renotify?: boolean } = {
    body: payload.body || '',
    icon: payload.icon || '/icons/mh-512.png',
    badge: payload.badge || '/icons/mh-192.png',
    data: { url: payload.data?.url || '/', ...payload.data },
    tag,
    renotify: !!tag,
    requireInteraction: payload.data?.type === 'urgent' || payload.data?.type === 'delivery_time' || payload.data?.type === 'delivery_overdue' || payload.data?.type === 'lien_reminder',
  };

  event.waitUntil(self.registration.showNotification(payload.title || 'Mahanex Pulse', options));
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

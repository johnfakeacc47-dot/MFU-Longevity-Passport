/// <reference lib="webworker" />
declare let self: ServiceWorkerGlobalScope;

import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// ── Fasting alarm state ──────────────────────────────────────────────
let fastingAlarmInterval: ReturnType<typeof setInterval> | null = null;
let fastingEndTimestamp: number | null = null;

function clearFastingAlarm() {
  if (fastingAlarmInterval !== null) {
    clearInterval(fastingAlarmInterval);
    fastingAlarmInterval = null;
  }
  fastingEndTimestamp = null;
}

function startFastingAlarm(endTimestamp: number, goalHours: number) {
  // Clear any existing alarm first
  clearFastingAlarm();
  fastingEndTimestamp = endTimestamp;

  // Check every 30 seconds whether it's time to fire the alarm
  fastingAlarmInterval = setInterval(() => {
    if (fastingEndTimestamp && Date.now() >= fastingEndTimestamp) {
      clearFastingAlarm();

      self.registration.showNotification('Fasting Goal Reached! 🏆', {
        body: `Congratulations! You've completed your ${goalHours} hour fast. Time to log your first meal!`,
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: 'fasting-goal',
        // @ts-ignore – actions & requireInteraction are valid on supported browsers
        actions: [{ action: 'enter-meal', title: '🍽️ Enter Meal' }],
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 400],
      });
    }
  }, 30_000);
}

// ── Message listener (from client page) ──────────────────────────────
self.addEventListener('message', (event) => {
  const { type, endTimestamp, goalHours } = event.data ?? {};

  if (type === 'SCHEDULE_FASTING_ALARM') {
    startFastingAlarm(endTimestamp, goalHours);
  } else if (type === 'CANCEL_FASTING_ALARM') {
    clearFastingAlarm();
  }
});

// ── Push notification (server-sent) ──────────────────────────────────
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Health Notification', body: 'Please check your passport.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      // @ts-ignore
      vibrate: [200, 100, 200]
    })
  );
});

// ── Notification click ───────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  const action = event.action; // '' when body clicked, 'enter-meal' when action btn clicked
  event.notification.close();

  // Decide which URL to open
  const targetUrl = action === 'enter-meal' ? '/?openFoodRecognition=true' : '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window and navigate it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({ type: 'SW_NAVIGATE', url: targetUrl });
          return;
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

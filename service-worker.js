// AOG Teens Jaktim — Service Worker
// Strategy v18:
// - HTML/index.html: NETWORK-FIRST (always fresh, fallback cache hanya kalau offline)
// - Supabase API: bypass (langsung ke browser)
// - Static assets (fonts, CDN, icon): cache-first

const CACHE_NAME = 'aog-absensi-v21';
const SHELL_URLS = [
  '/manifest.json',
  '/icon.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => null))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass: Supabase API, realtime WebSocket, non-GET
  if (
    req.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return;
  }

  // HTML/navigation: NETWORK-FIRST (always ambil versi terbaru)
  // Cache hanya dipakai sebagai fallback kalau offline
  if (req.mode === 'navigate' || req.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Other static (fonts, CDN scripts, images): cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ─── Push notifications (Web Push API — kalau ada server VAPID) ───
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) { data = { title: 'AOG Teens', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'AOG Teens Jaktim';
  const opts = {
    body: data.body || '',
    icon: data.icon || '/icon.jpg',
    badge: data.badge || '/icon.jpg',
    tag: data.tag || 'aog',
    vibrate: [80, 40, 80],
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

// ─── Klik notification → buka/fokus app ───
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate(url).catch(() => {}); return w.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

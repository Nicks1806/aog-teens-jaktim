// AOG Teens Jaktim — Service Worker (basic offline shell)
// Strategy:
// - HTML/CSS/JS shell: cache-first (stale-while-revalidate)
// - Supabase API calls: network-only (always fresh, no cache)
// - Other static (CDN scripts, fonts, icons): cache-first with network fallback

const CACHE_NAME = 'aog-absensi-v5';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.json'
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

  // Never cache: Supabase API, realtime WebSocket, POST/PUT/DELETE
  if (
    req.method !== 'GET' ||
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('supabase.io') ||
    url.protocol === 'ws:' ||
    url.protocol === 'wss:'
  ) {
    return; // bypass — let browser handle directly
  }

  // For navigation: stale-while-revalidate (instant load + background update)
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Other GETs (fonts, CDN scripts, images): cache-first
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
    icon: data.icon || '/manifest.json',
    badge: data.badge || data.icon,
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

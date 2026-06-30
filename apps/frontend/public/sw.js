const CACHE_NAME = 'nexus-crm-v1';
const STATIC_SHELL = ['/', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin and non-GET
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Network-only for API calls (never serve stale data)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/_next/data/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Stale-while-revalidate for Next.js built assets (hashed, safe to cache long)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Network-first for page navigations — fall back to cache on offline
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(request) || caches.match('/'))
    );
    return;
  }

  // Cache-first for everything else (icons, fonts, images)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Phantom Service Worker - Zero-Knowledge Ephemeral PWA
const CACHE_NAME = 'phantom-cache-v4';

const STATIC_SHELL_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/favicon.png',
  '/pdf.min.js',
  '/pdf.worker.min.js'
];

// Install Event - Pre-cache core standalone assets & activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_SHELL_ASSETS).catch((err) => {
        console.warn('PWA Pre-cache skipped some assets', err);
      });
    })
  );
});

// Activate Event - Clean up stale caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. CRITICAL: NEVER cache or intercept Next.js chunks, HMR, or bundles
  // Allowing Next.js / Turbopack to handle its own chunk loading prevents stale chunk errors
  if (url.pathname.startsWith('/_next/')) {
    return;
  }

  // 2. ZERO-KNOWLEDGE SECURITY RULE:
  // NEVER cache API requests, Supabase database / storage requests, or decrypted blobs
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.pathname.startsWith('/storage/')
  ) {
    return;
  }

  // 3. Static PWA and Library Assets (icons, manifest, PDF viewer scripts) -> Cache-First
  if (
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/pdf.') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.png'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200) return response;
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        });
      })
    );
    return;
  }

  // 4. Navigation Requests (Page Shells) -> Network-First (never serve stale code in dev)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response('Phantom is offline. Please reconnect.', {
          headers: { 'Content-Type': 'text/plain' },
        });
      })
    );
  }
});

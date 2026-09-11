// SPDX-License-Identifier: GPL-3.0-or-later
// Demo-only offline cache: application/engine assets, never user font files.
const VERSION = 'fontforge-wasm-demo-0.1.0-alpha.1-samples';
const ASSETS = [
  'examples/browser/', 'examples/browser/demo.js',
  'examples/fonts/Roboto-Regular.ttf', 'examples/fonts/Roboto-Regular.otf', 'examples/fonts/LICENSE.txt',
  'src/index.js', 'src/validate.js', 'src/browser-worker.js', 'src/runtime.js',
  'dist/browser-worker.mjs', 'dist/fontforge-core.wasm',
].map(path => new URL(path, self.registration.scope).href);
self.addEventListener('install', event => {
  // Revalidate mutable entry pages; never seed a new cache from stale HTTP data.
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  // Old open tabs may still reference a previous immutable release. Preserve
  // their offline assets instead of deleting them during an active conversion.
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  if (request.cache === 'no-store') { event.respondWith(fetch(request)); return; }
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const navigation = request.mode === 'navigate';
  if (!navigation && !ASSETS.includes(request.url) && !url.pathname.startsWith(scope.pathname + 'releases/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    if (navigation) {
      try {
        const response = await fetch(new Request(request, { cache: 'no-cache' }));
        if (response.ok) { await cache.put(request, response.clone()); return response; }
      } catch { /* Fall back to the complete cached release offline. */ }
    }
    const current = await cache.match(request);
    if (current) return current;
    for (const key of await caches.keys()) {
      if (!key.startsWith('fontforge-wasm-demo-') || key === VERSION) continue;
      const previous = await (await caches.open(key)).match(request);
      if (previous) return previous;
    }
    return fetch(request);
  })());
});

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
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith('fontforge-wasm-demo-') && key !== VERSION)
    .map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !ASSETS.includes(event.request.url)) return;
  event.respondWith(caches.open(VERSION).then(async cache => (await cache.match(event.request)) || fetch(event.request)));
});

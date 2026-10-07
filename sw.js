import { HELPERS } from './src/helpers/registry.js';

// Bump on every release that changes the shell, registry, helpers or assets.
const CACHE = '0815-v0.8.2';
const CACHE_PREFIX = '0815-';
const APP_SHELL = [
  './', './index.html', './manifest.webmanifest', './assets/styles.css', './assets/notes.css', './assets/signature.css',
  './assets/fonts/CormorantGaramond.woff2', './assets/fonts/GreatVibes.woff2',
  './assets/fonts/OFL-CormorantGaramond.txt', './assets/fonts/OFL-GreatVibes.txt',
  './assets/icons/icon-192.png', './assets/icons/icon-512.png',
  './src/app.js', './src/db.js', './src/context.js', './src/time-windows.js', './src/intervals.js', './src/places.js', './src/schema.js', './src/retention.js',
  './src/read-views.js', './src/navigation.js',
  './src/notes.js', './src/note-views.js', './src/note-presentation.js', './src/pwa-update.js', './src/theme.js',
  './src/helpers/registry.js', './src/helpers/contract.js',
  ...HELPERS.flatMap(helper => [`./src/helpers/${helper.id}/index.js`, ...(helper.offlineAssets || [])])
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const urls = [...new Set(APP_SHELL)].map(path => new URL(path, self.location.href));
    if (urls.some(url => url.origin !== self.location.origin || url.search || url.hash)) throw new Error('Offline-Assets müssen lokale URLs ohne Parameter sein.');
    const cache = await caches.open(CACHE);
    // Reload prevents an HTTP-cache entry from silently becoming the new release.
    await cache.addAll(urls.map(url => new Request(url.href, { cache: 'reload' })));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Parameterized requests are neither stored nor replaced with the app shell.
  if (url.search) return;
  const cachedResponse = caches.open(CACHE).then(cache => cache.match(event.request));
  const outcome = cachedResponse.then(async cached => {
    if (cached) return { response: cached };
    try {
      const response = await fetch(event.request);
      return { response, copy: response.ok && !response.redirected ? response.clone() : null };
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const response = await (await caches.open(CACHE)).match(new URL('./index.html', self.location.href));
        return { response };
      }
      throw error;
    }
  });
  event.respondWith(outcome.then(({ response }) => response));
  event.waitUntil(outcome.then(async ({ copy }) => {
    if (copy) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, copy);
    }
  }).catch(() => {}));
});

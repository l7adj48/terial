/* CodePatcher Terial — isolated service worker */
'use strict';

const CACHE_NAME = 'terial-pwa-v1';
const APP_SCOPE = new URL('./', self.registration.scope);
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg',
  './css/tokens.css',
  './css/themes.css',
  './css/components.css',
  './css/layouts.css',
  './css/responsive.css',
  './js/01-state.js',
  './js/02-pwa.js',
  './js/03-utils.js',
  './js/04-tokenizers.js',
  './js/05-patch-engine.js',
  './js/06-ui-core.js',
  './js/07-errors-report.js',
  './js/08-editor-view.js',
  './js/09-history.js',
  './js/10-editor-ops.js',
  './js/11-find-replace.js',
  './js/12-patch-ui.js',
  './js/13-symbols-keyboard.js',
  './js/14-files-tabs.js',
  './js/15-project-io.js',
  './js/16-export.js',
  './js/16b-text-bundle.js',
  './js/17-drawer.js',
  './js/18-settings.js',
  './js/19-isolation-selftest.js',
  './js/20-file-clipboard.js',
  './js/21-smoke-tests.js',
  './js/22-palette-shortcuts.js',
  './js/23-versions.js',
  './js/24-preview-console.js',
  './js/25-storage.js',
  './js/26-link-updates.js',
  './js/27-multiselect.js',
  './js/28-report-ambiguity.js',
  './js/29-patch-history.js',
  './js/30-home.js',
  './js/31-outline.js',
  './js/32b-github.js',
  './js/33b-files-toolbar.js',
  './js/34-jekyll-pwa.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith('terial-pwa-') && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const inAppScope = sameOrigin && url.pathname.startsWith(APP_SCOPE.pathname);

  if (!sameOrigin && (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com')) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok || response.type === 'opaque') await cache.put(request, response.clone());
        return response;
      } catch (_) {
        return Response.error();
      }
    })());
    return;
  }

  if (!inAppScope) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const response = await fetch(request, { cache: 'no-cache' });
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch (_) {
      return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
    }
  })());
});

/* CodePatcher service worker: network first, cached fallback */
const C = 'codepatcher-v23';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', './index.html', './manifest.webmanifest', './icon.svg', './css/tokens.css', './css/themes.css', './css/components.css', './css/layouts.css', './css/responsive.css', './js/01-state.js', './js/02-pwa.js', './js/03-utils.js', './js/04-tokenizers.js', './js/05-patch-engine.js', './js/06-ui-core.js', './js/07-errors-report.js', './js/08-editor-view.js', './js/09-history.js', './js/10-editor-ops.js', './js/11-find-replace.js', './js/12-patch-ui.js', './js/13-symbols-keyboard.js', './js/14-files-tabs.js', './js/15-project-io.js', './js/16-export.js','./js/16b-text-bundle.js', './js/17-drawer.js', './js/18-settings.js', './js/19-isolation-selftest.js', './js/20-file-clipboard.js', './js/21-smoke-tests.js', './js/22-palette-shortcuts.js', './js/23-versions.js', './js/24-preview-console.js', './js/25-storage.js', './js/26-link-updates.js', './js/27-multiselect.js', './js/28-report-ambiguity.js', './js/29-patch-history.js', './js/30-home.js', './js/31-outline.js', './js/32b-github.js', './js/33b-files-toolbar.js', './js/34-jekyll-pwa.js'])).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(caches.match(r).then(m => m || fetch(r).then(res => { if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => Response.error()))); return; }
  if (u.origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; }).catch(() => caches.match(r).then(m => m || caches.match('./'))));
});

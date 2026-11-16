'use strict';
/* تحويل المشروع عند الدفع إلى موقع Jekyll + PWA على GitHub Pages.
   الملفات المولَّدة تُضاف للدفعة فقط (لا تظهر في ملفات المشروع)، ولا تُكتب فوق ملف موجود في المشروع أو المستودع. */
const JK_A = '<' + '!--CP-PWA-->', JK_B = '<' + '!--/CP-PWA-->';
function jkStrip(t) {
  let s = String(t);
  for (;;) {
    const a = s.indexOf(JK_A); if (a < 0) return s;
    const b = s.indexOf(JK_B, a); if (b < 0) return s;
    let e = b + JK_B.length; if (s[e] === '\n') e++;
    s = s.slice(0, a) + s.slice(e);
  }
}
function jkSiteUrl(repo) {
  const p = String(repo).split('/'), o = (p[0] || '').toLowerCase(), r = p[1] || '';
  return 'https://' + o + '.github.io' + (r.toLowerCase() === o + '.github.io' ? '/' : '/' + r + '/');
}
/* يحقن في index.html ما ينقصه فقط (manifest، أيقونة، viewport، theme-color، تسجيل sw). o: {mf, icon, theme} */
function jkInject(html, o) {
  html = jkStrip(html);
  const low = html.toLowerCase();
  let head = '', body = '';
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) head += '<meta name="viewport" content="width=device-width, initial-scale=1">';
  if (!/<meta[^>]+name=["']theme-color["']/i.test(html)) head += '<meta name="theme-color" content="' + o.theme + '">';
  if (!/<link[^>]+rel=["']manifest["']/i.test(html)) head += '<link rel="manifest" href="' + o.mf + '">';
  if (o.icon && !/<link[^>]+rel=["'](?:shortcut )?icon["']/i.test(html)) head += '<link rel="icon" type="image/png" href="icon-192.png">';
  if (o.icon && !/<link[^>]+rel=["']apple-touch-icon["']/i.test(html)) head += '<link rel="apple-touch-icon" href="icon-192.png">';
  if (!/serviceWorker\s*\.\s*register/.test(html)) body = '<script>if("serviceWorker"in navigator)addEventListener("load",function(){navigator.serviceWorker.register("sw.js").catch(function(){})});</script>';
  if (body) { const i = low.lastIndexOf('</body>'), blk = JK_A + body + JK_B + '\n'; html = i >= 0 ? html.slice(0, i) + blk + html.slice(i) : html + '\n' + blk; }
  if (head) { const i = low.indexOf('</head>'), blk = JK_A + head + JK_B + '\n'; html = i >= 0 ? html.slice(0, i) + blk + html.slice(i) : blk + html; }
  return html;
}
function jkManifest(m) {
  return JSON.stringify({
    id: './', name: m.name, short_name: m.short, description: m.name, lang: m.lang, dir: m.dir,
    start_url: './', scope: './', display: 'standalone', background_color: m.theme, theme_color: m.theme,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  }, null, 2) + '\n';
}
const JK_SW = `/* service worker مولَّد من CodePatcher: الشبكة أولاً ثم النسخة المخزّنة */
const C = 'cp-pwa-v1';
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(C).then(c => c.addAll(['./', './index.html'])).catch(() => {})); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== C).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return;
  e.respondWith(fetch(r, { cache: 'no-cache' }).then(res => { if (res.ok) { const cp = res.clone(); caches.open(C).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
`;
function jkConfig(m, include) {
  return ['title: ' + JSON.stringify(m.name), 'lang: ' + JSON.stringify(m.lang), 'url: ' + JSON.stringify(m.url), 'baseurl: ' + JSON.stringify(m.base), '',
    'exclude:', '  - Gemfile', '  - Gemfile.lock', '  - vendor', '  - node_modules', '  - "*.gem"', '  - "*.gemspec"']
    .concat(include.length ? ['', 'include: [' + include.map(x => JSON.stringify(x)).join(', ') + ']'] : []).join('\n') + '\n';
}
const JK_GEMFILE = 'source "https://rubygems.org"\n\ngem "jekyll", "~> 4.4"\n';
function jkWorkflow(branch, dir) {
  const wd = dir ? ['          working-directory: ' + JSON.stringify(dir)] : [], sd = dir ? ['        working-directory: ' + JSON.stringify(dir)] : [];
  return [
    'name: Build and deploy Jekyll site', '', 'on:', '  push:', '    branches: [' + JSON.stringify(branch) + ']', '  workflow_dispatch:', '',
    'permissions:', '  contents: read', '  pages: write', '  id-token: write', '',
    'concurrency:', '  group: "github-pages"', '  cancel-in-progress: true', '',
    'jobs:', '  build:', '    runs-on: ubuntu-latest', '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: ruby/setup-ruby@v1', '        with:', '          ruby-version: "3.3"', '          bundler-cache: true'].concat(wd, [
    '      - name: Build with Jekyll', '        run: bundle exec jekyll build'], sd, [
    '      - uses: actions/upload-pages-artifact@v3', '        with:', '          path: ' + JSON.stringify('./' + (dir ? dir + '/' : '') + '_site'), '',
    '  deploy:', '    environment:', '      name: github-pages', '      url: ${{ steps.deployment.outputs.page_url }}', '    runs-on: ubuntu-latest', '    needs: build',
    '    steps:', '      - id: deployment', '        uses: actions/deploy-pages@v4']).join('\n') + '\n';
}
function jkIcon(size, letter, bg, fg) {
  return new Promise(res => {
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = size;
      const g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 ' + Math.round(size * 0.44) + 'px sans-serif';
      g.fillText(letter, size / 2, size / 2);
      cv.toBlob(b => { if (!b) return res(null); b.arrayBuffer().then(a => res(new Uint8Array(a)), () => res(null)); }, 'image/png');
    } catch (e) { res(null); }
  });
}
function jkFg(bg) {
  let h = bg.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&');
  const n = parseInt(h, 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150 ? '#111111' : '#ffffff';
}
/* تفعيل Pages بمصدر «GitHub Actions» (بدل اختيار الفرع يدوياً) */
async function jkEnablePages(c, repo) {
  const P = '/repos/' + repo + '/pages'; let cur = null;
  try { cur = await ghApi(c, 'GET', P); } catch (e) { if (!e || e.status !== 404) throw e; }
  if (!cur) await ghApi(c, 'POST', P, { build_type: 'workflow' });
  else if (cur.build_type !== 'workflow') await ghApi(c, 'PUT', P, { build_type: 'workflow' });
}
function jkPagesErr(e) {
  const s = e && e.status;
  if (s === 403 || s === 404) return 'التوكن لا يملك صلاحية Pages (Read and write)';
  if (s === 422) return 'Pages غير متاح لهذا المستودع (يحتاج مستودعاً عاماً في الحساب المجاني)';
  return ghErrText(e);
}
/* يعدّل مجموعة الملفات المدفوعة all (Map: مسار ← بايتات). have: مسارات المستودع الحالية.
   يعيد { skip } إن لم يكن هناك index.html في جذر المشروع، وإلا { added, pagesErr, url } */
async function jkApply(c, all, have, say) {
  const pre = c.dir ? c.dir.replace(/^\/+|\/+$/g, '') + '/' : '', P = n => pre + n;
  const idx = all.get(P('index.html')); if (!idx) return { skip: true };
  const enc = new TextEncoder(), html0 = new TextDecoder().decode(idx), added = [];
  const own = n => all.has(P(n)), need = n => !all.has(P(n)) && !have.has(P(n));
  const put = (p, v) => { if (all.has(p) || have.has(p)) return; all.set(p, typeof v === 'string' ? enc.encode(v) : v); added.push(p); };
  const parts = String(c.repo).split('/'), owner = parts[0], rn = parts[1] || '';
  const ttl = ((html0.match(/<title>\s*([^<]{1,60}?)\s*<\/title>/i) || [])[1] || '').trim();
  const short = rn.replace(/[-_.]+/g, ' ').trim() || 'App';
  const lang = (html0.match(/<html[^>]*\slang=["']([\w-]+)/i) || [])[1] || 'en';
  const dirA = (html0.match(/<html[^>]*\sdir=["'](rtl|ltr)/i) || [])[1] || (/^(ar|fa|he|ur)/i.test(lang) ? 'rtl' : 'ltr');
  const theme = (html0.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-f]{3}(?:[0-9a-f]{3})?)["']/i) || [])[1] || '#0a0c10';
  const url = jkSiteUrl(c.repo), m = { name: ttl || short, short: short.slice(0, 12), lang, dir: dirA, theme, url: url.replace(/^(https:\/\/[^/]+).*$/, '$1'), base: url.replace(/^https:\/\/[^/]+/, '').replace(/\/$/, '') };
  /* أيقونات PNG (192/512) إن لم توجد */
  const letter = (Array.from(short)[0] || 'A').toUpperCase(), fg = jkFg(theme);
  for (const sz of [192, 512]) { const n = 'icon-' + sz + '.png'; if (need(n)) { const u = await jkIcon(sz, letter, theme, fg); if (u) put(P(n), u); } }
  const icon = own('icon-192.png') || have.has(P('icon-192.png')) || added.includes(P('icon-192.png'));
  /* manifest + sw (لا يُكتب فوق ما للمشروع) */
  const mf = own('manifest.json') ? 'manifest.json' : 'manifest.webmanifest';
  if (!own('manifest.json') && !own('manifest.webmanifest')) put(P('manifest.webmanifest'), jkManifest(m));
  if (!own('sw.js') && !own('service-worker.js')) put(P('sw.js'), JK_SW);
  const nh = jkInject(html0, { mf, icon, theme });
  if (nh !== html0) all.set(P('index.html'), enc.encode(nh));
  /* Jekyll: يتجاهل افتراضياً المجلدات التي تبدأ بـ _ فنضيفها إلى include */
  const inc = new Set(), JKDIR = /^_(layouts|includes|data|sass|posts|drafts|plugins|site|config\.yml)$/;
  all.forEach((_, p) => {
    if (pre && !p.startsWith(pre)) return;
    let acc = ''; (pre ? p.slice(pre.length) : p).split('/').forEach((s, i) => { acc += (i ? '/' : '') + s; if ((s[0] === '_' && !JKDIR.test(s)) || s === '.well-known') inc.add(acc); });
  });
  put(P('_config.yml'), jkConfig(m, Array.from(inc)));
  put(P('Gemfile'), JK_GEMFILE);
  put('.github/workflows/pages.yml', jkWorkflow(c.branch, pre.replace(/\/$/, '')));
  const out = { added, url };
  try { say('جارٍ تفعيل Pages…'); await jkEnablePages(c, c.repo); } catch (e) { out.pagesErr = jkPagesErr(e); }
  return out;
}

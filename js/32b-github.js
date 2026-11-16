'use strict';
/* الدفع إلى GitHub: commit واحد لكل الملفات المتغيرة عبر Git Data API */
const GH_KEY = 'CodePatcher_github';
function ghKey() { try { return (typeof commonRoot === 'function' && commonRoot()) || '_'; } catch (e) { return '_'; } }
function ghRaw() { let c = null; try { c = JSON.parse(localStorage.getItem(GH_KEY) || 'null'); } catch (e) { } return c || {}; }
/* لكل مشروع مستودعه المحفوظ. مشروع بلا مستودع محفوظ يبقى بلا مستودع (يُختار يدوياً) كي لا يُدفع بالخطأ إلى مستودع مشروع آخر.
   الرجوع إلى آخر مستودع للإعدادات القديمة فقط (قبل وجود map) */
function ghCfg() {
  const c = ghRaw(), m = c.map ? (c.map[ghKey()] || {}) : c;
  return { token: c.token || '', repo: m.repo || '', branch: m.branch || 'main', dir: m.dir || '', jk: !!m.jk };
}
function ghSaveCfg(n) {
  const old = ghCfg(), jk = n.jk !== undefined ? !!n.jk : (n.repo === old.repo ? old.jk : false);
  const c = ghRaw(); c.token = n.token; c.repo = n.repo; c.branch = n.branch; c.dir = n.dir; c.jk = jk;
  c.map = c.map || {}; c.map[ghKey()] = { repo: n.repo, branch: n.branch, dir: n.dir, jk };
  try { localStorage.setItem(GH_KEY, JSON.stringify(c)); return true; } catch (e) { return false; }
}
function ghSetToken(t, login) { const c = ghRaw(); c.token = t; c.login = t ? (login || '') : ''; try { localStorage.setItem(GH_KEY, JSON.stringify(c)); return true; } catch (e) { return false; } }
async function ghVerify(t) {
  try { const u = await ghApi({ token: t }, 'GET', '/user'); return { ok: true, login: (u && u.login) || '' }; }
  catch (e) { return { ok: !(e && e.status === 401), login: '' }; }
}
function ghRepoOk(v) { return /^[\w.-]+\/[\w.-]+$/.test(v); }
function ghB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
async function ghBlobSha(u8) {
  if (!(window.crypto && crypto.subtle)) return '';
  const head = new TextEncoder().encode('blob ' + u8.length + '\0'), all = new Uint8Array(head.length + u8.length);
  all.set(head, 0); all.set(u8, head.length);
  const d = new Uint8Array(await crypto.subtle.digest('SHA-1', all));
  return Array.from(d, b => b.toString(16).padStart(2, '0')).join('');
}
async function ghApi(c, method, path, body) {
  const r = await fetch('https://api.github.com' + path, {
    method, cache: 'no-store',
    headers: Object.assign(c.token ? { 'Authorization': 'Bearer ' + c.token } : {}, { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body ? { 'Content-Type': 'application/json' } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok) { const e = new Error((j && j.message) || ('HTTP ' + r.status)); e.status = r.status; throw e; }
  return j;
}
function ghErrText(e) {
  const m = String(e && e.message || e), s = e && e.status;
  if (/workflow/i.test(m)) return 'التوكن يحتاج صلاحية Workflows: Read and write لرفع ملف النشر (.github/workflows)';
  if (s === 401) return 'التوكن غير صالح أو منتهي';
  if (s === 403) return 'التوكن لا يملك صلاحية الكتابة (Contents: Read and write) أو تجاوزت الحد: ' + m;
  if (s === 404) return 'المستودع أو الفرع غير موجود، أو التوكن لا يشمل هذا المستودع';
  if (s === 409 && /empty/i.test(m)) return 'المستودع فارغ: أنشئ فيه أي ملف واحد من موقع GitHub أولاً ثم أعد المحاولة';
  if (e instanceof TypeError) return 'تعذّر الاتصال بـ GitHub — تحقق من الإنترنت';
  return m;
}
/* ملفات المشروع كما ستُرفع: الجذر المشترك يُحذف، ويُضاف مجلد المستودع الاختياري */
function ghCollect(c) {
  const cr = commonRoot(), enc = new TextEncoder(), pre = c.dir ? c.dir.replace(/^\/+|\/+$/g, '') + '/' : '';
  const fix = n => { n = n.replace(/^\/+/, ''); if (cr && n.startsWith(cr + '/')) n = n.slice(cr.length + 1); return pre + n; };
  const out = new Map();
  files.forEach(f => out.set(fix(f.name), enc.encode(withEol(f))));
  BIN.forEach((u8, n) => out.set(fix(n), u8));
  return out;
}
function ghDefMsg() { return 'تحديث من CodePatcher ' + new Date().toISOString().slice(0, 16).replace('T', ' '); }
function ghProjName() { const k = ghKey(); return k === '_' ? '' : k; }
function ghNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
/* اسم المستودع لا يشبه اسم المشروع (يعمل فقط حين يكون اسم المشروع بحروف إنجليزية) */
function ghMismatch(c) {
  const p = ghNorm(ghProjName()), r = ghNorm((String(c.repo).split('/')[1]) || '');
  return !!(p && r && p.indexOf(r) < 0 && r.indexOf(p) < 0);
}
/* بطاقة الوجهة: اسم المستودع كبير وواضح، ثم الحساب والفرع، ثم اسم المشروع الحالي للمقارنة */
function ghTargetCard(c) {
  const o = String(c.repo).split('/'), pn = ghProjName();
  return '<div class="slabel">سيُدفع المشروع إلى المستودع</div>' +
    '<h3 dir="ltr">' + esc(o[1] || c.repo) + '</h3>' +
    '<div class="slabel" dir="ltr">' + esc(o[0] || '') + ' · branch: ' + esc(c.branch) + (c.dir ? ' · /' + esc(c.dir) : '') + '</div>' +
    (pn ? uiNote('المشروع الحالي: <bdi>' + esc(pn) + '</bdi>') : '') +
    (ghMismatch(c) ? uiNote('تنبيه: اسم المستودع لا يشبه اسم المشروع — تأكد أنه المستودع الصحيح') : '');
}
/* نافذة رسالة الـ commit مع إظهار المستودع الذي سيُدفع إليه. تعيد النص، أو null عند الإلغاء، أو { change, msg } عند طلب تغيير المستودع */
function ghAskPush(c, def) {
  return new Promise(res => {
    ui.show(ghHead('') + ghTargetCard(c) +
      uiRow('repos', 'folder-open', 'تغيير المستودع', 'اختر مستودعاً آخر للدفع إليه') +
      '<div class="slabel">رسالة الـ commit</div><input type="text" id="uiIn" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false">' +
      '<div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button><button type="button" class="btn primary" data-ui="ok">دفع</button></div>', act => { if (act === 'repos') ui.close({ change: true, msg: $('uiIn').value }); });
    ui.kind = 'prompt'; ui.resolve = res;
    const i = $('uiIn'); i.value = def || '';
    i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ui.close(i.value); } });
    setTimeout(() => { i.focus(); i.select(); }, 60);
  });
}
/* msg: نص جاهز، أو undefined فيُسأل المستخدم (مع إظهار المستودع). def: رسالة افتراضية للسؤال */
async function githubPush(msg, def) {
  const cc = cur(); if (cc) cc.content = editor.value;
  const c = ghCfg();
  if (!c.token || !ghRepoOk(c.repo)) return githubDialog();
  if (!files.length) return toast('لا ملفات للدفع', 'err');
  if (msg === undefined) {
    msg = await ghAskPush(c, def || ghDefMsg()); if (msg == null) return;
    if (typeof msg === 'object') { GH_ST.pushMsg = msg.msg; return void setTimeout(() => githubDialog('pick', 'push'), 120); }
  }
  msg = String(msg).trim() || ghDefMsg();
  const R = '/repos/' + c.repo, say = t => toast(t, ''), brp = encodeURIComponent(c.branch).replace(/%2F/g, '/');
  try {
    say('جارٍ قراءة المستودع…');
    const ref = await ghApi(c, 'GET', R + '/git/ref/heads/' + brp);
    const head = ref.object.sha, cm = await ghApi(c, 'GET', R + '/git/commits/' + head);
    const tr = await ghApi(c, 'GET', R + '/git/trees/' + cm.tree.sha + '?recursive=1');
    const have = new Map(); (tr.tree || []).forEach(t => { if (t.type === 'blob') have.set(t.path, t.sha); });
    const all = ghCollect(c), changed = [];
    /* حماية: مستودع فيه ملفات كثيرة لا يطابق مشروعك تقريباً = غالباً مستودع مشروع آخر */
    let ov = 0; all.forEach((_, p) => { if (have.has(p)) ov++; });
    if (!tr.truncated && have.size >= 5 && all.size >= 3 && ov / all.size < 0.3 &&
      !(await ui.confirm('تحذير: المستودع ' + c.repo + ' فيه ' + have.size + ' ملفاً، ولا يطابق مشروعك الحالي (' + all.size + ' ملفاً) إلا ' + ov + ' منها. قد يكون مستودع مشروع آخر. هل تدفع إليه رغم ذلك؟', 'ادفع رغم ذلك'))) return toast('أُلغي الدفع ولم يتغيّر شيء في المستودع', '');
    const jk = c.jk ? await jkApply(c, all, new Set(have.keys()), say) : null;
    for (const [path, u8] of all) { const sha = tr.truncated ? '' : await ghBlobSha(u8); if (!sha || have.get(path) !== sha) changed.push([path, u8]); }
    if (!changed.length) {
      if (jk && jk.url && !jk.skip && !jk.pagesErr) return ghAppDialog(c, jk.url, 0);
      return toast('لا تغييرات: المستودع مطابق للمشروع', 'ok');
    }
    const entries = []; let done = 0, next = 0;
    const worker = async () => {
      while (next < changed.length) {
        const [path, u8] = changed[next++];
        const b = await ghApi(c, 'POST', R + '/git/blobs', { content: ghB64(u8), encoding: 'base64' });
        entries.push({ path, mode: '100644', type: 'blob', sha: b.sha });
        say('جارٍ الرفع ' + (++done) + '/' + changed.length);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const nt = await ghApi(c, 'POST', R + '/git/trees', { base_tree: cm.tree.sha, tree: entries });
    const nc = await ghApi(c, 'POST', R + '/git/commits', { message: msg, tree: nt.sha, parents: [head] });
    await ghApi(c, 'PATCH', R + '/git/refs/heads/' + brp, { sha: nc.sha });
    log('ok', 'GitHub: دُفع ' + changed.length + ' ملف إلى ' + c.repo + '@' + c.branch + ' (' + nc.sha.slice(0, 7) + ')');
    const jkNote = !jk ? '' : jk.skip ? ' — لم يُحوَّل: لا index.html في جذر المشروع' : jk.pagesErr ? ' — تعذّر تفعيل Pages: ' + jk.pagesErr : ' — الموقع يُبنى الآن (دقيقة أو دقيقتان)';
    if (jk && jk.added && jk.added.length) log('ok', 'GitHub: أُضيفت ملفات التحويل: ' + jk.added.join('، '));
    const site = jk && jk.url && !jk.skip && !jk.pagesErr;
    if (site) return ghAppDialog(c, jk.url, changed.length);
    toast('تم الدفع: ' + changed.length + ' ملف في commit واحد' + jkNote, 'ok', { label: 'فتح الـ commit', fn: () => window.open('https://github.com/' + c.repo + '/commit/' + nc.sha, '_blank', 'noopener') });
  } catch (e) {
    const hint = c.jk && e && (e.status === 403 || e.status === 404 || e.status === 422) && !/workflow/i.test(String(e.message)) ? ' — وضع Jekyll يحتاج أيضاً Workflows وPages (Read and write)' : '';
    log('err', 'GitHub: ' + ghErrText(e) + hint); toast('فشل الدفع: ' + ghErrText(e) + hint, 'err');
  }
}
async function ghListRepos(c) {
  let out = [];
  for (let p = 1; p <= 3; p++) {
    const j = await ghApi(c, 'GET', '/user/repos?per_page=100&sort=pushed&page=' + p);
    out = out.concat(j); if (j.length < 100) break;
  }
  return out.filter(r => !r.permissions || r.permissions.push);
}
function ghSlug(v) { return String(v || '').trim().replace(/\s+/g, '-').replace(/[^A-Za-z0-9._-]/g, '').replace(/^\.+/, '').slice(0, 80); }
/* ينشئ المستودع (مع README ليكون غير فارغ) ويفعّل Pages اختيارياً؛ فشل Pages لا يُفشل الإنشاء */
async function ghCreateRepo(c, st) {
  const r = await ghApi(c, 'POST', '/user/repos', { name: st.name, description: st.desc || '', private: !!st.priv, auto_init: true });
  const br = r.default_branch || 'main'; let pages = false;
  if (st.pages && !st.priv) { try { if (st.jk) await jkEnablePages(c, r.full_name); else await ghApi(c, 'POST', '/repos/' + r.full_name + '/pages', { source: { branch: br, path: '/' } }); pages = true; } catch (e) { } }
  return { repo: r.full_name, branch: br, pages, jk: !!(st.jk && pages) };
}
function ghCreateErr(e) {
  const s = e && e.status;
  if (s === 422) return 'الاسم مستخدم عندك مسبقاً أو غير صالح — جرّب اسماً آخر';
  if (s === 401) return 'التوكن غير صالح أو منتهي';
  if (s === 403 || s === 404) return 'التوكن لا يملك صلاحية إنشاء المستودعات (Administration: Read and write) — عدّل صلاحياته أو أنشئ المستودع من موقع GitHub';
  return ghErrText(e);
}
/* ===== نافذة GitHub: لوحة واحدة بعدة عروض (ربط / رئيسي / اختيار مستودع / إنشاء / إعدادات) ===== */
const GH_ATTR = ' dir="ltr" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"';
function ghHead(sub) { return '<h3><svg class="ic brand" aria-hidden="true"><use href="#i-github"/></svg> GitHub ' + (sub ? uiSub(esc(sub)) : '') + '</h3>'; }
function ghChip(act, on, t) { return '<button type="button" class="btn' + (on ? ' primary' : '') + '" data-act="' + act + '">' + t + '</button>'; }
function ghRepoRows(list, q) {
  q = (q || '').trim().toLowerCase();
  const rows = list.map((r, i) => [r, i]).filter(x => !q || x[0].full_name.toLowerCase().includes(q))
    .map(x => uiRow('pick', 'github', esc(x[0].full_name), esc(x[0].default_branch) + (x[0].private ? ' · خاص' : ' · عام'), 'data-i="' + x[1] + '"')).join('');
  return rows || uiEmpty('لا نتائج');
}
/* حالة الموقع: on (مفعّل) | off (غير مفعّل) | unknown (غير معروف) | na (غير متاح). لا يرمي أخطاء.
   «مفعّل» = Pages موجود بمصدر Actions ووضع Jekyll مفعّل لهذا المستودع */
async function ghSiteState(c) {
  let p = null, err = null;
  try { p = await ghApi(c, 'GET', '/repos/' + c.repo + '/pages'); } catch (e) { err = e; }
  if (p) {
    const url = p.html_url || jkSiteUrl(c.repo);
    if (p.build_type !== 'workflow' || !c.jk) return { k: 'off', url };
    let t = p.status === 'built' ? 'جاهز' : p.status === 'building' ? 'يُبنى الآن…' : p.status === 'errored' ? 'فشل البناء' : 'مفعّل';
    try {
      const r = await ghApi(c, 'GET', '/repos/' + c.repo + '/actions/runs?per_page=1'), w = r.workflow_runs && r.workflow_runs[0];
      if (w) t = w.status !== 'completed' ? 'يُبنى الآن…' : w.conclusion === 'success' ? 'جاهز' : 'فشل آخر بناء — افتح المستودع ثم Actions';
    } catch (e) { }
    return { k: 'on', t, url };
  }
  try {
    const r = await ghApi(c, 'GET', '/repos/' + c.repo);
    if (r.private) { const u = await ghApi(c, 'GET', '/user'); if (u.plan && /free/i.test(u.plan.name || '') && r.owner && r.owner.type === 'User') return { k: 'na', url: '' }; }
  } catch (e) { }
  return { k: err && err.status === 404 ? 'off' : 'unknown', url: '' };
}
async function ghFillSite(c) {
  if (!c.jk || !$('ghSite')) return;
  const s = await ghSiteState(c), el = $('ghSite');
  if (!el || GH_ST.view !== 'main') return;
  GH_ST.site = s.url || '';
  if (s.k === 'on') el.innerHTML = '<div class="slabel">الموقع</div>' + uiNote('الموقع يعمل ✓ — ' + esc(s.t)) + (s.url ? '<div class="slabel" dir="ltr">' + esc(s.url) + '</div>' : '');
}
/* نافذة بعد الدفع/التفعيل: زر فتح التطبيق + تلميح التثبيت */
function ghAppDialog(c, url, n) {
  GH_ST.view = 'done';
  ui.show(ghHead(c.repo) +
    '<h3>' + (n ? 'تم الدفع: ' + n + ' ملف في commit واحد' : 'الموقع مفعّل والمستودع مطابق للمشروع') + '</h3>' +
    uiNote('الموقع يُبنى الآن وقد يحتاج دقيقة أو دقيقتين. بعدها افتح التطبيق، ثم في Chrome اختر ⋮ ثم «تثبيت التطبيق».') +
    '<button type="button" class="btn primary" data-act="app">فتح التطبيق</button>' +
    '<div class="srow"><button type="button" class="btn" data-act="web">فتح المستودع</button><button type="button" class="btn" data-ui="cancel">إغلاق</button></div>', act => {
      if (act === 'app') window.open(url, '_blank', 'noopener');
      if (act === 'web') window.open('https://github.com/' + c.repo, '_blank', 'noopener');
    });
}
const GH_ST = { view: '', repos: null, create: null, msg: '', site: '', after: '', pushMsg: '' };
/* العودة إلى نافذة الدفع بعد تغيير المستودع (أو الرجوع منه) مع إبقاء رسالة الـ commit */
function ghResumePush() { const m = GH_ST.pushMsg; GH_ST.after = ''; ui.close(null); setTimeout(() => githubPush(undefined, m), 120); }
/* تحويل المشروع إلى تطبيق (PWA) ثم دفعه، وفتح صفحة المشروع على GitHub Pages */
function ghConvertApp() {
  const c = ghCfg(); if (!c.token || !ghRepoOk(c.repo)) return githubDialog();
  ghSaveCfg({ token: c.token, repo: c.repo, branch: c.branch, dir: c.dir, jk: true });
  return githubPush(undefined, 'تحويل المشروع إلى تطبيق (PWA) من CodePatcher');
}
function ghOpenSite() {
  const c = ghCfg(); if (!ghRepoOk(c.repo)) return githubDialog();
  window.open(jkSiteUrl(c.repo), '_blank', 'noopener');
}
async function githubDialog(view, after) {
  const c = ghCfg(), raw = ghRaw();
  GH_ST.after = after === 'push' ? 'push' : '';
  if (!view) { GH_ST.create = null; view = !c.token ? 'connect' : ghRepoOk(c.repo) ? 'main' : 'pick'; }
  GH_ST.view = view;
  const go = v => githubDialog(v, GH_ST.after);
  const doOpen = u => window.open(u, '_blank', 'noopener');

  if (view === 'connect') {
    ui.show(ghHead() +
      uiNote('اربط حسابك لتدفع مشروعك إلى GitHub من هنا مباشرة.') +
      '<div class="slabel">التوكن</div><input type="password" id="ghTokIn"' + GH_ATTR + ' placeholder="github_pat_…">' +
      '<button type="button" class="btn primary" data-act="conn">ربط الحساب</button>' +
      '<button type="button" class="btn" data-act="mktok">إنشاء توكن من GitHub</button>' +
      uiNote('الصلاحيات: Contents بمستوى Read and write، وMetadata. وللمستودعات الجديدة Administration، ولوضع Jekyll + PWA: Workflows وPages (Read and write). يُحفظ التوكن على هذا الجهاز فقط ولا يدخل في أي تصدير.') +
      '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', async act => {
        if (act === 'mktok') return doOpen('https://github.com/settings/personal-access-tokens/new');
        if (act !== 'conn') return;
        const t = String($('ghTokIn').value || '').replace(/\s+/g, '');
        if (t.length < 20) return toast('انسخ التوكن كاملاً من GitHub', 'err');
        toast('جارٍ التحقق من التوكن…', '');
        const v = await ghVerify(t);
        if (!v.ok) return toast('التوكن غير صالح أو منتهي', 'err');
        if (!ghSetToken(t, v.login)) return toast('تعذّر حفظ التوكن في هذا المتصفح', 'err');
        toast('تم الربط' + (v.login ? ' — الحساب: ' + v.login : ''), 'ok');
        GH_ST.repos = null; go();
      });
    return;
  }

  if (view === 'main') {
    const rn = String(c.repo).split('/')[1] || c.repo;
    ui.show(ghHead(raw.login) + ghTargetCard(c) +
      uiRow('repos', 'folder-open', 'تغيير المستودع', 'اختر مستودعاً آخر لهذا المشروع') +
      '<div class="slabel">رسالة الـ commit</div><input type="text" id="ghMsg" value="' + esc(GH_ST.msg || ghDefMsg()) + '">' +
      '<button type="button" class="btn primary" data-act="push">دفع المشروع إلى <bdi dir="ltr">' + esc(rn) + '</bdi></button>' +
      '<div class="srow"><button type="button" class="btn" data-act="jkgo">تحويل إلى تطبيق</button><button type="button" class="btn" data-act="app">فتح الصفحة</button></div>' +
      '<div id="ghSite"></div>' +
      '<div class="srow"><button type="button" class="btn" data-act="web">فتح المستودع</button><button type="button" class="btn" data-act="new">مستودع جديد</button><button type="button" class="btn" data-act="set">الإعدادات</button></div>' +
      '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', act => {
        if (act === 'push') { GH_ST.msg = ''; const m = $('ghMsg').value; ui.close(null); return void setTimeout(() => githubPush(m), 120); }
        if (act === 'repos') return go('pick');
        if (act === 'new') return go('create');
        if (act === 'set') return go('set');
        if (act === 'web') return doOpen('https://github.com/' + c.repo);
        if (act === 'app') return doOpen(GH_ST.site || jkSiteUrl(c.repo));
        if (act === 'jkgo') { ui.close(null); return void setTimeout(ghConvertApp, 120); }
      });
    GH_ST.site = ''; ghFillSite(c);
    return;
  }

  if (view === 'pick') {
    if (!GH_ST.repos) {
      ui.show(ghHead(raw.login) + uiEmpty('جارٍ جلب مستودعاتك…') + '<button type="button" class="btn" data-ui="cancel">إلغاء</button>');
      try { GH_ST.repos = await ghListRepos(c); }
      catch (e) { toast('تعذّر جلب المستودعات: ' + ghErrText(e), 'err'); if (GH_ST.after === 'push') return ghResumePush(); return go(ghRepoOk(c.repo) ? 'main' : 'connect'); }
      if (GH_ST.view !== 'pick') return;
    }
    const list = GH_ST.repos;
    ui.show(ghHead(raw.login) +
      (GH_ST.after === 'push' ? uiNote('بعد الاختيار تعود إلى نافذة الدفع') : '') +
      '<div class="slabel">اختر المستودع (' + list.length + ')</div><input type="text" id="ghQ"' + GH_ATTR + ' placeholder="ابحث…">' +
      uiScroll('<div id="ghList">' + ghRepoRows(list, '') + '</div>', 'lg') +
      '<div class="srow"><button type="button" class="btn" data-act="back">رجوع</button><button type="button" class="btn primary" data-act="new">مستودع جديد</button></div>', (act, el) => {
        if (act === 'back') return GH_ST.after === 'push' ? ghResumePush() : go(ghRepoOk(c.repo) ? 'main' : 'connect');
        if (act === 'new') return go('create');
        if (act !== 'pick') return;
        const r = list[+el.dataset.i], cur0 = ghCfg();
        ghSaveCfg({ token: c.token, repo: r.full_name, branch: r.default_branch || 'main', dir: r.full_name === cur0.repo ? cur0.dir : '' });
        toast('اخترت: ' + r.full_name, 'ok'); if (GH_ST.after === 'push') return ghResumePush(); go('main');
      });
    $('ghQ').addEventListener('input', e => { $('ghList').innerHTML = ghRepoRows(list, e.target.value); });
    return;
  }

  if (view === 'create') {
    const st = GH_ST.create || (GH_ST.create = { name: ghSlug(ghKey() === '_' ? '' : ghKey()), desc: '', priv: false, pages: true, jk: true });
    ui.show(ghHead(raw.login) +
      '<div class="slabel">اسم المستودع (حروف إنجليزية وأرقام و - فقط)</div><input type="text" id="ghNName"' + GH_ATTR + ' value="' + esc(st.name) + '">' +
      '<div class="slabel">الوصف (اختياري)</div><input type="text" id="ghNDesc" value="' + esc(st.desc) + '">' +
      '<div class="slabel">الظهور</div><div class="srow">' + ghChip('pub', !st.priv, 'عام') + ghChip('prv', st.priv, 'خاص') + '</div>' +
      '<div class="slabel">موقع المشروع (GitHub Pages)</div><div class="srow">' + ghChip('pgon', st.pages && !st.priv, 'تفعيل') + ghChip('pgoff', !st.pages || st.priv, 'بدون') + '</div>' +
      (st.pages && !st.priv ? '<div class="slabel">نوع الموقع</div><div class="srow">' + ghChip('jkon', st.jk, 'تطبيق PWA (Jekyll)') + ghChip('jkoff', !st.jk, 'ملفات عادية') + '</div>' : '') +
      uiNote('Pages يحتاج مستودعاً عاماً في الحساب المجاني. يُنشأ المستودع ومعه ملف README ثم تدفع مشروعك إليه.') +
      '<div class="srow"><button type="button" class="btn" data-act="back">رجوع</button><button type="button" class="btn primary" data-act="mk">إنشاء</button></div>', async act => {
        const a = $('ghNName'), b = $('ghNDesc'); if (a) st.name = a.value; if (b) st.desc = b.value;
        if (act === 'back') return go(GH_ST.after === 'push' ? 'pick' : ghRepoOk(c.repo) ? 'main' : (GH_ST.repos ? 'pick' : 'connect'));
        if (act === 'pub') { st.priv = false; return go('create'); }
        if (act === 'prv') { st.priv = true; return go('create'); }
        if (act === 'pgon') { st.pages = true; return go('create'); }
        if (act === 'pgoff') { st.pages = false; return go('create'); }
        if (act === 'jkon' || act === 'jkoff') { st.jk = act === 'jkon'; return go('create'); }
        if (act !== 'mk') return;
        st.name = ghSlug(st.name); if (!st.name) return toast('اكتب اسماً بالإنجليزية', 'err');
        toast('جارٍ إنشاء المستودع…', '');
        try {
          const r = await ghCreateRepo(c, st);
          ghSaveCfg({ token: c.token, repo: r.repo, branch: r.branch, dir: '', jk: r.jk });
          GH_ST.repos = null; GH_ST.create = null;
          log('ok', 'GitHub: أُنشئ المستودع ' + r.repo);
          toast('أُنشئ ' + r.repo + (st.pages && !st.priv ? (r.pages ? ' وفُعّل الموقع' : ' — تعذّر تفعيل Pages، فعّله من إعدادات المستودع') : ''), 'ok');
          if (GH_ST.after === 'push') return ghResumePush();
          go('main');
        } catch (e) { toast('فشل الإنشاء: ' + ghCreateErr(e), 'err'); }
      });
    return;
  }

  if (view === 'set') {
    let jk = c.jk;
    ui.show(ghHead(raw.login) +
      '<div class="slabel">نوع النشر</div><div class="srow" id="ghJkRow">' + ghChip('jkoff', !jk, 'ملفات عادية') + ghChip('jkon', jk, 'تطبيق PWA (Jekyll)') + '</div>' +
      uiNote('عند اختيار «تطبيق PWA» يُضاف عند الدفع: _config.yml وGemfile وworkflow وmanifest وsw.js وأيقونات (إن لم تكن موجودة)، ويُفعَّل Pages. يحتاج التوكن Workflows وPages بمستوى Read and write.') +
      '<div class="slabel">الفرع</div><input type="text" id="ghBr"' + GH_ATTR + ' value="' + esc(c.branch) + '">' +
      '<div class="slabel">مجلد داخل المستودع (اتركه فارغاً للجذر)</div><input type="text" id="ghDir"' + GH_ATTR + ' value="' + esc(c.dir) + '">' +
      '<div class="slabel">تغيير التوكن (اتركه فارغاً للإبقاء على الحالي)</div><input type="password" id="ghTokIn"' + GH_ATTR + ' placeholder="github_pat_…">' +
      '<button type="button" class="btn primary" data-act="save">حفظ</button>' +
      '<div class="srow"><button type="button" class="btn" data-act="back">رجوع</button><button type="button" class="btn dng" data-act="off">فصل الحساب</button></div>', async (act, el) => {
        if (act === 'jkon' || act === 'jkoff') { jk = act === 'jkon'; const row = $('ghJkRow'); if (row) row.querySelectorAll('[data-act]').forEach(b => b.classList.toggle('primary', (b.dataset.act === 'jkon') === jk)); return; }
        if (act === 'back') return go(ghRepoOk(c.repo) ? 'main' : 'connect');
        if (act === 'off') { ghSetToken('', ''); GH_ST.repos = null; toast('تم فصل الحساب', 'ok'); return go('connect'); }
        if (act !== 'save') return;
        const t = String($('ghTokIn').value || '').replace(/\s+/g, '');
        if (t) {
          if (t.length < 20) return toast('انسخ التوكن كاملاً من GitHub', 'err');
          const v = await ghVerify(t); if (!v.ok) return toast('التوكن غير صالح أو منتهي', 'err');
          ghSetToken(t, v.login); GH_ST.repos = null;
        }
        const k = ghCfg();
        ghSaveCfg({ token: ghRaw().token, repo: k.repo, branch: $('ghBr').value.trim() || 'main', dir: $('ghDir').value.trim(), jk });
        toast('حُفظت الإعدادات', 'ok'); go(ghRepoOk(k.repo) ? 'main' : 'pick');
      });
  }
}

/* ===== استيراد مشروع من GitHub (مستودع عام بلا توكن، أو خاص مع الربط) ===== */
const GH_MAX_BLOB = 5 * 1024 * 1024;
function ghParseRepo(v) {
  const s = String(v || '').trim().replace(/^git@github\.com:/i, '').replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/[?#].*$/, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const m = s.match(/^([\w.-]+)\/([\w.-]+?)(?:\/tree\/(.+))?$/);
  return m ? { repo: m[1] + '/' + m[2], branch: m[3] || '' } : null;
}
function ghB64ToBytes(b64) {
  const s = atob(String(b64 || '').replace(/\s/g, '')), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return u;
}
/* mode: 'replace' (مشروع جديد من المستودع) | 'merge' (إضافة/تحديث داخل المشروع الحالي) */
async function ghImportRun(repo, branch, mode) {
  const tok = ghRaw().token || '', c = { token: tok }, R = '/repos/' + repo, say = t => toast(t, '');
  const cc = cur(); if (cc) cc.content = editor.value;
  try {
    say('جارٍ قراءة المستودع…');
    if (!branch) { const r = await ghApi(c, 'GET', R); branch = r.default_branch || 'main'; }
    const brp = encodeURIComponent(branch).replace(/%2F/g, '/');
    const tr = await ghApi(c, 'GET', R + '/git/trees/' + brp + '?recursive=1');
    let list = (tr.tree || []).filter(t => t.type === 'blob' && !SKIP_PATH.test(t.path));
    importSkips = []; let skipped = 0;
    const big = list.filter(t => t.size > GH_MAX_BLOB);
    big.forEach(t => importSkips.push({ n: t.path, w: 'أكبر من 5MB' })); skipped += big.length;
    list = list.filter(t => !(t.size > GH_MAX_BLOB));
    if (list.length > MAX_COUNT) { importSkips.push({ n: '(' + (list.length - MAX_COUNT) + ' ملف)', w: 'تجاوز حد ' + MAX_COUNT + ' ملف' }); skipped += list.length - MAX_COUNT; list = list.slice(0, MAX_COUNT); }
    if (!list.length) return toast('المستودع فارغ', 'err');
    const items = [], bins = []; let done = 0, next = 0;
    const worker = async () => {
      while (next < list.length) {
        const t = list[next++];
        try {
          const b = await ghApi(c, 'GET', R + '/git/blobs/' + t.sha), u8 = ghB64ToBytes(b.content), txt = bytesToText(u8);
          if (txt == null) bins.push({ name: t.path, u8 });
          else items.push({ name: t.path, content: jkStrip(txt), eol: bytesToText.meta.eol, enc: bytesToText.meta.enc });
        } catch (e) {
          if (e && (e.status === 401 || e.status === 403 || e.status === 429)) throw e;
          skipped++; importSkips.push({ n: t.path, w: 'تعذّر التنزيل' });
        }
        say('جارٍ التنزيل ' + (++done) + '/' + list.length);
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (!items.length) return toast(bins.length ? 'لا ملفات نصية في المستودع (الصور فقط)' : 'لا ملفات قابلة للاستيراد', 'err');
    const rep = mode === 'replace', wipe = rep ? new Map(BIN) : null;
    const n = await addItems(items, wipe);
    if (!n) return;
    bins.forEach(b => BIN.set(b.name, b.u8)); binSave();
    if (rep) { treeCwd = ''; ghSaveCfg({ token: tok, repo, branch, dir: '' }); render(); }
    log('ok', 'GitHub: استُورد ' + n + ' ملف نصي + ' + bins.length + ' ثنائي من ' + repo + '@' + branch);
    toast('استُورد ' + n + ' ملف من ' + repo + (bins.length ? ' + ' + bins.length + ' ثنائي' : '') + (skipped ? ' — تخطّي ' + skipped : ''), 'ok');
    if (importSkips.length) setTimeout(showImportReport, 400);
  } catch (e) {
    const s = e && e.status;
    const msg = s === 404 ? 'المستودع أو الفرع غير موجود (إن كان خاصاً فاربط حسابك أولاً)' : s === 403 || s === 429 ? 'تجاوزت حدّ الطلبات — اربط حسابك لرفع الحد ثم أعد المحاولة' : ghErrText(e);
    log('err', 'GitHub: ' + msg); toast('فشل الاستيراد: ' + msg, 'err');
  }
}
/* سحب آخر تحديثات المستودع المرتبط إلى المشروع الحالي (يسأل قبل استبدال أي ملف) */
function ghPull() { const c = ghCfg(); if (!ghRepoOk(c.repo)) return githubDialog(); return ghImportRun(c.repo, c.branch, 'merge'); }

const GH_IMP = { mode: 'replace', repos: null, tab: 'url', repo: '', branch: '', sel: null };
async function ghImportDialog(prefill) {
  if (prefill !== undefined) { GH_IMP.tab = 'url'; GH_IMP.repo = prefill; GH_IMP.branch = ''; }
  const raw = ghRaw(), tok = !!raw.token, tab = GH_IMP.tab === 'mine' ? 'mine' : 'url';
  const chip = (a, on, t) => '<button type="button" class="btn' + (on ? ' primary' : '') + '" data-act="' + a + '">' + t + '</button>';
  const rows = (list, q) => {
    q = (q || '').trim().toLowerCase();
    const h = list.map((r, i) => [r, i]).filter(x => !q || x[0].full_name.toLowerCase().includes(q))
      .map(x => uiRow('ipick', 'github', esc(x[0].full_name), esc(x[0].default_branch) + (x[0].private ? ' · خاص' : ' · عام'), 'data-i="' + x[1] + '"' + (GH_IMP.sel === x[0].full_name ? ' data-on="1"' : ''))).join('');
    return h || uiEmpty('لا نتائج');
  };
  const sv = () => { const a = $('giRepo'), b = $('giBr'); if (a) GH_IMP.repo = a.value; if (b) GH_IMP.branch = b.value; };
  let body;
  if (tab === 'url') body =
    '<div class="slabel">رابط المستودع أو owner/name</div><input type="text" id="giRepo"' + GH_ATTR + ' placeholder="https://github.com/owner/repo" value="' + esc(GH_IMP.repo) + '">' +
    '<div class="slabel">الفرع (اتركه فارغاً للافتراضي)</div><input type="text" id="giBr"' + GH_ATTR + ' placeholder="main" value="' + esc(GH_IMP.branch) + '">' +
    uiNote('المستودعات العامة تعمل بدون ربط الحساب.');
  else if (!tok) body = uiNote('اربط حسابك لتظهر مستودعاتك العامة والخاصة هنا.') + '<button type="button" class="btn primary" data-act="link">ربط الحساب</button>';
  else body =
    '<input type="text" id="giQ"' + GH_ATTR + ' placeholder="ابحث في مستودعاتك…">' +
    uiScroll('<div id="giList">' + uiEmpty('جارٍ جلب مستودعاتك…') + '</div>', 'md') +
    '<div class="slabel" id="giSel" dir="auto">' + (GH_IMP.sel ? 'المحدد: ' + esc(GH_IMP.sel) : 'اختر مستودعاً من القائمة') + '</div>' +
    '<div class="slabel">الفرع (اتركه فارغاً للافتراضي)</div><input type="text" id="giBr"' + GH_ATTR + ' placeholder="main" value="' + esc(GH_IMP.branch) + '">';
  const canGo = tab === 'url' || tok;
  ui.show('<h3><svg class="ic brand" aria-hidden="true"><use href="#i-github"/></svg> استيراد من GitHub ' + (raw.login ? uiSub(esc(raw.login)) : '') + '</h3>' +
    '<div class="srow gi-tabs">' + chip('turl', tab === 'url', 'من رابط') + chip('tmine', tab === 'mine', 'من مستودعاتي') + '</div>' + body +
    (canGo ? '<div class="slabel">طريقة الاستيراد</div><div class="srow" id="giMode">' + chip('mrep', GH_IMP.mode === 'replace', 'مشروع جديد') + chip('mmrg', GH_IMP.mode === 'merge', 'إضافة للحالي') + '</div>' : '') +
    '<div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button>' + (canGo ? '<button type="button" class="btn primary" data-act="go">استيراد</button>' : '') + '</div>', (act, el) => {
      if (act === 'turl' || act === 'tmine') { sv(); GH_IMP.tab = act === 'turl' ? 'url' : 'mine'; return ghImportDialog(); }
      if (act === 'link') { ui.close(null); return void setTimeout(() => githubDialog('connect'), 120); }
      if (act === 'mrep' || act === 'mmrg') {
        GH_IMP.mode = act === 'mrep' ? 'replace' : 'merge';
        const g = $('giMode'); if (g) g.querySelectorAll('.btn').forEach(b => b.classList.toggle('primary', b.dataset.act === act));
        return;
      }
      if (act === 'ipick') {
        const r = (GH_IMP.repos || [])[+el.dataset.i]; if (!r) return;
        GH_IMP.sel = r.full_name; GH_IMP.defBr = r.default_branch || 'main';
        document.querySelectorAll('#giList .mi').forEach(x => x.removeAttribute('data-on')); el.setAttribute('data-on', '1');
        const t = $('giSel'); if (t) t.textContent = 'المحدد: ' + r.full_name;
        const b = $('giBr'); if (b) b.placeholder = GH_IMP.defBr;
        return;
      }
      if (act !== 'go') return;
      sv();
      let p;
      if (tab === 'url') { p = ghParseRepo(GH_IMP.repo); if (!p) return toast('الصق رابط المستودع أو اكتب owner/name', 'err'); }
      else { if (!GH_IMP.sel) return toast('اختر مستودعاً من القائمة', 'err'); p = { repo: GH_IMP.sel, branch: '' }; }
      const br = (GH_IMP.branch || '').trim() || p.branch, mode = GH_IMP.mode;
      ui.close(null);
      setTimeout(async () => {
        if (mode === 'replace' && !(await ui.confirm('سيُستبدل المشروع الحالي (' + files.length + ' ملف) بمحتوى ' + p.repo + '. تُحفظ نقطة استرداد للملفات النصية. متابعة؟', 'استيراد'))) return;
        ghImportRun(p.repo, br, mode);
      }, 120);
    });
  if (tab !== 'mine' || !tok) return;
  try {
    if (!GH_IMP.repos) {
      let out = [];
      for (let p = 1; p <= 2; p++) { const j = await ghApi({ token: raw.token }, 'GET', '/user/repos?per_page=100&sort=pushed&page=' + p); out = out.concat(j); if (j.length < 100) break; }
      GH_IMP.repos = out;
    }
    const L = $('giList'); if (!L) return;
    L.innerHTML = rows(GH_IMP.repos, '');
    $('giQ').addEventListener('input', e => { L.innerHTML = rows(GH_IMP.repos, e.target.value); });
  } catch (e) { const L = $('giList'); if (L) L.innerHTML = uiEmpty('تعذّر جلب المستودعات — استخدم تبويب "من رابط"'); }
}

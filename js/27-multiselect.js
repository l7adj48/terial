'use strict';
/* التحديد المتعدد */
/* ===== التحديد المتعدد ===== */
function selKey(kind, key) { return (kind === 'file' ? 'f:' : 'd:') + key; }
function selToggle(kind, key) { const k = selKey(kind, key); if (selSet.has(k)) selSet.delete(k); else selSet.add(k); renderTree(); updateSelBar(); }
function selFiles() {
  const out = new Set();
  selSet.forEach(k => {
    if (k[0] === 'f') { const f = files.find(x => x.id === k.slice(2)); if (f) out.add(f); }
    else { const p = k.slice(2) + '/'; files.forEach(x => { if (x.name.startsWith(p)) out.add(x); }); }
  });
  return [...out];
}
function updateSelBar() {
  const n = selFiles().length;
  $('selCount').textContent = selSet.size ? n + ' ملف محدد' : 'اختر عناصر';
  document.querySelectorAll('#selbar .sb[data-need]').forEach(b => { b.disabled = !n; });
}
function toggleSel(on) {
  selMode = on == null ? !selMode : !!on; selSet.clear();
  $('dtool').style.display = selMode ? 'none' : ''; $('selbar').style.display = selMode ? 'flex' : 'none';
  renderTree(); updateSelBar();
}
function selAll() {
  const keys = [...$('tree').querySelectorAll('.tr')].map(r => r.dataset.id ? 'f:' + r.dataset.id : (r.dataset.p != null ? 'd:' + r.dataset.p : null)).filter(Boolean);
  const all = keys.length && keys.every(k => selSet.has(k));
  keys.forEach(k => { if (all) selSet.delete(k); else selSet.add(k); });
  renderTree(); updateSelBar();
}
function selExport() { const set = selFiles(); if (set.length) exportZip(null, set, undefined, undefined, Array.from(selSet).filter(k => k.startsWith('d:')).map(k => k.slice(2))); }
async function selDelete() {
  const set = selFiles(); if (!set.length) return;
  if (!(await ui.confirm('حذف ' + set.length + ' ملف نهائياً؟', 'حذف'))) return;
  snapNow('قبل حذف'); set.forEach(x => { const i = files.indexOf(x); if (i >= 0) files.splice(i, 1); removedIds.push(x.id); openTabs.delete(x.id); });
  lastBatch = null;
  if (!files.some(x => x.id === activeId)) activeId = files.length ? files[0].id : null;
  while (treeCwd && !files.some(x => x.name.startsWith(treeCwd + '/'))) treeCwd = dirOf(treeCwd);
  selSet.clear(); render(); scheduleSave(); updateSelBar();
  toast('تم حذف ' + set.length + ' ملف', 'ok');
}
async function newFolder(dir) {
  dir = typeof dir === 'string' ? dir : treeCwd;
  const n = await ui.prompt('مجلد جديد داخل: ' + (dir || 'الجذر') + ' (ابدأ بـ / للجذر)', 'مجلد', 'إنشاء'); if (n == null) return;
  const nn = placeIn(dir, n); if (!nn) return toast('اسم غير صالح', 'err');
  const p = nn + '/.gitkeep'; if (files.some(x => x.name === p || x.name.startsWith(nn + '/'))) return toast('المجلد موجود', 'err');
  files.push(makeFile(p, '', '')); treeCwd = nn; render(); scheduleSave(); toast('تم إنشاء المجلد: ' + nn, 'ok');
}
function resetProject(keepOne) {
  files.forEach(f => { removedIds.push(f.id); openTabs.delete(f.id); }); files = []; lastBatch = null; recent = []; treeCwd = ''; selSet.clear();
  V1 = { releases: [], draft: null }; v1Save(); lastEv = null; clearPatchUI(); projHandle = null; S.proj = ''; hideVerBar();
  if (keepOne) { const c = '<!-- ابدأ الكتابة هنا -->\n', f = makeFile('index.html', c, c); f.dirtySave = true; files.push(f); activeId = f.id; }
}
function newProject() {
  const bn = BIN.size;
  ui.show('<h3>مشروع جديد</h3><div class="slabel">سيُغلق المشروع الحالي (' + files.length + ' ملف' + (bn ? ' + ' + bn + ' ثنائي' : '') + ') وتُصفَّر الإصدارات (V1). تُحفظ نقطة استرداد للملفات النصية (الإعدادات ‹ نقاط الحفظ)، أما الملفات الثنائية والإصدارات فلا تعود.</div><div class="srow"><button type="button" class="btn primary" data-act="np_empty">مشروع فارغ</button><button type="button" class="btn" data-act="np_open">فتح ملفات/ZIP</button></div><button type="button" class="btn" data-ui="cancel">إلغاء</button>', a => {
    if (a === 'np_empty') { ui.close(null); snapNow('قبل مشروع جديد'); resetProject(true); BIN.clear(); binSave(); render(); scheduleSave(); toast('مشروع جديد فارغ', 'ok'); }
    else if (a === 'np_open') { ui.close(null); openFiles(true); }
  });
}
async function boot() {
  document.querySelectorAll('button[title]:not([aria-label])').forEach(b => b.setAttribute('aria-label', b.title));
  applyFont();
  await store.init(); await loadV1(); await loadBins(); await loadPH();
  let data = null;
  try { data = await store.load(); } catch (e) { if (store.mode === 'idb') return showRecovery(e); data = null; }
  try {
  if (data) {
    const m = data.meta || {};
    if (m.settings) { S = Object.assign(S, m.settings); delete S.gh; if (S.sym !== 'off') S.sym = 'auto'; }
    applyFont();
    files = data.files.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map(r => {
      const f = makeFile(r.name || 'untitled.txt', r.content || '', typeof r.baseline === 'string' ? r.baseline : (r.content || ''));
      f.id = r.id; f.eol = r.eol; f.enc = r.enc; f.dirtySave = !!legacyUsed;
      const cs = m.curs && m.curs[r.id]; f.cursor = cs ? cs[0] : (r.cursor || 0); f.scroll = cs ? cs[1] : (r.scroll || 0);
      return f;
    });
    activeId = files.some(f => f.id === m.activeId) ? m.activeId : files[0].id;
    if (m.opts) { $('optAtomic').checked = m.opts.atomic !== false; $('optFlex').checked = m.opts.flex !== false; }
    if (m.patchInput) $('patchInput').value = m.patchInput;
  }
  } catch (e) { files = []; return showRecovery(e); }
  if (!files.length) {
    const c = '<!-- ابدأ الكتابة هنا -->\n';
    const f = makeFile('index.html', c, c); files.push(f); activeId = f.id;
  }
  render(); renderLog(); syncViewport();
  if (data) {
    const t = data.meta && data.meta.tab;
    if (t && t !== 'p-edit' && $(t)) switchTab(t);
    toast('تم استعادة الجلسة', 'ok');
  }
  if (legacyUsed) saveSession();
  if (store.mode === 'mem') warnOnce('التخزين غير متاح في هذه البيئة — احفظ ملفاتك يدوياً');
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { _cw = 0; paintWindow(); });
}
$('patchInput').addEventListener('input', scheduleSave);
$('optAtomic').addEventListener('change', scheduleSave);
$('optFlex').addEventListener('change', scheduleSave);
window.addEventListener('pagehide', saveSession);
document.addEventListener('visibilitychange', () => { if (document.hidden) saveSession(); });

window.addEventListener('error', ev => { if (!booted) showRecovery(ev.error || ev.message); else warnOnce('خطأ غير متوقع — بياناتك محفوظة، والنسخ في الإعدادات ‹ نقاط الحفظ'); });
window.addEventListener('unhandledrejection', ev => { if (!booted) showRecovery(ev.reason); });
const startBoot = () => boot().then(() => { if (!bootFailed) booted = true; }).catch(e => showRecovery(e));
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startBoot); else startBoot();

'use strict';
/* الدرج الجانبي وبحث المشروع */
/* ===== الدرج الجانبي: شجرة الملفات + بحث المشروع ===== */
function expandTo(name) { treeCwd = name.split('/').slice(0, -1).join('/'); }
let treeCwd = '';
const EXT_RANK = { js: 1, gs: 1, mjs: 1, jsx: 1, ts: 1, html: 2, htm: 2, css: 3, json: 4, md: 5, txt: 5 };
const NAT = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
function rankOf(n) { return EXT_RANK[(n.split('.').pop() || '').toLowerCase()] || 9; }
function sortFiles(a, b) { return rankOf(a.base) - rankOf(b.base) || NAT.compare(a.base, b.base); }
function drawerView(v) {
  drawerV = v;
  $('dFiles').hidden = v !== 'files';
  $('dSearch').hidden = v !== 'search';
  $('dtF').classList.toggle('sel', v === 'files');
  $('dtS').classList.toggle('sel', v === 'search');
  if (v === 'files') renderTree(); else setTimeout(() => $('psQ').focus(), 220);
}
function openDrawer(v) {
  const c = cur(); if (c) expandTo(c.name);
  drawerView(v || 'files');
  $('drawer').classList.add('open'); $('dback').classList.add('open'); drawerOn = true; document.body.classList.add('side-open'); if (typeof updateSymBar === 'function') updateSymBar(); if (!dHist) dHist = histPush();
}
function closeDrawer() {
  if (selMode) toggleSel(false);
  $('drawer').classList.remove('open'); $('dback').classList.remove('open'); drawerOn = false; document.body.classList.remove('side-open'); closePop(); if (dHist) { dHist = 0; histBack(); }
  const a = document.activeElement;
  if (a && $('drawer').contains(a) && a.blur) a.blur();
  setTimeout(syncViewport, 60);
}
function openFileById(id) {
  if (id !== activeId) { saveCursor(); activeId = id; render(); scheduleSave(); }
  switchTab('p-edit'); closeDrawer();
}
function openAt(id, line, col, len) {
  const f = files.find(x => x.id === id); if (!f) return;
  switchTab('p-edit'); closeDrawer();
  if (id !== activeId) { saveCursor(); activeId = id; render(); scheduleSave(); }
  const p = Math.min(doc.ls[line - 1] + col, editor.value.length);
  editor.setSelectionRange(p, p + len); f.cursor = p; doc.cur = line - 1;
  setTimeout(() => { revealIndex(p); updateStatus(); }, 60);
}
function togglePs(k) { psF[k] = !psF[k]; $(k === 'case' ? 'psCase' : 'psRegex').classList.toggle('on', psF[k]); }
function psBuild() {
  const q = $('psQ').value; if (!q) return null;
  const sp = '.*+?^${}()|[]' + BSL;
  const src = psF.regex ? q : q.split('').map(c => sp.includes(c) ? BSL + c : c).join('');
  try { return new RegExp(src, psF.case ? '' : 'i'); }
  catch (e) { $('psInfo').textContent = 'تعبير نمطي غير صالح'; return null; }
}
function runSearch() {
  const re = psBuild(); if (!re) return;
  const c = cur(); if (c) c.content = editor.value;
  const cap = 400; let total = 0, nf = 0, h = '';
  for (const f of files) {
    if (total >= cap) break;
    const lines = f.content.split(NLC); let hits = '', k = 0;
    for (let i = 0; i < lines.length && k < 60 && total < cap; i++) {
      const m = re.exec(lines[i]); if (!m) continue;
      k++; total++;
      const s = Math.max(0, m.index - 30), a = m.index - s, ml = m[0].length;
      const snip = lines[i].slice(s, m.index + ml + 60);
      hits += `<div class="sr" data-act="go" data-id="${f.id}" data-l="${i + 1}" data-c="${m.index}" data-n="${ml}"><b>${i + 1}</b><span>${esc(snip.slice(0, a))}<mark>${esc(snip.slice(a, a + ml))}</mark>${esc(snip.slice(a + ml))}</span></div>`;
    }
    if (k) { nf++; h += `<div class="sf">${esc(f.name)} <i>${k}</i></div>` + hits; }
  }
  $('psOut').innerHTML = h || '<div class="slabel">لا نتائج</div>';
  $('psInfo').textContent = total + ' نتيجة في ' + nf + ' ملف' + (total >= cap ? ' (الحد ' + cap + ')' : '');
  $('psOut').scrollTop = 0;
}
function replaceProject() {
  const re0 = psBuild(); if (!re0) return;
  const r = $('psR').value, c = cur(); if (c) c.content = editor.value;
  const re = new RegExp(re0.source, re0.flags + 'gm');
  const plan = []; let total = 0;
  files.forEach(f => {
    const cnt = (f.content.match(re) || []).length; if (!cnt) return;
    const out = psF.regex ? f.content.replace(re, r) : f.content.replace(re, () => r);
    if (out !== f.content) { plan.push({ f, out }); total += cnt; }
  });
  if (!plan.length) { $('psInfo').textContent = 'لا نتائج'; return; }
  ui.confirm('استبدال ' + total + ' تطابق في ' + plan.length + ' ملف؟', 'استبدال').then(ok => {
    if (!ok) return;
    snapNow('قبل استبدال المشروع');
    const items = [];
    plan.forEach(p => {
      items.push({ id: p.f.id, before: p.f.content, after: p.out });
      if (p.f.id === activeId) setAll(p.out);
      else { pushHist(p.f, diffRange(p.f.content, p.out), true); p.f.content = p.out; p.f.dirtySave = true; }
    });
    lastBatch = { items };
    render(); scheduleSave(); runSearch();
    toast('استُبدل ' + total + ' في ' + plan.length + ' ملف (التراجع من تبويب الباتشات)', 'ok');
  });
}

/* ضغط مطوّل على صف: قائمة منبثقة */
let lpT = 0, lpFired = false;
const treeEl = $('tree');
treeEl.addEventListener('touchstart', e => {
  lpFired = false; clearTimeout(lpT); const el = e.target;
  lpT = setTimeout(() => { lpFired = true; try { if (navigator.vibrate) navigator.vibrate(15); } catch (x) { } ctxFromEl(el); }, 480);
}, { passive: true });
['touchend', 'touchmove', 'touchcancel'].forEach(t => treeEl.addEventListener(t, () => clearTimeout(lpT), { passive: true }));
treeEl.addEventListener('contextmenu', e => { e.preventDefault(); clearTimeout(lpT); if (!lpFired) { lpFired = true; ctxFromEl(e.target); } });
treeEl.addEventListener('click', e => { if (lpFired) { lpFired = false; e.stopPropagation(); e.preventDefault(); } }, true);
$('drawer').addEventListener('click', e => {
  const a = e.target.closest('[data-act]'); if (!a) return;
  const t = a.dataset.act;
  if (t === 'paste') pasteClip();
  else if (t === 'clipclr') { clip = null; renderTree(); }
  else if (t === 'ck') selToggle(a.dataset.k, a.dataset.k === 'file' ? a.dataset.id : a.dataset.p);
  else if (t === 'file' && selMode) selToggle('file', a.dataset.id);
  else if (t === 'more') { e.stopPropagation(); popMenu(a.dataset.k, a.dataset.k === 'file' ? a.dataset.id : a.dataset.p, a.closest('.tr')); }
  else if (t === 'cd') { treeCwd = a.dataset.p; renderTree(); $('tree').scrollTop = 0; }
  else if (t === 'file') openFileById(a.dataset.id);
  else if (t === 'go') openAt(a.dataset.id, +a.dataset.l, +a.dataset.c, +a.dataset.n);
});
$('psQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); runSearch(); } });
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
  if (mod && k === 'p') { e.preventDefault(); openDrawer('files'); setTimeout(() => $('dFilter').focus(), 240); }
  else if (mod && e.shiftKey && k === 'f') { e.preventDefault(); e.stopPropagation(); openDrawer('search'); }
}, true);
let tx = 0, ty = 0, tOn = false;
document.addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tOn = true; }, { passive: true });
document.addEventListener('touchend', e => {
  if (!tOn) return; tOn = false;
  const t = e.changedTouches[0], dx = t.clientX - tx, dy = Math.abs(t.clientY - ty);
  if (dy > 50) return;
  if (!drawerOn && tx < 24 && dx > 60 && currentTab === 'p-edit') openDrawer();
  else if (drawerOn && dx < -70 && e.target.closest && e.target.closest('#drawer')) closeDrawer();
}, { passive: true });

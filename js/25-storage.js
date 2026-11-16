'use strict';
/* التخزين: IndexedDB / localStorage */
/* ===== التخزين: IndexedDB ثم localStorage ثم الذاكرة ===== */
const store = {
  mode: 'mem', db: null,
  async init() {
    try {
      if (!window.indexedDB) throw 0;
      this.db = await new Promise((res, rej) => {
        const r = indexedDB.open('codepatcher', 1);
        r.onupgradeneeded = () => { r.result.createObjectStore('files', { keyPath: 'id' }); r.result.createObjectStore('meta'); };
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); r.onblocked = () => rej(0);
      });
      this.mode = 'idb'; return;
    } catch (e) { }
    try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); this.mode = 'ls'; } catch (e) { this.mode = 'mem'; }
  },
  req(name, fn) { return new Promise((res, rej) => { const r = fn(this.db.transaction(name).objectStore(name)); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); },
  async load() {
    if (this.mode === 'idb') {
      const fs = await this.req('files', s => s.getAll());
      const meta = await this.req('meta', s => s.get('session'));
      if (fs.length) return { files: fs, meta: meta || {} };
    }
    const keys = this.mode === 'ls' ? [LS_KEY, ...LEGACY_KEYS] : LEGACY_KEYS;
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k); if (!raw) continue;
        const d = JSON.parse(raw); if (!d.files || !d.files.length) continue;
        const fl = d.files.map((f, i) => {
          const c = typeof f.content === 'string' ? f.content : '';
          return { id: 'L' + i, name: f.name || 'untitled.txt', content: c, baseline: f.same ? c : (typeof f.baseline === 'string' ? f.baseline : c), cursor: f.cursor || 0, scroll: f.scroll || 0, order: i };
        });
        if (k !== LS_KEY) legacyUsed = k;
        return { files: fl, meta: { activeId: fl[Math.min(Math.max(0, d.activeIndex || 0), fl.length - 1)].id, tab: d.activeTab, patchInput: d.patchInput, opts: d.opts, settings: d.settings, curs: {} } };
      } catch (e) { }
    }
    return null;
  },
  async save(snap) {
    if (this.mode === 'idb') {
      await new Promise((res, rej) => {
        const t = this.db.transaction(['files', 'meta'], 'readwrite');
        const fs = t.objectStore('files'), ms = t.objectStore('meta');
        snap.dirty.forEach(f => fs.put(f)); snap.removed.forEach(id => fs.delete(id));
        ms.put(snap.meta, 'session');
        t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    } else if (this.mode === 'ls') {
      const d = { version: 17, files: snap.all.map(f => { const o = { name: f.name, content: f.content, cursor: f.cursor, scroll: f.scroll }; if (f.baseline === f.content) o.same = 1; else o.baseline = f.baseline; return o; }), activeIndex: Math.max(0, snap.all.findIndex(f => f.id === snap.meta.activeId)), activeTab: snap.meta.tab, patchInput: snap.meta.patchInput, opts: snap.meta.opts, settings: snap.meta.settings };
      const json = JSON.stringify(d);
      if (json.length > 4.5 * 1024 * 1024) throw new Error('size');
      localStorage.setItem(LS_KEY, json);
    } else throw new Error('mem');
  }
};
function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(saveSession, 800); }
async function saveSession() {
  clearTimeout(saveTimer); if (bootFailed) return;
  const c = cur(); if (c) { c.content = editor.value; c.cursor = editor.selectionStart; c.scroll = editor.scrollTop; }
  updateVerBadge();
  const rec = f => ({ id: f.id, name: f.name, content: f.content, baseline: f.baseline, cursor: f.cursor || 0, scroll: f.scroll || 0, order: files.indexOf(f), eol: f.eol, enc: f.enc });
  const dirty = files.filter(f => f.dirtySave), removed = removedIds.slice();
  const meta = { activeId, tab: currentTab, patchInput: $('patchInput').value || '', opts: { atomic: $('optAtomic').checked, flex: $('optFlex').checked }, settings: S, curs: {} };
  files.forEach(f => { meta.curs[f.id] = [f.cursor || 0, f.scroll || 0]; });
  try {
    await store.save({ dirty: dirty.map(rec), removed, all: files.map(rec), meta });
    dirty.forEach(f => { f.dirtySave = false; }); removedIds = removedIds.filter(x => !removed.includes(x));
    if (legacyUsed && store.mode !== 'mem') { try { localStorage.removeItem(legacyUsed); } catch (e) { } legacyUsed = null; }
  } catch (e) {
    warnOnce(store.mode === 'mem' ? 'التخزين غير متاح هنا — الجلسة لن تُحفظ، احفظ ملفاتك يدوياً' : 'تعذر حفظ الجلسة — احفظ ملفاتك يدوياً');
  }
}

function fiOf(n) {
  const e = (n.split('.').pop() || '').toLowerCase();
  const m = { js: 'js', mjs: 'js', gs: 'js', ts: 'js', jsx: 'js', html: 'html', htm: 'html', xml: 'html', css: 'css', json: 'json', md: 'md', markdown: 'md', png: 'img', jpg: 'img', jpeg: 'img', gif: 'img', webp: 'img', svg: 'img', ico: 'img' };
  return m[e] || 'txt';
}
function ckBox(on, attrs) { return "<span class='ck" + (on ? ' on' : '') + "' data-act='ck' " + attrs + '>' + ic(on ? 'check-square' : 'square') + '</span>'; }
function rowFile(f, label) {
  const k = fiOf(label), on = selMode && selSet.has('f:' + f.id);
  return "<div class='tr" + (f.id === activeId && !selMode ? ' act' : '') + (on ? ' chk' : '') + "' data-act='file' data-id='" + f.id + "'>" + (selMode ? ckBox(on, "data-k='file' data-id='" + f.id + "'") : '') + "<span class='fi fi-" + k + "'>" + ic('file-' + k) + "</span><span class='nm'>" + esc(label) + '</span>' + (f.content !== f.baseline ? "<span class='dtd' title='غير محفوظ'></span>" : '') + "<button type='button' class='mb' data-act='more' data-k='file' data-id='" + f.id + "' aria-label='المزيد'>" + ic('more') + '</button></div>';
}
function rowDir(p, name, cnt) {
  const on = selMode && selSet.has('d:' + p);
  return "<div class='tr" + (on ? ' chk' : '') + "' data-p='" + esc(p) + "'>" + (selMode ? ckBox(on, "data-k='dir' data-p='" + esc(p) + "'") : '') + "<div class='tl' data-act='cd' data-p='" + esc(p) + "'><span class='fi fi-d'>" + ic('folder') + "</span><span class='nm'>" + esc(name) + "</span><span class='cnt'>" + cnt + "</span></div><button type='button' class='mb' data-act='more' data-k='dir' data-p='" + esc(p) + "' aria-label='المزيد'>" + ic('more') + '</button></div>';
}
function clearDrawerFilter() {
  const inp = $('dFilter'); if (!inp) return;
  inp.value = ''; renderTree(); inp.focus();
}
function renderTree() {
  const q = $('dFilter').value.trim().toLowerCase(); let h = '';
  const clrBtn = $('dFilterClr'); if (clrBtn) clrBtn.hidden = !q;
  const folderCount = new Set(files.map(f => f.name.split('/').slice(0, -1).filter(Boolean).reduce((a, x) => a ? a + '/' + x : x, '')).flatMap(p => { const a=[]; while(p){a.push(p);p=p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';} return a; })).size;
  const countEl = $('explorerCount'), metaEl = $('explorerMeta');
  if (countEl) countEl.textContent = files.length + ' ملف';
  if (metaEl) metaEl.textContent = folderCount + ' مجلد · ' + files.filter(f => f.content !== f.baseline).length + ' تغييرات غير محفوظة';
  if (clip) h += "<div class='issue clip-bar'><b>" + (clip.mode === 'cut' ? 'نقل' : 'نسخ') + ': ' + clip.list.length + " ملف</b><button type='button' class='pmini' data-act='paste'>لصق في: " + esc(treeCwd || 'الجذر') + "</button><button type='button' class='pmini' data-act='clipclr'>إلغاء</button></div>";
  if (q) { files.filter(f => f.name.toLowerCase().includes(q)).map(f => ({ f, base: f.name })).sort(sortFiles).forEach(x => { h += rowFile(x.f, x.base); }); }
  else {
    let acc = ''; h += "<div class='tree-location'><span class='tree-location-label'>الموقع الحالي</span><div class='crumbs'><span class='cr' data-act='cd' data-p='' aria-label='الجذر'>" + ic('home') + '<b>الجذر</b></span>';
    (treeCwd ? treeCwd.split('/') : []).forEach(p => { acc = acc ? acc + '/' + p : p; h += "<span class='cr' data-act='cd' data-p='" + esc(acc) + "'>› " + esc(p) + '</span>'; });
    h += '</div></div>';
    const pre = treeCwd ? treeCwd + '/' : '', dirs = {}, fl = [];
    files.forEach(f => { if (!f.name.startsWith(pre)) return; const rest = f.name.slice(pre.length), i = rest.indexOf('/'); if (i < 0) fl.push({ f, base: rest }); else { const d = rest.slice(0, i); dirs[d] = (dirs[d] || 0) + 1; } });
    const dirNames = Object.keys(dirs).sort(NAT.compare);
    if (dirNames.length) h += "<div class='tree-section-label'><span>المجلدات</span><i>" + dirNames.length + " مجلد</i></div>";
    dirNames.forEach(d => { h += rowDir(pre + d, d, dirs[d]); });
    fl.sort(sortFiles).forEach((x, i) => { if (i === 0) h += "<div class='tree-section-label'><span>الملفات</span><i>" + fl.length + " ملف</i></div>"; h += rowFile(x.f, x.base); });
  }
  $('tree').classList.toggle('selmode', selMode);
  $('tree').innerHTML = h || "<div class='explorer-empty'><span class='empty-icon'>" + ic('folder-open') + "</span><b>لا توجد عناصر هنا</b><small>أنشئ ملفاً أو مجلداً جديداً للبدء.</small></div>";
}
function ctxFromEl(el) { const r = el && el.closest && el.closest('.tr'); if (!r) return; if (selMode) { selToggle(r.dataset.id ? 'file' : 'dir', r.dataset.id || r.dataset.p); return; } popMenu(r.dataset.id ? 'file' : 'dir', r.dataset.id || r.dataset.p, r); }
function closePop() { ['pop', 'pback'].forEach(id => { const e = $(id); if (e) e.remove(); }); document.querySelectorAll('.tr.sel').forEach(r => r.classList.remove('sel')); }
function popMenu(kind, key, row) {
  closePop();
  const isF = kind === 'file', f = isF ? files.find(x => x.id === key) : null; if (isF && !f) return;
  const path = isF ? f.name : key; row.classList.add('sel');
  const it = (a, i, t, c) => "<div class='pi" + (c ? ' ' + c : '') + "' data-pa='" + a + "'>" + ic(i) + '<span>' + t + '</span></div>';
  const h = (isF ? it('open', 'file-txt', 'فتح') : it('cd', 'folder-open', 'فتح المجلد')) + it('ren', 'edit', 'إعادة تسمية') + it('sel', 'check-square', 'تحديد') + it('clipc', 'copy', 'نسخ (للصق في مكان آخر)') + it('clipx', 'tab', 'قص (للنقل)') + (!isF && clip ? it('pastehere', 'paste', 'لصق هنا') : '') + (isF ? it('dup', 'copy', 'نسخ الملف') : it('new', 'file-plus', 'ملف جديد هنا') + it('newf', 'folder-plus', 'مجلد جديد هنا')) + it('path', 'link', 'نسخ المسار') + (isF ? '' : it('zip', 'export', 'تصدير ZIP')) + "<div class='psep'></div>" + it('del', 'trash', 'حذف', 'dng');
  const b = document.createElement('div'); b.id = 'pback'; b.addEventListener('click', closePop);
  const p = document.createElement('div'); p.id = 'pop'; p.className = 'pop'; p.innerHTML = h; document.body.append(b, p);
  const r = row.getBoundingClientRect(), w = p.offsetWidth, ph = p.offsetHeight;
  let top = r.bottom + 4; if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 4);
  p.style.top = top + 'px'; p.style.left = Math.max(8, Math.min(r.left + 36, window.innerWidth - w - 8)) + 'px';
  p.addEventListener('click', async e => {
    const x = e.target.closest('[data-pa]'); if (!x) return; const a = x.dataset.pa; closePop();
    if (a === 'open') openFileById(key);
    else if (a === 'cd') { treeCwd = key; renderTree(); }
    else if (a === 'ren') { const r2 = Array.from($('tree').querySelectorAll('.tr')).find(q => isF ? q.dataset.id === key : q.dataset.p === key); if (r2) startRename(kind, key, r2); }
    else if (a === 'dup') { const i = f.name.lastIndexOf('.'), ext = i > f.name.lastIndexOf('/') + 1 ? f.name.slice(i) : '', stem = ext ? f.name.slice(0, i) : f.name; let nn = stem + '-copy' + ext, k = 2; while (files.some(x => x.name === nn)) nn = stem + '-copy' + (k++) + ext; files.push(makeFile(nn, f.id === activeId ? editor.value : f.content, '')); render(); scheduleSave(); toast('تم النسخ', 'ok'); }
    else if (a === 'new') newFile(key);
    else if (a === 'newf') newFolder(key);
    else if (a === 'clipc') setClip('copy', [{ kind, key }]);
    else if (a === 'clipx') setClip('cut', [{ kind, key }]);
    else if (a === 'pastehere') { treeCwd = key; pasteClip(); }
    else if (a === 'sel') { toggleSel(true); selToggle(kind, key); }
    else if (a === 'path') copyToClipboard(path).then(() => toast('تم نسخ المسار', 'ok'));
    else if (a === 'zip') exportZip(key);
    else if (a === 'del') {
      const set = isF ? [f] : files.filter(x => x.name.startsWith(key + '/')); if (!set.length) return;
      if (!(await ui.confirm(isF ? 'حذف «' + f.name + '» نهائياً؟' : 'حذف المجلد وما فيه (' + set.length + ' ملف)؟', 'حذف'))) return;
      snapNow('قبل حذف'); set.forEach(x => { const i = files.indexOf(x); if (i >= 0) files.splice(i, 1); removedIds.push(x.id); openTabs.delete(x.id); });
      lastBatch = null; if (!files.some(x => x.id === activeId)) activeId = files.length ? files[0].id : null; render(); scheduleSave(); toast('تم الحذف', 'ok');
    }
  });
}
function startRename(kind, key, row) {
  const isF = kind === 'file', f = isF ? files.find(x => x.id === key) : null; if (isF && !f) return;
  const path = isF ? f.name : key, base = path.split('/').pop(), pre = path.slice(0, path.length - base.length);
  const nm = row.querySelector('.nm'); nm.innerHTML = "<input class='rin' autocapitalize='off' autocorrect='off' spellcheck='false'>";
  const i = nm.firstChild; i.value = base; row.classList.add('ren');
  row.insertAdjacentHTML('beforeend', "<button type='button' class='mb rb' data-r='1' aria-label='تأكيد'>" + ic('check') + "</button><button type='button' class='mb rb' data-r='0' aria-label='إلغاء'>" + ic('x') + '</button>');
  const dot = base.lastIndexOf('.'); setTimeout(() => { i.focus(); i.setSelectionRange(0, isF && dot > 0 ? dot : base.length); }, 30);
  let busy = false;
  const ext = s => s.includes('.') ? s.split('.').pop().toLowerCase() : '';
  const done = async ok => {
    if (busy) return; busy = true;
    const nb = i.value.trim();
    if (!ok || !nb || nb === base) { renderTree(); return; }
    if (/[\\\/:*?"<>|]/.test(nb)) { toast('الاسم يحتوي أحرفاً غير مسموحة', 'err'); busy = false; i.focus(); return; }
    const to = pre + nb, set = isF ? [f] : files.filter(x => x.name.startsWith(key + '/'));
    const others = files.filter(x => !set.includes(x)).map(x => x.name);
    if (isF ? others.includes(to) : set.some(x => others.includes(to + x.name.slice(key.length)))) { toast('الاسم مستخدم', 'err'); busy = false; i.focus(); return; }
    let msg = 'تغيير الاسم من «' + base + '» إلى «' + nb + '»؟' + (isF ? '' : ' (يشمل ' + set.length + ' ملف)');
    if (isF && ext(base) !== ext(nb)) msg += ' — سيتغير نوع الملف';
    const moves = new Map(); set.forEach(x => moves.set(x.name, isF ? to : to + x.name.slice(key.length)));
    const c0 = cur(); if (c0) c0.content = editor.value;
    const plan = planLinkUpdates(moves);
    let okc;
    if (plan.total) {
      okc = await new Promise(res => {
        ui.show('<h3>' + esc(msg) + '</h3><label class="opt"><input type="checkbox" id="lkOn" checked><span>تحديث الروابط في ' + plan.list.length + ' ملف (' + plan.total + ' رابط)</span></label><div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button><button type="button" class="btn primary" data-ui="ok">تغيير الاسم</button></div>');
        ui.kind = 'confirm'; ui.resolve = res;
      });
    } else okc = await ui.confirm(msg, 'تغيير الاسم');
    if (!okc) { busy = false; renderTree(); return; }
    const doLinks = plan.total && $('lkOn') && $('lkOn').checked;
    const rec = { ren: set.map(x => ({ f: x, from: x.name, to: moves.get(x.name) })), edits: doLinks ? applyLinkEdits(plan.list) : [], cwd: treeCwd };
    set.forEach(x => { x.name = moves.get(x.name); x.lang = langOf(x.name); x.dirtySave = true; });
    if (!isF && (treeCwd === key || treeCwd.startsWith(key + '/'))) treeCwd = to + treeCwd.slice(key.length);
    lastRename = rec;
    render(); scheduleSave();
    toast('تمت إعادة التسمية' + (rec.edits.length ? ' وتحديث ' + plan.total + ' رابط' : ''), 'ok', { label: 'تراجع', fn: undoRename });
  };
  i.addEventListener('click', e => e.stopPropagation());
  i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); done(true); } else if (e.key === 'Escape') done(false); });
  i.addEventListener('blur', () => setTimeout(() => { if (!busy) done(false); }, 200));
  row.querySelectorAll('.rb').forEach(b => { b.addEventListener('pointerdown', e => e.preventDefault()); b.addEventListener('click', e => { e.stopPropagation(); done(b.dataset.r === '1'); }); });
}

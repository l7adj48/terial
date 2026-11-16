'use strict';
/* الملفات والتبويبات */
/* ===== الملفات والتبويبات ===== */
function render() {
  if (activeId) { openTabs.add(activeId); if (recent[0] !== activeId) recent = [activeId].concat(recent.filter(x => x !== activeId)).slice(0, 10); }
  const valid = new Set(files.map(f => f.id));
  openTabs.forEach(i => { if (!valid.has(i)) openTabs.delete(i); });
  const tb = $('tabbar'); tb.textContent = '';
  if (!files.length) { const d = document.createElement('div'); d.className = 'filet active'; d.textContent = 'لا يوجد ملف'; tb.appendChild(d); }
  let activeEl = null;
  files.filter(f => openTabs.has(f.id)).forEach(f => {
    const d = document.createElement('div');
    d.className = 'filet' + (f.id === activeId ? ' active' : '') + (f.content !== f.baseline ? ' dirty' : '');
    const dot = document.createElement('span'); dot.className = 'dot';
    const nm = document.createElement('span'); nm.dir = 'ltr'; nm.textContent = f.name;
    const x = document.createElement('span'); x.className = 'x'; x.setAttribute('role', 'button'); x.setAttribute('aria-label', 'إغلاق التبويب'); x.title = 'إغلاق التبويب'; x.innerHTML = ic('x', 's');
    x.addEventListener('click', ev => { ev.stopPropagation(); closeTab(f.id); });
    d.title = f.id === activeId ? 'اضغط لإعادة تسمية الملف' : f.name;
    d.append(dot, nm, x);
    d.addEventListener('click', () => { if (f.id === activeId) renameFile(); else { saveCursor(); activeId = f.id; render(); scheduleSave(); } });
    tb.appendChild(d); if (f.id === activeId) activeEl = d;
  });
  if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ inline: 'center', block: 'nearest' });
  const c = cur();
  editor.disabled = !c; editor.value = c ? c.content : '';
  reparse();
  if (c) {
    const p = Math.min(c.cursor || 0, c.content.length);
    try { editor.setSelectionRange(p, p); } catch (e) { }
    editor.scrollTop = c.scroll || 0;
  }
  doc.cur = lineAt(editor.selectionStart);
  paintWindow(); updateStatus(); updateLintStatus(); markDirty();
  runLint();
  if (drawerOn && drawerV === 'files') renderTree();
}
function closeTab(id) {
  const vis = files.filter(f => openTabs.has(f.id));
  if (vis.length <= 1) return toast('هذا آخر تبويب مفتوح');
  const i = vis.findIndex(f => f.id === id);
  openTabs.delete(id);
  if (activeId === id) { const nx = vis.filter(f => f.id !== id)[Math.max(0, i - 1)]; saveCursor(); activeId = nx.id; }
  render(); scheduleSave();
}
function saveCursor() { const f = cur(); if (f) { f.cursor = editor.selectionStart; f.scroll = editor.scrollTop; } }
async function renameFile() {
  const f = cur(); if (!f) return;
  const n = await ui.prompt('اسم الملف', f.name, 'حفظ'); if (n == null) return;
  const nn = n.trim(); if (!nn || nn === f.name) return;
  if (files.some(x => x !== f && x.name === nn)) return toast('الاسم مستخدم', 'err');
  f.name = nn; f.lang = langOf(nn); f.dirtySave = true; render(); scheduleSave();
}
function placeIn(dir, v) { let n = String(v || '').trim().replace(/\\+/g, '/'); const root = n.startsWith('/'); n = n.replace(/^\/+|\/+$/g, '').replace(/\/{2,}/g, '/'); if (!n || n.split('/').some(x => x === '..' || x === '.')) return ''; return root || !dir ? n : dir + '/' + n; }
async function newFile(dir) {
  dir = typeof dir === 'string' ? dir : treeCwd;
  const n = await ui.prompt('ملف جديد داخل: ' + (dir || 'الجذر') + ' (ابدأ بـ / للجذر)', 'untitled.html', 'إنشاء'); if (n == null) return;
  const nn = placeIn(dir, n); if (!nn) return toast('اسم غير صالح', 'err');
  if (files.some(x => x.name === nn)) return toast('الاسم مستخدم', 'err');
  saveCursor(); const f = makeFile(nn, '', ''); files.push(f); activeId = f.id; expandTo(nn); render(); scheduleSave();
}
let newProjWipe = false;
function openFiles(rep) { newProjWipe = rep === true; $('fileIn').click(); }

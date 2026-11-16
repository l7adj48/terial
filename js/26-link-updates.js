'use strict';
/* تحديث الروابط عند إعادة التسمية/النقل */
/* ===== تحديث الروابط عند إعادة التسمية أو النقل ===== */
const LINK_EXT = /\.(html?|css|m?js|jsx|tsx?|svg|xml)$/i;
function normPath(p) {
  const out = [];
  for (const x of p.split('/')) { if (!x || x === '.') continue; if (x === '..') { if (!out.length) return null; out.pop(); } else out.push(x); }
  return out.join('/');
}
function dirOf(p) { const i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
function relPath(fromDir, to) {
  const a = fromDir ? fromDir.split('/') : [], b = to.split('/'); let i = 0;
  while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
  return '../'.repeat(a.length - i) + b.slice(i).join('/');
}
/* لا يُعدَّل إلا نص بين علامتي اقتباس أو داخل url() يشير فعلاً إلى ملف موجود في المشروع */
function planLinkUpdates(moves) {
  const names = new Set(files.map(f => f.name)), mv = p => moves.has(p) ? moves.get(p) : p;
  const list = []; let total = 0;
  const re = /(["'])([^"'\s<>`]{1,300})\1|url\(\s*([^)"'\s]+)\s*\)/g;
  files.forEach(g => {
    if (!LINK_EXT.test(g.name)) return;
    const gOld = g.name, gNew = mv(gOld), src = g.content; let n = 0;
    const after = src.replace(re, (m, q, s1, s2) => {
      const raw = s1 != null ? s1 : s2;
      if (!raw || /^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(raw)) return m;
      const mm = /^([^?#]*)([?#].*)?$/.exec(raw), pp = mm[1], tail = mm[2] || '';
      if (!pp) return m;
      const abs = pp[0] === '/';
      const target = normPath(abs ? pp : (dirOf(gOld) ? dirOf(gOld) + '/' : '') + pp);
      if (target == null || !names.has(target)) return m;
      const t2 = mv(target);
      if (t2 === target && dirOf(gNew) === dirOf(gOld)) return m;
      let np = abs ? '/' + t2 : relPath(dirOf(gNew), t2);
      if (!abs && pp.startsWith('./') && !np.startsWith('.')) np = './' + np;
      if (np === pp) return m;
      n++;
      return q !== undefined ? q + np + tail + q : 'url(' + np + tail + ')';
    });
    if (n) { list.push({ f: g, before: src, after, n }); total += n; }
  });
  return { list, total };
}
function applyLinkEdits(list) {
  return list.map(e => {
    const f = e.f;
    if (f.id === activeId) setAll(e.after);
    else { pushHist(f, diffRange(f.content, e.after), true); f.content = e.after; f.dirtySave = true; }
    return { f, before: e.before, after: e.after };
  });
}
function undoRename() {
  const r = lastRename; if (!r) return; lastRename = null;
  r.ren = r.ren.filter(x => files.includes(x.f));
  const rest = new Set(files.filter(f => !r.ren.some(x => x.f === f)).map(f => f.name));
  if (r.ren.some(x => x.f.name !== x.to || rest.has(x.from))) return toast('تعذر التراجع: تغيّرت الأسماء', 'err');
  r.edits.forEach(e => {
    const f = e.f; if (!files.includes(f)) return;
    if (f.id === activeId) { if (editor.value === e.after) setAll(e.before); }
    else if (f.content === e.after) { pushHist(f, diffRange(f.content, e.before), true); f.content = e.before; f.dirtySave = true; }
  });
  r.ren.forEach(x => { x.f.name = x.from; x.f.lang = langOf(x.from); x.f.dirtySave = true; });
  treeCwd = r.cwd; render(); scheduleSave(); toast('تم التراجع عن إعادة التسمية', 'ok');
}

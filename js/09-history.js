'use strict';
/* التراجع/الإعادة */
/* ===== التاريخ (فروقات صغيرة بدل لقطات كاملة) ===== */
function pushHist(f, d, barrier) {
  const now = Date.now(), top = f.undo[f.undo.length - 1];
  f.redo = [];
  if (!barrier && top && !top.barrier && now - top.t < 900) {
    if (!d.del && !top.del && d.at === top.at + top.ins.length && d.ins.indexOf('\n') < 0 && top.ins.length < 300) { top.ins += d.ins; top.t = now; return; }
    if (!d.ins && !top.ins && d.at + d.del.length === top.at && top.del.length < 300) { top.at = d.at; top.del = d.del + top.del; top.t = now; return; }
  }
  f.undo.push({ at: d.at, del: d.del, ins: d.ins, t: now, barrier: !!barrier });
  if (f.undo.length > 600) f.undo.shift();
}
function afterChange() {
  const f = cur(); if (!f) return;
  f.content = editor.value; f.dirtySave = true; f.cursor = editor.selectionStart;
  reparse(); doc.cur = lineAt(editor.selectionStart); paintWindow(); updateStatus(); markDirty(); scheduleSave();
}
function commit(prev, barrier) {
  const f = cur(); if (!f) return;
  const now = editor.value; if (prev === now) return;
  pushHist(f, diffRange(prev, now), barrier);
  afterChange();
}
/* تعديل برمجي مُتتبَّع: يستبدل [at, at+del) بـ ins */
function replaceText(at, del, ins, selA, selB, barrier) {
  const f = cur(); if (!f) return;
  const prev = editor.value, st = editor.scrollTop, sl = editor.scrollLeft;
  editor.setRangeText(ins, at, at + del, 'end');
  if (selA != null) editor.setSelectionRange(selA, selB == null ? selA : selB);
  editor.scrollTop = st; editor.scrollLeft = sl;
  commit(prev, barrier);
  revealCaret();
}
function setAll(nv, sel) {
  const f = cur(); if (!f) return;
  const prev = editor.value; if (nv === prev) return;
  const d = diffRange(prev, nv);
  const caret = sel == null ? Math.min(d.at + d.ins.length, nv.length) : sel;
  replaceText(d.at, d.del.length, d.ins, caret, caret, true);
}
function applyEntry(e, inv) {
  const f = cur(); if (!f) return;
  const delLen = inv ? e.ins.length : e.del.length, ins = inv ? e.del : e.ins;
  const st = editor.scrollTop;
  editor.setRangeText(ins, e.at, e.at + delLen, 'end');
  const c = e.at + ins.length; editor.setSelectionRange(c, c); editor.scrollTop = st;
  afterChange(); revealCaret();
}
function undo() { const f = cur(); if (!f) return; if (!f.undo.length) return toast('لا يوجد ما يُتراجع عنه'); const e = f.undo.pop(); f.redo.push(e); applyEntry(e, true); }
function redo() { const f = cur(); if (!f) return; if (!f.redo.length) return toast('لا يوجد ما يُعاد'); const e = f.redo.pop(); f.undo.push(e); applyEntry(e, false); }

editor.addEventListener('input', () => { const f = cur(); if (f) commit(f.content, false); revealCaret(); });

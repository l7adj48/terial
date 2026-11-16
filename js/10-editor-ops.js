'use strict';
/* عمليات المحرر (إزاحة، تعليق، إغلاق تلقائي...) */
/* ===== عمليات المحرر ===== */
function blockRange() {
  const v = editor.value, s = editor.selectionStart, e = editor.selectionEnd;
  const ls = s === 0 ? 0 : v.lastIndexOf('\n', s - 1) + 1;
  const endPos = (e > s && v[e - 1] === '\n') ? e - 1 : e;
  let le = v.indexOf('\n', endPos); if (le === -1) le = v.length;
  return { v, s, e, ls, le };
}
function transformLines(fn) {
  const f = cur(); if (!f) return;
  const { v, s, e, ls, le } = blockRange();
  const lines = v.slice(ls, le).split('\n'), out = fn(lines);
  const block = out.join('\n'), oldLen = le - ls;
  const removedFirst = lines[0].length - out[0].length, removedTotal = oldLen - block.length;
  const ns = Math.max(ls, s - removedFirst), ne = s === e ? ns : Math.max(ns, e - removedTotal);
  replaceText(ls, oldLen, block, ns, ne, true);
}
function indentLines(dir) {
  if (!cur()) return;
  const U = detectIndent(editor.value), re = new RegExp('^(' + (U === '\t' ? '\\t| {1,4}' : ' {1,' + U.length + '}|\\t') + ')');
  transformLines(lines => lines.map(l => dir > 0 ? (l.length ? U + l : l) : l.replace(re, '')));
  editor.focus({ preventScroll: true });
}
function toggleComment() {
  const f = cur(); if (!f) return;
  const lang = f.lang;
  if (lang === 'plain' || lang === 'json') return toast('لا تعليقات في هذا النوع');
  const wrap = lang === 'html' ? ['<!-- ', ' -->'] : lang === 'css' ? ['/* ', ' */'] : ['// ', ''];
  transformLines(lines => {
    const ne = lines.filter(l => l.trim());
    const all = ne.length && ne.every(l => l.trim().startsWith(wrap[0].trim()));
    return lines.map(l => {
      if (!l.trim()) return l;
      const ind = l.match(/^\s*/)[0], body = l.slice(ind.length);
      if (all) { let b = body.slice(wrap[0].trim().length); if (b[0] === ' ') b = b.slice(1); if (wrap[1] && b.endsWith(wrap[1].trim())) b = b.slice(0, -wrap[1].trim().length).replace(/ $/, ''); return ind + b; }
      return ind + wrap[0] + body + wrap[1];
    });
  });
}
/* أدوات الأسطر: تكرار، حذف، تحريك */
function lineOp(k) {
  if (!cur()) return;
  const v = editor.value, b = blockRange(), s = editor.selectionStart, e = editor.selectionEnd;
  const block = v.slice(b.ls, b.le);
  if (k === 'dup') {
    replaceText(b.le, 0, NLC + block, s + block.length + 1, e + block.length + 1, true);
  } else if (k === 'dell') {
    let at = b.ls, len = b.le - b.ls + 1;
    if (b.le >= v.length) { if (b.ls > 0) { at = b.ls - 1; len = b.le - at; } else len = b.le - b.ls; }
    replaceText(at, len, '', at, null, true);
  } else if (k === 'mvup') {
    if (b.ls === 0) return;
    const ps = b.ls < 2 ? 0 : v.lastIndexOf(NLC, b.ls - 2) + 1;
    const prev = v.slice(ps, b.ls - 1), d = prev.length + 1;
    replaceText(ps, b.le - ps, block + NLC + prev, s - d, e - d, true);
  } else if (k === 'mvdn') {
    if (b.le >= v.length) return;
    let ne = v.indexOf(NLC, b.le + 1); if (ne < 0) ne = v.length;
    const nx = v.slice(b.le + 1, ne), d = nx.length + 1;
    replaceText(b.ls, ne - b.ls, nx + NLC + block, s + d, e + d, true);
  }
  editor.focus({ preventScroll: true });
}
function autoIndentEnter() {
  const v = editor.value, s = editor.selectionStart, en = editor.selectionEnd;
  const ls = s === 0 ? 0 : v.lastIndexOf('\n', s - 1) + 1;
  const ind = (v.slice(ls, s).match(/^[ \t]*/) || [''])[0];
  const prev = v[s - 1], next = v[en], pairs = { '{': '}', '(': ')', '[': ']' };
  if (prev && pairs[prev]) {
    if (next === pairs[prev]) { const ins = '\n' + ind + '    ' + '\n' + ind; replaceText(s, en - s, ins, s + 1 + ind.length + 4, null, false); return; }
    replaceText(s, en - s, '\n' + ind + '    ', null, null, false); return;
  }
  replaceText(s, en - s, '\n' + ind, null, null, false);
}
const OPEN = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };
function tryAutoClose(e) {
  const f = cur(); if (!f || !S.autoClose || f.lang === 'plain') return false;
  const ch = e.data; if (!ch || ch.length !== 1) return false;
  const v = editor.value, s = editor.selectionStart, en = editor.selectionEnd;
  if (s !== en && OPEN[ch]) { replaceText(s, en - s, ch + v.slice(s, en) + OPEN[ch], s + 1, en + 1, true); return true; }
  if ((ch === ')' || ch === ']' || ch === '}' || ch === '"' || ch === "'" || ch === '`') && v[s] === ch) { editor.setSelectionRange(s + 1, s + 1); onSel(); return true; }
  if (OPEN[ch]) {
    const quote = ch === '"' || ch === "'" || ch === '`';
    if (quote && /[\w\u0080-\uffff]/.test(v[s - 1] || '')) return false;
    const next = v[s] || '';
    if (next === '' || /[\s)\]};,.:>]/.test(next)) { replaceText(s, 0, ch + OPEN[ch], s + 1, null, false); return true; }
  }
  return false;
}
editor.addEventListener('beforeinput', e => {
  if (e.isComposing || !e.cancelable || !cur()) return;
  if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') { e.preventDefault(); autoIndentEnter(); return; }
  if (e.inputType === 'insertText') { if (tryAutoClose(e)) e.preventDefault(); return; }
  if (e.inputType === 'deleteContentBackward' && S.autoClose && cur().lang !== 'plain') {
    const v = editor.value, s = editor.selectionStart;
    if (s === editor.selectionEnd && s > 0 && OPEN[v[s - 1]] && v[s] === OPEN[v[s - 1]]) { e.preventDefault(); replaceText(s - 1, 2, '', s - 1, null, false); }
  }
});
editor.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = editor.selectionStart, en = editor.selectionEnd;
    if (e.shiftKey || editor.value.slice(s, en).includes('\n')) indentLines(e.shiftKey ? -1 : 1); else replaceText(s, en - s, '    ', null, null, false);
  } else if (mod && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (mod && k === 'y') { e.preventDefault(); redo(); }
  else if (mod && k === 's') { e.preventDefault(); saveFile(); }
  else if (mod && k === 'f') { e.preventDefault(); toggleFindBar(); }
  else if (mod && k === '/') { e.preventDefault(); toggleComment(); }
  else if (mod && k === 'g') { e.preventDefault(); goToLine(); }
});
function pasteClipboard() {
  if (!navigator.clipboard || !navigator.clipboard.readText) return toast('الحافظة غير متاحة — استخدم اللصق المطوّل داخل المحرر', 'err');
  navigator.clipboard.readText().then(txt => {
    if (!txt || !cur()) return;
    const s = editor.selectionStart, e = editor.selectionEnd;
    replaceText(s, e - s, nl(txt), null, null, true); editor.focus({ preventScroll: true }); toast('تم اللصق');
  }).catch(() => toast('تعذر اللصق — استخدم اللصق المطوّل داخل المحرر', 'err'));
}
function copyAll() { copyToClipboard(editor.value).then(() => toast('تم نسخ الكود بالكامل', 'ok')); }
async function goToLine() {
  if (!cur()) return;
  const v = await ui.prompt('اذهب إلى السطر (1 – ' + doc.n + ')', String(doc.cur + 1), 'اذهب');
  if (v == null) return;
  const n = Math.min(Math.max(1, parseInt(v, 10) || 1), doc.n);
  editor.focus({ preventScroll: true }); editor.setSelectionRange(doc.ls[n - 1], doc.ls[n - 1]);
  doc.cur = n - 1; revealIndex(doc.ls[n - 1]); updateStatus();
}
function showProblems() {
  const f = cur(); if (!f) return;
  const iss = doc.lint;
  let html = '<h3>المشاكل</h3>';
  if (f.lang === 'plain' || f.lang === 'html') html += '<div class="slabel">لا يوجد فحص تلقائي لهذا النوع.</div>';
  else if (!iss.length) html += '<div class="slabel">' + ic('check', 'xs') + ' لا مشاكل في الأقواس والنصوص.</div>';
  else html += iss.map((x, i) => `<div class="issue" data-act="goto" data-i="${i}"><b>${x.line}</b><span>${esc(x.msg)}</span></div>`).join('');
  if (f.lang === 'json') html += '<button type="button" class="btn" data-act="fmt">تنسيق JSON</button>';
  if (f.lang === 'js') html += '<button type="button" class="btn" data-act="deep">فحص عميق للصياغة (JS)</button><div class="slabel" id="deepOut"></div>';
  html += '<button type="button" class="btn" data-ui="cancel">إغلاق</button>';
  ui.show(html, (act, el) => {
    if (act === 'goto') {
      const x = iss[+el.dataset.i]; ui.close(null);
      editor.focus({ preventScroll: true }); const p = x.pos != null ? x.pos : doc.ls[x.line - 1];
      editor.setSelectionRange(p, p); doc.cur = lineAt(p); revealIndex(p);
    } else if (act === 'fmt') {
      try { setAll(JSON.stringify(JSON.parse(editor.value), null, 2)); ui.close(null); toast('تم التنسيق', 'ok'); } catch (err) { toast('JSON غير صالح', 'err'); }
    } else if (act === 'deep') {
      let msg;
      try { new Function(editor.value); msg = ic('check', 'xs') + ' الصياغة سليمة (قد تظهر تحذيرات كاذبة مع import/export).'; }
      catch (err) { msg = ic('x-circle', 'xs') + ' ' + esc(err.message); }
      $('deepOut').innerHTML = msg;
    }
  });
}

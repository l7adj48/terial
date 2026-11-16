'use strict';
/* البحث والاستبدال */
/* ===== البحث والاستبدال ===== */
function toggleFindBar() {
  const bar = $('findBar');
  if (bar.classList.contains('active')) { bar.classList.remove('active'); editor.focus({ preventScroll: true }); }
  else {
    const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    if (sel && !sel.includes('\n') && sel.length < 200) $('fFind').value = sel;
    bar.classList.add('active'); $('fFind').focus();
  }
  requestAnimationFrame(() => { paintWindow(); });
}
function toggleFlag(k) { fFlags[k] = !fFlags[k]; $(k === 'case' ? 'fCase' : 'fRegex').classList.toggle('on', fFlags[k]); $('fInfo').textContent = ''; }
function buildRe(extra) {
  const q = $('fFind').value; if (!q) return null;
  try { return new RegExp(fFlags.regex ? q : q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), (fFlags.case ? '' : 'i') + 'm' + (extra || '')); }
  catch (e) { $('fInfo').textContent = 'تعبير نمطي غير صالح'; return null; }
}
function allMatches(re, t) {
  const out = []; let m; re.lastIndex = 0;
  while ((m = re.exec(t)) && out.length < 5000) { out.push({ i: m.index, len: m[0].length }); if (!m[0].length) re.lastIndex++; }
  return out;
}
function findNext(dir) {
  dir = dir || 1;
  const re = buildRe('g'); if (!re) return;
  const t = editor.value, list = allMatches(re, t);
  if (!list.length) { $('fInfo').textContent = 'لا نتائج'; return; }
  const s = editor.selectionStart, en = editor.selectionEnd;
  let k;
  if (dir > 0) { k = list.findIndex(m => m.i >= en); if (k < 0) k = 0; }
  else { k = -1; for (let j = list.length - 1; j >= 0; j--) if (list[j].i < s) { k = j; break; } if (k < 0) k = list.length - 1; }
  const m = list[k];
  editor.focus({ preventScroll: true }); editor.setSelectionRange(m.i, m.i + m.len);
  doc.cur = lineAt(m.i); revealIndex(m.i); updateStatus();
  $('fInfo').textContent = `${k + 1} / ${list.length} — سطر ${doc.cur + 1}`;
}
function replaceOne() {
  if (!cur()) return;
  const re = buildRe(''); if (!re) return;
  const r = $('fRepl').value, s = editor.selectionStart, e = editor.selectionEnd;
  const sel = editor.value.slice(s, e);
  const full = new RegExp('^(?:' + re.source + ')$', re.flags);
  if (sel && full.test(sel)) { const rep = fFlags.regex ? sel.replace(re, r) : r; replaceText(s, e - s, rep, null, null, true); }
  findNext(1);
}
function replaceAll() {
  if (!cur()) return;
  const re = buildRe('g'); if (!re) return;
  const r = $('fRepl').value, t = editor.value, c = allMatches(re, t).length;
  if (!c) { $('fInfo').textContent = 'لا نتائج'; return; }
  setAll(fFlags.regex ? t.replace(re, r) : t.replace(re, () => r), editor.selectionStart);
  $('fInfo').textContent = `تم استبدال ${c} مرة`;
}
function copyMatches() {
  const re = buildRe(''); if (!re) return toast('أدخل نصاً للبحث', 'err');
  const out = []; editor.value.split('\n').forEach((l, i) => { if (re.test(l)) out.push((i + 1) + ': ' + l); });
  if (!out.length) return toast('لا تطابقات', 'err');
  copyToClipboard(out.join('\n')).then(() => toast(`تم نسخ ${out.length} سطر`, 'ok'));
}
$('fFind').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); findNext(e.shiftKey ? -1 : 1); } });

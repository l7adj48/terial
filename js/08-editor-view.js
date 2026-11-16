'use strict';
/* عرض المحرر: التلوين والأسطر والمؤشر */
/* ===== المستند: تلوين افتراضي + أسطر ===== */
const doc = { text: '', tk: [], ls: [0], n: 1, cur: 0, lint: [] };
function reparse() {
  const f = cur(), t = editor.value;
  doc.text = t; doc.bm = null; doc.tk = tokenize(t, f ? f.lang : 'plain');
  const ls = [0]; let i = -1; while ((i = t.indexOf('\n', i + 1)) !== -1) ls.push(i + 1);
  doc.ls = ls; doc.n = ls.length;
  clearTimeout(lintTimer); lintTimer = setTimeout(runLint, 450);
}
function lineAt(p) {
  const ls = doc.ls; let lo = 0, hi = ls.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ls[mid] <= p) lo = mid; else hi = mid - 1; }
  return lo;
}
function runLint() {
  const f = cur(); doc.lint = f ? lintText(editor.value, doc.tk, f.lang) : [];
  updateLintStatus();
}
function updateLintStatus() {
  const f = cur(), el = $('stLint');
  const lang = f ? f.lang : 'plain';
  const label = { js: 'JS', html: 'HTML', css: 'CSS', json: 'JSON', plain: 'TXT' }[lang];
  if (lang === 'plain' || lang === 'html') { el.className = ''; el.textContent = label; return; }
  if (doc.lint.length) { el.className = 'tap bad'; el.innerHTML = label + ' ' + ic('alert', 'xs') + ' ' + doc.lint.length; }
  else { el.className = 'tap good'; el.innerHTML = label + ' ' + ic('check', 'xs'); }
}
function charW() {
  if (_cw) return _cw;
  try { const c = document.createElement('canvas').getContext('2d'); c.font = S.fs + 'px ' + getComputedStyle(editor).fontFamily; _cw = c.measureText('M').width || S.fs * 0.6; } catch (e) { _cw = S.fs * 0.6; }
  return _cw;
}
function lineHTML(L) {
  const t = doc.text, tk = doc.tk, nT = tk.length / 3;
  const ls = doc.ls[L], le = L + 1 < doc.n ? doc.ls[L + 1] - 1 : t.length;
  let pos = ls, h = '';
  let lo = 0, hi = nT;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (tk[mid * 3 + 1] <= ls) lo = mid + 1; else hi = mid; }
  for (let q = lo; q < nT && tk[q * 3] < le; q++) {
    const ts = Math.max(tk[q * 3], ls), te = Math.min(tk[q * 3 + 1], le);
    if (te > ts) {
      if (ts > pos) h += escM(pos, ts);
      h += `<span class="t-${tk[q * 3 + 2]}">${escM(ts, te)}</span>`; pos = te;
    }
  }
  if (pos < le) h += escM(pos, le);
  return h;
}
function paintWindow() {
  const h = editor.clientHeight || window.innerHeight, st = editor.scrollTop;
  let first = Math.max(0, Math.floor((st - PAD) / LH) - MARGIN);
  let last = Math.min(doc.n - 1, Math.ceil((st + h - PAD) / LH) + MARGIN);
  if (first > doc.n - 1) first = Math.max(0, doc.n - 1);
  if (last < first) last = first;
  winFirst = first; winLast = last;
  let hh = '', gg = '';
  for (let L = first; L <= last; L++) {
    const c = L === doc.cur;
    hh += `<div class="ln${c ? ' cur' : ''}">${lineHTML(L)}</div>`;
    gg += `<div class="gn${c ? ' cur' : ''}">${L + 1}</div>`;
  }
  hlInner.innerHTML = hh; gInner.innerHTML = gg;
  const gw = Math.max(40, String(doc.n).length * charW() + 22);
  gutter.style.width = gw + 'px';
  positionLayers();
}
function positionLayers() {
  const st = editor.scrollTop, sl = editor.scrollLeft;
  hlInner.style.transform = `translate(${-sl}px,${winFirst * LH + PAD - st}px)`;
  gInner.style.transform = `translateY(${winFirst * LH + PAD - st}px)`;
}
function onScroll() {
  const f = cur(); if (f) f.scroll = editor.scrollTop;
  const st = editor.scrollTop, h = editor.clientHeight || window.innerHeight;
  const vf = Math.floor((st - PAD) / LH), vl = Math.ceil((st + h - PAD) / LH);
  if ((vf < winFirst && winFirst > 0) || (vl > winLast && winLast < doc.n - 1)) paintWindow(); else positionLayers();
}
editor.addEventListener('scroll', onScroll, { passive: true });

function updateCursorLine() {
  const ln = lineAt(editor.selectionStart);
  if (ln !== doc.cur) { doc.cur = ln; paintWindow(); }
}
function updateStatus() {
  const pos = editor.selectionStart, ln = lineAt(pos);
  $('stCursor').textContent = `Ln ${ln + 1}, Col ${pos - doc.ls[ln] + 1}`;
  $('stSize').textContent = `${editor.value.length} chars`;
}
function onSel() {
  if (selRaf) return;
  selRaf = requestAnimationFrame(() => {
    selRaf = 0;
    if (document.activeElement !== editor) return;
    const f = cur(); if (f) f.cursor = editor.selectionStart;
    updateCursorLine(); updateBracket(); updateStatus();
  });
}
document.addEventListener('selectionchange', onSel);

function markDirty() {
  const f = cur(), d = !!f && f.content !== f.baseline;
  $('saveDot').classList.toggle('dirty', d);
  const t = document.querySelector('.filet.active'); if (t) t.classList.toggle('dirty', d);
}
function revealCaret() {
  const s = editor.selectionStart, ln = lineAt(s), col = s - doc.ls[ln];
  const top = PAD + ln * LH, bot = top + LH;
  if (top < editor.scrollTop) editor.scrollTop = Math.max(0, top - LH);
  else if (bot > editor.scrollTop + editor.clientHeight - 8) editor.scrollTop = bot - editor.clientHeight + LH + 8;
  const x = PAD + col * charW();
  if (x < editor.scrollLeft + 20) editor.scrollLeft = Math.max(0, x - 40);
  else if (x > editor.scrollLeft + editor.clientWidth - 30) editor.scrollLeft = x - editor.clientWidth + 60;
  positionLayers(); onScroll();
}
function revealIndex(idx) {
  const ln = lineAt(idx), col = idx - doc.ls[ln];
  editor.scrollTop = Math.max(0, ln * LH - editor.clientHeight / 3);
  const x = col * charW();
  editor.scrollLeft = x > editor.clientWidth * 0.6 ? x - editor.clientWidth / 3 : 0;
  paintWindow();
}

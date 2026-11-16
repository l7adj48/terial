'use strict';
/* مخطط الملف (A16) والنطاق الثابت (A19) */
/*PURE9_START*/
const OL_KW = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'else', 'do', 'try', 'with']);
function outlineOf(t, tk, lang) {
  const out = [], ls = [0]; let i = -1;
  while ((i = t.indexOf('\n', i + 1)) !== -1) ls.push(i + 1);
  const lineEnd = n => (n + 1 < ls.length ? ls[n + 1] - 1 : t.length);
  const lineOfPos = p => { let lo = 0, hi = ls.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ls[m] <= p) lo = m; else hi = m - 1; } return lo; };
  const pairs = new Map();
  if (lang === 'js' || lang === 'css') bracketPairs(t, tk).forEach(p => pairs.set(p[0], p[1]));
  const openAt = (a, b) => { for (let k = t.indexOf('{', a); k >= 0 && k < b; k = t.indexOf('{', k + 1)) if (!isSkipTok(tk, k)) return k; return -1; };
  const add = (n, name, kind, level) => out.push({ name, kind, line: n, end: n, level: level || 0 });
  const setEnd = (e, n, a) => { const k = openAt(a, lineEnd(Math.min(n + 1, ls.length - 1))); if (k >= 0 && pairs.has(k)) e.end = lineOfPos(pairs.get(k)); };
  for (let n = 0; n < ls.length; n++) {
    const a = ls[n], line = t.slice(a, lineEnd(n)); let m;
    if (isSkipTok(tk, a + (line.length - line.trimStart().length))) continue;
    const before = out.length;
    if (lang === 'js') {
      if ((m = /^\s*(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s*([\w$]+)/.exec(line))) add(n, m[1], 'fn');
      else if ((m = /^\s*(?:export\s+(?:default\s+)?)?class\s+([\w$]+)/.exec(line))) add(n, m[1], 'class');
      else if ((m = /^\s*(?:export\s+)?(?:const|let|var)\s+([\w$]+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[\w$]+\s*=>)/.exec(line))) add(n, m[1], 'fn');
      else if ((m = /^\s+(?:static\s+)?(?:async\s+)?(?:get\s+|set\s+)?([\w$]+)\s*\([^)]*\)\s*\{/.exec(line)) && !OL_KW.has(m[1])) add(n, m[1], 'method');
      if (out.length > before) setEnd(out[before], n, a);
    } else if (lang === 'css') {
      if ((m = /^\s*([^\s{}\/;][^{};]*?)\s*\{/.exec(line))) { add(n, m[1].slice(0, 70), 'css'); setEnd(out[before], n, a); }
    } else if (lang === 'md') {
      if ((m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line))) add(n, m[2], 'h', m[1].length);
    } else if (lang === 'html') {
      if ((m = /<\w+[^>]*\bid\s*=\s*["']([^"']+)["']/.exec(line))) add(n, '#' + m[1], 'id');
      else if ((m = /^\s*<(script|style)\b/i.exec(line))) add(n, '<' + m[1].toLowerCase() + '>', 'tag');
    }
  }
  if (lang === 'md') out.forEach((e, k) => { let j = k + 1; while (j < out.length && out[j].level > e.level) j++; e.end = j < out.length ? out[j].line - 1 : ls.length - 1; });
  return out;
}
function scopeAt(list, line) { const ch = []; for (const e of list) { if (e.line > line) break; if (line <= e.end) ch.push(e); } return ch; }
function pureTests9() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  const cm = '// function fake() {}', js = 'function a(x) {\n  return 1;\n}\nclass B {\n  m() {\n    if (x) {\n    }\n  }\n}\nconst f = (y) => {\n};\n' + cm + '\n';
  const p = js.indexOf(cm), o = outlineOf(js, [p, p + cm.length, 'c'], 'js');
  t('A16: مخطط JS يجد الدوال والأصناف والطرق', o.map(e => e.name).join() === 'a,B,m,f');
  t('A16: يتجاهل الأسطر داخل التعليقات و if', !o.some(e => e.name === 'fake' || e.name === 'if'));
  t('A16: نهاية الكتلة صحيحة', o[0].end === 2 && o[1].end === 8 && o[2].end === 7 && o[3].end === 10);
  t('A19: النطاق داخل الطريقة = الصنف ثم الطريقة', scopeAt(o, 5).map(e => e.name).join() === 'B,m');
  t('A19: النطاق داخل دالة', scopeAt(o, 1).map(e => e.name).join() === 'a');
  t('A19: لا نطاق خارج الكتل', scopeAt(o, 11).length === 0);
  const c = outlineOf('.a {\n  color: red;\n}\n@media (x) {\n  .b:hover {\n  }\n}\n', [], 'css');
  t('A16: مخطط CSS', c.map(e => e.name).join('|') === '.a|@media (x)|.b:hover');
  t('A19: نطاق CSS متداخل', scopeAt(c, 5).map(e => e.name).join('|') === '@media (x)|.b:hover');
  const md = outlineOf('# T\ntext\n## S\n### U\n## V\n', [], 'md');
  t('A16: عناوين Markdown', md.length === 4 && md[1].end === 3);
  t('A19: نطاق Markdown', scopeAt(md, 3).map(e => e.name).join() === 'T,S,U' && scopeAt(md, 4).map(e => e.name).join() === 'T,V');
  const h = outlineOf('<div id="app">\n<script>\n</script>', [], 'html');
  t('A16: HTML معرّفات ووسوم', h.map(e => e.name).join() === '#app,<script>');
  return T;
}
/*PURE9_END*/

const scopeBar = $('scopeBar');
let olCache = { text: null, lang: null, list: [] }, scRaf = 0, scKey = null;
function olLang(f) { if (!f) return 'plain'; return /\.(md|markdown)$/i.test(f.name) ? 'md' : f.lang; }
function olEligible(f) { return !!f && ['js', 'css', 'md', 'html'].includes(olLang(f)) && doc.text.length <= MAX_HL; }
function getOutline() {
  const f = cur(); if (!olEligible(f)) return [];
  const lang = olLang(f);
  if (olCache.text === doc.text && olCache.lang === lang) return olCache.list;
  let list = []; try { list = outlineOf(doc.text, doc.tk, lang); } catch (e) { list = []; }
  olCache = { text: doc.text, lang, list }; return list;
}
function updateScope() {
  scRaf = 0; if (!scopeBar) return;
  const f = cur(), on = olEligible(f);
  if (scopeBar.hidden === on) scopeBar.hidden = !on;
  if (!on) { scKey = null; return; }
  const list = getOutline(), ch = scopeAt(list, Math.max(0, Math.floor((editor.scrollTop - PAD) / LH)));
  const key = list.length + '|' + ch.map(e => e.name + '@' + e.line).join('>');
  if (key === scKey) return; scKey = key;
  const nm = $('scopeName'); nm.textContent = ch.length ? ch.slice(-2).map(e => e.name).join(' › ') : '—';
  nm.dataset.line = ch.length ? ch[ch.length - 1].line : '';
}
function scheduleScope() { if (!scRaf) scRaf = requestAnimationFrame(updateScope); }
function olGoto(line) {
  const p = doc.ls[line]; if (p == null) return;
  editor.setSelectionRange(p, p); doc.cur = lineAt(p); revealIndex(p); updateStatus();
}
function showOutline() {
  const f = cur(), list = getOutline();
  if (!list.length) return toast(olEligible(f) ? 'لا عناصر في هذا الملف' : 'المخطط لا يدعم هذا الملف', 'err');
  const rows = list.map((e, i) => `<div class="issue" data-act="go" data-i="${i}"><b>${e.line + 1}</b><span>${'\u00A0\u00A0'.repeat(Math.max(0, scopeAt(list, e.line).length - 1))}${esc(e.name)}</span></div>`).join('');
  ui.show('<h3>مخطط الملف</h3>' + rows + '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', (act, el) => {
    if (act === 'go') { const e = list[+el.dataset.i]; ui.close(null); olGoto(e.line); }
  });
}
if (scopeBar) {
  editor.addEventListener('scroll', scheduleScope, { passive: true });
  $('scopeName').addEventListener('click', e => { const l = e.currentTarget.dataset.line; if (l !== '') olGoto(+l); });
  $('scopeList').addEventListener('click', showOutline);
  const _reparse = reparse;
  reparse = function () { const r = _reparse.apply(this, arguments); scKey = null; scheduleScope(); return r; };
}

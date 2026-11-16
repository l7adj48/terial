'use strict';
/* الإصدارات والتصحيحات المرقمة */
/* ===== v27a: الإصدارات والتصحيحات المرقمة (V1) ===== */
/*PURE4_START*/
const ST = { pending: 'معلّق', applied: 'مطبّق ✓', rejected: 'مرفوض', deferred: 'مؤجّل' };
function parseFixDoc(text) { const out = []; String(text).split(/\r?\n/).forEach(l => { const m = /^\s*(\d+)\s*[-–—.):،]\s*(.+?)\s*$/.exec(l); if (m) out.push(m[2].slice(0, 160)); else if (out.length && l.trim()) out[out.length - 1] = (out[out.length - 1] + ' ' + l.trim()).slice(0, 160); }); return out; }
function diffStates(a, b) { const d = {}; Object.keys(b).forEach(k => { if (a[k] !== b[k]) d[k] = b[k]; }); Object.keys(a).forEach(k => { if (!(k in b)) d[k] = null; }); return d; }
function applyDelta(m, d) { const o = Object.assign({}, m); Object.keys(d).forEach(k => { if (d[k] === null) delete o[k]; else o[k] = d[k]; }); return o; }
function lastState(base, fixes, upto) { let m = Object.assign({}, base); fixes.filter(f => f.status === 'applied' && f.d && (upto == null || f.seq <= upto)).sort((x, y) => x.seq - y.seq).forEach(f => { m = applyDelta(m, f.d); }); return m; }
function stateAfter(base, fixes, k) { const f = fixes[k]; return f && f.status === 'applied' && f.d ? lastState(base, fixes, f.seq) : null; }
function lineDelta(x, y) { const A = String(x || '').split('\n'), B = new Set(String(y || '').split('\n')); let n = 0; A.forEach(l => { if (!B.has(l)) n++; }); return n; }
function cmpStates(a, b) { const out = []; new Set(Object.keys(a).concat(Object.keys(b))).forEach(n => { if (a[n] === b[n]) return; out.push({ n, k: !(n in a) ? '+' : !(n in b) ? '−' : '~', add: lineDelta(b[n], a[n]), del: lineDelta(a[n], b[n]) }); }); return out.sort((x, y) => x.n < y.n ? -1 : 1); }
function changelogMD(rel) { return '# إصدار ' + rel.n + (rel.name ? ' — ' + rel.name : '') + '\n\n' + rel.fixes.map((f, i) => '- ' + (i + 1) + '- ' + f.title + ' (' + ST[f.status].replace(' ✓', '') + ')').join('\n') + '\n'; }
function pureTests4() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  t('V1: وثيقة مرقمة تتحول لخانات بالترتيب', JSON.stringify(parseFixDoc('1- أصلح الزر\n2- غيّر اللون\nتفصيل إضافي\n3) أضف سجل')) === JSON.stringify(['أصلح الزر', 'غيّر اللون تفصيل إضافي', 'أضف سجل']));
  const a = { 'x.js': '1', 'y.css': 'a' }, b = { 'x.js': '2', 'z.html': 'n' }, d = diffStates(a, b);
  t('V1: فرق الحالات (تعديل/جديد/حذف)', d['x.js'] === '2' && d['z.html'] === 'n' && d['y.css'] === null);
  t('V1: تطبيق الفرق يعيد الحالة', JSON.stringify(applyDelta(a, d)) === JSON.stringify({ 'x.js': '2', 'z.html': 'n' }));
  const base = { f: '0' }, fx = [{ status: 'applied', seq: 1, d: { f: '1' } }, { status: 'pending' }, { status: 'applied', seq: 2, d: { f: '2', g: 'g' } }];
  t('V1: الحالة بعد تصحيح 1', stateAfter(base, fx, 0).f === '1' && !('g' in stateAfter(base, fx, 0)));
  t('V1: الحالة بعد تصحيح 3', stateAfter(base, fx, 2).f === '2' && stateAfter(base, fx, 2).g === 'g');
  t('V1: تصحيح معلّق بلا حالة', stateAfter(base, fx, 1) === null);
  t('V1: الحالة الأخيرة', lastState(base, fx).f === '2');
  t('V1: الأساس لا يتغير (لا تلوّث)', base.f === '0');
  const c = cmpStates({ a: 'x\ny', b: 'k' }, { a: 'x\nz', c: 'n' });
  t('V1: مقارنة إصدارين', c.length === 3 && c.find(r => r.n === 'a').k === '~' && c.find(r => r.n === 'b').k === '−' && c.find(r => r.n === 'c').k === '+' && c.find(r => r.n === 'a').add === 1);
  t('V1: سجل التغييرات', /# إصدار 2 — س/.test(changelogMD({ n: 2, name: 'س', fixes: [{ title: 'ت', status: 'applied' }] })) && /- 1- ت \(مطبّق\)/.test(changelogMD({ n: 2, name: 'س', fixes: [{ title: 'ت', status: 'applied' }] })));
  const sv = V1; V1 = { releases: [{ n: 1, files: { a: '1', b: 'x' }, fixes: [{ title: 't', status: 'applied', d: { a: '1' }, seq: 1 }], base0: { a: '0' } }, { n: 2, files: { a: '2', c: 'n' }, fixes: [] }], draft: null };
  v1Compact(); const r0 = relFiles(0), r1 = relFiles(1), r00 = V1.releases[0];
  t('V1: الفروق العكسية تعيد الإصدار القديم والأحدث', JSON.stringify(r0) === JSON.stringify({ a: '1', b: 'x' }) && JSON.stringify(r1) === JSON.stringify({ a: '2', c: 'n' }));
  t('V1: القديم بلا ملفات كاملة ولا تغييرات تصحيحات', r00.files === undefined && r00.nf === 2 && r00.fixes[0].d === undefined && r00.base0 === undefined);
  V1 = sv;
  return T;
}
/*PURE4_END*/

/*PURE5_START*/
const BR_O = '([{', BR_C = ')]}';
function tokTypeAt(tk, i) { let lo = 0, hi = tk.length / 3 - 1; while (lo <= hi) { const m = (lo + hi) >> 1, a = tk[m * 3], b = tk[m * 3 + 1]; if (i < a) hi = m - 1; else if (i >= b) lo = m + 1; else return tk[m * 3 + 2]; } return null; }
function isSkipTok(tk, i) { const y = tokTypeAt(tk, i); return y === 'c' || y === 's' || y === 'rx'; }
function bracketMatch(t, tk, pos) {
  const LIM = 60000;
  for (const i of [pos - 1, pos]) {
    if (i < 0 || i >= t.length) continue;
    const o = BR_O.indexOf(t[i]), c = BR_C.indexOf(t[i]);
    if ((o < 0 && c < 0) || isSkipTok(tk, i)) continue;
    const st = [];
    if (o >= 0) {
      for (let j = i, end = Math.min(t.length, i + LIM); j < end; j++) {
        const x = t[j], a = BR_O.indexOf(x), b = BR_C.indexOf(x);
        if ((a < 0 && b < 0) || isSkipTok(tk, j)) continue;
        if (a >= 0) st.push(a); else { if (st.pop() !== b) return { a: i, bad: 1 }; if (!st.length) return { a: i, b: j }; }
      }
    } else {
      for (let j = i, end = Math.max(-1, i - LIM); j > end; j--) {
        const x = t[j], a = BR_O.indexOf(x), b = BR_C.indexOf(x);
        if ((a < 0 && b < 0) || isSkipTok(tk, j)) continue;
        if (b >= 0) st.push(b); else { if (st.pop() !== a) return { a: i, bad: 1 }; if (!st.length) return { a: i, b: j }; }
      }
    }
    return { a: i, bad: 1 };
  }
  return null;
}
function bracketPairs(t, tk) {
  const out = [], st = [];
  for (let i = 0; i < t.length; i++) {
    const o = BR_O.indexOf(t[i]), c = BR_C.indexOf(t[i]);
    if ((o < 0 && c < 0) || isSkipTok(tk, i)) continue;
    if (o >= 0) st.push([o, i]); else { let k = st.length - 1; while (k >= 0 && st[k][0] !== c) k--; if (k >= 0) { out.push([st[k][1], i]); st.length = k; } }
  }
  return out;
}
function expandSel(t, tk, s, e) {
  const C = [], W = /[\w$\u0600-\u06FF]/;
  let a = s, b = e; while (a > 0 && W.test(t[a - 1])) a--; while (b < t.length && W.test(t[b])) b++; if (b > a) C.push([a, b]);
  for (let q = 0; q < tk.length; q += 3) if (tk[q + 2] === 's' && tk[q] <= s && tk[q + 1] >= e) { C.push([tk[q], tk[q + 1]]); if (tk[q + 1] - tk[q] >= 2) C.push([tk[q] + 1, tk[q + 1] - 1]); }
  const ls = s === 0 ? 0 : t.lastIndexOf('\n', s - 1) + 1; let le = t.indexOf('\n', e); if (le < 0) le = t.length;
  C.push([ls, le]); let fs = ls; while (fs < le && /[ \t]/.test(t[fs])) fs++; if (fs < le) C.push([fs, le]);
  bracketPairs(t, tk).forEach(p => { C.push([p[0] + 1, p[1]]); C.push([p[0], p[1] + 1]); });
  C.push([0, t.length]);
  let best = null; C.forEach(c => { if (c[0] <= s && c[1] >= e && c[1] - c[0] > e - s && (!best || c[1] - c[0] < best[1] - best[0])) best = c; });
  return best;
}
function pureTests5() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  let r = bracketMatch('f(a)', [], 2); t('A1: قوس مفتوح يجد مقابله', r && r.a === 1 && r.b === 3);
  r = bracketMatch('f("a)")', [2, 6, 's'], 2); t('A1: يتجاهل الأقواس داخل النصوص', r && r.a === 1 && r.b === 6);
  r = bracketMatch('f(a', [], 2); t('A1: قوس بلا مقابل يُعلَّم', r && r.bad === 1);
  r = bracketMatch('{x}', [], 3); t('A1: قوس مغلق يجد مفتوحه', r && r.a === 2 && r.b === 0);
  r = bracketMatch('(]', [], 1); t('A1: عدم تطابق الأنواع', r && r.bad === 1);
  t('A1: لا قوس عند المؤشر', bracketMatch('abc', [], 1) === null);
  t('A1: أزواج متداخلة', bracketPairs('a(b[c]{d})', []).length === 3);
  const x = 'foo(bar baz)', seq = []; let a = 5, b = 5, n;
  while (n = expandSel(x, [], a, b)) { seq.push(n.join('-')); a = n[0]; b = n[1]; if (seq.length > 9) break; }
  t('A18: تسلسل التوسيع كلمة ثم داخل القوس ثم القوس ثم الملف', seq.join(',') === '4-7,4-11,3-12,0-12');
  t('A18: لا توسيع بعد الملف كله', expandSel(x, [], 0, 12) === null);
  t('A18: نص عربي كلمة', expandSel('مرحبا بك', [], 2, 2).join('-') === '0-5');
  return T;
}
/*PURE5_END*/
let selStack = [], selLast = null, composing = false;
editor.addEventListener('compositionstart', () => { composing = true; });
editor.addEventListener('compositionend', () => { composing = false; onSel(); });
function updateBracket() {
  if (composing) return;
  let nb = null;
  try {
    if (editor.selectionStart === editor.selectionEnd && doc.text === editor.value) {
      const r = bracketMatch(doc.text, doc.tk, editor.selectionStart);
      if (r) nb = r.bad ? [[r.a, 'bx']] : [[r.a, 'bm'], [r.b, 'bm']];
    }
  } catch (e) { nb = null; }
  if (JSON.stringify(nb) !== JSON.stringify(doc.bm)) { doc.bm = nb; paintWindow(); }
}
function escM(a, b) {
  const bm = doc.bm, t = doc.text; let r = null;
  if (bm) for (let k = 0; k < bm.length; k++) if (bm[k][0] >= a && bm[k][0] < b) (r = r || []).push(bm[k]);
  if (!r) return escT(t.slice(a, b));
  r.sort((p, q) => p[0] - q[0]); let out = '', c = a;
  r.forEach(m => { out += escT(t.slice(c, m[0])) + `<span class="${m[1]}">${escT(t[m[0]])}</span>`; c = m[0] + 1; });
  return out + escT(t.slice(c, b));
}
function selExpand(dir) {
  if (composing) return;
  const s = editor.selectionStart, e = editor.selectionEnd;
  if (!selLast || selLast[0] !== s || selLast[1] !== e) selStack = [];
  let r;
  if (dir > 0) { r = expandSel(editor.value, doc.tk, s, e); if (!r) return; selStack.push([s, e]); } else { r = selStack.pop(); if (!r) return; }
  editor.setSelectionRange(r[0], r[1]); selLast = [r[0], r[1]]; onSel();
}
let V1 = { releases: [], draft: null };
let projHandle = null, histIn = null, vp = null;
/* الأحدث يحمل الملفات كاملة، والأقدم يحمل «فرقاً عكسياً» فقط؛ وتصحيحات الأقدم عناوين فقط */
function v1Compact() {
  const R = V1.releases; if (!R.length) return;
  let next = R[R.length - 1].files; if (!next) return;
  R[R.length - 1].nf = Object.keys(next).length;
  for (let k = R.length - 2; k >= 0; k--) {
    const r = R[k];
    if (r.files) { r.rd = diffStates(next, r.files); r.nf = Object.keys(r.files).length; next = r.files; delete r.files; }
    else if (r.rd) next = applyDelta(next, r.rd);
    r.fixes = (r.fixes || []).map(f => ({ title: f.title, status: f.status }));
    delete r.base0;
  }
}
function relFiles(i) { const R = V1.releases; let m = R[R.length - 1].files; for (let k = R.length - 2; k >= i; k--) m = applyDelta(m, R[k].rd || {}); return m; }
function hasHist() { return V1.releases.length > 0 || !!(V1.draft && V1.draft.fixes.length); }
function histPack() { v1Compact(); return { v: 1, proj: S.proj || '', t: Date.now(), V1 }; }
function adoptHistory(h) {
  if (!h || !h.V1 || !Array.isArray(h.V1.releases)) return false;
  V1 = h.V1; if (!V1.draft) V1.draft = null; v1Compact();
  if (h.proj) S.proj = cleanName(h.proj) || S.proj;
  projHandle = null; v1Save(); scheduleSave(); return true;
}
async function maybeAdopt(h, wipe) {
  if (hasHist() && !wipe && !(await ui.confirm('وُجد سجل إصدارات داخل الملف المفتوح. استبدال سجلك الحالي به؟', 'استبدال'))) return;
  if (adoptHistory(h)) { verMark(verSig()); toast('حُمّل سجل الإصدارات (' + V1.releases.length + ' إصدار)', 'ok'); }
}
function doRelease(name) {
  const d = ensureDraft();
  const rel = { n: d.n, name, t: Date.now(), files: filesMap(), base0: d.base0, fixes: d.fixes.slice() };
  V1.releases.push(rel);
  V1.draft = { n: d.n + 1, base0: null, seq: 0, fixes: d.fixes.filter(f => f.status === 'pending' || f.status === 'deferred').map(f => ({ title: f.title, status: f.status })) };
  v1Compact(); v1Save(); snapNow('عند تسجيل إصدار ' + rel.n);
  toast('سُجّل إصدار ' + rel.n, 'ok', { label: 'حفظ الإصدارات', fn: saveVersions });
  return rel;
}
function verSig() {
  const m = filesMap(), ks = Object.keys(m).sort(); let h = 5381;
  const add = s => { for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; };
  ks.forEach(k => { add(k); add('\u0001'); add(m[k]); add('\u0002'); });
  add('R' + V1.releases.length + ':' + (V1.draft ? V1.draft.n + V1.draft.fixes.map(f => f.status + f.title).join('|') : ''));
  return h + ':' + ks.length;
}
function updateVerBadge() {
  const b = $('verBtn'); if (!b) return;
  let un = false; try { un = hasHist() && files.length > 0 && S.verSig !== verSig(); } catch (_) { }
  b.classList.toggle('unsaved', un);
  b.title = un ? 'إدارة المشروع وحفظ الإصدارات — فيه تغييرات لم تُحفظ' : 'إدارة المشروع وتصدير ZIP';
}
function verMark(sig) { S.verSig = sig; scheduleSave(); updateVerBadge(); }
async function saveVersions() {
  const c = cur(); if (c) c.content = editor.value;
  if (!files.length) return toast('لا ملفات', 'err');
  if (!S.proj) {
    const def = cleanName(commonRoot()) || 'project';
    const n = await ui.prompt('اسم المشروع (يُحفظ ZIP بهذا الاسم ومعه سجل الإصدارات)', def, 'حفظ');
    if (n == null) return; S.proj = cleanName(n) || def; scheduleSave();
  }
  return exportZip(null, null, S.proj, 'ver');
}
function showVerBar(i) {
  vp = i; const r = V1.releases[i], n = V1.releases.length;
  $('verBar').classList.add('on'); $('vbLabel').textContent = 'إصدار ' + r.n + (r.name ? ' — ' + r.name : '') + ' (' + (i + 1) + '/' + n + ')';
  $('vbOld').disabled = i <= 0; $('vbNew').disabled = i >= n - 1;
}
function hideVerBar() { vp = null; const b = $('verBar'); if (b) b.classList.remove('on'); }
function previewRelease(i) { previewState(relFiles(i), 'إصدار ' + V1.releases[i].n, i); }
function verNav(d) { if (vp == null) return; const j = vp + d; if (j < 0 || j >= V1.releases.length) return; previewRelease(j); }
function verCompare() { if (vp == null) return; const i = vp; cmpSheet(relFiles(i), filesMap(), 'إصدار ' + V1.releases[i].n + ' ← الحالي', () => ui.close(null)); }
async function verRestore() {
  if (vp == null) return; const i = vp, r = V1.releases[i];
  if (await ui.confirm('استرجاع المشروع إلى إصدار ' + r.n + '؟ (تُحفظ حالتك الحالية أولاً)', 'استرجاع')) { hideVerBar(); restoreMap(relFiles(i), 'إصدار ' + r.n); switchTab('p-edit'); }
}
function v1Save() { setTimeout(updateVerBadge, 0); if (currentTab === 'p-home' && typeof cpRefreshHome === 'function') cpRefreshHome(); if (store.mode !== 'idb') return; const snap = JSON.parse(JSON.stringify(V1)); snapQ = snapQ.then(() => new Promise(res => { try { const tx = store.db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(snap, 'v1'); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; } catch (e) { res(); } })); }
async function loadV1() { try { if (store.mode === 'idb') { const v = await store.req('meta', m => m.get('v1')); if (v && Array.isArray(v.releases)) { V1 = v; v1Compact(); } } } catch (e) { } }
function filesMap() { const c = cur(); if (c) c.content = editor.value; const m = {}; files.forEach(f => { m[f.name] = f.content; }); return m; }
function draftBase() { return V1.releases.length ? V1.releases[V1.releases.length - 1].files : V1.draft.base0; }
function relBase(i) { return i > 0 ? relFiles(i - 1) : V1.releases[0].base0; }
function ensureDraft() { if (!V1.draft) V1.draft = { n: (V1.releases.length ? V1.releases[V1.releases.length - 1].n : 0) + 1, base0: V1.releases.length ? null : filesMap(), fixes: [], seq: 0 }; return V1.draft; }
function recordFix(i, auto) {
  const d = ensureDraft(), fx = d.fixes[i]; if (!fx) return false;
  const delta = diffStates(lastState(draftBase(), d.fixes), filesMap());
  if (!Object.keys(delta).length) { if (!auto) toast('لا تغييرات منذ آخر تصحيح مسجّل', 'err'); return false; }
  fx.d = delta; fx.status = 'applied'; fx.seq = ++d.seq; fx.t = Date.now(); v1Save(); return true;
}
function v1Auto() {
  if (!V1.draft) return; const i = V1.draft.fixes.findIndex(f => f.status === 'pending'); if (i < 0) return;
  if (recordFix(i, true)) { log('ok', 'نُسب الباتش إلى تصحيح ' + (i + 1) + ': ' + V1.draft.fixes[i].title); setTimeout(() => toast('نُسب إلى تصحيح ' + (i + 1) + ' — ' + truncate(V1.draft.fixes[i].title, 40), 'ok', { label: 'تغيير', fn: showV1 }), 300); }
}
function sourceOfState(map) {
  const sf = files, sa = activeId;
  try { files = Object.keys(map).map(n => makeFile(n, map[n], map[n])); const d0 = makeFile('__d.txt', '', ''); files.push(d0); activeId = d0.id; return projectSource(); } finally { files = sf; activeId = sa; }
}
function previewState(map, label, vi) {
  const src = sourceOfState(map); if (!src) return toast('لا ملف HTML في هذه الحالة', 'err');
  clearConsole(); const fr = $('runFrame'); fr.srcdoc = ''; setTimeout(() => { fr.srcdoc = withHook(src); }, 30); switchTab('p-run'); if (vi == null) hideVerBar(); else showVerBar(vi); toast('معاينة: ' + label + ' (للقراءة فقط)', 'ok');
}
function restoreMap(map, label) { restoreSnap({ files: Object.keys(map).map(n => ({ name: n, content: map[n] })) }); log('ok', 'استرجاع: ' + label); }
function dlBlob(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
let v1Act = null;
function v1Render(html, fn) { v1Act = fn; $('v1Body').innerHTML = html; }
$('v1Body').addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el && v1Act) v1Act(el.dataset.act, el); });
/* حذف/إعادة بناء السلسلة دون كسر الفروق المخزّنة */
function rebaseFixes(fixes, from, to) {
  const f = fixes.filter(x => x.status === 'applied' && x.d).sort((a, b) => a.seq - b.seq)[0];
  if (f) f.d = diffStates(to, applyDelta(from, f.d));
}
function dropFixDelta(fixes, base, k) {
  const f = fixes[k]; if (!f) return;
  if (f.d) {
    const nx = fixes.filter(x => x !== f && x.status === 'applied' && x.d && x.seq > f.seq).sort((a, b) => a.seq - b.seq)[0];
    if (nx) nx.d = diffStates(lastState(base, fixes, f.seq - 1), applyDelta(lastState(base, fixes, f.seq), nx.d));
  }
  delete f.d; delete f.seq;
}
function v1DelFix(ctx, k) { dropFixDelta(ctx.fixes, ctx.base, k); ctx.fixes.splice(k, 1); v1Save(); }
function v1DelRelease(i) {
  const R = V1.releases, n = R.length, r = R[i], d = ensureDraft();
  const maps = R.map((_, k) => relFiles(k));
  const prev = i > 0 ? maps[i - 1] : (r.base0 || maps[0]);
  rebaseFixes(i < n - 1 ? R[i + 1].fixes : d.fixes, maps[i], prev);
  R.splice(i, 1); maps.splice(i, 1);
  R.forEach((x, k) => { x.files = maps[k]; delete x.rd; });
  if (!R.length) d.base0 = prev; else if (i === 0) R[0].base0 = prev;
  if (i === n - 1) d.n = r.n;
  v1Compact(); v1Save();
}
function relGuard() { const R = V1.releases; return !!R.length && !Object.keys(diffStates(R[R.length - 1].files, filesMap())).length; }
async function quickRelease() {
  const c = cur(); if (c) c.content = editor.value;
  if (!files.length) return toast('لا ملفات', 'err');
  if (relGuard()) return toast('لا تغييرات منذ آخر إصدار — لا حاجة لإصدار جديد', 'err');
  const d = ensureDraft(), left = d.fixes.filter(f => f.status === 'pending').length;
  const nm = await ui.prompt('اسم الإصدار ' + d.n + ' (اختياري)' + (left ? ' — ' + left + ' تصحيح معلّق سيُرحَّل للإصدار التالي' : ''), '', 'تسجيل');
  if (nm == null) return; doRelease(nm.trim());
  if (currentTab === 'p-v1') showV1();
}
function fxIcon(st) {
  const m = { applied: ['check', 'ok'], pending: ['', 'pend'], deferred: ['skip', 'def'], rejected: ['x', 'rej'] }[st] || ['', 'pend'];
  return '<span class="fxs ' + m[1] + '" title="' + ST[st] + '">' + (m[0] ? ic(m[0]) : '') + '</span>';
}
function fxDots(fx) {
  const c = { applied: 'ok', pending: 'pend', deferred: 'def', rejected: 'rej' };
  return fx.slice(0, 14).map(f => '<i class="fd ' + (c[f.status] || 'pend') + '"></i>').join('') + (fx.length > 14 ? '<small>+' + (fx.length - 14) + '</small>' : '');
}
const v1View = { tab: 'timeline', a: '', b: 'cur', file: '' };
function v1StateOpts() {
  const out = [{ id: 'cur', label: 'الحالي (المشروع الآن)' }];
  V1.releases.slice().reverse().forEach((r, idx) => {
    const i = V1.releases.length - 1 - idx;
    out.push({ id: 'r:' + i, label: 'إصدار ' + r.n + (r.name ? ' — ' + r.name : '') });
  });
  if (V1.draft && V1.draft.base0) out.push({ id: 'base0', label: 'نقطة بداية المشروع' });
  return out;
}
function v1ResolveState(id) {
  if (id === 'cur') return { id: 'cur', label: 'الحالي', map: filesMap(), type: 'cur' };
  if (id === 'base0' && V1.draft && V1.draft.base0) return { id: 'base0', label: 'بداية المشروع', map: V1.draft.base0, type: 'base' };
  if (id && id.startsWith('r:')) {
    const i = +id.slice(2), r = V1.releases[i];
    if (r) return { id, label: 'إصدار ' + r.n + (r.name ? ' — ' + r.name : ''), map: relFiles(i), type: 'rel', idx: i, rel: r };
  }
  if (V1.releases.length) {
    const i = V1.releases.length - 1, r = V1.releases[i];
    return { id: 'r:' + i, label: 'إصدار ' + r.n + (r.name ? ' — ' + r.name : ''), map: relFiles(i), type: 'rel', idx: i, rel: r };
  }
  if (V1.draft && V1.draft.base0) return { id: 'base0', label: 'بداية المشروع', map: V1.draft.base0, type: 'base' };
  return { id: 'cur', label: 'الحالي', map: filesMap(), type: 'cur' };
}
function v1DiffFileHTML(aText, bText) {
  const H = typeof lineDiffHunks === 'function' ? lineDiffHunks(aText || '', bText || '') : [];
  if (!H.length) return '<div class="empty-msg">متطابقان — لا فروق في الأسطر</div>';
  let total = 0, out = '';
  for (let i = 0; i < H.length && i < 30 && total < 400; i++) {
    const hk = H[i];
    out += `<div class="dh">مقطع ${i + 1}/${H.length} — سطر ${hk.ln}</div>`;
    hk.ops.slice(0, 80).forEach(o => {
      total++;
      out += `<div class="dl ${o.t === '+' ? 'add' : o.t === '-' ? 'del' : 'ctx'}">${o.t === ' ' ? '  ' : o.t + ' '}${esc(truncate(o.x, 160))}</div>`;
    });
    if (hk.ops.length > 80) out += `<div class="dm">… +${hk.ops.length - 80} سطر</div>`;
  }
  if (H.length > 30 || total >= 400) out += '<div class="dm">العرض مقتطع (حد 30 مقطعاً/400 سطر)</div>';
  return out;
}
function v1CopyDiffAI(sa, sb, rows) {
  let out = `# مقارنة إصداري CodePatcher\nمن: ${sa.label}\nإلى: ${sb.label}\nالملفات المتغيرة: ${rows.length}\n\n`;
  if (!rows.length) { out += 'متطابقان بالكامل.\n'; return copyToClipboard(out).then(() => toast('نُسخ تقرير المقارنة للذكاء', 'ok')); }
  rows.slice(0, 20).forEach(r => {
    out += `## [${r.k}] ${r.n} (+${r.add} -${r.del})\n`;
    const H = typeof lineDiffHunks === 'function' ? lineDiffHunks(sa.map[r.n] || '', sb.map[r.n] || '') : [];
    H.slice(0, 4).forEach(hk => {
      out += `@@ سطر ${hk.ln} @@\n`;
      out += hk.ops.slice(0, 30).map(o => (o.t === ' ' ? '  ' : o.t + ' ') + truncate(o.x, 140)).join('\n') + '\n';
    });
    out += '\n';
  });
  if (rows.length > 20) out += `… +${rows.length - 20} ملف آخر\n`;
  copyToClipboard(out).then(() => toast('نُسخ تقرير المقارنة للذكاء (' + rows.length + ' ملف)', 'ok'));
}
function showV1() {
  if (ui.modal.classList.contains('open')) ui.close(null);
  if (currentTab !== 'p-v1') { switchTab('p-v1'); return; }
  const d = ensureDraft(), R = V1.releases, tot = d.fixes.length, ap = d.fixes.filter(f => f.status === 'applied').length;
  const un = Object.keys(diffStates(lastState(draftBase(), d.fixes), filesMap())).length, pct = tot ? Math.round(ap * 100 / tot) : 0;

  const opts = v1StateOpts();
  if (!opts.some(o => o.id === v1View.a)) v1View.a = R.length ? 'r:' + (R.length - 1) : (opts[1] ? opts[1].id : 'cur');
  if (!opts.some(o => o.id === v1View.b)) v1View.b = 'cur';
  const sa = v1ResolveState(v1View.a), sb = v1ResolveState(v1View.b);
  const cmpRows = cmpStates(sa.map, sb.map);
  if (!cmpRows.some(r => r.n === v1View.file)) v1View.file = cmpRows[0] ? cmpRows[0].n : '';
  const totalAdd = cmpRows.reduce((s, r) => s + r.add, 0), totalDel = cmpRows.reduce((s, r) => s + r.del, 0);

  const tile = (act, icon, label, cls) => '<button type="button" class="v1-tile' + (cls ? ' ' + cls : '') + '" data-act="' + act + '">' + ic(icon) + '<span>' + label + '</span></button>';
  const leg = (cls, icon, txt) => '<span><span class="fxs ' + cls + '">' + (icon ? ic(icon) : '') + '</span>' + txt + '</span>';

  const hero = '<div class="v1-hero"><div class="v1-ring" style="--p:' + pct + '"><b>' + d.n + '</b></div><div class="v1-ht"><b>إصدار ' + d.n + ' — قيد العمل</b><span>' + (tot ? ap + ' من ' + tot + ' تصحيح منجز' : 'لا تصحيحات مرقمة بعد') + '</span>' +
    (un ? '<button type="button" class="v1-chip warn" data-act="recnow">' + ic('check', 'xs') + ' سجّل ' + un + ' ملف معدّل كتصحيح</button>' : '<span class="v1-chip ok">' + ic('check', 'xs') + ' كل التغييرات منسوبة وموثقة</span>') + '</div></div>';
  const tiles = '<div class="v1-tiles">' + tile('add', 'plus', 'تصحيح') + tile('doc', 'paste', 'قائمة 1-2-3') + tile('rel', 'flag', 'تثبيت إصدار', 'main') + tile('vsave', 'save', 'حفظ ZIP') + '</div>';
  const help = '<details class="v1-help"><summary>دورة الإصدارات والمقارنة</summary><ol><li>الصق قائمة التصحيحات (1- 2- 3-) أو أضف تصحيحاً يدوياً.</li><li>طبّق باتشات الذكاء الاصطناعي من تبويب الباتشات لتُنسب تلقائياً للتصحيحات.</li><li>راقب الفروق بين أي إصدار والحالي أو بين إصدارين في لوحة المقارنة.</li><li>ثبّت الإصدار واحفظه في ZIP يضم سجل الإصدارات الكامل لاسترجاعه لاحقاً.</li></ol></details>';

  const curItem = '<div class="tl-item cur"><div class="tl-node"><span>' + d.n + '</span></div><div class="tl-card"><div class="tl-h"><b>تصحيحات الإصدار ' + d.n + '</b>' + (tot ? '<span>' + ap + '/' + tot + '</span>' : '') + '</div>' +
    (d.fixes.map((f, i) => {
      const chCnt = f.d ? Object.keys(f.d).length : 0;
      return '<div class="fxr" data-act="fx" data-i="' + i + '">' + fxIcon(f.status) + '<em>' + (i + 1) + '</em><span class="fxr-title">' + esc(f.title) + '</span>' + (chCnt ? '<span class="fxr-cnt">' + chCnt + ' ملف</span>' : '') + '</div>';
    }).join('') || '<div class="tl-empty">' + ic('paste', 'xs') + '<span>الصق قائمتك المرقمة (1- 2- 3-) أو أضف تصحيحاً جديداً</span></div>') +
    (tot ? '<div class="v1-leg">' + leg('ok', 'check', 'منجز') + leg('pend', '', 'معلّق') + leg('def', 'skip', 'مؤجّل') + leg('rej', 'x', 'مرفوض') + '</div>' : '') + '</div></div>';

  const relItems = R.map((r, i) => {
    const a = r.fixes.filter(f => f.status === 'applied').length, last = i === R.length - 1;
    const activeCmp = sa.id === 'r:' + i || sb.id === 'r:' + i;
    const fixChips = r.fixes.length
      ? '<div class="tl-fixes">' + r.fixes.slice(0, 4).map((f, k) => {
          const fc = f.status === 'applied' ? 'ok' : f.status === 'rejected' ? 'rej' : f.status === 'deferred' ? 'def' : '';
          return '<span class="tl-fix-chip ' + fc + '"><b>' + (k + 1) + '.</b><span>' + esc(truncate(f.title, 34)) + '</span></span>';
        }).join('') + (r.fixes.length > 4 ? '<span class="tl-fix-chip">+' + (r.fixes.length - 4) + ' أخرى</span>' : '') + '</div>'
      : '';
    return '<div class="tl-item rel' + (activeCmp ? ' selected' : '') + '" data-act="rl" data-i="' + i + '"><div class="tl-node"><span>' + r.n + '</span></div><div class="tl-card"><div class="tl-h"><b>' + (r.name ? esc(r.name) : 'إصدار ' + r.n) + '</b>' + (last ? '<em class="tl-new">الأحدث</em>' : '') +
      '<button type="button" class="tl-eye" data-act="rprev" data-i="' + i + '" aria-label="معاينة">' + ic('monitor') + '</button></div><div class="tl-meta"><span>' + new Date(r.t).toLocaleDateString('en-GB') + '</span><span>' + ic('file-txt', 'xs') + ' ' + (r.nf || 0) + ' ملف</span><span>' + ic('check', 'xs') + ' ' + a + '/' + r.fixes.length + ' تصحيح</span></div>' +
      fixChips +
      '<div class="tl-actions"><button type="button" class="pmini" data-act="rcmp" data-i="' + i + '">' + ic('layers', 'xs') + ' مقارنة</button><button type="button" class="pmini" data-act="rprev" data-i="' + i + '">' + ic('play', 'xs') + ' معاينة</button><button type="button" class="pmini" data-act="rl" data-i="' + i + '">' + ic('settings', 'xs') + ' إدارة و ZIP</button></div>' +
      '</div></div>';
  }).reverse().join('');
  const start = '<div class="tl-item start"><div class="tl-node dot"></div><div class="tl-card">' + (R.length ? 'بداية المشروع' : 'بداية المشروع — عند استقرار التعديلات اضغط «تثبيت إصدار» لحفظ لقطة قابلة للمقارنة والاسترجاع.') + '</div></div>';

  const optHtml = sel => opts.map(o => '<option value="' + esc(o.id) + '"' + (o.id === sel ? ' selected' : '') + '>' + esc(o.label) + '</option>').join('');
  const cmpFilesHtml = cmpRows.length
    ? '<div class="cmp-files">' + cmpRows.map(r => {
        const kc = r.k === '+' ? 'add' : r.k === '−' ? 'del' : 'mod';
        return '<button type="button" class="cmp-file-row' + (r.n === v1View.file ? ' active' : '') + '" data-act="cmpf" data-f="' + esc(r.n) + '">' +
          '<span class="cmp-k ' + kc + '">' + r.k + '</span><span class="cmp-fn">' + esc(r.n) + '</span><span class="cmp-stat">+' + r.add + ' −' + r.del + '</span></button>';
      }).join('') + '</div>'
    : '<div class="empty-msg">النسختان متطابقتان تماماً — لا توجد فروق بينهما</div>';

  const cmpDiffBox = v1View.file
    ? '<div class="pdiff cmp-diff">' + v1DiffFileHTML(sa.map[v1View.file] || '', sb.map[v1View.file] || '') + '</div>'
    : '';

  const cmpPane = '<div class="cmp-card">' +
    '<div class="cmp-head"><b>استوديو المقارنة والفروق</b><span>' + esc(sa.label) + ' ◂ ' + esc(sb.label) + '</span></div>' +
    '<div class="cmp-selectors">' +
      '<label class="cmp-select-wrap"><small>النسخة الأساسية (من)</small><select class="cmp-select" data-v1sel="a">' + optHtml(sa.id) + '</select></label>' +
      '<button type="button" class="cmp-swap" data-act="cmpswap" title="تبديل طرفي المقارنة" aria-label="تبديل طرفي المقارنة">⇄</button>' +
      '<label class="cmp-select-wrap"><small>النسخة الهدف (إلى)</small><select class="cmp-select" data-v1sel="b">' + optHtml(sb.id) + '</select></label>' +
    '</div>' +
    '<div class="cmp-summary">' +
      '<span class="badge applied">+' + cmpRows.filter(r => r.k === '+').length + ' جديد</span>' +
      '<span class="badge skipped">~' + cmpRows.filter(r => r.k === '~').length + ' معدّل</span>' +
      '<span class="badge failed">−' + cmpRows.filter(r => r.k === '−').length + ' محذوف</span>' +
      '<span class="meta-sub">+' + totalAdd + ' / −' + totalDel + ' سطر</span>' +
      '<button type="button" class="pmini" data-act="cmpai">' + ic('copy', 'xs') + ' تقرير للذكاء</button>' +
    '</div>' +
    cmpFilesHtml +
    cmpDiffBox +
    (sa.type === 'rel' ? '<div class="srow"><button type="button" class="btn" data-act="cmpprev">' + ic('monitor', 'xs') + ' معاينة ' + esc(sa.label) + '</button><button type="button" class="btn outline" data-act="cmprest">' + ic('undo', 'xs') + ' استرجاع إليها</button></div>' : '') +
    '</div>';

  const modeTabs = '<div class="v1-tabs">' +
    '<button type="button" class="v1-tab' + (v1View.tab === 'timeline' ? ' active' : '') + '" data-act="vtab" data-v="timeline">' + ic('layers', 'xs') + ' الإصدارات والتصحيحات</button>' +
    '<button type="button" class="v1-tab' + (v1View.tab === 'compare' ? ' active' : '') + '" data-act="vtab" data-v="compare">' + ic('search', 'xs') + ' مقارنة الفروق <span class="v1-tab-cnt">' + cmpRows.length + '</span></button>' +
    '</div>';

  const html =
    '<div class="v1-top"><h3>الإصدارات والمقارنة</h3><button type="button" class="v1-ibtn" data-act="clog" title="نسخ سجل التغييرات" aria-label="نسخ سجل التغييرات">' + ic('copy') + '</button><button type="button" class="v1-ibtn" data-act="vsave" title="حفظ ZIP بالسجل" aria-label="حفظ ZIP بالسجل">' + ic('save') + '</button></div>' +
    modeTabs +
    '<div class="v1-workspace">' +
      '<div class="v1-main' + (v1View.tab !== 'timeline' ? ' v1-pane-hidden' : '') + '">' + hero + tiles + help + '<div class="tl">' + curItem + relItems + start + '</div></div>' +
      '<div class="v1-compare' + (v1View.tab !== 'compare' ? ' v1-pane-hidden' : '') + '">' + cmpPane + '</div>' +
    '</div>';

  v1Render(html, async (act, el) => {
    const i = +el.dataset.i;
    if (act === 'vtab') { v1View.tab = el.dataset.v || 'timeline'; return showV1(); }
    if (act === 'vsave') return saveVersions();
    if (act === 'recnow') {
      let k = d.fixes.findIndex(f => f.status === 'pending');
      if (k < 0) { const t = await ui.prompt('اسم هذا التصحيح', '', 'تسجيل'); if (!t || !t.trim()) return showV1(); d.fixes.push({ title: t.trim().slice(0, 160), status: 'pending' }); k = d.fixes.length - 1; }
      if (recordFix(k, false)) toast('سُجّل كتصحيح ' + (k + 1), 'ok'); return showV1();
    }
    if (act === 'fx') return fixSheet({ fixes: d.fixes, base: draftBase(), draft: true }, i);
    if (act === 'rl') return relSheet(i);
    if (act === 'rprev') return previewRelease(i);
    if (act === 'rcmp') { v1View.a = 'r:' + i; v1View.b = 'cur'; v1View.file = ''; v1View.tab = 'compare'; return showV1(); }
    if (act === 'cmpswap') { const tmp = v1View.a; v1View.a = v1View.b; v1View.b = tmp; v1View.file = ''; return showV1(); }
    if (act === 'cmpf') { v1View.file = el.dataset.f || ''; return showV1(); }
    if (act === 'cmpai') return v1CopyDiffAI(sa, sb, cmpRows);
    if (act === 'cmpprev' && sa.type === 'rel') return previewRelease(sa.idx);
    if (act === 'cmprest' && sa.type === 'rel') {
      if (await ui.confirm('استرجاع المشروع إلى ' + sa.label + '؟ (تُحفظ حالتك الحالية أولاً)', 'استرجاع')) { restoreMap(sa.map, sa.label); switchTab('p-edit'); }
      return;
    }
    if (act === 'add') { const t = await ui.prompt('عنوان التصحيح', '', 'إضافة'); if (t && t.trim()) { d.fixes.push({ title: t.trim().slice(0, 160), status: 'pending' }); v1Save(); } return showV1(); }
    if (act === 'doc') return docSheet();
    if (act === 'rel') return quickRelease();
    if (act === 'clog') { const md = R.map(changelogMD).reverse().concat(d.fixes.length ? [changelogMD({ n: d.n + ' (جارٍ)', name: '', fixes: d.fixes })] : []).join('\n'); copyToClipboard(md).then(() => toast('نُسخ سجل التغييرات', 'ok')); }
  });
}
$('v1Body').addEventListener('change', e => {
  const sel = e.target.closest && e.target.closest('[data-v1sel]');
  if (!sel) return;
  if (sel.dataset.v1sel === 'a') v1View.a = sel.value;
  else if (sel.dataset.v1sel === 'b') v1View.b = sel.value;
  v1View.file = '';
  showV1();
});
function docSheet() {
  ui.show('<h3>وثيقة التصحيحات</h3><div class="slabel">الصق قائمتك: 1- … 2- … 3- …</div><textarea class="plain" id="fxDoc" rows="8" placeholder="1- ...\n2- ..."></textarea><div class="srow"><button type="button" class="btn" data-act="back">رجوع</button><button type="button" class="btn primary" data-act="ok">إضافة</button></div>', (act) => {
    if (act === 'back') return showV1();
    const l = parseFixDoc($('fxDoc').value); if (!l.length) return toast('لم أجد بنوداً مرقمة', 'err');
    const d = ensureDraft(); l.forEach(t => d.fixes.push({ title: t, status: 'pending' })); v1Save(); toast('أُضيف ' + l.length + ' تصحيح', 'ok'); showV1();
  });
}
function fixSheet(ctx, k) {
  const f = ctx.fixes[k], st = stateAfter(ctx.base, ctx.fixes, k), label = 'تصحيح ' + (k + 1);
  ui.show(`<h3>${k + 1}- ${esc(f.title)}</h3><div class="slabel">${ST[f.status]}${f.d ? ' · ' + Object.keys(f.d).length + ' ملف تغيّر' : ''}</div><div class="srow">` +
    (ctx.draft ? '<button type="button" class="btn primary" data-act="done">أنجزته الآن</button><button type="button" class="btn" data-act="defer">تأجيل</button><button type="button" class="btn" data-act="rej">رفض</button><button type="button" class="btn" data-act="pend">معلّق</button>' : '') +
    '</div><div class="srow">' + (st ? '<button type="button" class="btn" data-act="prev">معاينة بعده</button><button type="button" class="btn" data-act="cmp">مقارنة بالحالي</button><button type="button" class="btn" data-act="rest">الرجوع إليه</button>' : '') + '</div><div class="srow"><button type="button" class="btn" data-act="ren">' + ic('edit', 'xs') + ' تعديل العنوان</button><button type="button" class="btn dng" data-act="del">' + ic('trash', 'xs') + ' حذف</button></div><button type="button" class="btn" data-act="back">رجوع</button>', async (act) => {
      const d = V1.draft;
      if (act === 'back') return ctx.draft ? showV1() : relSheet(ctx.rel);
      if (act === 'ren') { const t = await ui.prompt('عنوان التصحيح', f.title, 'حفظ'); if (t && t.trim()) { f.title = t.trim().slice(0, 160); v1Save(); } return fixSheet(ctx, k); }
      if (act === 'del') { if (!(await ui.confirm('حذف التصحيح ' + (k + 1) + '؟ (ملفاتك لا تتغير)', 'حذف'))) return fixSheet(ctx, k); v1DelFix(ctx, k); toast('حُذف التصحيح', 'ok'); return ctx.draft ? showV1() : relSheet(ctx.rel); }
      if (act === 'done') {
        const before = ctx.fixes.slice(0, k).filter(x => x.status === 'pending').length;
        if (before && !(await ui.confirm('يوجد ' + before + ' تصحيح معلّق قبل هذا. تجاوزه؟', 'تجاوز'))) return showV1();
        recordFix(k, false); return showV1();
      }
      if (act === 'defer' || act === 'rej' || act === 'pend') { if (f.status === 'applied') { if (!(await ui.confirm('سيُلغى تسجيل هذا التصحيح (الملفات لا تتغير). متابعة؟', 'متابعة'))) return showV1(); dropFixDelta(ctx.fixes, ctx.base, k); } f.status = act === 'defer' ? 'deferred' : act === 'rej' ? 'rejected' : 'pending'; v1Save(); return showV1(); }
      if (act === 'prev') { ui.close(null); return previewState(st, label); }
      if (act === 'cmp') return cmpSheet(st, filesMap(), label + ' ← الحالي', () => fixSheet(ctx, k));
      if (act === 'rest') { ui.close(null); if (await ui.confirm('استرجاع المشروع إلى حالته بعد ' + label + '؟ (تُحفظ حالتك الحالية أولاً ولا يُمحى شيء من السجل)', 'استرجاع')) restoreMap(st, label); }
    });
}
function relSheet(i) {
  const r = V1.releases[i], title = 'إصدار ' + r.n;
  ui.show(`<h3>${title}${r.name ? ' — ' + esc(r.name) : ''}</h3>` +
    (r.fixes.length ? uiScroll(r.fixes.map((f, k) => `<div class='issue' data-act='rf' data-i='${k}'><b>${k + 1}- ${esc(f.title)}</b><span>${ST[f.status]}</span></div>`).join(''), 'sm') : uiNote('لا تصحيحات مسجّلة داخل هذا الإصدار')) +
    '<div class="srow"><button type="button" class="btn" data-act="prev">معاينة</button><button type="button" class="btn primary" data-act="cmp">مقارنة بالحالي</button><button type="button" class="btn" data-act="rest">استرجاع</button></div><div class="srow"><button type="button" class="btn" data-act="ren">' + ic('edit', 'xs') + ' تسمية</button><button type="button" class="btn dng" data-act="del">' + ic('trash', 'xs') + ' حذف الإصدار</button></div><div class="srow"><button type="button" class="btn" data-act="zip">ZIP</button><button type="button" class="btn" data-act="log">سجل التغييرات</button><button type="button" class="btn" data-act="back">رجوع</button></div>', async (act, el) => {
      if (act === 'back') return showV1();
      if (act === 'ren') { const nm = await ui.prompt('اسم الإصدار ' + r.n, r.name || '', 'حفظ'); if (nm != null) { r.name = nm.trim(); v1Save(); } return relSheet(i); }
      if (act === 'del') { if (!(await ui.confirm('حذف إصدار ' + r.n + ' من السجل؟ ملفاتك الحالية لا تتغير، وتبقى بقية الإصدارات كما هي.', 'حذف'))) return relSheet(i); hideVerBar(); v1DelRelease(i); toast('حُذف إصدار ' + r.n, 'ok'); return showV1(); }
      if (act === 'rf') return fixSheet({ fixes: r.fixes, base: relBase(i), draft: false, rel: i }, +el.dataset.i);
      if (act === 'prev') { ui.close(null); return previewRelease(i); }
      if (act === 'cmp') return cmpSheet(relFiles(i), filesMap(), title + ' ← الحالي', () => relSheet(i));
      if (act === 'rest') { ui.close(null); if (await ui.confirm('استرجاع المشروع إلى ' + title + '؟ (تُحفظ حالتك الحالية أولاً)', 'استرجاع')) restoreMap(relFiles(i), title); return; }
      if (act === 'log') copyToClipboard(changelogMD(r)).then(() => toast('نُسخ سجل التغييرات', 'ok'));
      if (act === 'zip') { const enc = new TextEncoder(); const rf = relFiles(i); dlBlob(await zipC(Object.keys(rf).map(n => ({ name: n.replace(/^\/+/, ''), data: enc.encode(rf[n]) }))), 'release-' + r.n + '.zip'); toast('نُزّل ZIP إصدار ' + r.n, 'ok'); }
    });
}
function cmpSheet(a, b, label, back) {
  const rows = cmpStates(a, b);
  ui.show('<h3>مقارنة: ' + esc(label) + '</h3>' +
    (rows.length ? uiScroll(rows.map((r, i) => `<div class='issue' data-act='cf' data-i='${i}'><b>${r.k} ${esc(truncate(r.n, 50))}</b><span>+${r.add} −${r.del}</span></div>`).join(''), 'md') : uiEmpty('متطابقان تماماً')) +
    '<button type="button" class="btn" data-act="back">رجوع</button>', (act, el) => {
    if (act === 'back') return back();
    if (act !== 'cf') return;
    const r = rows[+el.dataset.i];
    ui.show('<h3>' + esc(r.n) + '</h3><div class="pdiff">' + v1DiffFileHTML(a[r.n] || '', b[r.n] || '') + '</div><button type="button" class="btn" data-act="back2">رجوع</button>', () => cmpSheet(a, b, label, back));
  });
}

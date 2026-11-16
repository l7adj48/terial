'use strict';
/* واجهة الباتشات + القبول الجزئي + الفروق */
/* ===== الباتشات: مشروع متعدد الملفات ===== */
let lastBatch = null;
const BUNDLE_CNT = /\s*\((\d+)\s*(?:lines?|سطر|أسطر)\)\s*$/i;
function bundleMark(ln) {
  const m = /^[ \t]*={3,}[ \t]*(?:FILE|ملف)[ \t]*:[ \t]*(.+?)[ \t]*(?:={3,})?[ \t]*$/i.exec(ln); if (!m) return null;
  let name = m[1].trim(), n = null; const c = BUNDLE_CNT.exec(name);
  if (c) { n = +c[1]; name = name.slice(0, c.index).trim(); }
  return { name, n };
}
/* يقرأ === FILE: path === ، وإن وُجد (N lines) يقرأ N سطراً بالضبط فلا يلتبس محتوى يشبه الفاصل.
   عند عدم تطابق العدد يرجع للقراءة حتى الفاصل التالي ويضع warn على الملف. */
function parseBundle(raw) {
  const L = nl(raw).split('\n'), out = []; let i = 0;
  while (i < L.length && !bundleMark(L[i])) i++;
  if (i >= L.length) return null;
  const nextMark = from => { let q = from; while (q < L.length && !bundleMark(L[q])) q++; return q; };
  while (i < L.length) {
    const mk = bundleMark(L[i]), j = i + 1; let body = null, warn = '', next = 0;
    if (mk.n != null) {
      const e = j + mk.n; let k = e;
      while (k < L.length && (!L[k].trim() || /^\s*#( |$)/.test(L[k]) || /^\s*```\s*$/.test(L[k]))) k++;
      const inner = L.slice(j, e).some(l => { const m2 = bundleMark(l); return m2 && m2.n != null; });
      if (e <= L.length && !inner && (k >= L.length || bundleMark(L[k]))) { body = L.slice(j, e).join('\n'); next = k; }
    }
    if (body === null) {
      const q = nextMark(j); body = L.slice(j, q).join('\n'); next = q;
      if (/^\s*```/.test(body)) body = stripFences(body);
      if (mk.n != null) { const got = body.replace(/\s+$/, '') ? body.replace(/\s+$/, '').split('\n').length : 0; warn = 'متوقع ' + mk.n + ' سطر ووُجد ' + got + ' (ربما قُطع أو عُدّل النص)'; }
    }
    const t = body.replace(/\s+$/, '');
    out.push({ name: mk.name, content: t ? t + '\n' : (mk.n === 0 ? '' : '\n'), warn });
    i = next;
  }
  return out;
}
function parseInput(raw) {
  const t = stripFences(String(raw || '').trim());
  if (/^[\[{]/.test(t)) return parsePatches(raw);
  const b = parseBundle(raw);
  if (b) return { bundle: b, repaired: false };
  return parsePatches(raw);
}
function resolveFile(ref, work, def) {
  if (!ref) return { name: def !== undefined ? def : cur().name };
  const r = String(ref).trim().replace(/^(\.\/)+/, '').replace(/^\//, '');
  if (work[r] !== undefined) return { name: r };
  const base = r.split('/').pop();
  const m = Object.keys(work).filter(n => n.split('/').pop() === base);
  if (m.length === 1) return { name: m[0] };
  if (m.length > 1) return { err: 1, list: m };
  return { none: r };
}
function putFileResult(work, n, ref, content, overwrite, action) {
  const r = resolveFile(ref, work);
  if (r.err) return { n, action, file: ref, status: 'failed', error: makeError('FILE_AMBIGUOUS', 'اسم الملف ملتبس #' + n, { patchIndex: n, action, message: r.list.join(' ، '), suggestion: 'اكتب المسار الكامل' }) };
  const name = r.name || String(ref || '').trim().replace(/^(\.\/)+/, '').replace(/^\//, '');
  if (!name) return { n, action, file: '', status: 'failed', error: makeError('PATCH_INVALID', 'اسم الملف فارغ #' + n, { patchIndex: n, action }) };
  if (work[name] === content) return { n, action, file: name, status: 'skipped', reason: 'مطبق مسبقاً' };
  if (r.name && !overwrite) return { n, action, file: name, status: 'failed', error: makeError('FILE_EXISTS', 'الملف موجود #' + n, { patchIndex: n, action, message: name, suggestion: 'أضف "overwrite":true للاستبدال الكامل' }) };
  const prev = work[name] === undefined ? '' : work[name];
  work[name] = content;
  return { n, action, file: name, status: 'applied', line: 1, info: r.name ? 'استبدال كامل' : 'ملف جديد', ex: { b: '', a: content.slice(0, 160) }, bf: prev, af: content, full: 1 };
}
/* ===== H2: القبول الجزئي ===== */
let REJ = new Set(), REJ_KEY = '', PDOPEN = new Set(), lastEv = null, lastDry = true;
function rejSync(txt) { if (txt !== REJ_KEY) { REJ = new Set(); REJ_KEY = txt; PDOPEN = new Set(); } }
function clearPatchUI() { $('patchSummary').innerHTML = ''; $('patchList').innerHTML = ''; $('smokeBox').innerHTML = ''; }
function runCore(parsed, work, def, opts, rej) {
  const before = Object.assign({}, work), results = [];
  const scratch = () => Object.assign({}, work);
  if (parsed.bundle) {
    parsed.bundle.forEach((b, i) => {
      const n = i + 1;
      if (rej.has(n)) { const r = putFileResult(scratch(), n, b.name, b.content, true, 'file'); if (r.status === 'applied') r.status = 'rejected'; return results.push(r); }
      results.push(putFileResult(work, n, b.name, b.content, true, 'file'));
    });
  } else {
    parsed.patches.forEach((p, i) => {
      const n = i + 1;
      const bad = (code, title, o) => results.push({ n, action: (p && typeof p.action === 'string' ? p.action : 'replace'), file: p && p.file, status: 'failed', error: makeError(code, title + ' #' + n, Object.assign({ patchIndex: n, file: (p && typeof p === 'object') ? p.file : undefined }, o || {})) });
      if (!p || typeof p !== 'object' || Array.isArray(p)) return bad('PATCH_INVALID', 'باتش غير صالح');
      const act = typeof p.action === 'string' ? p.action.trim().toLowerCase() : 'replace';
      if (act === 'create') {
        const c = typeof p.content === 'string' ? p.content : (typeof p.replace === 'string' ? p.replace : null);
        if (!p.file) return bad('PATCH_INVALID', 'حقل file مفقود');
        if (c === null) return bad('PATCH_INVALID', 'حقل content مفقود');
        if (rej.has(n)) { const r = putFileResult(scratch(), n, p.file, nl(c), p.overwrite === true, 'create'); if (r.status === 'applied') r.status = 'rejected'; return results.push(r); }
        return results.push(putFileResult(work, n, p.file, nl(c), p.overwrite === true, 'create'));
      }
      const r = resolveFile(p.file, work, def);
      if (r.err) return bad('FILE_AMBIGUOUS', 'اسم الملف ملتبس', { message: r.list.join(' ، '), suggestion: 'اكتب المسار الكامل' });
      if (r.none) return bad('FILE_NOT_FOUND', 'الملف غير موجود', { message: r.none, suggestion: 'أنشئه أولاً بـ action:"create"' });
      const one = evaluatePatches(work[r.name], [p], opts), ev = one.results[0];
      ev.n = n; ev.file = r.name;
      if (ev.error) { ev.error.patchIndex = n; ev.error.title = ev.error.title.replace(/#1$/, '#' + n); ev.error.message = '[' + r.name + '] ' + (ev.error.message || ''); ev.error.file = r.name; ev.error.intended = typeof p.replace === 'string' ? p.replace : (typeof p.content === 'string' ? p.content : ''); }
      if (ev.status === 'applied') { if (rej.has(n)) ev.status = 'rejected'; else work[r.name] = one.output; }
      results.push(ev);
    });
  }
  const failed = results.filter(r => r.status === 'failed').length;
  const ev = { results, work, before, failed, blocked: opts.atomic && failed > 0, repaired: parsed.repaired, kind: kindLabel(parsed) };
  ev.changed = Object.keys(work).filter(k => work[k] !== before[k]);
  ev.lazy = lazyScan(parsed, before, rej);
  if (!ev.blocked) {
    let reg = 0;
    ev.changed.forEach(k => {
      const lang = langOf(k); if (lang !== 'js' && lang !== 'css' && lang !== 'json') return;
      const b = before[k] === undefined ? 0 : lintText(before[k], tokenize(before[k], lang), lang).length;
      const a = lintText(work[k], tokenize(work[k], lang), lang).length;
      if (a > b) reg += a - b;
    });
    if (reg) ev.regress = reg;
  }
  return ev;
}
function addedText(r) { return r.ed ? r.ed.map(e => e.ins).join('\n') : (r.af || ''); }
function h2Deps(part, full, beforeAll) {
  const deps = [], coupling = [], rejRows = part.results.filter(r => r.status === 'rejected');
  if (!rejRows.length) return { deps, coupling };
  part.results.forEach((r, i) => {
    const f = full.results[i]; if (!f || f.status !== 'applied') return;
    const changed = (r.status === 'failed' || r.status === 'skipped') || (r.status === 'applied' && r.count !== f.count);
    if (!changed) return;
    const same = rejRows.filter(x => x.n < r.n && x.file === r.file), on = (same.length ? same : rejRows.filter(x => x.n < r.n)).map(x => x.n);
    if (on.length) deps.push({ n: r.n, on, why: r.status === 'applied' ? 'تغيّر عدد المواضع المطابقة' : 'لم يعد يُطبَّق' });
  });
  const idRe = /[A-Za-z_$][\w$]{3,}/g;
  rejRows.forEach(j => {
    const ids = {}; (addedText(j).match(idRe) || []).forEach(x => { if (Object.keys(ids).length < 30) ids[x] = 1; });
    const fresh = Object.keys(ids).filter(x => beforeAll.indexOf(x) < 0);
    if (!fresh.length) return;
    part.results.forEach(k => {
      if (k.status !== 'applied' || k.n === j.n) return;
      const t = addedText(k), hit = fresh.find(x => t.indexOf(x) >= 0);
      if (hit && coupling.length < 6) coupling.push('#' + k.n + ' يستخدم «' + hit + '» المُضاف في #' + j.n + ' المرفوض');
    });
  });
  return { deps, coupling };
}
function evalWithRej(parsed, work, def, opts, rej) {
  const w0 = Object.assign({}, work);
  const ev = runCore(parsed, Object.assign({}, work), def, opts, rej);
  if (rej.size) {
    const full = runCore(parsed, Object.assign({}, work), def, opts, new Set());
    const d = h2Deps(ev, full, Object.keys(w0).map(k => w0[k]).join('\n'));
    ev.deps = d.deps; ev.coupling = d.coupling;
  }
  return ev;
}
function runPatchEngine() {
  const f0 = cur();
  if (!f0) { clearPatchUI(); renderErrors([makeError('NO_FILE', 'لا يوجد ملف مفتوح')]); return null; }
  let parsed;
  try { parsed = parseInput($('patchInput').value); }
  catch (e) { clearPatchUI(); renderErrors([e && e.code ? e : makeError('PARSE_FAIL', 'خطأ', { message: e && e.message })]); return null; }
  rejSync($('patchInput').value);
  const opts = { flex: $('optFlex').checked, atomic: $('optAtomic').checked };
  const work = {}; files.forEach(f => { work[f.name] = f.content; }); work[f0.name] = editor.value;
  const ev = evalWithRej(parsed, work, f0.name, opts, REJ);
  if (parsed.cleaned) log('ok', 'نُظّف الباتش من اقتباسات ذكية/أحرف خفية قبل التحليل');
  return ev;
}
function commitProject(ev) {
  const act = cur(), items = [];
  ev.changed.forEach(name => {
    const nv = ev.work[name]; let f = files.find(x => x.name === name);
    if (!f) { f = makeFile(name, nv, ''); files.push(f); items.push({ id: f.id, isNew: true, after: nv }); return; }
    items.push({ id: f.id, before: f.content, after: nv });
    if (f.id !== act.id) { pushHist(f, diffRange(f.content, nv), true); f.content = nv; f.dirtySave = true; }
  });
  if (ev.changed.includes(act.name)) setAll(ev.work[act.name]);
  lastBatch = { items };
  render(); scheduleSave();
}
function undoBatch() {
  const b = lastBatch; if (!b) return toast('لا يوجد تطبيق للتراجع عنه');
  const stale = b.items.some(it => { const f = files.find(x => x.id === it.id); return !f || f.content !== it.after; });
  if (stale) { lastBatch = null; return toast('تغيّرت الملفات بعد التطبيق — استخدم تراجع المحرر', 'err'); }
  lastBatch = null;
  b.items.forEach(it => {
    const f = files.find(x => x.id === it.id); if (!f) return;
    if (it.isNew) { files = files.filter(x => x !== f); removedIds.push(f.id); return; }
    if (f.id === activeId) { undo(); return; }
    f.undo.pop(); f.redo = []; f.content = it.before; f.dirtySave = true;
  });
  if (!files.some(f => f.id === activeId)) activeId = files.length ? files[0].id : null;
  render(); scheduleSave(); toast('تم التراجع عن آخر تطبيق', 'ok');
}
/* يحلّ الرابط بالنسبة لمجلد ملف الدخول (fromDir) حتى لا تختلط المشاريع المتجاورة.
   البحث بالاسم وحده لا يُستعمل إلا إن كان الاسم فريداً، ولا يُخمَّن عند وجود أكثر من ملف بنفس الاسم. */
function refFile(ref, fromDir) {
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return null;
  const clean = String(ref).split(/[?#]/)[0], abs = clean[0] === '/';
  const b = clean.replace(/^(\.\/)+/, '').replace(/^\//, '');
  if (!b) return null;
  fromDir = fromDir || '';
  const rel = normPath(abs ? b : (fromDir ? fromDir + '/' : '') + b);
  let f = rel != null ? files.find(x => x.name === rel) : null;
  if (f) return f;
  if (abs) { f = files.find(x => x.name === b); if (f) return f; }
  const base = b.split('/').pop(), same = files.filter(x => x.name.split('/').pop() === base);
  if (same.length === 1) return same[0];
  const inTree = fromDir ? same.filter(x => x.name.startsWith(fromDir + '/')) : same;
  return inTree.length === 1 ? inTree[0] : null;
}
/* ملف الدخول: index.html في مجلد الملف النشط، ثم في المجلدات الأعلى، ثم أي html في المجلد نفسه */
function pickEntry(f) {
  if (f.lang === 'html') return f;
  const htmls = files.filter(x => x.lang === 'html');
  let d = dirOf(f.name);
  for (;;) {
    const hit = htmls.find(x => dirOf(x.name) === d && /(^|\/)index\.html?$/i.test(x.name)) || htmls.find(x => dirOf(x.name) === d);
    if (hit) return hit;
    if (!d) break;
    d = dirOf(d);
  }
  return files.find(x => /(^|\/)index\.html?$/i.test(x.name)) || htmls[0] || f;
}
function projectSource() {
  const f = cur(); if (!f) return '';
  let entry = f;
  if (f.lang !== 'html') entry = pickEntry(f);
  const eDir = dirOf(entry.name);
  const src = entry.id === f.id ? editor.value : entry.content;
  if (entry.lang !== 'html') return src;
  const deferred = [];
  let out = src.replace(/<link\b[^>]*>/gi, m => {
    if (!/rel\s*=\s*["']?stylesheet/i.test(m)) return m;
    const h = /href\s*=\s*["']([^"']+)["']/i.exec(m), pf = h && refFile(h[1], eDir);
    return pf && pf !== entry ? '<style>' + pf.content + '</style>' : m;
  });
  out = out.replace(/<script\b([^>]*)>\s*<\/script>/gi, (m, attrs) => {
    const s = /\bsrc\s*=\s*["']([^"']+)["']/i.exec(attrs); if (!s) return m;
    const pf = refFile(s[1], eDir); if (!pf || pf === entry) return m;
    const isDefer = /\bdefer\b/i.test(attrs) && !/type\s*=\s*["']?module/i.test(attrs);
    const a = attrs.replace(/\bsrc\s*=\s*["'][^"']*["']/i, '').replace(/\s+(defer|async)\b/gi, '');
    const tag = '<script' + a + '>' + pf.content.replace(/<\/script/gi, '<\\/script') + '<\/script>';
    if (isDefer) { deferred.push(tag); return ''; }
    return tag;
  });
  if (deferred.length) out = /<\/body>/i.test(out) ? out.replace(/<\/body>/i, () => deferred.join('\n') + '</body>') : out + deferred.join('\n');
  return out;
}

function rowInfo(r) {
  if (r.status === 'applied') return (r.info ? r.info + ' · ' : '') + 'سطر ' + r.line + (r.count > 1 ? ' × ' + r.count : '') + (r.flex ? ' · مطابقة مرنة' : '');
  if (r.status === 'rejected') return 'مرفوض بقرارك — لن يُطبَّق' + (r.line ? ' (سطر ' + r.line + ')' : '');
  if (r.status === 'skipped') return r.reason || '';
  return r.error ? r.error.title : '';
}
function exHTML(r) {
  if (r.status !== 'applied' || !r.ex) return '';
  const fmt = (t, c, sg) => { const L = String(t).split('\n'); let o = L.slice(0, 6).map(x => `<div class="${c}">${sg} ${esc(truncate(x, 110))}</div>`).join(''); if (L.length > 6) o += `<div class="px-more">… +${L.length - 6} سطر</div>`; return o; };
  let h = '';
  if (r.ex.b) h += fmt(r.ex.b, 'del', '−');
  if (r.ex.a) h += fmt(r.ex.a, 'add', '+');
  return h ? `<div class="px">${h}</div>` : '';
}
/* ---- مقاطع الفروق (قبل/بعد مع سياق) ---- */
function hunksFromEdits(bf, ed, ctx) {
  ctx = ctx || 3;
  const BL = bf.split('\n'), out = [];
  ed.slice().sort((a, b) => a.at - b.at).forEach(e => {
    const ls = bf.lastIndexOf('\n', e.at - 1) + 1;
    let le = bf.indexOf('\n', e.at + e.del.length); if (le < 0) le = bf.length;
    const bl = bf.slice(ls, le).split('\n'), al = (bf.slice(ls, e.at) + e.ins + bf.slice(e.at + e.del.length, le)).split('\n');
    let k1 = 0; while (k1 < bl.length && k1 < al.length && bl[k1] === al[k1]) k1++;
    let k2 = 0; while (k2 < bl.length - k1 && k2 < al.length - k1 && bl[bl.length - 1 - k2] === al[al.length - 1 - k2]) k2++;
    const del = bl.slice(k1, bl.length - k2), add = al.slice(k1, al.length - k2);
    if (!del.length && !add.length) return;
    const d0 = bf.slice(0, ls).split('\n').length - 1 + k1;
    const ops = [];
    BL.slice(Math.max(0, d0 - ctx), d0).forEach(x => ops.push({ t: ' ', x }));
    del.forEach(x => ops.push({ t: '-', x })); add.forEach(x => ops.push({ t: '+', x }));
    BL.slice(d0 + del.length, d0 + del.length + ctx).forEach(x => ops.push({ t: ' ', x }));
    out.push({ ln: d0 + 1, ops });
  });
  return out;
}
function lineDiffHunks(a, b, ctx) {
  ctx = ctx || 3;
  const A = a === '' ? [] : a.split('\n'), B = b === '' ? [] : b.split('\n');
  let s = 0; while (s < A.length && s < B.length && A[s] === B[s]) s++;
  let e = 0; while (e < A.length - s && e < B.length - s && A[A.length - 1 - e] === B[B.length - 1 - e]) e++;
  const a2 = A.slice(s, A.length - e), b2 = B.slice(s, B.length - e), mid = [];
  if (!a2.length || !b2.length || a2.length * b2.length > 2500000) { a2.forEach(x => mid.push({ t: '-', x })); b2.forEach(x => mid.push({ t: '+', x })); }
  else {
    const n = a2.length, m = b2.length, W = m + 1, dp = new Uint16Array((n + 1) * W);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i * W + j] = a2[i] === b2[j] ? dp[(i + 1) * W + j + 1] + 1 : Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) { if (a2[i] === b2[j]) { mid.push({ t: ' ', x: a2[i] }); i++; j++; } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) { mid.push({ t: '-', x: a2[i++] }); } else { mid.push({ t: '+', x: b2[j++] }); } }
    while (i < n) mid.push({ t: '-', x: a2[i++] }); while (j < m) mid.push({ t: '+', x: b2[j++] });
  }
  const pre = A.slice(Math.max(0, s - ctx), s).map(x => ({ t: ' ', x })), post = A.slice(A.length - e, A.length - e + ctx).map(x => ({ t: ' ', x }));
  const ops = pre.concat(mid, post), aIdx = [];
  let ai = s - pre.length; ops.forEach(o => { aIdx.push(ai); if (o.t !== '+') ai++; });
  const ch = []; ops.forEach((o, k) => { if (o.t !== ' ') ch.push(k); });
  const hunks = []; if (!ch.length) return hunks;
  const close = (x, y) => { const from = Math.max(0, x - ctx), to = Math.min(ops.length - 1, y + ctx); hunks.push({ ln: aIdx[from] + 1, ops: ops.slice(from, to + 1) }); };
  let st = ch[0], pv = ch[0];
  for (let q = 1; q < ch.length; q++) { if (ch[q] - pv - 1 > 2 * ctx) { close(st, pv); st = ch[q]; } pv = ch[q]; }
  close(st, pv);
  return hunks;
}
function rowHunks(r) {
  if (r.full) return lineDiffHunks(r.bf || '', r.af || '');
  if (r.ed && typeof r.bf === 'string') return hunksFromEdits(r.bf, r.ed);
  return [];
}
function diffHTML(r) {
  const H = rowHunks(r); if (!H.length) return '<div class="dm">لا فروق للعرض</div>';
  let total = 0, h = '';
  for (let i = 0; i < H.length && i < 30 && total < 400; i++) {
    const hk = H[i]; h += `<div class="dh">مقطع ${i + 1}/${H.length} — سطر ${hk.ln}</div>`;
    hk.ops.slice(0, 80).forEach(o => { total++; h += `<div class="dl ${o.t === '+' ? 'add' : o.t === '-' ? 'del' : 'ctx'}">${o.t === ' ' ? '  ' : o.t + ' '}${esc(truncate(o.x, 160))}</div>`; });
    if (hk.ops.length > 80) h += `<div class="dm">… +${hk.ops.length - 80} سطر</div>`;
  }
  if (H.length > 30 || total >= 400) h += '<div class="dm">العرض مقتطع (حد 30 مقطعاً/400 سطر) — التطبيق نفسه لا يتأثر</div>';
  return h;
}
function renderPatchResults(ev, dryRun) {
  const rs = ev.results; lastEv = ev; lastDry = !!dryRun; $('smokeBox').innerHTML = ''; smokeSeq++;
  const applied = rs.filter(r => r.status === 'applied').length, skipped = rs.filter(r => r.status === 'skipped').length, failed = ev.failed, rejected = rs.filter(r => r.status === 'rejected').length;
  let html = `<div class="summary"><span class="badge applied">${ic('check', 'xs')} ${applied}</span><span class="badge skipped">${ic('skip', 'xs')} ${skipped}</span><span class="badge failed">${ic('x-circle', 'xs')} ${failed}</span>${rejected ? `<span class="badge rejected">${ic('skip', 'xs')} ${rejected}</span>` : ''}<span class="summary-mode">${dryRun ? 'معاينة' : 'تعديل'}</span></div>`;
  if (dryRun && applied > 0 && !ev.blocked) html += `<div class="srow srow-mt"><button type="button" class="btn success" data-papply="1">${ic('check', 'xs')} تطبيق ${applied}</button></div>`;
  if (dryRun && (applied + rejected) > 1) html += `<div class="srow srow-mt"><button type="button" class="pmini" data-pall="acc">قبول الكل</button><button type="button" class="pmini" data-pall="rej">رفض الكل</button></div>`;
  if (dryRun && (applied + rejected) > 0) html += '<div class="pnote">' + ic('alert-circle', 'xs') + '<span>اضغط ✓ لقبول/رفض كل مقطع أو «الملف» لكل مقاطعه، ثم «تطبيق». المرفوض لا يُطبَّق، ويُمسح اختيارك إن عدّلت نص الباتش.</span></div>';
  if (ev.blocked) html += '<div class="pnote">' + ic('alert-circle', 'xs') + '<span>لم يُطبَّق أي باتش (وضع الكل أو لا شيء) — صحّح الأخطاء ثم أعد المحاولة.</span></div>';
  if (ev.kind) html += '<div class="pnote">' + ic('check', 'xs') + '<span>فهمتُ هذا كـ: ' + esc(ev.kind) + '</span></div>';
  if (ev.repaired) html += '<div class="pnote">' + ic('wrench', 'xs') + '<span>تم إصلاح صيغة JSON تلقائياً (أسطر خام أو فواصل زائدة).</span></div>';
  if (ev.regress) html += `<div class="pnote">${ic('alert', 'xs')}<span>الناتج به ${ev.regress} مشكلة جديدة في الأقواس/النصوص مقارنةً بالحالي — راجع «المشاكل» بعد التطبيق (يمكنك التراجع).</span></div>`;
  if (ev.deps && ev.deps.length) html += `<div class="pnote">${ic('alert', 'xs')}<span><b>ترابط:</b> ` + ev.deps.map(d => '#' + d.n + ' ' + d.why + ' بسبب رفض ' + d.on.map(x => '#' + x).join('، ')).map(esc).join(' | ') + '</span></div>';
  if (ev.coupling && ev.coupling.length) html += `<div class="pnote">${ic('alert', 'xs')}<span><b>ترابط محتمل (كشف تقريبي):</b> ` + ev.coupling.map(esc).join(' | ') + '</span></div>';
  $('patchSummary').innerHTML = html;
  const icon = { applied: ic('check', 'xs'), skipped: ic('skip', 'xs'), failed: ic('x-circle', 'xs'), rejected: ic('skip', 'xs') };
  const depOf = {}; (ev.deps || []).forEach(d => { depOf[d.n] = d; });
  const groups = [], gi = {};
  rs.forEach(r => { const k = r.file || ''; if (gi[k] === undefined) { gi[k] = groups.length; groups.push({ name: k, rows: [] }); } groups[gi[k]].rows.push(r); });
  ev.groups = groups.map(g => g.rows.filter(r => r.status === 'applied' || r.status === 'rejected').map(r => r.n));
  const rowHTML = r => {
    const can = r.status === 'applied' || r.status === 'rejected', on = r.status === 'applied', d = depOf[r.n];
    const open = PDOPEN.has(r.n) && can;
    return `<div class="prow ${r.status}${open ? ' open' : ''}" data-n="${r.n}">${dryRun && can ? `<button type="button" class="pk${on ? ' on' : ''}" data-pk="${r.n}" aria-pressed="${on}" aria-label="قبول أو رفض المقطع ${r.n}">${on ? '✓' : '✗'}</button>` : ''}<b>#${r.n}</b><span class="pa">${esc(r.action)}</span><span class="pm">${icon[r.status]} ${esc(rowInfo(r))}</span>${can ? `<button type="button" class="pmini" data-pd="${r.n}">الفروق</button>` : ''}${d ? `<div class="pdep">يعتمد على المرفوض ${d.on.map(x => '#' + x).join('، ')}</div>` : ''}${exHTML(r)}<div class="pdiff"${open ? '' : ' hidden'}>${open ? diffHTML(r) : ''}</div></div>`;
  };
  $('patchList').innerHTML = groups.map((g, i) => {
    const sel = g.rows.filter(r => r.status === 'applied' || r.status === 'rejected'), acc = sel.filter(r => r.status === 'applied').length;
    const head = (g.name || groups.length > 1) ? `<div class="pgrp"><span class="pgn">${esc(g.name || 'عام')}</span>${dryRun && sel.length ? `<span>${acc}/${sel.length}</span><button type="button" class="pmini" data-pf="${i}">${acc ? 'رفض الملف' : 'قبول الملف'}</button>` : ''}</div>` : '';
    return head + g.rows.map(rowHTML).join('');
  }).join('');
  renderErrors(rs.filter(r => r.status === 'failed').map(r => r.error));
  lastPatchAttempt = { total: rs.length, applied, skipped, failed, rejected };
  return { applied, skipped, failed, rejected };
}
function smokeNote(ev, hint) {
  if (!ev || ev.blocked || !ev.changed.length) return;
  $('smokeBox').innerHTML = '<div class="pnote">' + ic('alert-circle', 'xs') + '<span>' + hint + '</span>' + (S.autoSmoke === false ? '<button type="button" class="pmini" onclick="smokeTest(lastEv)">فحص الدخان الآن</button>' : '') + '</div>';
}
function refreshPreview() { const ev = runPatchEngine(); if (ev) { renderPatchResults(ev, true); smokeNote(ev, S.autoSmoke === false ? 'الفحص التلقائي متوقف.' : 'تغيّر اختيارك — اضغط «معاينة» لإعادة اختبار الدخان.'); } }
function clearPatch() {
  const ta = $('patchInput'), old = ta.value;
  if (!old) { ta.focus(); return; }
  ta.value = ''; ta.dispatchEvent(new Event('input')); clearPatchUI(); renderErrors([]); lastEv = null; REJ = new Set(); smokeSeq++; ta.focus();
  toast('تم مسح الباتش', 'ok', { label: 'تراجع', fn: () => { ta.value = old; ta.dispatchEvent(new Event('input')); ta.focus(); } });
}
function h2Click(e) {
  const t = e.target.closest('[data-pk],[data-pf],[data-pd],[data-pall],[data-papply]'); if (!t || !lastEv) return;
  if (t.dataset.papply) return applyPatch();
  if (t.dataset.pd) {
    const n = +t.dataset.pd, row = t.closest('.prow'), box = row && row.querySelector('.pdiff'), r = lastEv.results.find(x => x.n === n);
    if (!box || !r) return;
    if (PDOPEN.has(n)) { PDOPEN.delete(n); box.hidden = true; row.classList.remove('open'); }
    else { PDOPEN.add(n); box.innerHTML = diffHTML(r); box.hidden = false; row.classList.add('open'); }
    return;
  }
  if (!lastDry) return;
  const rows = lastEv.results.filter(x => x.status === 'applied' || x.status === 'rejected');
  if (t.dataset.pk) { const n = +t.dataset.pk; if (REJ.has(n)) REJ.delete(n); else REJ.add(n); }
  else if (t.dataset.pf) { const g = lastEv.groups[+t.dataset.pf] || [], anyOn = g.some(n => !REJ.has(n)); g.forEach(n => { if (anyOn) REJ.add(n); else REJ.delete(n); }); }
  else if (t.dataset.pall) { rows.forEach(x => { if (t.dataset.pall === 'rej') REJ.add(x.n); else REJ.delete(x.n); }); }
  refreshPreview();
}
$('patchList').addEventListener('click', h2Click); $('patchSummary').addEventListener('click', h2Click);
function previewPatch() {
  const ev = runPatchEngine(); if (!ev) return;
  const c = renderPatchResults(ev, true);
  toast(ev.blocked ? 'سيُرفض الباتش بالكامل' : `معاينة: ${c.applied} سيُطبَّق${c.rejected ? '، ' + c.rejected + ' مرفوض' : ''}، ${c.failed} فشل`, c.failed ? 'err' : 'ok');
  if (S.autoSmoke !== false) smokeTest(ev); else smokeNote(ev, 'الفحص التلقائي متوقف.');
}
function applyPatch() {
  const ev = runPatchEngine(); if (!ev) return;
  const c = renderPatchResults(ev, false);
  if (ev.blocked) { toast('لم يُطبَّق شيء — صحّح الأخطاء', 'err'); log('err', `باتش مرفوض: فشل ${c.failed} من ${ev.results.length}`); return; }
  if (!c.applied) { toast(c.rejected ? 'كل المقاطع مرفوضة — لم يُطبَّق شيء' : c.skipped ? 'كل الباتشات مطبقة مسبقاً' : 'لم يتم تعديل شيء', c.skipped && !c.rejected ? '' : 'err'); return; }
  const first = ev.results.filter(r => r.status === 'applied').reduce((a, r) => Math.min(a, r.line || 1), Infinity);
  if (ev.lazy && ev.lazy.length) {
    log('err', 'حارس الباتش الكسول: ' + ev.lazy.join(' | '));
    if (S.strictLazy !== false) { toast('حُجب (الحارس مفعّل): ' + ev.lazy[0] + (ev.lazy.length > 1 ? ' (+' + (ev.lazy.length - 1) + ')' : ''), 'err'); return; }
    toast('تحذير: ' + ev.lazy[0], 'err');
  }
  snapNow('قبل تطبيق باتش');
  commitProject(ev); v1Auto(); REJ = new Set();
  toast(`تم تطبيق ${c.applied}${c.rejected ? ' (رُفض ' + c.rejected + ')' : ''} — ${ev.changed.length} ملف (أول تعديل سطر ${first})`, 'ok');
  log('ok', `باتش: طُبّق ${c.applied}، رُفض ${c.rejected || 0}، تخطّى ${c.skipped}، فشل ${c.failed} (${ev.changed.join('، ')})`);
}
function pasteAndPreview() {
  if (!navigator.clipboard || !navigator.clipboard.readText) return toast('الحافظة غير متاحة — الصق يدوياً في المربع ثم اضغط معاينة', 'err');
  navigator.clipboard.readText().then(txt => {
    if (!txt || !txt.trim()) return toast('الحافظة فارغة', 'err');
    const ta = $('patchInput'); ta.value = txt; ta.dispatchEvent(new Event('input')); scheduleSave();
    previewPatch();
    setTimeout(() => { const s = $('patchSummary'); if (s && s.scrollIntoView) s.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 80);
  }).catch(() => toast('تعذر قراءة الحافظة — الصق يدوياً ثم اضغط معاينة', 'err'));
}
function pastePatch() {
  if (!navigator.clipboard || !navigator.clipboard.readText) return toast('الحافظة غير متاحة — الصق يدوياً', 'err');
  navigator.clipboard.readText().then(txt => { $('patchInput').value = txt; scheduleSave(); toast('تم اللصق'); }).catch(() => toast('تعذر اللصق — الصق يدوياً', 'err'));
}

'use strict';
/* حزمة نصية واحدة: تصدير المشروع كنص + خريطة ملفات، واستيراد نص لتوليد الملفات.
   الصيغة:  === FILE: path (N lines) ===  ثم المحتوى. القراءة في parseBundle (12-patch-ui.js). */
const BUNDLE_HEAD = /^\s*# CodePatcher Bundle/;
/* بعد ui.close يلزم انتظار قصير قبل فتح نافذة أخرى (سباق history.back في ui) */
const bundleWait = ms => new Promise(r => setTimeout(r, ms));
const bundleOpt = { instr: true, limit: 30000 };   // limit = الحد الأقصى للأحرف في الجزء الواحد (0 = كل شيء)
const bLines = c => { const t = String(c).replace(/\s+$/, ''); return t === '' ? 0 : t.split('\n').length; };
function estTokens(s) { let a = 0, o = 0; for (let i = 0; i < s.length; i++) (s.charCodeAt(i) < 128 ? a++ : o++); return Math.ceil(a / 3.6 + o / 1.6); }

function bundleTree(names, bins) {
  const T = {};
  const add = (n, b) => { const p = n.split('/').filter(Boolean); let o = T; p.forEach((seg, i) => { if (i === p.length - 1) o[seg] = b ? 'b' : 'f'; else { if (typeof o[seg] !== 'object') o[seg] = {}; o = o[seg]; } }); };
  names.forEach(n => add(n, false)); bins.forEach(n => add(n, true));
  const isD = v => typeof v === 'object', lines = [];
  const walk = (o, pre) => {
    const ks = Object.keys(o).sort((a, b) => (isD(o[b]) - isD(o[a])) || (a < b ? -1 : a > b ? 1 : 0));
    ks.forEach((k, i) => {
      const last = i === ks.length - 1;
      lines.push(pre + (last ? '└── ' : '├── ') + k + (isD(o[k]) ? '/' : '') + (o[k] === 'b' ? '  [binary]' : ''));
      if (isD(o[k])) walk(o[k], pre + (last ? '    ' : '│   '));
    });
  };
  walk(T, ''); return lines.join('\n');
}

function bundleInstr(n) {
  return '# Instructions: this is a full project snapshot. Read it, then follow my request.\n' +
    '# When you change files, reply with each CHANGED file in full: a line like  === FILE: path/to/file ===  then its complete content\n' +
    '# (no placeholders, no omitted parts, nothing else between files). Do not repeat unchanged files.' +
    (n > 1 ? '\n# The project is sent in ' + n + ' parts: wait until all parts arrive before answering.' : '');
}

/* يبني الأجزاء بحد صارم بالأحرف: لا يتجاوز أي جزء (بترويسته وذيله) limit حرفاً.
   limit = 0 → كل شيء في جزء واحد. الملف الأكبر من المتاح يُقسَّم على حدود الأسطر وتُوضع له ترويسة تكملة (للقراءة، لا لإعادة الاستيراد). */
function bundleBuildFrom(fl, bins, sel, limit, instr) {
  fl = fl.slice().sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (limit) limit = Math.max(3000, limit | 0);
  const root = sel || commonRoot(fl) || 'Project';
  const meta = '# المشروع: ' + root + ' — ' + fl.length + ' ملف' + (bins.length ? ' + ' + bins.length + ' ثنائي' : '') + ' — ' + new Date().toISOString().slice(0, 10);
  const head1 = N => '# CodePatcher Bundle v1\n' + meta + (N > 1 ? ' — جزء 1/' + N : '') + '\n' + (instr ? bundleInstr(N) + '\n' : '') +
    '\n## خريطة الملفات\n' + bundleTree(fl.map(f => f.name), bins) + '\n\n## محتوى الملفات\n\n';
  const headN = (i, N) => '# CodePatcher Bundle v1 (تكملة)\n# جزء ' + (i + 1) + '/' + N + ' — الخريطة في الجزء الأول\n\n';
  const tailN = (i, N) => N > 1 ? '# — نهاية الجزء ' + (i + 1) + '/' + N + (i + 1 < N ? ' — سيصل الجزء التالي' : ' — انتهى') + ' —\n' : '';
  const MAXN = 999, tl = tailN(MAXN - 2, MAXN).length;
  const room1 = limit ? limit - head1(MAXN).length - tl : Infinity;          // المتاح للمحتوى في الجزء الأول
  const roomN = limit ? limit - headN(MAXN - 2, MAXN).length - tl : Infinity; // وفي الأجزاء التالية
  const groups = [{ u: [], n: 0 }], capOf = () => groups.length === 1 ? room1 : roomN;
  const addNew = u => groups.push({ u: [u], n: u.length });
  const add = u => { const g = groups[groups.length - 1]; g.u.push(u); g.n += u.length; };
  fl.forEach(f => {
    const t = nl(f.content).replace(/\s+$/, ''), L = bLines(t);
    const full = '=== FILE: ' + f.name + ' (' + L + ' lines) ===\n' + t + '\n\n';
    const g = groups[groups.length - 1], remaining = capOf() - g.n;
    if (!limit || full.length <= remaining) return add(full);
    if (full.length <= roomN) return addNew(full);
    // ملف أكبر من جزء كامل: يُقسَّم، وتملأ أول قطعة ما تبقّى في الجزء الحالي إن كان كافياً
    const over = f.name.length + 100, startNew = remaining - over < 1500;
    let max = startNew ? roomN - over : remaining - over;
    const bodies = []; let cur = [], n = 0, startLine = 1, ln = 0;
    const flush = () => { if (cur.length) { bodies.push({ a: startLine, b: ln, text: cur.join('\n') }); cur = []; n = 0; startLine = ln + 1; max = roomN - over; } };
    t.split('\n').forEach(line => {
      while (line.length > max - 1) { if (cur.length) flush(); ln++; bodies.push({ a: ln, b: ln, text: line.slice(0, max - 1) }); line = line.slice(max - 1); startLine = ln; ln--; max = roomN - over; }
      if (n + line.length + 1 > max) flush();
      ln++; cur.push(line); n += line.length + 1;
    });
    flush();
    bodies.forEach((p, k) => {
      const u = '=== FILE: ' + f.name + ' (جزء ' + (k + 1) + '/' + bodies.length + ' من الملف — أسطر ' + p.a + '–' + p.b + ' من ' + L + ') ===\n' + p.text + '\n\n';
      if (k === 0 && !startNew) add(u); else addNew(u);
    });
  });
  const N = groups.length;
  return groups.map((g, i) => (i === 0 ? head1(N) : headN(i, N)) + g.u.join('') + tailN(i, N));
}
function bundleBuild(sel, limit, instr) {
  const fl = files.filter(f => !sel || f.name.startsWith(sel + '/'));
  const bins = [...BIN.keys()].map(n => n.replace(/^\/+/, '')).filter(n => !sel || n.startsWith(sel + '/')).sort();
  return bundleBuildFrom(fl, bins, sel, limit, instr);
}

function bundleMapText(sel) {
  const fl = files.filter(f => !sel || f.name.startsWith(sel + '/')).map(f => f.name), bins = [...BIN.keys()].map(n => n.replace(/^\/+/, '')).filter(n => !sel || n.startsWith(sel + '/'));
  return '# CodePatcher Map\n# ' + (sel || commonRoot() || 'Project') + ' — ' + fl.length + ' ملف\n\n' + bundleTree(fl, bins) + '\n';
}
function downloadText(text, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })); a.download = name; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* اسم ملف الجزء: الترقيم قبل اسم المشروع (الشرطة المائلة ممنوعة في أسماء الملفات، لذا 01-10 بدل 1/10) */
function bundlePartName(base, i, N) {
  const w = String(N).length, pad = v => String(v).padStart(w, '0');
  return pad(i + 1) + '-' + pad(N) + '_' + base + '-bundle.txt';
}
/* حفظ الأجزاء في مجلد عادي: منتقي مجلد ← مشاركة (يختار المستخدم المكان) ← تنزيل متتابع */
async function saveBundlePartsToFolder(items, folderName) {
  const dir = await saveBundleToDeviceDir(items.map(it => ({ path: folderName + '/' + it.path, content: it.content })));
  if (dir.status !== 'na') return dir.status === 'ok' ? { status: 'ok', method: 'dir', count: dir.count, where: dir.dirName + '/' + folderName } : dir;
  const sfs = (typeof File === 'function') ? items.map(it => new File([it.content], it.path, { type: 'text/plain' })) : [];
  if (sfs.length && navigator.share && navigator.canShare && navigator.canShare({ files: sfs })) {
    try { await navigator.share({ files: sfs, title: folderName }); return { status: 'ok', method: 'share', count: sfs.length }; }
    catch (e) { if (e && e.name === 'AbortError') return { status: 'abort' }; }
  }
  for (const it of items) { downloadText(it.content, it.path); await new Promise(r => setTimeout(r, 350)); }
  return { status: 'ok', method: 'dl', count: items.length };
}

function exportBundleDialog(sel) {
  const c = cur(); if (c) c.content = editor.value;
  sel = sel || '';
  if (!files.some(f => !sel || f.name.startsWith(sel + '/'))) return toast('لا ملفات للتصدير', 'err');
  const I = n => '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg>';
  const base = cleanName(sel ? sel.split('/').pop() : commonRoot()) || 'project';
  const kfmt = n => n.toLocaleString('en-US');
  const draw = () => {
    const parts = bundleBuild(sel, bundleOpt.limit, bundleOpt.instr), all = parts.join('\n'), N = parts.length;
    const chip = (v, t) => '<button type="button" class="btn' + (bundleOpt.limit === v ? ' primary' : '') + '" data-act="lim" data-v="' + v + '">' + t + '</button>';
    const preset = [0, 15000, 30000, 31000].includes(bundleOpt.limit);
    const partsHtml = parts.map((p, i) => '<div class="part-row"><button type="button" class="btn primary" data-act="cp" data-i="' + i + '"><span class="part-t">' + I('copy') + (N > 1 ? 'نسخ الجزء ' + (i + 1) + '/' + N : 'نسخ') + '</span><small class="meta-sub" dir="ltr">' + kfmt(p.length) + ' ch</small></button>' +
      '<button type="button" class="btn" data-act="dlp" data-i="' + i + '" aria-label="تنزيل الجزء ' + (i + 1) + '">' + I('arrow-down') + '</button></div>').join('');
    ui.show('<h3>' + I('file-md') + ' المشروع ← نص للذكاء ' + uiSub(N + (N > 1 ? ' parts' : ' part') + ' · ' + kfmt(all.length) + ' ch · ~' + kfmt(estTokens(all)) + ' tok') + '</h3>' +
      uiNote('الحد الأقصى للأحرف في الجزء الواحد (بترويسته)') +
      '<div class="srow">' + chip(0, 'كامل') + chip(15000, '15k') + chip(30000, '30k') + chip(31000, '31k') + '<button type="button" class="btn' + (preset ? '' : ' primary') + '" data-act="limc">' + (preset ? 'مخصص' : kfmt(bundleOpt.limit)) + '</button></div>' +
      (N > 4 ? uiScroll(partsHtml, 'lg') : partsHtml) +
      (N > 1 ? uiRow('zip', 'arrow-down', 'حفظ كل الأجزاء في مجلد', N + ' ملفات نصية مرقّمة') : '') +
      uiRow('dl', 'arrow-down', N > 1 ? 'تنزيل الكل في ملف نصي واحد' : 'تنزيل ملف نصي') +
      uiRow('map', 'list', 'نسخ خريطة الملفات فقط (بدون محتوى)') +
      uiRow('ins', bundleOpt.instr ? 'check-square' : 'square', 'تعليمات للنموذج في البداية') +
      uiNote('الصور والملفات الثنائية تظهر في الخريطة فقط. الملف الذي يتجاوز الحد يُقسَّم على حدود الأسطر، وأجزاؤه للقراءة فقط وليست لإعادة الاستيراد.') +
      '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', async (act, el) => {
        const i = +el.dataset.i || 0;
        if (act === 'lim') { bundleOpt.limit = +el.dataset.v; return draw(); }
        if (act === 'limc') { const v = await ui.prompt('الحد الأقصى للأحرف في الجزء (مثال 30000)', String(bundleOpt.limit || 30000), 'تطبيق'); if (v != null && +v >= 3000) bundleOpt.limit = Math.round(+v); else if (v != null) toast('أدخل رقماً لا يقل عن 3000', 'err'); return draw(); }
        if (act === 'ins') { bundleOpt.instr = !bundleOpt.instr; return draw(); }
        if (act === 'cp') { const t = parts[i]; return copyToClipboard(t).then(() => toast('نُسخ' + (N > 1 ? ' الجزء ' + (i + 1) + '/' + N : '') + ' (' + kfmt(t.length) + ' حرف)', 'ok')); }
        if (act === 'dlp') { downloadText(parts[i], bundlePartName(base, i, N)); return toast('نُزّل الجزء ' + (i + 1) + '/' + N, 'ok'); }
        if (act === 'zip') { const r = await saveBundlePartsToFolder(parts.map((p, k) => ({ path: bundlePartName(base, k, N), content: p })), base + '-bundle-parts'); if (r && r.status === 'ok') toast(r.method === 'dir' ? 'حُفظت ' + r.count + ' أجزاء في المجلد: ' + r.where : r.method === 'share' ? 'تمت المشاركة: ' + r.count + ' أجزاء' : 'نُزّلت ' + r.count + ' أجزاء إلى مجلد التنزيلات', 'ok'); else if (r && r.status === 'fail') toast('تعذّر الحفظ' + (r.message ? ': ' + r.message : ''), 'err'); return; }
        if (act === 'map') { const t = bundleMapText(sel); return copyToClipboard(t).then(() => toast('نُسخت الخريطة (~' + estTokens(t) + ' توكن)', 'ok')); }
        if (act === 'dl') { downloadText(all, base + '-bundle.txt'); return toast('نُزّل الملف', 'ok'); }
      });
  };
  draw();
}

/* اختبارات نقية لحد الأحرف */
function pureTestsBundle() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok }), mk = (n, c) => ({ name: n, content: c });
  const big = Array.from({ length: 900 }, (_, i) => 'const v' + i + ' = ' + i + '; // سطر رقم ' + i).join('\n');
  const fl = [mk('a.js', 'x'.repeat(500)), mk('b/big.js', big), mk('c.md', 'نص عربي '.repeat(300)), mk('d.css', 'y{}\n'.repeat(400))];
  [3000, 12000, 30000, 31000].forEach(lim => {
    const parts = bundleBuildFrom(fl, [], '', lim, true);
    t('bundle: لا جزء يتجاوز ' + lim + ' حرفاً (' + parts.length + ' أجزاء)', parts.every(p => p.length <= lim));
  });
  const p30 = bundleBuildFrom(fl, [], '', 30000, true), joined = p30.join('');
  t('bundle: كل ملف حاضر في الأجزاء', fl.every(f => joined.includes('=== FILE: ' + f.name)));
  t('bundle: الملف الكبير قُسِّم بترويسة تكملة', /جزء 1\/\d+ من الملف/.test(bundleBuildFrom(fl, [], '', 12000, false).join('')));
  const lines = []; bundleBuildFrom([mk('z.js', big)], [], '', 3000, false).forEach(p => p.replace(/=== FILE: z\.js \(جزء \d+\/\d+ من الملف — أسطر (\d+)–(\d+) من \d+\) ===\n([\s\S]*?)\n\n/g, (_, a, b, body) => { lines.push(body); }));
  t('bundle: إعادة تجميع أجزاء الملف تطابق الأصل', lines.join('\n') === big);
  t('bundle: limit=0 جزء واحد', bundleBuildFrom(fl, [], '', 0, true).length === 1);
  const one = bundleBuildFrom([mk('m.min.js', 'q'.repeat(20000))], [], '', 5000, false);
  t('bundle: سطر واحد طويل يُقطَّع ضمن الحد', one.length > 3 && one.every(p => p.length <= 5000));
  return T;
}

/* ===== الاستيراد ===== */
function bundleSafeName(n) {
  n = String(n || '').trim().replace(/\\+/g, '/').replace(/^(\.\/)+/, '').replace(/^\/+/, '');
  if (!n || n.split('/').some(s => s === '..' || s === '')) return '';
  return n;
}
function bundleCleanSub(v) {
  return String(v || '').replace(/\\+/g, '/').split('/')
    .map(s => s.replace(/[:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-'))
    .filter(s => s && s !== '.' && s !== '..').join('/');
}
function unwrapBundleFence(raw) {
  const s = nl(raw), tr = s.trim();
  if (/^```[^\n]*\n[\s\S]*\n?```$/.test(tr)) {
    const inner = tr.replace(/^```[^\n]*\n?/, '').replace(/\n?```\s*$/, '');
    if (inner.trim()) return inner;
  }
  const L = s.split('\n');
  let firstMark = -1;
  for (let i = 0; i < L.length; i++) { if (bundleMark(L[i])) { firstMark = i; break; } }
  if (firstMark > 0) {
    const fences = [];
    for (let i = 0; i < firstMark; i++) if (/^\s*```/.test(L[i])) fences.push(i);
    if (fences.length % 2 === 1) {
      let lastNonEmpty = L.length - 1;
      while (lastNonEmpty > firstMark && !L[lastNonEmpty].trim()) lastNonEmpty--;
      if (lastNonEmpty > firstMark && /^\s*```\s*$/.test(L[lastNonEmpty])) {
        const cand = L.slice(fences[fences.length - 1] + 1, lastNonEmpty).join('\n');
        if (parseBundle(cand)) return cand;
      }
    }
  }
  return s;
}

/* خريطة شجرية (├── └── │ أو مسافات أو قائمة مسارات) ← { files, dirs(فارغة), bins } */
function parseTreeMap(text) {
  const nodes = [], bins = [], stack = [];
  nl(text).split('\n').forEach(raw => {
    if (!raw.trim() || /^\s*#/.test(raw)) return;
    const pre = /^[\s│├└─|`+\-\\¦]*/.exec(raw)[0];
    let name = raw.slice(pre.length).replace(/\s+#.*$/, '').replace(/\s+(?:←|<-+|—|\/\/).*$/, '').trim();
    const isBin = /\s*\[binary\]\s*$/i.test(name); name = name.replace(/\s*\[binary\]\s*$/i, '').trim();
    if (!name || name.length > 120 || /[<>:"|?*\u0000-\u001f]/.test(name)) return;
    const indent = pre.length;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1]; if (parent) { parent.isDir = true; parent.kids = true; }
    const isDir = /\/$/.test(name), clean = name.replace(/\/+$/, '');
    if (!clean) return;
    const node = { indent, path: (parent ? parent.path + '/' : '') + clean, isDir, kids: false, bin: isBin };
    stack.push(node); nodes.push(node);
  });
  return {
    files: nodes.filter(n => !n.isDir && !n.bin).map(n => n.path),
    dirs: nodes.filter(n => n.isDir && !n.kids).map(n => n.path),
    bins: nodes.filter(n => n.bin).map(n => n.path),
    looksTree: nodes.length > 0 && nodes.some(n => n.path.includes('/') || /[.]/.test(n.path) || n.isDir)
  };
}

/* يحوّل النص إلى خطة: [{ rel, content, warn, empty }] (rel بلا جذر المشروع) + اسم جذر مقترح */
function bundlePlan(text) {
  const cleaned = unwrapBundleFence(text);
  const blocks = parseBundle(cleaned), warns = [], bad = []; let raw = [], bins = [], fromMap = false;
  if (blocks && blocks.length) {
    blocks.forEach(p => { const n = bundleSafeName(p.name); if (!n) { bad.push(p.name); return; } if (p.warn) warns.push(n + ': ' + p.warn); raw.push({ path: n, content: p.content }); });
  } else {
    const m = parseTreeMap(cleaned); if (!m.looksTree) return null;
    fromMap = true; bins = m.bins;
    m.files.forEach(f => { const n = bundleSafeName(f); if (n) raw.push({ path: n, content: '', empty: true }); else bad.push(f); });
    m.dirs.forEach(d => { const n = bundleSafeName(d); if (n) raw.push({ path: n + '/.gitkeep', content: '', empty: true }); else bad.push(d); });
  }
  const seen = new Map(); raw.forEach(r => { if (seen.has(r.path)) warns.push(r.path + ': مكرر — اعتُمدت الأخيرة'); seen.set(r.path, r); });
  raw = [...seen.values()];
  if (!raw.length) return null;
  const tops = new Set(raw.map(r => r.path.includes('/') ? r.path.split('/')[0] : null));
  const root = (tops.size === 1 && !tops.has(null)) ? [...tops][0] : '';
  const list = raw.map(r => ({ rel: root ? r.path.slice(root.length + 1) : r.path, content: r.content, empty: !!r.empty })).filter(r => r.rel);
  return { list, root, warns, bad, bins, fromMap };
}

async function saveBundleToDeviceDir(items) {
  if (typeof window.showDirectoryPicker !== 'function' || window.self !== window.top) return { status: 'na' };
  try {
    const rootDir = await window.showDirectoryPicker({ mode: 'readwrite' });
    let count = 0;
    for (const it of items) {
      const segs = it.path.split('/').filter(Boolean), fname = segs.pop();
      if (!fname) continue;
      let d = rootDir;
      for (const s of segs) d = await d.getDirectoryHandle(s, { create: true });
      const fh = await d.getFileHandle(fname, { create: true });
      const w = await fh.createWritable();
      await w.write(it.content);
      await w.close();
      count++;
    }
    return { status: 'ok', count, dirName: rootDir.name || '' };
  } catch (e) {
    if (e && e.name === 'AbortError') return { status: 'abort' };
    return { status: 'fail', message: e && e.message };
  }
}

async function saveBundleAsZip(items, zipBase) {
  const enc = new TextEncoder();
  const entries = items.map(it => ({ name: it.path.replace(/^\/+/, ''), data: enc.encode(it.content) }));
  const zblob = await zipC(entries);
  const fileName = (cleanName(zipBase) || 'generated-files') + '.zip';
  const canPick = typeof window.showSaveFilePicker === 'function' && window.self === window.top;
  if (canPick) {
    try {
      const h = await showSaveFilePicker({ suggestedName: fileName, types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }] });
      const w = await h.createWritable(); await w.write(zblob); await w.close();
      return { status: 'ok', method: 'pick', fileName: h.name || fileName, count: entries.length };
    } catch (e) {
      if (e && e.name === 'AbortError') return { status: 'abort' };
    }
  }
  const zfile = (typeof File === 'function') ? new File([zblob], fileName, { type: 'application/zip' }) : null;
  if (zfile && typeof tryShare === 'function') {
    const r = await tryShare(zfile, fileName);
    if (r === 'ok') return { status: 'ok', method: 'share', fileName, count: entries.length };
    if (r === 'abort') return { status: 'abort' };
  }
  const url = URL.createObjectURL(zblob);
  const a = document.createElement('a'); a.href = url; a.download = fileName; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { status: 'ok', method: 'dl', fileName, count: entries.length };
}

async function saveBundleSingleFile(relPath, content) {
  const fname = relPath.split('/').pop() || 'file.txt';
  const canPick = typeof window.showSaveFilePicker === 'function' && window.self === window.top;
  if (canPick) {
    try {
      const h = await showSaveFilePicker({ suggestedName: fname });
      const w = await h.createWritable(); await w.write(content); await w.close();
      return { status: 'ok', method: 'pick', fileName: h.name || fname };
    } catch (e) {
      if (e && e.name === 'AbortError') return { status: 'abort' };
    }
  }
  const sf = (typeof File === 'function') ? new File([content], fname, { type: 'text/plain;charset=utf-8' }) : null;
  if (sf && typeof tryShare === 'function') {
    const r = await tryShare(sf, fname);
    if (r === 'ok') return { status: 'ok', method: 'share', fileName: fname };
    if (r === 'abort') return { status: 'abort' };
  }
  downloadText(content, fname);
  return { status: 'ok', method: 'dl', fileName: fname };
}

async function importBundleText(text, fresh, prePlan) {
  if (!prePlan) await bundleWait(130);
  const plan = prePlan || bundlePlan(text);
  if (!plan) { toast('لم أجد كتل === FILE: === ولا خريطة ملفات في النص', 'err'); return 0; }
  if (plan.list.length > MAX_COUNT) { plan.warns.push('تجاوز حد ' + MAX_COUNT + ' ملف — تُركت الزيادة'); plan.list.length = MAX_COUNT; }
  const I = n => '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg> ';
  let name = bundleCleanSub(plan.root) || '';
  let loc = fresh ? '' : (typeof treeCwd === 'string' ? treeCwd : '');
  const extra = [];
  const canDir = typeof window.showDirectoryPicker === 'function' && window.self === window.top;
  const finalOf = (r, nm, lc) => bundleSafeName([lc, nm, r.rel].filter(Boolean).join('/'));
  const devPathOf = (r, nm) => bundleSafeName([nm, r.rel].filter(Boolean).join('/'));
  const stats = (nm, lc) => {
    const its = plan.list.map(r => ({ r, path: finalOf(r, nm, lc) })).filter(x => x.path);
    const ex = x => files.find(f => f.name === x.path);
    return { its, nNew: its.filter(x => !ex(x)).length, nSame: its.filter(x => ex(x) && ex(x).content === x.r.content).length };
  };
  const prevHTML = (nm, lc) => {
    const st = stats(nm, lc), nRep = st.its.length - st.nNew - st.nSame;
    const destLabel = [lc, nm].filter(Boolean).join('/') || '/ (جذر المشروع)';
    return '<b>جديد ' + st.nNew + '</b> · <b>يُستبدل ' + nRep + '</b> · <b>مطابق ' + st.nSame + '</b>' +
      '<div class="slabel ltr-text" dir="ltr">📁 ' + esc(destLabel) + '</div>' +
      '<div class="slabel ltr-text" dir="ltr">' +
      st.its.slice(0, 4).map(x => esc(x.path)).join('<br>') + (st.its.length > 4 ? '<br>… +' + (st.its.length - 4) : '') + '</div>';
  };
  const note = (t, a) => a.length ? '<div class="slabel">' + t + ' <span dir="ltr">' + a.slice(0, 5).map(esc).join(' ، ') + (a.length > 5 ? ' … +' + (a.length - 5) : '') + '</span></div>' : '';
  return new Promise(res => {
    let settled = false;
    const done = v => { if (!settled) { settled = true; res(v); } };
    const draw = () => {
      const folderSet = new Set(['', ...allFolders(), ...extra]);
      if (loc) folderSet.add(loc);
      const folders = ['', ...[...folderSet].filter(Boolean).sort()];
      ui.resolve = null;
      ui.show('<h3>' + I('import') + 'أين تحفظ الملفات المولّدة؟ ' + uiSub('· ' + plan.list.length + ' ملف') + '</h3>' +
        (plan.fromMap ? uiNote('خريطة بلا محتوى — ستُنشأ الملفات فارغة والمجلدات الفارغة بملف .gitkeep.') : '') +
        '<div class="slabel-row"><span class="slabel">المجلد داخل المشروع</span><button type="button" class="pmini" data-act="nf">+ مجلد جديد</button></div>' +
        uiScroll(folderRows(folders, loc), 'sm') +
        '<div class="slabel">اسم مجلد فرعي إضافي (اختياري — اتركه فارغاً للحفظ مباشرة)</div>' +
        '<input type="text" id="bnName" dir="ltr" placeholder="مثال: my-app" value="' + esc(name) + '">' +
        '<div class="issue" id="bnPrev">' + prevHTML(name, loc) + '</div>' +
        note('تنبيه:', plan.warns) + note('مرفوض:', plan.bad) + (plan.bins.length ? note('ثنائية لا تُولَّد:', plan.bins) : '') +
        '<div class="srow"><button type="button" class="btn primary" data-act="merge">' + I('save') + 'حفظ في المجلد المحدد</button><button type="button" class="btn" data-act="fresh">فتح كمشروع جديد</button></div>' +
        '<div class="bn-sec"><div class="slabel">أو حفظ على الجهاز مباشرة (تختار المكان)</div>' +
        (canDir ? uiRow('dir', 'folder-plus', 'اختيار مجلد على الجهاز…', 'يكتب الملفات والمجلدات المولّدة في مجلد تختاره') : '') +
        uiRow('zip', 'export', 'حفظ كملف ZIP (تختار المكان)…', 'يحزم الملفات المولّدة فقط مع منتقي مكان الحفظ') +
        (plan.list.length === 1 ? uiRow('one', 'file', 'حفظ الملف على الجهاز…', esc(plan.list[0].rel.split('/').pop())) : '') +
        '</div>' +
        '<button type="button" class="btn" data-ui="cancel">إلغاء</button>', async (act, el) => {
          const inp = $('bnName'); if (inp) name = bundleCleanSub(inp.value);
          if (act === 'fold') { loc = folders[+el.dataset.i] || ''; return draw(); }
          if (act === 'nf') {
            ui.resolve = null;
            const rawDir = await ui.prompt('اسم المجلد الجديد (يمكنك كتابة مسار مثل src/ui)', '', 'إنشاء');
            const sub = bundleCleanSub(rawDir);
            if (sub) {
              const target = [loc, sub].filter(Boolean).join('/');
              const parts = target.split('/');
              for (let k = 1; k <= parts.length; k++) extra.push(parts.slice(0, k).join('/'));
              loc = target;
            }
            return draw();
          }
          if (act === 'dir') {
            const devItems = plan.list.map(r => ({ path: devPathOf(r, name), content: r.content })).filter(x => x.path);
            const r = await saveBundleToDeviceDir(devItems);
            if (r.status === 'abort') return;
            if (r.status === 'ok') {
              ui.resolve = null; ui.close(null);
              toast('حُفظ ' + r.count + ' ملف في مجلد الجهاز: ' + (r.dirName || 'المجلد المحدد'), 'ok');
              log('ok', 'حفظ توليد نصي على الجهاز: ' + r.count + ' ملف → ' + (r.dirName || 'مجلد الجهاز'));
              return done(r.count);
            }
            toast('تعذّر الكتابة على المجلد — جرّب الحفظ كـ ZIP' + (r.message ? ' (' + r.message + ')' : ''), 'err');
            return;
          }
          if (act === 'zip') {
            const devItems = plan.list.map(r => ({ path: devPathOf(r, name), content: r.content })).filter(x => x.path);
            const zipBase = cleanName((name || '').split('/').pop() || plan.root || (devItems[0] && devItems[0].path.split('/')[0].replace(/\.[^.]+$/, '')) || 'generated-files');
            const r = await saveBundleAsZip(devItems, zipBase);
            if (r.status === 'abort') return;
            ui.resolve = null; ui.close(null);
            toast((r.method === 'pick' || r.method === 'share' ? 'تم حفظ ' : 'نُزّل ') + r.count + ' ملف: ' + r.fileName, 'ok');
            log('ok', 'تصدير توليد نصي ZIP: ' + r.count + ' ملف (' + r.fileName + ')');
            return done(r.count);
          }
          if (act === 'one' && plan.list.length === 1) {
            const item = plan.list[0];
            const r = await saveBundleSingleFile(item.rel, item.content);
            if (r.status === 'abort') return;
            ui.resolve = null; ui.close(null);
            toast((r.method === 'pick' || r.method === 'share' ? 'تم حفظ الملف: ' : 'نُزّل الملف: ') + r.fileName, 'ok');
            return done(1);
          }
          if (act !== 'merge' && act !== 'fresh') return;
          if (act === 'fresh' && !fresh && files.length) {
            ui.resolve = null;
            const ok = await ui.confirm('سيُستبدل المشروع الحالي (' + files.length + ' ملف) بالملفات المولّدة. متابعة؟', 'فتح كمشروع جديد');
            if (!ok) return draw();
          }
          const useLoc = act === 'fresh' ? '' : loc;
          const its = stats(name, useLoc).its.filter(x => act === 'fresh' || !files.some(f => f.name === x.path && f.content === x.r.content));
          const wipe = act === 'fresh' ? new Map(BIN) : null;
          ui.resolve = null; ui.close(null); await bundleWait(130);
          if (!its.length) { toast('لا شيء ليتغيّر — كل الملفات مطابقة', ''); return done(0); }
          const n = await addItems(its.map(x => { const old = files.find(f => f.name === x.path); return { name: x.path, content: x.r.content, eol: old ? old.eol : 'lf', enc: old ? old.enc : 'utf-8' }; }), wipe);
          if (n) {
            const destDir = [useLoc, name].filter(Boolean).join('/');
            const pref = its.find(x => /(^|\/)index\.html?$/i.test(x.path)) || its[0];
            const tgt = pref && files.find(f => f.name === pref.path);
            if (tgt) activeId = tgt.id;
            if (typeof treeCwd === 'string') treeCwd = destDir || (tgt ? tgt.name.split('/').slice(0, -1).join('/') : '');
            render(); scheduleSave();
            const where = destDir ? destDir : '/ (جذر المشروع)';
            toast('تم حفظ ' + n + ' ملف في ' + where + (act === 'merge' ? ' — للتراجع: تبويب باتشات' : ''), 'ok');
            log('ok', 'توليد من نص: ' + n + ' ملف → ' + where);
          }
          done(n || 0);
        });
      ui.resolve = () => done(0);
      const inp = $('bnName');
      if (inp) inp.addEventListener('input', () => {
        name = bundleCleanSub(inp.value);
        const pv = $('bnPrev');
        if (pv) pv.innerHTML = prevHTML(name, loc);
      });
    };
    draw();
  });
}
function importBundleDialog() {
  ui.show('<h3>استيراد من نص</h3><div class="slabel">الصق حزمة (=== FILE: ===) أو خريطة ملفات (شجرة) أو اختر ملف .txt</div>' +
    '<textarea class="plain" id="bnIn" spellcheck="false" autocapitalize="off"></textarea>' +
    '<div class="srow"><button type="button" class="btn" data-act="paste">لصق</button><button type="button" class="btn" data-act="pick">ملف .txt…</button></div>' +
    '<div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button><button type="button" class="btn primary" data-act="parse">تحليل واختيار الحفظ</button></div>', async act => {
      const ta = $('bnIn');
      if (act === 'paste') { try { ta.value = await navigator.clipboard.readText(); } catch (e) { toast('لا إذن للحافظة — الصق يدوياً داخل الخانة', 'err'); } return; }
      if (act === 'pick') {
        const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.txt,.md,text/plain';
        inp.onchange = async () => { const f = inp.files && inp.files[0]; if (f) ta.value = await f.text(); };
        return inp.click();
      }
      if (act === 'parse') {
        const t = ta.value;
        if (!t.trim()) { toast('الخانة فارغة', 'err'); ta.focus(); return; }
        const plan = bundlePlan(t);
        if (!plan) { toast('لم أجد كتل === FILE: === ولا خريطة ملفات في النص', 'err'); ta.focus(); return; }
        await importBundleText(t, false, plan);
      }
    });
  setTimeout(() => { const t = $('bnIn'); if (t) t.focus(); }, 80);
}
function bundleMenu() {
  const I = n => '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg> ';
  ui.show('<h3>' + I('file-md') + 'المشروع كنص واحد</h3>' +
    uiRow('out', 'export', 'نسخ المشروع كنص (للذكاء الاصطناعي)') +
    uiRow('in', 'import', 'توليد ملفات ومجلدات من نص (حزمة أو خريطة)'), act => {
      ui.close(null);
      if (act === 'out') setTimeout(() => exportBundleDialog(''), 120);
      else if (act === 'in') setTimeout(importBundleDialog, 120);
    });
}


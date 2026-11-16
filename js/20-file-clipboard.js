'use strict';
/* نسخ/قص/لصق الملفات والمجلدات */
/* ===== v30.2: نسخ / قص / لصق للملفات والمجلدات ===== */
let clip = null;
function clipResolve(items, fl) {
  fl = fl || files; const out = [], seen = new Set();
  items.forEach(it => {
    if (it.kind === 'file') { const f = fl.find(x => x.id === it.key); if (f && !seen.has(f.id)) { seen.add(f.id); out.push({ id: f.id, rel: f.name.split('/').pop() }); } }
    else { const p = it.key + '/', base = it.key.split('/').pop(); fl.forEach(f => { if (f.name.startsWith(p) && !seen.has(f.id)) { seen.add(f.id); out.push({ id: f.id, rel: base + '/' + f.name.slice(p.length) }); } }); }
  });
  return out;
}
function uniqueCopyName(nn, taken) {
  if (!taken.has(nn)) return nn;
  const i = nn.lastIndexOf('.'), sl = nn.lastIndexOf('/'), ext = i > sl + 1 ? nn.slice(i) : '', stem = ext ? nn.slice(0, i) : nn;
  let k = 1, cand; do { cand = stem + '-copy' + (k > 1 ? k : '') + ext; k++; } while (taken.has(cand));
  return cand;
}
function setClip(mode, items) {
  const c = cur(); if (c) c.content = editor.value;
  const list = clipResolve(items); if (!list.length) return toast('لا ملفات لتحديدها', 'err');
  clip = { mode, list, dirs: items.filter(x => x.kind === 'dir').map(x => x.key) };
  renderTree();
  toast((mode === 'cut' ? 'للنقل: ' : 'للنسخ: ') + list.length + ' ملف — افتح المجلد الهدف ثم اضغط «لصق»', 'ok');
}
function selClip(mode) {
  const items = [...selSet].map(k => ({ kind: k[0] === 'f' ? 'file' : 'dir', key: k.slice(2) }));
  if (!items.length) return;
  toggleSel(false); setClip(mode, items);
}
async function pasteClip() {
  if (!clip) return;
  const dest = treeCwd, pre = dest ? dest + '/' : '', c0 = cur(); if (c0) c0.content = editor.value;
  const list = clip.list.map(x => ({ f: files.find(f => f.id === x.id), rel: x.rel })).filter(x => x.f);
  if (!list.length) { clip = null; renderTree(); return toast('العناصر لم تعد موجودة', 'err'); }
  if (clip.mode === 'cut') {
    if (clip.dirs.some(d => dest === d || dest.startsWith(d + '/'))) return toast('لا يمكن نقل مجلد إلى داخل نفسه', 'err');
    const moves = new Map(); list.forEach(x => moves.set(x.f.name, pre + x.rel));
    if (list.every(x => x.f.name === pre + x.rel)) { clip = null; renderTree(); return toast('العناصر موجودة في هذا المجلد أصلاً'); }
    const movedSet = new Set(list.map(x => x.f)), targets = new Set(moves.values());
    const clash = files.filter(f => !movedSet.has(f) && targets.has(f.name));
    if (clash.length && !(await ui.confirm('يوجد ' + clash.length + ' ملف بنفس الاسم في الهدف. استبدالها؟ (تُحفظ نقطة استرجاع)', 'استبدال'))) return;
    const plan = planLinkUpdates(moves);
    if (plan.total) {
      const ok = await new Promise(res => {
        ui.show('<h3>نقل ' + list.length + ' ملف إلى «' + esc(dest || 'الجذر') + '»؟</h3><label class="opt"><input type="checkbox" id="lkOn" checked><span>تحديث الروابط في ' + plan.list.length + ' ملف (' + plan.total + ' رابط)</span></label><div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button><button type="button" class="btn primary" data-ui="ok">نقل</button></div>');
        ui.kind = 'confirm'; ui.resolve = res;
      });
      if (!ok) return;
    }
    snapNow('قبل النقل');
    const doLinks = plan.total && $('lkOn') && $('lkOn').checked;
    clash.forEach(f => { const i = files.indexOf(f); if (i >= 0) files.splice(i, 1); removedIds.push(f.id); openTabs.delete(f.id); });
    const rec = { ren: list.map(x => ({ f: x.f, from: x.f.name, to: moves.get(x.f.name) })), edits: doLinks ? applyLinkEdits(plan.list) : [], cwd: treeCwd };
    list.forEach(x => { x.f.name = moves.get(x.f.name); x.f.lang = langOf(x.f.name); x.f.dirtySave = true; });
    lastRename = rec; clip = null; render(); scheduleSave();
    toast('تم نقل ' + list.length + ' ملف' + (rec.edits.length ? ' وتحديث ' + plan.total + ' رابط' : ''), 'ok', { label: 'تراجع', fn: undoRename });
  } else {
    const taken = new Set(files.map(f => f.name)), items = [];
    list.forEach(x => {
      const nn = uniqueCopyName(pre + x.rel, taken); taken.add(nn);
      const body = x.f.id === activeId ? editor.value : x.f.content, nf = makeFile(nn, body, body);
      nf.eol = x.f.eol; nf.enc = x.f.enc; nf.dirtySave = true; files.push(nf); items.push({ id: nf.id, isNew: true, after: body });
    });
    lastBatch = { items }; render(); scheduleSave();
    toast('تم لصق ' + items.length + ' ملف في «' + (dest || 'الجذر') + '»', 'ok', { label: 'تراجع', fn: undoBatch });
  }
}
function pureTests8() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  const fl = [{ id: 'a', name: 'x/p.js' }, { id: 'b', name: 'x/s/q.css' }, { id: 'c', name: 'r.html' }];
  let r = clipResolve([{ kind: 'dir', key: 'x' }, { kind: 'file', key: 'c' }], fl);
  t('نسخ/قص: المجلد يحفظ بنيته النسبية', r.length === 3 && r[0].rel === 'x/p.js' && r[1].rel === 'x/s/q.css' && r[2].rel === 'r.html');
  r = clipResolve([{ kind: 'file', key: 'a' }, { kind: 'dir', key: 'x' }], fl);
  t('نسخ/قص: بلا تكرار عند تحديد ملف ومجلده', r.length === 2 && r[0].rel === 'p.js');
  t('نسخ/قص: لا تعارض يُبقي الاسم', uniqueCopyName('a.js', new Set(['b.js'])) === 'a.js');
  t('نسخ/قص: تعارض يضيف -copy', uniqueCopyName('a.js', new Set(['a.js'])) === 'a-copy.js');
  t('نسخ/قص: تعارض متكرر يرقّم', uniqueCopyName('d/a.js', new Set(['d/a.js', 'd/a-copy.js'])) === 'd/a-copy2.js');
  t('نسخ/قص: ملف بلا امتداد', uniqueCopyName('d.x/README', new Set(['d.x/README'])) === 'd.x/README-copy');
  return T;
}
function pureTests7() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  const src = 'function a(){\n  return 1;\n}\nfunction Hello(){\n  return 2;\n}\n';
  const mk = (code, extra, o) => {
    o = o || {};
    return repairReportText([makeError(code, 'عنوان #1', Object.assign({ patchIndex: 1, action: 'replace', file: 'a.js' }, extra))], {
      ev: null, dry: true, active: 'a.js', text: n => n === 'a.js' ? (o.src || src) : null, files: ['a.js'],
      patchInput: o.pi || '', smoke: o.smoke === undefined ? null : o.smoke, lint: o.lint || [], lintName: 'a.js', con: o.con || []
    });
  };
  let r = mk('PATCH_NOT_FOUND', { searchText: 'function Hello() {\n  return 3;\n}', intended: 'NEWCODE' });
  t('R6: التقرير يحوي نوع الخطأ والتعليمة الصريحة', r.includes('PATCH_NOT_FOUND') && r.includes('أعد التوليد بناءً عليه') && r.includes('الكود الفعلي'));
  t('R6: يحوي find والنص المقصود', r.includes('function Hello() {') && r.includes('NEWCODE'));
  t('R6: يعرض الكود الفعلي حول أقرب موضع', r.includes('أقرب المواضع المحتملة') && r.includes('function Hello(){'));
  r = mk('PATCH_NEAR_MISS', { searchText: 'function hello(){', similarMatch: 'function Hello(){', similarLine: 4 });
  t('R6: NEAR_MISS يشخّص حالة الأحرف ويعرض السطر الفعلي', r.includes('حالة الأحرف') && /4> function Hello\(\)\{/.test(r));
  r = mk('PATCH_NEAR_MISS', { searchText: 'a b', similarMatch: 'a  b', similarLine: 1 });
  t('R6: NEAR_MISS يشخّص فرق المسافات', r.includes('المسافات'));
  r = mk('PATCH_AMBIGUOUS', { searchText: 'foo' }, { src: 'x\nfoo\ny\nfoo\n' });
  t('R6: AMBIGUOUS يعدّد المواضع', r.includes('الموضع 1 — سطر 2') && r.includes('الموضع 2 — سطر 4') && r.includes('occurrence'));
  r = mk('PATCH_NOT_FOUND', { searchText: 'zzzzzz qqqqqq' });
  t('R6: بلا تشابه يعطي مخطط الملف', r.includes('مخطط الملف') && r.includes('function Hello'));
  r = mk('JSON_PARSE_ERROR', { message: 'Unexpected (سطر 2)', file: undefined }, { pi: 'a\nBADLINE\nc' });
  t('R6: خطأ JSON يعرض السطر المعيب', r.includes('BADLINE') && r.includes('مُهرَّبة'));
  r = mk('PATCH_NOT_FOUND', { searchText: 'abcdef ghijkl' }, { smoke: null });
  t('R6: بلا اختبار دخان يذكر ذلك', r.includes('لم يُشغَّل اختبار دخان'));
  r = mk('PATCH_NOT_FOUND', { searchText: 'abcdef ghijkl' }, { smoke: { n: 1, rt: ['ReferenceError: x is not defined'], st: [], pre: 2, ran: true } });
  t('R6: نتيجة الدخان تُضمَّن', r.includes('تحذير') && r.includes('ReferenceError') && r.includes('قبل الباتش'));
  r = mk('PATCH_NOT_FOUND', { searchText: 'abcdef ghijkl' }, { smoke: { pending: true } });
  t('R6: دخان قيد التنفيذ', r.includes('قيد التنفيذ'));
  r = mk('PATCH_NOT_FOUND', { searchText: 'abcdef ghijkl' }, { lint: [{ line: 3, msg: 'قوس' }], con: ['boom'] });
  t('R6: مشاكل المحرر والكونسول تُضمَّن', r.includes('سطر 3: قوس') && r.includes('boom'));
  const d = rWhatDiff('a b', 'a  b');
  t('R6: rWhatDiff يحدد أول اختلاف', d.at === 2 && /المسافات/.test(d.why));
  const w = makeError('PATCH_NOT_FOUND', 'x', { file: 'f.js', intended: 'q' });
  t('R6: makeError يحمل file وintended', w.file === 'f.js' && w.intended === 'q');
  const mkEv = blocked => {
    const err = makeError('PATCH_NOT_FOUND', 'عنوان #2', { patchIndex: 2, action: 'replace', file: 'a.js', searchText: 'zzz qqq' });
    const results = [{ n: 1, status: 'applied' }, { n: 2, status: 'failed', error: err }, { n: 3, status: 'applied' }, { n: 4, status: 'applied' }];
    return repairReportText([err], { ev: { results, blocked }, dry: false, active: 'a.js', text: n => n === 'a.js' ? src : null, files: ['a.js'], patchInput: '', smoke: null, lint: [], lintName: 'a.js', con: [] });
  };
  r = mkEv(true);
  t('R7: يطلب دائماً إعادة كل الباتشات (الدفعة مرفوضة)', r.includes('أعد **كل** باتشات الدفعة (4)') && r.includes('تحوي كل الباتشات (#1 إلى #4)') && !r.includes('الفاشلة فقط') && !r.includes('طُبِّقت'));
  r = mkEv(false);
  t('R7: يطلب كل الباتشات حتى لو لم تُرفض الدفعة (المعاينة يُتراجع عنها)', r.includes('أعد **كل** باتشات الدفعة (4)') && r.includes('لم يُعتمد أي باتش') && !r.includes('الفاشلة فقط') && !r.includes('فلا تعد توليدها'));
  return T;
}
function pureTests6() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  const O = { flex: true, atomic: true };
  let r = evaluatePatches('a foo b', [{ find: 'foo', replace: 'bar' }], O).results[0];
  t('H2: التعديل يسجّل الموضع والنص', r.ed && r.ed.length === 1 && r.ed[0].at === 2 && r.ed[0].del === 'foo' && r.ed[0].ins === 'bar' && r.bf === 'a foo b');
  r = evaluatePatches('foo x foo', [{ find: 'foo', replace: 'bar', all: true }], O).results[0];
  t('H2: all:true يسجّل موضعين', r.ed && r.ed.length === 2);
  let h = hunksFromEdits('a\nb\nc\nd', [{ at: 4, del: 'c', ins: 'X' }]);
  t('H2: مقطع استبدال بسياق', h.length === 1 && h[0].ln === 3 && h[0].ops.map(o => o.t + o.x).join('|') === ' a| b|-c|+X| d');
  h = hunksFromEdits('a\nb\nc', [{ at: 1, del: '', ins: '\nNEW' }]);
  t('H2: إدراج سطر كامل بلا حذف', h.length === 1 && !h[0].ops.some(o => o.t === '-') && h[0].ops.some(o => o.t === '+' && o.x === 'NEW'));
  h = lineDiffHunks('1\n2\n3', '1\nX\n3');
  t('H2: فرق ملف كامل', h.length === 1 && h[0].ops.some(o => o.t === '-' && o.x === '2') && h[0].ops.some(o => o.t === '+' && o.x === 'X'));
  t('H2: ملفان متطابقان بلا فروق', lineDiffHunks('a\nb', 'a\nb').length === 0);
  const P = [{ file: 'a.js', find: 'x', replace: 'function newThing(){}' }, { file: 'b.js', find: 'p', replace: 'newThing()' }];
  let ev = evalWithRej({ patches: P }, { 'a.js': 'x', 'b.js': 'p' }, 'a.js', O, new Set([1]));
  t('H2: المرفوض لا يُطبَّق والباقي يُطبَّق', ev.results[0].status === 'rejected' && ev.work['a.js'] === 'x' && ev.work['b.js'] === 'newThing()' && ev.changed.join() === 'b.js');
  t('H2: كشف ترابط محتمل بين ملفين', ev.coupling && ev.coupling.length === 1);
  ev = evalWithRej({ patches: [{ file: 'a.js', find: 'x', replace: 'y' }, { file: 'a.js', find: 'y', replace: 'z' }] }, { 'a.js': 'x' }, 'a.js', O, new Set([1]));
  t('H2: رفض باتش يُسقط التابع له ويُبلَّغ', ev.results[1].status === 'failed' && ev.deps.length === 1 && ev.deps[0].n === 2 && ev.deps[0].on[0] === 1);
  ev = evalWithRej({ bundle: [{ name: 'a.js', content: '1\n' }, { name: 'n.js', content: '2\n' }] }, { 'a.js': '0' }, 'a.js', O, new Set([2]));
  t('H2: رفض ملف كامل في حزمة', ev.results[1].status === 'rejected' && ev.work['n.js'] === undefined && ev.work['a.js'] === '1\n');
  ev = evalWithRej({ patches: P }, { 'a.js': 'x', 'b.js': 'p' }, 'a.js', O, new Set());
  t('H2: بلا رفض = السلوك القديم', ev.changed.length === 2 && !ev.deps);
  t('H2: الحارس الكسول يتجاهل المرفوض', lazyScan({ patches: [{ replace: '// ... rest of code' }] }, {}, new Set([1])).length === 0);
  t('R4: وسم غير مغلق يُكشف', tagIssues('a.html', '<div><span></div>').length === 1 && tagIssues('a.html', '<div><span></div>')[0].k.includes('<span>'));
  t('R4: وسوم سليمة (void وp اختياري) بلا إنذار', tagIssues('a.html', '<p>a<br><img src=x></p><ul><li>1<li>2</ul>').length === 0);
  t('R4: وسم إغلاق زائد', tagIssues('a.html', '<div></div></div>').length === 1);
  t('R4: صياغة JS: خطأ يُكشف وسليم لا', jsSyntaxIssues('a.js', 'function(){').length === 1 && jsSyntaxIssues('a.js', 'let a = 1;').length === 0);
  t('R4: ملف module يُتجاهل', jsSyntaxIssues('a.js', "import x from 'y';").length === 0);
  t('R4: السكربت المضمّن يُفحص', staticIssues({ 'a.html': '<script>let =<\/script>' }).length === 1);
  const dn = diffNew([{ k: 'a' }, { k: 'b' }], [{ k: 'a' }, { k: 'c' }, { k: 'c' }]);
  t('R4: مقارنة قبل/بعد: الجديد والمُزال', dn.added.length === 2 && dn.fixed === 1);
  t('مجلد: الاسم يُنشأ داخل المجلد الحالي', placeIn('src', 'a.js') === 'src/a.js' && placeIn('src', 'x/b.js') === 'src/x/b.js');
  t('مجلد: / تعني الجذر، و.. مرفوضة', placeIn('src', '/a.js') === 'a.js' && placeIn('src', '../a.js') === '' && placeIn('', 'a.js') === 'a.js');
  return T;
}

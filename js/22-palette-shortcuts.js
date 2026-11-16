'use strict';
/* لوحة الأوامر والاختصارات والأزرار العائمة */
/* ===== v26c: لوحة الأوامر، الاختصارات، الملفات الحديثة، تقرير الاستيراد ===== */
/*PURE3_START*/
function detectIndent(t) {
  let tabs = 0; const c = {};
  String(t).split('\n').forEach(l => { if (l[0] === '\t') tabs++; else { const m = /^( +)\S/.exec(l); if (m) { const n = m[1].length; if (n % 2 === 0) c[n % 4 === 0 && n >= 4 ? 4 : 2] = (c[n % 4 === 0 && n >= 4 ? 4 : 2] || 0) + 1; } } });
  const sp = (c[2] || 0) + (c[4] || 0); if (!tabs && !sp) return '    ';
  if (tabs > sp) return '\t'; return (c[2] || 0) > (c[4] || 0) * 1.5 ? '  ' : '    ';
}
function cmdMatch(list, q) { q = String(q || '').trim().toLowerCase(); if (!q) return list; return list.filter(c => q.split(/\s+/).every(w => c.n.toLowerCase().includes(w))); }
function ctxLines(content, line, n) { const L = String(content).split('\n'), a = Math.max(0, line - 1 - n), b = Math.min(L.length, line + n); return L.slice(a, b).map((x, i) => (a + i + 1) + (a + i + 1 === line ? '>' : ' ') + ' ' + x).join('\n'); }
function kindLabel(parsed) { return parsed.bundle ? 'كتل ملفات كاملة (' + parsed.bundle.length + ' ملف)' : 'باتشات JSON (' + (parsed.patches || []).length + ')'; }
function pureTests3() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  t('A9: كشف 2 مسافة', detectIndent('a{\n  b\n  c{\n    d\n  }\n}') === '  ');
  t('A9: كشف 4 مسافات', detectIndent('a{\n    b\n    c\n        d\n}') === '    ');
  t('A9: كشف Tab', detectIndent('a{\n\tb\n\tc\n}') === '\t');
  t('A9: افتراضي 4', detectIndent('abc') === '    ');
  const L = [{ n: 'احفظ الملف' }, { n: 'Find بحث' }, { n: 'تراجع' }];
  t('A17: بحث بالأوامر', cmdMatch(L, 'بحث').length === 1 && cmdMatch(L, 'find بحث').length === 1 && cmdMatch(L, '').length === 3 && cmdMatch(L, 'zzz').length === 0);
  t('C7: سياق الكود حول السطر', ctxLines('a\nb\nc\nd\ne', 3, 1) === '2  b\n3> c\n4  d');
  t('R: تسمية الصيغة المفهومة', /JSON/.test(kindLabel({ patches: [1, 2] })) && /ملف/.test(kindLabel({ bundle: [1] })));
  const nb = evaluatePatches('a b', [{ find: 'x\u00A0y', replace: 'z' }], { flex: true }).results[0];
  t('تحذير NBSP عند عدم العثور', nb.error && nb.error.code === 'PATCH_NOT_FOUND' && /NBSP/.test(nb.error.message));
  t('لا تحذير NBSP لنص عادي', !/NBSP/.test(evaluatePatches('a b', [{ find: 'xy', replace: 'z' }], { flex: true }).results[0].error.message));
  return T;
}
/*PURE3_END*/
let recent = [], importSkips = [];
function recentFiles() { return recent.map(id => files.find(f => f.id === id)).filter(Boolean); }
function showImportReport() {
  if (!importSkips.length) return;
  ui.show('<h3>تقرير الاستيراد: ' + importSkips.length + ' ملف مُتجاوَز</h3>' + importSkips.slice(0, 80).map(x => `<div class='issue'><b>${esc(truncate(x.n, 60))}</b><span>${esc(x.w)}</span></div>`).join('') + (importSkips.length > 80 ? '<div class="issue"><span>… و' + (importSkips.length - 80) + ' أخرى</span></div>' : '') + '<button type="button" class="btn" data-ui="cancel">إغلاق</button>');
}
function cmdList() {
  const f = cur(), sw = id => { saveCursor(); activeId = id; render(); };
  const L = [
    ['حفظ…', saveMenu], ['حفظ الكل', saveAll], ['بحث واستبدال', toggleFindBar], ['انتقال إلى سطر', goToLine], ['تشغيل المعاينة', runCode],
    ['تراجع', undo], ['إعادة', redo], ['نسخ كل الكود', copyAll], ['لصق', pasteClipboard], ['المشاكل (فحص الأقواس)', showProblems],
    ['ملف جديد', newFile], ['إعادة تسمية الملف', renameFile], ['تصدير المشروع ZIP', () => exportZip()], ['فتح ملفات', openFiles], ['نسخ المشروع كنص واحد (للذكاء)', () => exportBundleDialog('')], ['توليد ملفات من نص', importBundleDialog], ['دفع المشروع إلى GitHub', githubDialog],
    ['تكرار السطر', () => lineOp('dup')], ['حذف السطر', () => lineOp('dell')], ['نقل السطر لأعلى', () => lineOp('mvup')], ['نقل السطر لأسفل', () => lineOp('mvdn')],
    ['تعليق/إلغاء تعليق', toggleComment], ['زيادة المسافة البادئة', () => indentLines(1)], ['إنقاص المسافة البادئة', () => indentLines(-1)],
    ['معاينة الباتش', previewPatch], ['تطبيق الباتش', applyPatch], ['تراجع عن آخر تطبيق باتش', undoBatch],
    ['الإصدارات والتصحيحات', showV1], ['مخطط الملف', showOutline], ['سجّل كإصدار', quickRelease], ['حفظ الإصدارات (ZIP + السجل)', saveVersions], ['نقاط الحفظ', showSnaps], ['الإعدادات', openSettings], ['اختبار ذاتي', runSelfTest], ['تنزيل الملف الحالي', downloadFile], ['نسخ التقرير للذكاء', copyReport], ['نسخ تقرير الإصلاح للذكاء', () => copyRepairReport()], ['سجل الباتشات', showPH],
    ['إغلاق التبويبات الأخرى', () => { [...openTabs].forEach(i => { if (i !== activeId) openTabs.delete(i); }); render(); }],
    ['نسخ مسار الملف', () => f && copyToClipboard(f.name).then(() => toast('تم نسخ المسار', 'ok'))],
    ['آخر ملف (تبديل سريع)', () => { const r = recentFiles()[1]; if (r) sw(r.id); else toast('لا ملف سابق'); }]
  ].map(([n, fn]) => ({ n, fn }));
  recentFiles().slice(0, 8).forEach(r => L.push({ n: 'فتح: ' + r.name, fn: () => sw(r.id) }));
  return L;
}
function openPalette() {
  const all = cmdList(); let cur_ = all;
  const draw = q => { cur_ = cmdMatch(all, q); $('pal').innerHTML = cur_.slice(0, 40).map((c, i) => `<div class='issue' data-act='pc' data-i='${i}'><b>${esc(c.n)}</b></div>`).join('') || '<div class="issue"><span>لا نتائج</span></div>'; };
  ui.show('<h3>لوحة الأوامر</h3><input type="text" id="palQ" dir="auto" placeholder="ابحث عن أمر أو ملف…" autocomplete="off" autocapitalize="off" spellcheck="false"><div id="pal" class="scroll-box md"></div><button type="button" class="btn" data-ui="cancel">إغلاق</button>', (act, el) => {
    if (act !== 'pc') return; const c = cur_[+el.dataset.i]; ui.close(null); if (c) setTimeout(() => c.fn(), 80);
  });
  draw(''); const q = $('palQ'); q.addEventListener('input', () => draw(q.value)); q.addEventListener('keydown', e => { if (e.key === 'Enter' && cur_[0]) { e.preventDefault(); const c = cur_[0]; ui.close(null); setTimeout(() => c.fn(), 80); } });
  setTimeout(() => q.focus(), 120);
}
// ==== الأزرار العائمة (كونسول + خروج من ملء الشاشة): سحب + حفظ الموضع ====
(function () {
  const fab = $('fabGroup'); if (!fab) return;
  const host = fab.parentElement, KEY = 'cp_fab_pos';
  let st = null, moved = false, justDragged = false, pos = null;
  try { pos = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (pos && !(isFinite(pos.fx) && isFinite(pos.fy))) pos = null;
  function place(x, y) {
    const mw = Math.max(0, host.clientWidth - fab.offsetWidth), mh = Math.max(0, host.clientHeight - fab.offsetHeight);
    x = Math.max(0, Math.min(x, mw)); y = Math.max(0, Math.min(y, mh));
    fab.style.right = 'auto'; fab.style.bottom = 'auto'; fab.style.left = x + 'px'; fab.style.top = y + 'px';
    return { x, y, mw, mh };
  }
  function apply() {
    if (!pos || !host.clientWidth || !host.clientHeight || st) return;
    const mw = Math.max(0, host.clientWidth - fab.offsetWidth), mh = Math.max(0, host.clientHeight - fab.offsetHeight);
    place(pos.fx * mw, pos.fy * mh);
  }
  fab.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const r = fab.getBoundingClientRect(), h = host.getBoundingClientRect();
    st = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left - h.left, oy: r.top - h.top };
    moved = false;
  });
  fab.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.sx, dy = e.clientY - st.sy;
    if (!moved) {
      if (Math.hypot(dx, dy) < 8) return;
      moved = true; fab.classList.add('drag');
      try { fab.setPointerCapture(e.pointerId); } catch (_) {}
    }
    place(st.ox + dx, st.oy + dy);
  });
  function end(e) {
    if (!st || e.pointerId !== st.id) return;
    if (moved) {
      const p = place(st.ox + (e.clientX - st.sx), st.oy + (e.clientY - st.sy));
      pos = { fx: p.mw ? p.x / p.mw : 0, fy: p.mh ? p.y / p.mh : 0 };
      try { localStorage.setItem(KEY, JSON.stringify(pos)); } catch (_) {}
      justDragged = true; setTimeout(() => { justDragged = false; }, 350);
    }
    fab.classList.remove('drag'); st = null; moved = false;
  }
  fab.addEventListener('pointerup', end);
  fab.addEventListener('pointercancel', end);
  // بعد السحب: نبتلع الضغطة كي لا يعمل الزر بالخطأ
  fab.addEventListener('click', e => { if (justDragged) { e.stopPropagation(); e.preventDefault(); } }, true);
  // إعادة التقييد عند تدوير الشاشة / الكيبورد / ملء الشاشة / ظهور تبويب التشغيل
  if (window.ResizeObserver) new ResizeObserver(apply).observe(host);
  window.addEventListener('resize', () => setTimeout(apply, 80));
  apply();
})();

document.addEventListener('keydown', e => {
  if (e.isComposing) return;
  const mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase(), inEd = document.activeElement === editor;
  if (mod && e.shiftKey && k === 'p') { e.preventDefault(); e.stopPropagation(); openPalette(); }
  else if (inEd && mod && !e.shiftKey && k === 'd') { e.preventDefault(); lineOp('dup'); }
  else if (inEd && mod && e.shiftKey && k === 'k') { e.preventDefault(); lineOp('dell'); }
  else if (inEd && e.altKey && !mod && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); lineOp(e.key === 'ArrowUp' ? 'mvup' : 'mvdn'); }
}, true);
/* قائمة «إدارة المشروع»: تجمع التصدير وحفظ الإصدارات وتسجيل إصدار مستقر في زر واحد بالشريط العلوي */
function openManage() {
  ui.show('<h3>إدارة المشروع</h3>' +
    uiRow('exp', 'export', 'تصدير المشروع', 'ZIP أو نص واحد للذكاء الاصطناعي') +
    uiRow('sav', 'save', 'حفظ الإصدارات', 'ZIP مع سجل الإصدارات') +
    uiRow('rel', 'flag', 'تسجيل إصدار مستقر', 'نقطة رجوع باسم تختاره'), act => {
      const fn = { exp: exportDialog, sav: saveVersions, rel: quickRelease }[act];
      ui.close(null);
      if (fn) setTimeout(fn, 120);
    });
}

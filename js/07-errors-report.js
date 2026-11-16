'use strict';
/* بطاقات الأخطاء وتقرير الإصلاح للذكاء */
/* ===== Errors UI ===== */
function formatErrorForAI(err) {
  const f = cur();
  let out = `=== تقرير خطأ ===\nالرمز: ${err.code}\nالعنوان: ${err.title}\n`;
  if (f) out += `الملف: ${f.name}\n`;
  if (err.message) out += `التفاصيل: ${err.message}\n`;
  if (err.patchIndex != null) out += `الباتش: #${err.patchIndex}\n`;
  if (err.action) out += `العملية: ${err.action}\n`;
  if (err.searchText) out += `النص المبحوث: "${truncate(err.searchText, 300)}"\n`;
  if (err.similarMatch) out += `مشابه (سطر ${err.similarLine}): "${truncate(err.similarMatch, 300)}"\n`;
  if (err.similarLine && f) out += `الأسطر الحالية حول السطر ${err.similarLine}:\n${ctxLines(f.content, err.similarLine, 3)}\n`;
  if (err.suggestion) out += `الاقتراح: ${err.suggestion}\n`;
  return out + '======================\n';
}
function errorCardHTML(err, i) {
  const row = (k, v, cls) => `<div class="errcard-row"><span class="k">${k}</span><span class="v${cls ? ' ' + cls : ''}">${esc(v)}</span></div>`;
  let h = `<div class="errcard ${err.severity === 'error' ? '' : err.severity}"><div class="errcard-head"><span class="errcard-title">${esc(err.title)}</span><span class="errcard-code">${esc(err.code)}</span></div><div>`;
  if (err.message) h += row('التفاصيل:', err.message);
  if (err.searchText) h += row('البحث:', truncate(err.searchText, 150));
  if (err.similarMatch) h += row((err.code === 'PATCH_NOT_FOUND' ? 'أقرب موضع (سطر ' : 'موجود (سطر ') + err.similarLine + '):', truncate(err.similarMatch, 150));
  if (err.suggestion) h += row('الاقتراح:', err.suggestion, 'ok');
  return h + `</div><div class="errcard-actions">${err.similarLine ? `<button type="button" class="copy-ai open" data-open="${i}">${ic('edit', 's')} افتح في المحرر</button>` : ''}<button type="button" class="copy-ai" data-err="${i}">${ic('copy', 's')} نسخ للـAI</button><button type="button" class="copy-ai fix" data-fix="${i}">${ic('wrench', 's')} نسخ تقرير الإصلاح للذكاء</button>${err.code === 'PATCH_AMBIGUOUS' ? `<button type="button" class="copy-ai" data-pick="${i}">اختر الموضع</button>` : ''}</div></div>`;
}
function renderErrors(errs) { errStore = errs; $('patchErrors').innerHTML = errs.map(errorCardHTML).join(''); }
function openErr(i) {
  const err = errStore[i]; if (!err || !err.similarLine) return;
  const c = cur(); if (c) c.content = editor.value;
  const fm = /^\[(.+?)\]/.exec(err.message || ''), f = fm ? files.find(x => x.name === fm[1]) : cur();
  if (!f) return toast('تعذّر تحديد الملف', 'err');
  const Ls = String(f.content).split('\n'), ln = Math.min(err.similarLine, Ls.length), txt = Ls[ln - 1] || '';
  const first = err.similarMatch ? String(err.similarMatch).split('\n')[0] : '', at = first ? txt.indexOf(first) : -1;
  openAt(f.id, ln, at >= 0 ? at : 0, at >= 0 ? first.length : txt.length);
  toast('عدّل يدوياً ثم ارجع لتبويب باتشات', 'ok');
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-open]'); if (b) openErr(+b.dataset.open); });
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-err]'); if (!b) return;
  const err = errStore[+b.dataset.err];
  if (err) copyToClipboard(formatErrorForAI(err)).then(() => toast('تم النسخ — الصقه في AI', 'ok'));
});
/* ===== R6: تقرير الإصلاح للذكاء (v30.0) =====
   يجمع: الباتش الفاشل + الكود الفعلي الآن + نتيجة اختبار الدخان + مشاكل المحرر والكونسول.
   النواة repairReportText دالة نقية (بلا DOM) لسهولة الاختبار الذاتي. */
const FENCE = String.fromCharCode(96).repeat(3);
let lastSmoke = null;
const ERR_WHY = {
  PATCH_NOT_FOUND: 'النص المطلوب (find) غير موجود إطلاقاً في الملف الحالي — غالباً الكود تغيّر عمّا تتوقعه، أو أن النص مُتخيَّل.',
  PATCH_NEAR_MISS: 'وُجد نص مشابه لكنه ليس مطابقاً حرفياً (اختلاف في حالة الأحرف أو المسافات أو جزء من النص).',
  PATCH_AMBIGUOUS: 'النص find يتكرر أكثر من مرة، فرُفض الباتش حمايةً — يلزم find أطول وفريد، أو استخدام occurrence / all.',
  PATCH_OCCURRENCE: 'رقم occurrence خارج عدد التطابقات الفعلي في الملف.',
  PATCH_INVALID: 'الباتش ناقص أو غير صالح البنية (حقل مطلوب مفقود).',
  PATCH_ACTION: 'اسم العملية (action) غير معروف.',
  FILE_NOT_FOUND: 'الباتش يشير إلى ملف غير موجود في المشروع.',
  FILE_AMBIGUOUS: 'اسم الملف يطابق أكثر من ملف في المشروع — يلزم المسار الكامل.',
  FILE_EXISTS: 'الملف موجود مسبقاً ولم يُسمح بالاستبدال الكامل.',
  JSON_PARSE_ERROR: 'نص الباتش ليس JSON صالحاً.'
};
function vis(s) { return String(s).replace(/\n/g, '↵').replace(/\t/g, '→').replace(/ /g, '[NBSP]').replace(/[​-‏﻿‪-‮]/g, '[خفي]'); }
function rFence(t) { return FENCE + '\n' + t + '\n' + FENCE; }
function rLines(content, a, b, n) {
  const L = String(content).split('\n'), s = Math.max(1, a - n), e = Math.min(L.length, b + n), w = String(e).length, o = [];
  for (let i = s; i <= e; i++) o.push(String(i).padStart(w) + (i >= a && i <= b ? '>' : ' ') + ' ' + truncate(L[i - 1], 220));
  return o.join('\n');
}
function rHints(content, find) {
  const L = String(content).split('\n'), out = [], seen = new Set();
  const add = (i, why) => { if (out.length < 3 && !seen.has(i)) { seen.add(i); out.push({ line: i + 1, why }); } };
  const fl = nl(find).split('\n').map(x => x.trim()).filter(x => x.length >= 6).sort((a, b) => b.length - a.length);
  for (const t of fl.slice(0, 3)) { L.forEach((l, i) => { if (l.includes(t)) add(i, 'يحوي السطر «' + truncate(t, 50) + '»'); }); if (out.length) break; }
  if (!out.length) {
    const words = (find.match(/[A-Za-z_$][\w$]{4,}/g) || []).filter((w, i, a) => a.indexOf(w) === i).sort((a, b) => b.length - a.length).slice(0, 3);
    for (const w of words) { L.forEach((l, i) => { if (l.includes(w)) add(i, 'يحوي الكلمة «' + w + '»'); }); if (out.length) break; }
  }
  return out;
}
function rOutline(content) {
  const re = /^\s*(?:async\s+)?(?:function\*?\s+[\w$]+|class\s+[\w$]+|(?:const|let|var)\s+[\w$]+\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[\w$]+\s*=>))/, out = [];
  String(content).split('\n').forEach((l, i) => { if (out.length < 60 && re.test(l)) out.push((i + 1) + ': ' + truncate(l.trim(), 90)); });
  return out;
}
function rWhatDiff(a, b) {
  let why;
  if (a.toLowerCase() === b.toLowerCase()) why = 'الفرق في حالة الأحرف (كبيرة/صغيرة).';
  else if (a.replace(/\s+/g, ' ').trim() === b.replace(/\s+/g, ' ').trim()) why = 'الفرق في المسافات أو التبويب أو فواصل الأسطر.';
  else why = 'جزء من النص يطابق والباقي يختلف.';
  const m = Math.min(a.length, b.length); let at = 0; while (at < m && a[at] === b[at]) at++;
  return { why, want: vis(a.slice(at, at + 25)), real: vis(b.slice(at, at + 25)), at };
}
function repairSection(err, k, cx) {
  const fname = err.file || ((/^\[(.+?)\]/.exec(err.message || '') || [])[1]) || cx.active || '';
  const content = fname ? cx.text(fname) : null, L = [];
  L.push('## الخطأ ' + k + ': ' + err.code + ' — ' + err.title);
  L.push('نوع الخطأ: ' + (ERR_WHY[err.code] || err.message || '—'));
  if (fname) L.push('الملف: ' + fname);
  if (err.action) L.push('العملية: ' + err.action);
  if (err.message) L.push('تفاصيل الأداة: ' + err.message);
  if (err.suggestion) L.push('اقتراح الأداة: ' + err.suggestion);
  const find = err.searchText ? nl(err.searchText) : '';
  if (find) L.push('', '### النص الذي بحث عنه الباتش (find):', rFence(truncate(find, 1500)));
  if (err.intended) L.push('', '### النص الجديد الذي كان مقصوداً (replace) — حافظ على معناه:', rFence(truncate(err.intended, 1500)));
  const nLines = find ? find.split('\n').length : 1;
  if (find && content != null) {
    if (err.code === 'PATCH_NEAR_MISS' && err.similarLine) {
      const a = err.similarLine, b = a + nLines - 1;
      L.push('', '### الكود الفعلي الآن (الأسطر ' + a + '–' + b + ' مُعلَّمة بـ > وهي الأقرب لطلب الباتش):', rFence(rLines(content, a, b, 6)));
      if (err.similarMatch) {
        const d = rWhatDiff(find, nl(err.similarMatch));
        L.push('سبب عدم التطابق: ' + d.why, 'أول اختلاف عند الحرف ' + (d.at + 1) + ': المطلوب «' + d.want + '» والفعلي «' + d.real + '»  (↵ = سطر جديد، → = تبويب).');
      }
    } else if (err.code === 'PATCH_AMBIGUOUS' || err.code === 'PATCH_OCCURRENCE') {
      const hits = []; let p = content.indexOf(find);
      while (p >= 0 && hits.length < 8) { hits.push(p); p = content.indexOf(find, p + Math.max(1, find.length)); }
      if (hits.length) {
        L.push('', '### مواضع التكرار في الكود الفعلي (' + hits.length + (hits.length >= 8 ? '+' : '') + '):');
        hits.forEach((h, i) => { const ln = content.slice(0, h).split('\n').length; L.push('الموضع ' + (i + 1) + ' — سطر ' + ln + ':', rFence(rLines(content, ln, ln + nLines - 1, 2))); });
        L.push('الحل: أطِل find بإضافة سطر مجاور يجعله فريداً، أو أضف "occurrence": رقم الموضع، أو "all": true.');
      }
    } else if (err.code === 'PATCH_NOT_FOUND') {
      const hs = rHints(content, find);
      if (hs.length) {
        L.push('', '### أقرب المواضع المحتملة في الكود الفعلي:');
        hs.forEach(h => L.push('- سطر ' + h.line + ' — ' + h.why));
        hs.slice(0, 2).forEach(h => L.push('', 'الكود الفعلي حول سطر ' + h.line + ':', rFence(rLines(content, h.line, h.line + nLines - 1, 4))));
      } else {
        const ol = rOutline(content);
        L.push('', '### لم أجد في الملف أي سطر يشبه النص المطلوب. مخطط الملف الفعلي (' + content.split('\n').length + ' سطراً):', rFence(ol.length ? ol.join('\n') : rLines(content, 1, 25, 0)));
      }
    }
  } else if (find && content == null) {
    L.push('', '(تعذّر قراءة الملف «' + (fname || '؟') + '» من المشروع الآن.)');
  }
  if (err.code === 'FILE_NOT_FOUND' || err.code === 'FILE_AMBIGUOUS') L.push('', '### ملفات المشروع الحالية:', rFence(cx.files.slice(0, 60).join('\n')));
  if (err.code === 'JSON_PARSE_ERROR') {
    const ln = +((/سطر (\d+)/.exec(err.message || '') || [])[1] || 0);
    if (ln && cx.patchInput) L.push('', '### نص الباتش حول موضع الخطأ:', rFence(rLines(cx.patchInput, ln, ln, 3)));
    L.push('أعد إرسال JSON صالحاً: اجعل علامات الاقتباس والأسطر الجديدة داخل النصوص مُهرَّبة (\\" و \\n).');
  }
  return L.join('\n');
}
function smokeSection(cx) {
  const s = cx.smoke, L = ['--- نتيجة اختبار الدخان ---'];
  if (!s) { L.push('لم يُشغَّل اختبار دخان لهذه الدفعة (اضغط «معاينة» ليُجرى).'); return L.join('\n'); }
  if (s.pending) { L.push('قيد التنفيذ الآن — أعد نسخ التقرير بعد بضع ثوانٍ لتضمينه.'); return L.join('\n'); }
  if (s.skip) { L.push('لم يُنفَّذ: ' + s.skip); return L.join('\n'); }
  L.push(s.n ? 'تحذير: الباتشات الناجحة في هذه الدفعة تضيف ' + s.n + ' خطأ جديداً.' : 'آمن: الباتشات الناجحة لا تضيف أخطاء جديدة.');
  if (s.rt.length) L.push('أخطاء تشغيل جديدة:', rFence(s.rt.slice(0, 8).map(x => truncate(x, 240)).join('\n')));
  if (s.st.length) L.push('أخطاء صياغة/وسوم جديدة:', rFence(s.st.slice(0, 8).map(x => truncate(x, 240)).join('\n')));
  if (s.pre) L.push('أخطاء موجودة قبل الباتش (لا تُحسب): ' + s.pre);
  if (!s.ran) L.push('لم يُشغَّل المشروع (لا ملف html)، فُحصت الصياغة والوسوم فقط.');
  L.push('ملاحظة: الاختبار جرى على الباتشات الناجحة فقط؛ الفاشلة لم تدخل فيه.');
  return L.join('\n');
}
function repairReportText(errs, cx) {
  const ev = cx.ev, out = [];
  // المعاينة يُتراجع عنها ولا يُعتمد شيء قبل نجاح الدفعة كلها: يُطلب دائماً إعادة كل الباتشات لا الفاشلة وحدها
  const total = ev ? ev.results.length : 0;
  out.push('=== تقرير إصلاح للذكاء — CodePatcher ===');
  out.push('فشل ' + errs.length + ' باتش عند تطبيقه على الكود الفعلي. هذا هو الكود الفعلي الموجود الآن في المحرر — أعد التوليد بناءً عليه، لا بناءً على ما تتذكّره.');
  out.push('', 'القواعد:',
    '1) انسخ نص find حرفياً من «الكود الفعلي» أدناه، بنفس حالة الأحرف والمسافات والتبويب.',
    '2) اجعل find فريداً (أضف سطراً مجاوراً) أو استخدم "occurrence" أو "all": true.',
    '3) أعد **كل** باتشات الدفعة' + (total ? ' (' + total + ')' : '') + ' في مصفوفة JSON واحدة وبنفس ترتيبها، لا الفاشلة وحدها: صحّح الفاشلة، وانسخ الناجحة كما هي حرفياً دون تغيير، بلا شرح خارج الـJSON. (لا يُعتمد أي باتش قبل أن تنجح الدفعة كلها.)',
    '4) احتفظ بنفس حقول file / action / replace ومعنى التعديل المقصود.');
  if (ev) {
    const c = k => ev.results.filter(r => r.status === k).map(r => r.n);
    const ok = c('applied'), sk = c('skipped');
    out.push('', 'حالة الدفعة: لم يُعتمد أي باتش — المعاينة يُتراجع عنها، فتُعاد الدفعة كلها.',
      'ناجح (يُعاد كما هو): ' + (ok.length ? ok.map(x => '#' + x).join(' ') : '—') + ' | مُتخطّى: ' + (sk.length ? sk.map(x => '#' + x).join(' ') : '—') + ' | فاشل (يُصحَّح): ' + c('failed').map(x => '#' + x).join(' '));
  }
  const MAXE = 8;
  errs.slice(0, MAXE).forEach((e, i) => out.push('', repairSection(e, i + 1, cx)));
  if (errs.length > MAXE) out.push('', '(… و' + (errs.length - MAXE) + ' أخطاء أخرى لم تُفصَّل هنا)');
  out.push('', smokeSection(cx));
  if (cx.lint && cx.lint.length) out.push('', '--- مشاكل الأقواس/النصوص في «' + cx.lintName + '» الآن ---', rFence(cx.lint.slice(0, 5).map(x => 'سطر ' + x.line + ': ' + x.msg).join('\n')));
  if (cx.con && cx.con.length) out.push('', '--- آخر أخطاء الكونسول (المعاينة) ---', rFence(cx.con.join('\n')));
  const nums = errs.map(e => e.patchIndex).filter(x => x != null);
  out.push('', 'المطلوب الآن: مصفوفة JSON واحدة تحوي كل الباتشات' + (total ? ' (#1 إلى #' + total + ')' : '') + ' — الفاشلة مصحَّحة' + (nums.length ? ' (' + nums.map(x => '#' + x).join(' ') + ')' : '') + ' والناجحة كما هي دون تغيير، مبنيّة على الكود الفعلي أعلاه.', '=== نهاية التقرير ===');
  return out.join('\n');
}
function gatherRepairCx(allErrs) {
  const c = cur();
  const ev = (lastEv && allErrs.length && allErrs.every(e => lastEv.results.some(r => r.error === e))) ? lastEv : null;
  const lintOn = !!c && ['js', 'css', 'json'].includes(c.lang);
  return {
    ev, dry: lastDry, active: c ? c.name : '',
    text: n => { const f = files.find(x => x.name === n); return f ? (f.id === activeId ? editor.value : f.content) : null; },
    files: files.map(f => f.name), patchInput: $('patchInput').value,
    smoke: (ev && lastSmoke && lastSmoke.ev === ev) ? lastSmoke : null,
    lint: lintOn ? doc.lint : [], lintName: c ? c.name : '',
    con: conMsgs.filter(m => m.t === 'error').slice(-5).map(m => truncate(String(m.txt), 300))
  };
}
function copyRepairReport(i) {
  const all = errStore.filter(Boolean), errs = i == null ? all : [errStore[i]].filter(Boolean);
  if (!errs.length) return toast('لا أخطاء باتش لتقريرها — اضغط معاينة أو تطبيق أولاً', 'err');
  const txt = repairReportText(errs, gatherRepairCx(all));
  copyToClipboard(txt).then(() => toast('نُسخ تقرير الإصلاح (' + errs.length + ' خطأ) — الصقه في الذكاء', 'ok'));
  log('ok', 'نُسخ تقرير الإصلاح: ' + errs.map(e => e.code).join('، '));
}
document.addEventListener('click', e => {
  const b = e.target.closest && e.target.closest('[data-fix]'); if (!b) return;
  copyRepairReport(+b.dataset.fix);
});
function copyFullReport() {
  const f = cur(); let out = '=== تقرير شامل ===\n';
  if (f) out += `الملف: ${f.name} (${f.content.length} حرف)\n`;
  if (lastPatchAttempt) out += `آخر باتش: إجمالي ${lastPatchAttempt.total} | نجح ${lastPatchAttempt.applied} | تخطّى ${lastPatchAttempt.skipped} | فشل ${lastPatchAttempt.failed}\n`;
  logs.slice(0, 25).forEach(l => { out += `[${l.time}][${l.kind}] ${l.msg}\n`; });
  copyToClipboard(out).then(() => toast('تم نسخ التقرير', 'ok'));
}

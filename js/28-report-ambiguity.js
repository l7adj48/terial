'use strict';
/* نسخ التقرير ومنتقي الغموض */
/* ===== نسخ التقرير للذكاء ===== */
function copyReport() {
  const c = cur(), pe = $('patchErrors'), errs = pe ? pe.textContent.trim() : '';
  const con = conMsgs.slice(-30).map(m => '[' + m.t + '] ' + truncate(String(m.txt), 400)).join('\n');
  if (!errs && !con) return toast('لا أخطاء ولا نتائج لنسخها', 'err');
  const out = ['=== تقرير ===', 'الملف الحالي: ' + (c ? c.name : '-')];
  if (errs) out.push('--- أخطاء الباتش ---\n' + truncate(errs, 3000));
  if (con) out.push('--- الكونسول (آخر 30) ---\n' + con);
  copyToClipboard(out.join('\n\n')).then(() => toast('نُسخ التقرير', 'ok'));
}
/* ===== منتقي الغموض (النص مكرر) ===== */
function pickAmbig(i) {
  const err = errStore[i]; if (!err) return;
  const fm = /^\[(.+?)\]/.exec(err.message || ''), cnt = +((/وُجد (\d+)/.exec(err.message || '') || [])[1] || 0);
  const c = cur(); if (c) c.content = editor.value;
  const f = fm && files.find(x => x.name === fm[1]);
  if (!f || !err.searchText) return toast('تعذّر تحديد الملف أو النص', 'err');
  const t = f.content, hits = []; let p = t.indexOf(err.searchText);
  while (p >= 0 && hits.length < 40) { hits.push(p); p = t.indexOf(err.searchText, p + 1); }
  if (hits.length < 2 || hits.length !== cnt) return toast('تعذّر عرض المواضع بدقة — أضف "occurrence" يدوياً', 'err');
  const L = t.split('\n'), cut = x => esc(String(x).slice(0, 70));
  const rows = hits.map((h, k) => { const ln = t.slice(0, h).split('\n').length; return `<div class="issue" data-act="occ" data-k="${k + 1}"><b>#${k + 1} — سطر ${ln}</b><div class="slabel ltr-pre">${cut(L[ln - 2] || '')}\n<b>${cut(L[ln - 1] || '')}</b>\n${cut(L[ln] || '')}</div></div>`; }).join('');
  ui.show('<h3>أي موضع تقصد؟ — ' + esc(f.name) + '</h3>' + uiScroll(rows, 'lg') + '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', (a, el) => {
    if (a !== 'occ') return;
    const k = +el.dataset.k, ta = $('patchInput');
    try {
      const arr = JSON.parse(ta.value.trim().replace(/^```\w*\s*|\s*```$/g, ''));
      if (!Array.isArray(arr) || !arr[err.patchIndex - 1]) throw 0;
      arr[err.patchIndex - 1].occurrence = k; ta.value = JSON.stringify(arr, null, 2);
      ta.dispatchEvent(new Event('input')); ui.close(null); setTimeout(previewPatch, 150);
    } catch (e) { ui.close(null); toast('الباتش ليس JSON خالصاً — أضف "occurrence": ' + k + ' يدوياً', 'err'); }
  });
}
$('patchErrors').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (b) pickAmbig(+b.dataset.pick); });

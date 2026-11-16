'use strict';
/* العزل ونقاط الحفظ والاسترداد والاختبار الذاتي */
/* ===== J5/J4/J2: العزل ونقاط الحفظ والاسترداد والاختبار الذاتي ===== */
/*SELFTEST_PURE_START*/
const SHIM_SRC = '(function(){var mk=function(){var d={};return{getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},setItem:function(k,v){d[String(k)]=String(v)},removeItem:function(k){delete d[String(k)]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}};' +
  '["localStorage","sessionStorage"].forEach(function(n){try{Object.defineProperty(window,n,{value:mk(),configurable:true})}catch(e){}});' +
  'try{Object.defineProperty(window,"indexedDB",{value:{open:function(){throw new Error("IndexedDB غير متاح في المعاينة المعزولة")}},configurable:true})}catch(e){}})();';
const SNAP_MAX = 20;
function snapHash(fl) { let h = 0; fl.forEach(f => { const s = f.name + '|' + f.content; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; }); return h; }
function capSnaps(list, s) { if (list[0] && list[0].h === s.h) return list; return [s].concat(list).slice(0, SNAP_MAX); }
function previewMsgOk(e, win) { const d = e.data; return !!d && d.__cp === 1 && !!win && e.source === win; }
function pureTests() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  const ev = (c, p, o) => evaluatePatches(c, p, o || { flex: true });
  let r = ev('a foo b', [{ find: 'foo', replace: 'bar' }]);
  t('استبدال فريد', r.output === 'a bar b' && r.results[0].status === 'applied');
  r = ev('foo foo', [{ find: 'foo', replace: 'bar' }]);
  t('غموض: يُرفض ولا يُعدَّل', r.results[0].status === 'failed' && r.results[0].error.code === 'PATCH_AMBIGUOUS' && r.output === 'foo foo');
  r = ev('foo foo', [{ find: 'foo', replace: 'bar', all: true }]);
  t('all:true', r.output === 'bar bar');
  r = ev('foo foo', [{ find: 'foo', replace: 'bar', occurrence: 2 }]);
  t('occurrence', r.output === 'foo bar');
  r = ev('x = newValue123;', [{ find: 'oldValue', replace: 'newValue123' }]);
  t('تخطي المطبّق مسبقاً مع سبب وسطر', r.results[0].status === 'skipped' && /سطر 1/.test(r.results[0].reason));
  r = ev('abc', [{ find: 'zzz', replace: 'y' }]);
  t('غير موجود', r.results[0].error && r.results[0].error.code === 'PATCH_NOT_FOUND');
  r = ev('Hello', [{ find: 'hello', replace: 'Hi' }]);
  t('نص مشابه (حالة الأحرف)', r.results[0].error && r.results[0].error.code === 'PATCH_NEAR_MISS' && r.output === 'Hello');
  r = ev('a b', [{ action: 'insert_after', find: 'a', content: '1' }, { action: 'insert_before', find: 'b', content: '2' }]);
  t('إدراج قبل وبعد', r.output === 'a1 2b');
  r = ev('a b c', [{ action: 'delete', find: ' b' }]);
  t('حذف', r.output === 'a c');
  r = ev('x', [{ action: 'append', content: 'y' }, { action: 'prepend', content: 'w' }]);
  t('إلحاق وإضافة في البداية', r.output === 'wxy');
  r = ev('a  b', [{ find: 'a b', replace: 'c' }], { flex: true });
  t('مطابقة مرنة للمسافات', r.output === 'c' && r.results[0].flex === true);
  r = ev('a  b', [{ find: 'a b', replace: 'c' }], { flex: false });
  t('بلا مرونة: لا تغيير', r.output === 'a  b');
  t('CRLF إلى LF', nl('a\r\nb\rc') === 'a\nb\nc');
  const a = 'hello world', b = 'hello brave world', d = diffRange(a, b);
  t('diffRange يعيد البناء', a.slice(0, d.at) + d.ins + a.slice(d.at + d.del.length) === b);
  // العزل: محاكاة التخزين
  const fw = {}; new Function('window', SHIM_SRC)(fw);
  fw.localStorage.setItem('k', 5);
  t('shim: localStorage يعمل بالذاكرة', fw.localStorage.getItem('k') === '5' && fw.localStorage.length === 1 && fw.localStorage.getItem('none') === null);
  fw.localStorage.removeItem('k'); fw.sessionStorage.setItem('s', 1); fw.sessionStorage.clear();
  t('shim: remove وclear وفصل sessionStorage', fw.localStorage.length === 0 && fw.sessionStorage.length === 0);
  let thrown = ''; try { fw.indexedDB.open('x'); } catch (e) { thrown = e.message; }
  t('shim: IndexedDB يعطي خطأً واضحاً', /غير متاح/.test(thrown));
  t('HOOK يحوي shim', HOOK.indexOf('getItem') > -1);
  // نقاط الحفظ
  let list = []; for (let i = 0; i < 25; i++) list = capSnaps(list, { h: i, t: i });
  t('نقاط الحفظ: الحد 20 والأحدث أولاً', list.length === 20 && list[0].h === 24);
  t('نقاط الحفظ: لا تكرار متتالٍ', capSnaps(list, { h: 24 }) === list);
  t('hash يتغير بتغيّر المحتوى', snapHash([{ name: 'a', content: '1' }]) !== snapHash([{ name: 'a', content: '2' }]));
  // قناة الرسائل
  const A = {}, B = {};
  t('رسالة من نافذة أخرى تُرفض', !previewMsgOk({ data: { __cp: 1 }, source: A }, B));
  t('رسالة المعاينة تُقبل', previewMsgOk({ data: { __cp: 1 }, source: B }, B));
  t('رسالة بلا علامة تُرفض', !previewMsgOk({ data: { x: 1 }, source: B }, B));
  return T;
}
/*SELFTEST_PURE_END*/

let snapQ = Promise.resolve(), bootFailed = false, booted = false, memSnaps = [];
function snapNow(reason) {
  if (!files.length) return;
  const c = cur(); if (c) c.content = editor.value;
  const fl = files.map(f => ({ name: f.name, content: f.content }));
  const s = { t: Date.now(), r: reason, files: fl, h: snapHash(fl) };
  memSnaps = capSnaps(memSnaps, s);
  if (store.mode !== 'idb') return;
  snapQ = snapQ.then(async () => {
    try {
      const old = (await store.req('meta', m => m.get('snaps'))) || [], nw = capSnaps(old, s);
      if (nw === old) return;
      await new Promise((res, rej) => { const tx = store.db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(nw, 'snaps'); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
    } catch (e) { }
  });
}
async function getSnaps() {
  await snapQ;
  if (store.mode !== 'idb') return memSnaps;
  try { return (await store.req('meta', m => m.get('snaps'))) || []; } catch (e) { return memSnaps; }
}
async function showSnaps() {
  const l = await getSnaps();
  if (!l.length) return toast('لا توجد نقاط حفظ بعد — تُؤخذ تلقائياً قبل أي عملية مدمّرة', 'err');
  ui.show('<h3>نقاط الحفظ</h3>' + uiNote('تُؤخذ تلقائياً قبل الحذف والاستبدال والتطبيق (آخر ' + SNAP_MAX + '). الاسترجاع يحفظ حالتك الحالية أولاً.') +
    l.map((b, i) => `<div class='issue' data-act='rs' data-i='${i}'><b>${esc(b.r || 'نقطة حفظ')}</b><span>${new Date(b.t).toLocaleString('en-GB')} · ${b.files.length} ملف</span></div>`).join('') +
    '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', async (act, el) => {
      if (act !== 'rs') return; const b = l[+el.dataset.i]; ui.close(null);
      if (!(await ui.confirm('استرجاع المشروع كاملاً إلى «' + (b.r || 'نقطة حفظ') + '»؟ (تُحفظ حالتك الحالية أولاً)', 'استرجاع'))) return;
      restoreSnap(b);
    });
}
function restoreSnap(b) {
  snapNow('قبل الاسترجاع');
  files.forEach(f => removedIds.push(f.id)); openTabs.clear();
  files = b.files.map(x => makeFile(x.name, x.content, x.content));
  activeId = files[0] ? files[0].id : null; lastBatch = null;
  render(); scheduleSave(); toast('تم استرجاع المشروع (' + files.length + ' ملف)', 'ok');
}
async function showRecovery(err) {
  if (bootFailed) return; bootFailed = true;
  const msg = String(err && (err.stack || err.message) || err || 'خطأ غير معروف').slice(0, 600);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0a0c10;color:#e6edf3;overflow:auto;padding:20px;direction:rtl;font:15px/1.7 system-ui,"Noto Sans Arabic",sans-serif';
  d.innerHTML = '<h2 style="margin:0 0 8px">شاشة الاسترداد</h2><p>تعذّر تشغيل التطبيق بشكل سليم. <b>بياناتك المخزّنة لم تُمسّ ولن يُكتب فوقها.</b></p><pre style="direction:ltr;white-space:pre-wrap;background:#12161f;padding:10px;border-radius:8px;font-size:12px"></pre><div id="rcList">جارٍ قراءة النسخ…</div><button type="button" id="rcRaw" style="display:block;width:100%;padding:12px;margin:10px 0;border-radius:8px;border:0;background:#2dd4bf;color:#000;font-weight:700">تنزيل كل البيانات الخام (JSON)</button><button type="button" id="rcRetry" style="display:block;width:100%;padding:12px;border-radius:8px;border:1px solid #283142;background:#12161f;color:#e6edf3">إعادة المحاولة</button>';
  d.querySelector('pre').textContent = msg; document.body.appendChild(d);
  const dl = (name, obj) => { const u = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' })); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 30000); };
  d.querySelector('#rcRetry').onclick = () => location.reload();
  let raw = { files: [], meta: {} };
  try {
    if (store.db) {
      raw.files = await store.req('files', s => s.getAll());
      for (const k of ['session', 'snaps', 'backups']) raw.meta[k] = await store.req('meta', s => s.get(k));
    }
  } catch (e) { raw.error = String(e); }
  d.querySelector('#rcRaw').onclick = () => dl('codepatcher-raw-' + Date.now() + '.json', raw);
  const sn = (raw.meta.snaps || []).concat((raw.meta.backups || []).map(b => ({ t: b.t, r: 'نسخة احتياطية', files: b.files })));
  const box = d.querySelector('#rcList'); box.textContent = '';
  if (!sn.length) box.textContent = 'لا نسخ محفوظة. زر التنزيل أدناه يحفظ كل ما في التخزين.';
  sn.forEach(b => { const x = document.createElement('button'); x.style.cssText = 'display:block;width:100%;text-align:right;padding:10px;margin:4px 0;border-radius:8px;border:1px solid #283142;background:#12161f;color:#e6edf3'; x.textContent = (b.r || 'نقطة حفظ') + ' · ' + new Date(b.t).toLocaleString('en-GB') + ' · ' + (b.files || []).length + ' ملف — تنزيل'; x.onclick = () => dl('snapshot-' + b.t + '.json', b); box.appendChild(x); });
}
async function runSelfTest() {
  const T = pureTests().concat(pureTests2(), pureTests3(), pureTests4(), pureTests5(), pureTests6(), pureTests7(), pureTests8(), pureTests9(), pureTestsBundle());
  const fr = $('runFrame'), sb = fr.getAttribute('sandbox') || '';
  T.push({ n: 'sandbox بلا allow-same-origin', ok: sb.indexOf('allow-same-origin') < 0 });
  T.push({ n: 'sandbox يحتفظ بـ allow-scripts وallow-modals وallow-forms وallow-popups', ok: ['allow-scripts', 'allow-modals', 'allow-forms', 'allow-popups'].every(x => sb.indexOf(x) > -1) });
  // اختبار حيّ: إطار معزول يحاول الوصول للتطبيق
  const live = await new Promise(res => {
    const id = 'st' + Date.now(), f = document.createElement('iframe');
    f.setAttribute('sandbox', sb); f.style.cssText = 'position:absolute;width:0;height:0;border:0;opacity:0';
    let done = false; const fin = v => { if (done) return; done = true; window.removeEventListener('message', on); f.remove(); res(v); };
    const on = e => { if (e.source === f.contentWindow && e.data && e.data.__st === id) fin(e.data.r); };
    window.addEventListener('message', on); setTimeout(() => fin(null), 3500);
    const code = 'var r={};try{parent.document;r.doc="leak"}catch(e){r.doc="blocked"}' +
      'try{parent.document.title="x";r.edit="leak"}catch(e){r.edit="blocked"}' +
      'try{var q=parent.indexedDB.open("codepatcher");r.idb="leak"}catch(e){r.idb="blocked"}' +
      'try{localStorage.setItem("a","1");r.ls=localStorage.getItem("a")}catch(e){r.ls="error"}' +
      'try{indexedDB.open("x");r.own="open"}catch(e){r.own="error"}' +
      'console.log("hi");parent.postMessage({__st:"' + id + '",r:r},"*");';
    f.srcdoc = withHook('<!doctype html><html><head></head><body><script>' + code + '<\/script></body></html>'); document.body.appendChild(f);
  });
  if (!live) T.push({ n: 'اختبار العزل الحي (لم يصل رد خلال 3.5 ثانية)', ok: false });
  else {
    T.push({ n: 'العزل: parent.document مرفوض', ok: live.doc === 'blocked' });
    T.push({ n: 'العزل: تعديل واجهة المحرر مرفوض', ok: live.edit === 'blocked' });
    T.push({ n: 'العزل: IndexedDB التطبيق مرفوض', ok: live.idb === 'blocked' });
    T.push({ n: 'العزل: مشروع يستخدم localStorage يعمل', ok: live.ls === '1' });
    T.push({ n: 'العزل: IndexedDB داخل المعاينة يعطي خطأً واضحاً', ok: live.own === 'error' });
  }
  const pass = T.filter(x => x.ok).length, bad = T.filter(x => !x.ok);
  const pct = Math.round(pass / T.length * 100);
  ui.show('<h3>الاختبار الذاتي: ' + pass + '/' + T.length + ' (' + pct + '%)</h3>' +
    (bad.length ? bad.map(x => `<div class='issue'><b class="fail-tag">فشل</b><span>${esc(x.n)}</span></div>`).join('') : '<div class="issue"><b>كل الاختبارات ناجحة</b></div>') +
    '<details class="st-details"><summary>التفاصيل</summary>' + T.map(x => `<div class="st-row">${x.ok ? '✓' : '✗'} ${esc(x.n)}</div>`).join('') + '</details><button type="button" class="btn" data-ui="cancel">إغلاق</button>');
  log(bad.length ? 'err' : 'ok', 'اختبار ذاتي: ' + pass + '/' + T.length);
}

/* ===== v26b: ترميز، نهاية السطر، أحرف خفية، منظّف اللصق، حارس الكسل ===== */

/* ===== اختبارات H2 ===== */
/* ===== اختبارات R6 ===== */

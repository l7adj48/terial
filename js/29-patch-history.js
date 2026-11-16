'use strict';
/* سجل الباتشات (يلفّ runPatchEngine/applyPatch — يبقى أخيراً) */
/* ===== سجل الباتشات ===== */
let PH = [], phQ = Promise.resolve(), phEv = null;
function phSave() { if (store.mode !== 'idb') return; const snap = JSON.parse(JSON.stringify(PH)); phQ = phQ.then(() => new Promise(res => { try { const tx = store.db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(snap, 'phist'); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; } catch (e) { res(); } })); }
async function loadPH() { try { if (store.mode === 'idb') { const v = await store.req('meta', m => m.get('phist')); if (Array.isArray(v)) PH = v; } } catch (e) { } }
{
  const rpe = runPatchEngine; runPatchEngine = function () { const ev = rpe.apply(this, arguments); phEv = ev; return ev; };
  const ap = applyPatch;
  applyPatch = function () {
    const txt = $('patchInput').value; phEv = null; const r = ap.apply(this, arguments); const ev = phEv;
    if (ev && txt.trim() && txt.length < 400000) {
      const done = !ev.blocked && ev.changed.length && ev.changed.every(k => { const f = files.find(x => x.name === k); return f && f.content === ev.work[k]; });
      const c = k => ev.results.filter(x => x.status === k).length;
      PH.unshift({ t: Date.now(), txt, st: done ? 'applied' : 'rejected', ok: c('applied'), bad: c('failed'), sk: c('skipped'), rj: c('rejected'), fl: ev.changed.slice(0, 4) });
      if (PH.length > 40) PH.length = 40; phSave();
    }
    return r;
  };
}
function showPH() {
  if (!PH.length) return toast('السجل فارغ — يُسجَّل كل باتش تضغط عليه «تطبيق»', '');
  const rows = PH.map((h, i) => `<div class="issue"><b>${h.st === 'applied' ? '✓ طُبّق' : '✗ مرفوض/لم يُطبَّق'}</b> — ${esc(new Date(h.t).toLocaleString('ar'))}<div class="slabel">ناجح ${h.ok} · فشل ${h.bad} · متخطّى ${h.sk}${h.rj ? ' · مرفوض ' + h.rj : ''}${h.fl.length ? ' — ' + esc(h.fl.join('، ')) : ''}</div><div class="slabel ltr-text">${esc(h.txt.replace(/\s+/g, ' ').slice(0, 80))}</div><div class="srow"><button type="button" class="btn primary" data-act="ph_use" data-i="${i}">أعِد للّصق</button><button type="button" class="btn" data-act="ph_del" data-i="${i}">حذف</button></div></div>`).join('');
  ui.show('<h3>سجل الباتشات</h3>' + uiScroll(rows, 'lg') + '<button type="button" class="btn" data-ui="cancel">إغلاق</button>', (a, el) => {
    const i = +el.dataset.i;
    if (a === 'ph_use' && PH[i]) { const ta = $('patchInput'); ta.value = PH[i].txt; ta.dispatchEvent(new Event('input')); ui.close(null); switchTab('p-patch'); toast('أُعيد الباتش إلى خانة اللصق — اضغط معاينة', 'ok'); }
    else if (a === 'ph_del') { PH.splice(i, 1); phSave(); ui.close(null); setTimeout(showPH, 120); }
  });
}

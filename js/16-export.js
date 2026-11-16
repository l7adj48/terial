'use strict';
/* نافذة التصدير والإصدار التلقائي */
/* ===== التصدير: نافذة اسم + رقم إصدار تلقائي لكل اسم ===== */
function commonRoot(list) {
  list = list || files; if (!list.length) return '';
  const tops = new Set(list.map(f => f.name.includes('/') ? f.name.split('/')[0] : null));
  return (tops.size === 1 && !tops.has(null)) ? [...tops][0] : '';
}
function cleanName(v) {
  return String(v || '').replace(/\.zip$/i, '').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').replace(/^\.+/, '').slice(0, 80);
}
async function exportZip(pre, only, fixed, mode, binDirs) {
  const c = cur(); if (c) c.content = editor.value;
  const set = only || files.filter(f => !pre || f.name.startsWith(pre + '/'));
  if (!set.length) return toast('لا ملفات للتصدير', 'err');
  const base = cleanName(pre ? pre.split('/').pop() : only ? (commonRoot(only) || 'selection') : commonRoot()) || 'project';
  const ver = ((S.exportVer && S.exportVer[base]) || 0) + 1, def = base + '-v' + ver;
  const ans = fixed != null ? fixed : await ui.prompt('اسم ملف التصدير (يُضاف .zip تلقائياً)', def, 'تصدير');
  if (ans == null) return;
  const name = cleanName(ans) || def, m = /^(.*)-v(\d+)$/.exec(name);
  if (m && m[1]) { S.exportVer = S.exportVer || {}; S.exportVer[m[1]] = Math.max(S.exportVer[m[1]] || 0, +m[2]); scheduleSave(); }
  const cutAt = pre ? pre.lastIndexOf('/') + 1 : 0;   // تصدير مجلد: يبقى المجلد نفسه جذراً داخل الأرشيف
  const verSigNow = mode === 'ver' ? verSig() : null, enc = new TextEncoder(), seen = new Set();
  const entries = set.filter(f => { if (seen.has(f.name)) return false; seen.add(f.name); return true; })
    .map(f => ({ name: f.name.replace(/^\/+/, '').slice(cutAt), data: enc.encode(withEol(f)) }));
  if (mode === 'ver' && !pre && !only && hasHist()) entries.push({ name: '.codepatcher/history.json', data: enc.encode(JSON.stringify(histPack())) });
  if (!only) BIN.forEach((u8, n) => { if (!pre || n.startsWith(pre + '/')) entries.push({ name: n.replace(/^\/+/, '').slice(cutAt), data: u8 }); });
  if (only && binDirs && binDirs.length) BIN.forEach((u8, n) => { if (binDirs.some(d => n.startsWith(d + '/'))) entries.push({ name: n.replace(/^\/+/, '').slice(cutAt), data: u8 }); });
  const zblob = await zipC(entries);
  const zfile = (typeof File === 'function') ? new File([zblob], name + '.zip', { type: 'application/zip' }) : null;
  const touch = !!(window.matchMedia && matchMedia('(pointer:coarse)').matches);
  const canPick = !!window.showSaveFilePicker && window.self === window.top;
  const pickSave = async (reuse) => {
    try {
      const h = (reuse && projHandle) ? projHandle : await showSaveFilePicker({ suggestedName: name + '.zip', types: [{ description: 'ZIP', accept: { 'application/zip': ['.zip'] } }] });
      const w = await h.createWritable(); await w.write(zblob); await w.close(); if (mode === 'ver') { projHandle = h; verMark(verSigNow); }
      toast('تم حفظ ' + entries.length + ' ملف: ' + name + '.zip', 'ok');
      return 'ok';
    } catch (e) { if (reuse && projHandle) { projHandle = null; return pickSave(false); } return e && e.name === 'AbortError' ? 'abort' : 'fail'; }
  };
  if (mode == null || mode === 'pick' || mode === 'ver') {
    if (canPick) { const r = await pickSave(mode === 'ver'); if (r !== 'fail') return; }
  }
  if (zfile && (mode === 'share' || (mode == null && touch))) {
    const r = await tryShare(zfile, name);
    if (r === 'ok') return toast('اخترت المكان من قائمة المشاركة: ' + name + '.zip', 'ok');
    if (r === 'abort') return;
    if (canPick) { const r2 = await pickSave(); if (r2 !== 'fail') return; }
    toast(r === 'fail' ? 'تعذّر فتح قائمة المشاركة — سيُنزَّل الملف إلى مجلد التنزيلات' : noPickMsg(), 'err');
  }
  const url = URL.createObjectURL(zblob);
  const a = document.createElement('a'); a.href = url; a.download = name + '.zip'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  if (mode === 'ver') verMark(verSigNow);
  toast(mode === 'ver' ? 'نُزّل ' + name + '.zip بسجل الإصدارات — هذا المتصفح لا يكتب فوق الملف نفسه، فقد يُضاف (1) للاسم' : 'تم تصدير ' + entries.length + ' ملف: ' + name + '.zip', 'ok');
}
$('fileIn').addEventListener('change', async e => { const l = Array.from(e.target.files || []); e.target.value = ''; await ingest(l); });
async function tryShare(file, title) {
  try { if (!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] }))) return 'na'; await navigator.share({ files: [file], title }); return 'ok'; }
  catch (e) { return e && e.name === 'AbortError' ? 'abort' : 'fail'; }
}
const FS_OK = (() => { try { return 'showSaveFilePicker' in window && window.self === window.top; } catch (e) { return false; } })();
async function writeHandle(h, text) { const w = await h.createWritable(); await w.write(text); await w.close(); }
function markSaved(f) { f.baseline = f.content; f.dirtySave = true; markDirty(); render(); scheduleSave(); }
async function saveToDevice(asNew) {
  const f = cur(); if (!f) return false; saveCursor();
  if (FS_OK) {
    try {
      let h = !asNew && f.handle;
      if (!h) h = await showSaveFilePicker({ suggestedName: f.name.split('/').pop() });
      await writeHandle(h, withEol(f));
      f.handle = h; markSaved(f); toast('حُفظ على الجهاز: ' + h.name, 'ok'); return true;
    } catch (e) { if (e && e.name === 'AbortError') return false; f.handle = null; toast('تعذّر الحفظ المباشر، سيُنزَّل الملف بدلاً منه', 'err'); }
  }
  const body = withEol(f), sf = (typeof File === 'function') ? new File([body], f.name.split('/').pop(), { type: 'text/plain' }) : null;
  if (sf) { const r = await tryShare(sf, sf.name); if (r === 'ok') { markSaved(f); toast('اخترت المكان من قائمة المشاركة', 'ok'); return true; } if (r === 'abort') return false; }
  downloadFile(); markSaved(f); toast(SECURE ? 'هذا المتصفح لا يسمح باختيار المكان — نُزِّل الملف إلى مجلد التنزيلات' : noPickMsg(), 'ok'); return true;
}
async function saveFile() {
  const f = cur(); if (!f) return toast('لا يوجد ملف', 'err');
  saveCursor();
  if (f.handle || FS_OK) return saveToDevice(false);
  markSaved(f); toast('حُفظ داخل التطبيق فقط — متصفحك لا يدعم الكتابة على ملفات الجهاز. للحصول على ملف: حفظ باسم ← تنزيل', 'ok');
}
function saveCopyAs(name) {
  const f = cur(); if (!f) return; saveCursor(); const text = editor.value;
  let t = files.find(x => x.name === name);
  if (t) { snapNow('قبل الحفظ فوق ' + name); t.content = text; t.baseline = text; t.undo = []; t.redo = []; t.cursor = 0; t.scroll = 0; }
  else { t = makeFile(name, text, text); files.push(t); }
  t.eol = f.eol; t.enc = f.enc; t.dirtySave = true;
  activeId = t.id; expandTo(name); render(); scheduleSave(); toast('حُفظ في ' + name, 'ok');
}
function allFolders() { const set = new Set(); files.forEach(f => { const p = f.name.split('/'); p.pop(); for (let i = 1; i <= p.length; i++) set.add(p.slice(0, i).join('/')); }); return [...set].sort(); }
function folderRows(list, sel) { return list.map((p, i) => `<div class="issue${p === sel ? ' sel' : ''}" data-act="fold" data-i="${i}"><b>${p ? esc(p) : '/ (جذر المشروع)'}</b></div>`).join(''); }
function modifiedCount() { const c = cur(); if (c) c.content = editor.value; return files.filter(f => f.content !== f.baseline).length; }
function saveAll() { const c = cur(); if (c) c.content = editor.value; let n = 0; files.forEach(f => { if (f.content !== f.baseline) { if (f.handle) writeHandle(f.handle, withEol(f)).catch(() => { f.handle = null; }); f.baseline = f.content; f.dirtySave = true; n++; } }); markDirty(); render(); scheduleSave(); toast(n ? 'حُفظ ' + n + ' ملف' : 'لا تغييرات للحفظ', 'ok'); }
function saveMenu() {
  const f = cur(); if (!f) return toast('لا يوجد ملف', 'err');
  const n = modifiedCount();
  const I = x => '<svg class="ic" aria-hidden="true"><use href="#i-' + x + '"/></svg> ';
  ui.show('<h3>' + I('save') + esc(f.name.split('/').pop()) + '</h3>' +
    uiRow('same', 'save', 'حفظ') +
    uiRow('as', 'save', 'حفظ في…') +
    (n > 1 ? uiRow('all', 'check-all', 'حفظ الكل (' + n + ')') : ''), act => {
    if (act === 'same') { ui.close(null); return saveFile(); }
    if (act === 'all') { ui.close(null); return saveAll(); }
    if (act === 'as') return saveAsDialog();
    if (act === 'dev') { ui.close(null); return saveToDevice(true); }
  });
}
function childFolders(path, extra) { const all = new Set(allFolders().concat(extra)), out = []; all.forEach(p => { const i = p.lastIndexOf('/'); if ((i < 0 ? '' : p.slice(0, i)) === path) out.push(p); }); return out.sort(); }
function saveAsDialog() {
  const f = cur(); if (!f) return;
  const slash = f.name.lastIndexOf('/'), base = f.name.slice(slash + 1), dot = base.lastIndexOf('.');
  let path = slash > 0 ? f.name.slice(0, slash) : '', nameVal = dot > 0 ? base.slice(0, dot) + '-copy' + base.slice(dot) : base + '-copy', extra = [], kids = [];
  const draw = () => {
    kids = childFolders(path, extra);
    ui.show('<h3>حفظ باسم</h3><div class="slabel">الاسم</div><input type="text" id="saName" dir="ltr" value="' + esc(nameVal) + '">' +
      '<div class="slabel ltr-text" dir="ltr">📁 /' + esc(path) + '</div>' +
      (path ? '<div class="issue" data-act="up"><b>.. (للأعلى)</b></div>' : '') +
      kids.map((k, i) => `<div class="issue" data-act="open" data-i="${i}"><b>📁 ${esc(k.slice(k.lastIndexOf('/') + 1))}</b></div>`).join('') +
      (kids.length || path ? '' : '<div class="slabel">لا مجلدات — سيُحفظ في جذر المشروع</div>') +
      '<button type="button" class="btn" data-act="nf">+ مجلد</button><div class="srow"><button type="button" class="btn primary" data-act="go">حفظ</button><button type="button" class="btn" data-ui="cancel">إلغاء</button></div>', async (act, el) => {
        const inp = $('saName'); if (inp) nameVal = inp.value;
        if (act === 'dev') { ui.close(null); return saveToDevice(true); }
        if (act === 'up') { path = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''; return draw(); }
        if (act === 'open') { path = kids[+el.dataset.i]; return draw(); }
        if (act === 'nf') { const n = await ui.prompt('اسم المجلد الجديد', '', 'إنشاء'); const c = n && n.trim().replace(/^\/+|\/+$/g, '').replace(/\//g, '-'); if (c) { path = (path ? path + '/' : '') + c; extra.push(path); } return draw(); }
        if (act === 'go') {
          const nn = nameVal.trim().replace(/^\/+/, ''); if (!nn) return toast('اكتب اسماً', 'err');
          const full = (path ? path + '/' : '') + nn;
          if (full === f.name) { ui.close(null); return saveFile(); }
          if (files.some(x => x.name === full) && !(await ui.confirm('الملف ' + full + ' موجود. استبدال محتواه؟ (تُحفظ نقطة استرجاع قبله)', 'استبدال'))) return draw();
          ui.close(null); saveCopyAs(full);
        }
      });
  };
  draw();
}
function exportDialog() {
  const c = cur(); if (c) c.content = editor.value;
  if (!files.length) return toast('لا ملفات للتصدير', 'err');
  const I = n => '<svg class="ic" aria-hidden="true"><use href="#i-' + n + '"/></svg> ';
  let sel = '', nameVal = '', list = [];
  const defName = () => { const b = cleanName(sel ? sel.split('/').pop() : commonRoot()) || 'project'; return b + '-v' + (((S.exportVer && S.exportVer[b]) || 0) + 1); };
  const count = () => {
    const nf = files.filter(f => !sel || f.name.startsWith(sel + '/')).length;
    let nb = 0; BIN.forEach((u, n) => { if (!sel || n.startsWith(sel + '/')) nb++; });
    return nf + ' ملف' + (nb ? ' + ' + nb : '');
  };
  nameVal = defName();
  const canShare = typeof navigator.canShare === 'function', canPick = !!window.showSaveFilePicker;
  const draw = () => {
    list = [''].concat(allFolders());
    ui.show('<h3>' + I('export') + 'ZIP ' + uiSub('· ' + count()) + '</h3>' +
      '<input type="text" id="exName" dir="ltr" value="' + esc(nameVal) + '">' +
      (list.length > 1 ? uiScroll(folderRows(list, sel).replace('/ (جذر المشروع)', 'المشروع كله'), 'sm') : '') +
      (canPick ? uiRow('go', 'save', 'حفظ في…') : '') +
      (canShare ? uiRow('share', 'external', 'مشاركة') : '') +
      uiRow('dl', 'arrow-down', 'تنزيل') +
      uiRow('bundle', 'file-md', 'نص واحد للذكاء الاصطناعي') +
      uiRow('gh', 'github', 'دفع إلى GitHub') +
      uiRow('one', 'file', 'هذا الملف فقط (بدون ZIP)'), (act, el) => {
        if (act === 'one') { ui.close(null); return saveToDevice(true); }
        if (act === 'gh') { ui.close(null); return void setTimeout(githubDialog, 120); }
        if (act === 'bundle') { const s = sel; ui.close(null); return void setTimeout(() => exportBundleDialog(s), 120); }
        const inp = $('exName'); if (inp) nameVal = inp.value;
        if (act === 'fold') { const old = defName(); sel = list[+el.dataset.i]; if (nameVal === old) nameVal = defName(); return draw(); }
        if (act === 'go' || act === 'share' || act === 'dl') { const n = nameVal; ui.close(null); return exportZip(sel || null, null, n, act === 'share' ? 'share' : act === 'dl' ? 'download' : null); }
      });
  };
  draw();
}
function downloadFile() {
  const f = cur(); if (!f) return toast('لا يوجد ملف', 'err');
  saveCursor();
  const url = URL.createObjectURL(new Blob([withEol(f)], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a'); a.href = url; a.download = f.name.split('/').pop(); a.style.display = 'none';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('نُزّل الملف', 'ok');
}

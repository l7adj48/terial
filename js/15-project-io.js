'use strict';
/* فتح المشاريع وZIP */
/* ===== فتح المشاريع (ZIP / عدة ملفات / مجلد) وتصدير ZIP ===== */
const SKIP_PATH = /(^|\/)(__MACOSX|node_modules|\.git|\.idea|\.vscode)(\/|$)|(^|\/)\.DS_Store$|(^|\/)Thumbs\.db$/;
const MAX_FILE = 3 * 1024 * 1024, MAX_COUNT = 600;
const BIN = new Map(); let binQ = Promise.resolve(), binAdded = 0;
function binSave() { if (store.mode !== 'idb') return; const o = {}; BIN.forEach((u, n) => { o[n] = u; }); binQ = binQ.then(() => new Promise(res => { try { const tx = store.db.transaction('meta', 'readwrite'); tx.objectStore('meta').put(o, 'bins'); tx.oncomplete = res; tx.onerror = res; tx.onabort = res; } catch (e) { res(); } })); }
async function loadBins() { try { if (store.mode === 'idb') { const o = await store.req('meta', m => m.get('bins')); if (o) Object.keys(o).forEach(n => BIN.set(n, o[n])); } } catch (e) { } }
function bytesToText(u8) {
  bytesToText.meta = null;
  bytesToText.why = '';
  if (u8.length > MAX_FILE) { bytesToText.why = 'أكبر من 3MB'; return null; }
  const n = Math.min(u8.length, 8000), isU16 = (u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF);
  if (!isU16) for (let i = 0; i < n; i++) if (u8[i] === 0) { bytesToText.why = 'ملف ثنائي'; return null; }
  const d = decodeBytes(u8); if (!d) { bytesToText.why = 'ترميز غير معروف'; return null; }
  bytesToText.meta = { enc: d.enc, eol: detectEol(d.text) };
  return nl(d.text);
}
async function inflateRaw(u8) {
  if (typeof DecompressionStream === 'undefined') throw new Error('المتصفح لا يدعم فك الضغط');
  const stream = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
function readZipEntries(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf), out = [];
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) { if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; } }
  if (e < 0) throw new Error('ملف ZIP غير صالح');
  const total = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
  const dec = new TextDecoder('utf-8');
  for (let k = 0; k < total; k++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const flag = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    out.push({
      name,
      async get() {
        if ((flag & 1) || csize === 0xFFFFFFFF || off === 0xFFFFFFFF) return null;
        if (dv.getUint32(off, true) !== 0x04034b50) return null;
        const st = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(st, st + csize);
        if (method === 0) return data;
        if (method === 8) return inflateRaw(data);
        return null;
      }
    });
  }
  return out;
}
async function zipToItems(file) {
  const ents = readZipEntries(await file.arrayBuffer()).filter(e => e.name && !e.name.endsWith('/') && !SKIP_PATH.test(e.name));
  const strip = ents.length > 0 && ents.every(e => e.name.includes('/')) && new Set(ents.map(e => e.name.split('/')[0])).size === 1;
  const items = [], bins = []; let skipped = 0, hist = null;
  for (const e of ents.slice(0, MAX_COUNT)) {
    if (items.length % 20 === 0) { toast('فك الضغط ' + items.length + ' / ' + ents.length); await new Promise(r => setTimeout(r, 0)); } const u8 = await e.get(); if (u8 && (strip ? e.name.slice(e.name.indexOf('/') + 1) : e.name) === '.codepatcher/history.json') { try { hist = JSON.parse(new TextDecoder().decode(u8)); } catch (_) { } continue; } const t = u8 ? bytesToText(u8) : null;
    if (t == null) { if (u8) { bins.push({ name: strip ? e.name.slice(e.name.indexOf('/') + 1) : e.name, u8 }); continue; } skipped++; importSkips.push({ n: e.name, w: 'تعذر فك الضغط' }); continue; }
    items.push({ name: strip ? e.name.slice(e.name.indexOf('/') + 1) : e.name, content: t, eol: bytesToText.meta.eol, enc: bytesToText.meta.enc });
  }
  if (ents.length > MAX_COUNT) { skipped += ents.length - MAX_COUNT; importSkips.push({ n: '(' + (ents.length - MAX_COUNT) + ' ملف)', w: 'تجاوز حد ' + MAX_COUNT + ' ملف' }); }
  return { items, skipped, bins, hist };
}
async function addItems(items, wipe) { const snap = {}; files.forEach(f => { snap[f.name] = f.content; }); const n = await addItemsRaw(items, wipe); if (n && !wipe) { const b = []; items.forEach(it => { const f = files.find(x => x.name === it.name); if (!f) return; b.push(it.name in snap ? { id: f.id, before: snap[it.name], after: it.content } : { id: f.id, isNew: true, after: it.content }); }); lastBatch = { items: b }; } return n; } async function addItemsRaw(items, wipe) {
  const clash = wipe ? [] : items.filter(it => files.some(f => f.name === it.name && f.content !== it.content));
  if (clash.length && !(await ui.confirm('سيُستبدل ' + clash.length + ' ملف موجود بنفس الاسم. متابعة؟', 'استبدال'))) return 0;
  if (clash.length) snapNow('قبل استيراد يستبدل');
  const nonU = items.filter(it => it.enc && it.enc !== 'utf-8');
  if (nonU.length && !(await ui.confirm(nonU.length + ' ملف بترميز غير UTF-8 (' + nonU.slice(0, 3).map(x => x.name.split('/').pop() + ': ' + x.enc).join('، ') + ') — سيُفتح سليماً ويُحفظ بـ UTF-8. متابعة؟', 'تحويل'))) return 0;
  if (wipe) { snapNow('قبل مشروع جديد'); resetProject(false); wipe.forEach((u, k) => { if (BIN.get(k) === u) BIN.delete(k); }); binSave(); }
  let first = null;
  items.forEach(it => {
    const f = files.find(x => x.name === it.name);
    let tgt = f;
    if (f) { f.eol = it.eol; f.enc = it.enc; f.content = it.content; f.undo = []; f.redo = []; f.cursor = 0; f.scroll = 0; f.dirtySave = true; }
    else { tgt = makeFile(it.name, it.content, it.content); tgt.eol = it.eol; tgt.enc = it.enc; files.push(tgt); }
    if (!first || /(^|\/)index\.html?$/i.test(it.name)) first = tgt;
  });
  if (first) activeId = first.id;
  render(); scheduleSave();
  return items.length;
}
async function ingest(list) {
  importSkips = []; binAdded = 0; histIn = null; const wipe = newProjWipe ? new Map(BIN) : null; newProjWipe = false; saveCursor(); const items = []; let skipped = 0;
  for (const file of list) {
    const nm = file.name.toLowerCase();
    try {
      if (/\.zip$/.test(nm)) { const r = await zipToItems(file); if (r.hist) histIn = r.hist; const pn = await ui.prompt('اسم المشروع (داخل المجلد المفتوح إن وُجد)', (!wipe && treeCwd ? treeCwd + '/' : '') + file.name.replace(/\.zip$/i, ''), 'استيراد'); if (pn == null) continue; const pre = pn.trim().split('/').filter(Boolean).join('/'); r.items.forEach(it => items.push({ name: pre ? pre + '/' + it.name : it.name, content: it.content, eol: it.eol, enc: it.enc })); r.bins.forEach(b => { BIN.set(pre ? pre + '/' + b.name : b.name, b.u8); binAdded++; }); skipped += r.skipped; }
      else if (/\.(rar|7z|tar|gz|tgz|bz2|xz)$/.test(nm)) { toast('هذا النوع غير مدعوم (' + file.name + ') — حوّله إلى ZIP', 'err'); }
      else {
        const wr = file.webkitRelativePath || ''; if (wr && SKIP_PATH.test(wr)) { skipped++; continue; } const rel = wr;
        const u8 = new Uint8Array(await file.arrayBuffer()), t = bytesToText(u8);
        if (t != null && BUNDLE_HEAD.test(t.slice(0, 200)) && await ui.confirm('«' + file.name + '» حزمة نصية من CodePatcher — توليد ملفات المشروع منها؟ (إلغاء = فتحه كملف عادي)', 'توليد الملفات')) { await importBundleText(t, !!wipe); continue; }
        const dst = (!wipe && treeCwd ? treeCwd + '/' : '') + (rel || file.name); if (t == null) { BIN.set(dst, u8); binAdded++; } else items.push({ name: dst, content: t, eol: bytesToText.meta.eol, enc: bytesToText.meta.enc });
      }
    } catch (err) { toast('تعذر قراءة ' + file.name + ' — ' + (err && err.message || ''), 'err'); }
  }
  if (!items.length) { if (binAdded) { binSave(); toast('حُفظ ' + binAdded + ' ملف ثنائي (صور وغيرها) وسيُصدَّر مع المشروع', 'ok'); return; } if (skipped) toast('لا ملفات نصية (تخطّي ' + skipped + ' ثنائي/كبير)', 'err'); return; }
  const n = await addItems(items, wipe);
  if (n && histIn) await maybeAdopt(histIn, !!wipe);
  if (binAdded) binSave();
  if (n) { toast('تم فتح ' + n + ' ملف' + (binAdded ? ' + ' + binAdded + ' ثنائي محفوظ' : '') + (skipped ? ' — تخطّي ' + skipped + ' ثنائي/كبير/مُتجاهل' : '') + ' — للتراجع: تبويب باتشات', 'ok'); if (importSkips.length) setTimeout(showImportReport, 400); log('ok', 'فتح مشروع: ' + n + ' ملف، تخطّي ' + skipped); }
}
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function deflateRaw(u8) { const st = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw')); return new Uint8Array(await new Response(st).arrayBuffer()); }
async function zipC(entries) {
  if (typeof CompressionStream === 'undefined') return makeZip(entries);
  for (const en of entries) { if (en.data.length < 64) continue; try { const c = await deflateRaw(en.data); if (c.length < en.data.length * 0.95) { en.cdata = c; } } catch (e) { } }
  return makeZip(entries);
}
function makeZip(entries) {
  const enc = new TextEncoder(), parts = [], cd = []; let off = 0, cdSize = 0;
  const d = new Date(), time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  entries.forEach(en => {
    const nm = enc.encode(en.name), crc = crc32(en.data), sz = en.data.length, cz = en.cdata ? en.cdata.length : sz, mt = en.cdata ? 8 : 0;
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, mt, true); lh.setUint16(10, time, true); lh.setUint16(12, date, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, cz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true);
    parts.push(lh.buffer, nm, en.cdata || en.data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, mt, true); ch.setUint16(12, time, true); ch.setUint16(14, date, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, cz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
    cd.push(ch.buffer, nm); cdSize += 46 + nm.length; off += 30 + nm.length + cz;
  });
  const eo = new DataView(new ArrayBuffer(22));
  eo.setUint32(0, 0x06054b50, true); eo.setUint16(8, entries.length, true); eo.setUint16(10, entries.length, true); eo.setUint32(12, cdSize, true); eo.setUint32(16, off, true);
  return new Blob([...parts, ...cd, eo.buffer], { type: 'application/zip' });
}

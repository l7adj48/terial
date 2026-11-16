'use strict';
/* محرك الباتشات (parse / match / evaluate) */
/* ---------- Patch engine ---------- */
function makeError(code, title, o) {
  o = o || {};
  return { code, title, message: o.message || '', patchIndex: o.patchIndex, action: o.action, searchText: o.searchText, file: o.file, intended: o.intended, similarMatch: o.similarMatch, similarLine: o.similarLine, suggestion: o.suggestion, severity: o.severity || 'error' };
}
function locateHint(content, find) {
  const ls = String(find).split('\n').map(s => s.trim()).filter(s => s.length >= 6).sort((a, b) => b.length - a.length).slice(0, 6);
  for (const s of ls) { const i = content.indexOf(s); if (i >= 0) return { text: s, line: lineOf(content, i) }; }
  return null;
}
function findNearMatch(content, text) {
  if (!text) return null;
  const ci = content.toLowerCase().indexOf(text.toLowerCase());
  if (ci >= 0) return { type: 'case', text: content.substring(ci, ci + text.length), index: ci };
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try { const m = content.match(new RegExp(escaped.replace(/\s+/g, '\\s+'), 'i')); if (m) return { type: 'whitespace', text: m[0], index: m.index }; } catch (e) { }
  if (text.length > 40) { const hi = content.indexOf(text.substring(0, 40)); if (hi >= 0) return { type: 'partial', text: content.substring(hi, hi + text.length), index: hi }; }
  return null;
}
function stripFences(s) { return s.replace(/^\s*```[a-zA-Z]*[ \t]*\n?/, '').replace(/\n?```\s*$/, ''); }
function repairJSON(raw) {
  let out = '', inStr = false, esc = false;
  for (const ch of raw) {
    if (inStr) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { out += ch; inStr = false; continue; }
      if (ch === '\n') { out += '\\n'; continue; }
      if (ch === '\r') { continue; }
      if (ch === '\t') { out += '\\t'; continue; }
      out += ch;
    } else {
      if (ch === '"') inStr = true;
      if (ch === ']' || ch === '}') out = out.replace(/,\s*$/, '');
      out += ch;
    }
  }
  return out;
}
function jsonErrLoc(s, e) {
  const m = String(e && e.message); let line = null;
  const lm = m.match(/line\s+(\d+)/i);
  if (lm) line = +lm[1];
  else { const pm = m.match(/position\s+(\d+)/i); if (pm) line = s.slice(0, +pm[1]).split('\n').length; }
  return line ? ' (سطر ' + line + ')' : '';
}
function parsePatches(raw) {
  const s = stripFences(String(raw || '').trim());
  if (!s) throw makeError('EMPTY', 'لم تُدخل باتشاً');
  let data, repaired = false, cleaned = false;
  try { data = JSON.parse(s); }
  catch (e1) {
    try { data = JSON.parse(repairJSON(s)); repaired = true; }
    catch (e2) { try { data = JSON.parse(repairJSON(cleanPatchText(s))); repaired = true; cleaned = true; } catch (e3) { throw makeError('JSON_PARSE_ERROR', 'خطأ في صيغة JSON', { message: e1.message + jsonErrLoc(s, e1) }); } }
  }
  if (data && !Array.isArray(data) && Array.isArray(data.patches)) data = data.patches;
  if (!Array.isArray(data)) data = [data];
  if (!data.length) throw makeError('EMPTY', 'الباتش فارغ');
  return { patches: data, repaired, cleaned };
}
function findMatches(hay, needle, flex) {
  const out = []; let i = 0;
  while ((i = hay.indexOf(needle, i)) !== -1) { out.push({ i, len: needle.length }); i += Math.max(1, needle.length); }
  if (out.length || !flex) return { list: out, flex: false };
  const t = needle.trim(); if (!t) return { list: [], flex: false };
  const parts = t.split(/\s+/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  let re; try { re = new RegExp(parts.join('\\s+'), 'g'); } catch (e) { return { list: [], flex: false }; }
  let m;
  while ((m = re.exec(hay))) { out.push({ i: m.index, len: m[0].length }); if (!m[0].length) re.lastIndex++; }
  return { list: out, flex: out.length > 0 };
}
function alreadyDone(w, m, act, nt, ft) {
  if (!nt) return false;
  if (act === 'insert_after') return w.substr(m.i + m.len, nt.length) === nt;
  if (act === 'insert_before') return m.i >= nt.length && w.substr(m.i - nt.length, nt.length) === nt;
  if (act === 'replace') {
    let o = -1;
    while ((o = nt.indexOf(ft, o + 1)) !== -1) { if (m.i - o >= 0 && w.substr(m.i - o, nt.length) === nt) return true; }
  }
  return false;
}
const ACTIONS = ['replace', 'insert_after', 'insert_before', 'append', 'prepend', 'delete'];
const NEEDS_FIND = ['replace', 'insert_after', 'insert_before', 'delete'];
const NEEDS_NEW = ['replace', 'insert_after', 'insert_before', 'append', 'prepend'];

function evaluatePatches(content, patches, opts) {
  opts = opts || {};
  const results = []; let working = content;
  patches.forEach((p, i) => {
    const n = i + 1; let act = 'replace';
    const push = (status, extra) => results.push(Object.assign({ n, action: act, status }, extra || {}));
    const fail = (code, title, o) => push('failed', { error: makeError(code, title + ' #' + n, Object.assign({ patchIndex: n, action: act }, o || {})) });

    if (!p || typeof p !== 'object' || Array.isArray(p)) return fail('PATCH_INVALID', 'باتش غير صالح', { message: 'يجب أن يكون الباتش كائناً' });
    if (p.action !== undefined) {
      if (typeof p.action !== 'string') return fail('PATCH_ACTION', 'حقل action غير صالح');
      act = p.action.trim().toLowerCase();
    }
    if (!ACTIONS.includes(act)) return fail('PATCH_ACTION', 'عملية غير معروفة', { message: 'المتاح: ' + ACTIONS.join(', ') });
    const find = typeof p.find === 'string' ? nl(p.find) : '';
    const rawNew = typeof p.replace === 'string' ? p.replace : (typeof p.content === 'string' ? p.content : null);
    const hasNew = rawNew !== null, nt = hasNew ? nl(rawNew) : '';
    if (NEEDS_FIND.includes(act) && !find) return fail('PATCH_INVALID', 'حقل find مفقود');
    if (NEEDS_NEW.includes(act) && !hasNew) return fail('PATCH_INVALID', 'حقل replace/content مفقود');

    if (act === 'append') {
      if (!nt || working.endsWith(nt)) return push('skipped', { reason: nt ? 'مطبق مسبقاً' : 'نص فارغ' });
      const bf0 = working, at0 = working.length; working += nt; return push('applied', { line: lineOf(working, working.length - nt.length), ex: { b: '', a: nt.slice(0, 1500) }, bf: bf0, ed: [{ at: at0, del: '', ins: nt }] });
    }
    if (act === 'prepend') {
      if (!nt || working.startsWith(nt)) return push('skipped', { reason: nt ? 'مطبق مسبقاً' : 'نص فارغ' });
      const bf0 = working; working = nt + working; return push('applied', { line: 1, ex: { b: '', a: nt.slice(0, 1500) }, bf: bf0, ed: [{ at: 0, del: '', ins: nt }] });
    }
    const res = findMatches(working, find, opts.flex);
    const list = res.list;
    const delLike = act === 'delete' || (act === 'replace' && nt === '');
    if (!list.length) {
      if (!delLike && nt.trim().length >= 8 && working.includes(nt)) return push('skipped', { reason: 'مطبق مسبقاً (النص الجديد موجود في سطر ' + lineOf(working, working.indexOf(nt)) + ' والنص القديم غير موجود)' });
      const near = findNearMatch(working, find);
      if (near) return fail('PATCH_NEAR_MISS', 'نص مشابه', { message: 'البحث الحرفي فشل، لكن وُجد نص مشابه في السطر ' + lineOf(working, near.index), searchText: find, similarMatch: near.text, similarLine: lineOf(working, near.index), suggestion: 'انسخ النص من المحرر حرفياً', severity: 'warn' });
      if (delLike) return push('skipped', { reason: 'غير موجود (محذوف مسبقاً؟)' });
      const hint = locateHint(working, find), nb = /[\u00A0\u200B-\u200F\uFEFF\u202A-\u202E]/.test(find) ? 'تحذير: النص المبحوث يحوي مسافة غير عادية (NBSP) أو حرفاً خفياً — استبدلها بمسافة عادية ثم أعد المحاولة.' : '';
      return fail('PATCH_NOT_FOUND', 'لم يُعثر على النص', Object.assign({ searchText: find, message: nb }, hint ? { similarMatch: hint.text, similarLine: hint.line, suggestion: 'وُجد سطر من النص المطلوب في سطر ' + hint.line + ' — افتحه في المحرر وعدّل يدوياً' } : {}));
    }
    const remaining = list.filter(m => !alreadyDone(working, m, act, nt, find));
    if (!remaining.length) return push('skipped', { reason: 'مطبق مسبقاً' });
    let targets;
    if (p.all === true) targets = remaining;
    else if (p.occurrence !== undefined) {
      const k = Number(p.occurrence);
      if (!Number.isInteger(k) || k < 1 || k > list.length) return fail('PATCH_OCCURRENCE', 'رقم occurrence غير صالح', { message: 'عدد التطابقات: ' + list.length, searchText: find });
      if (alreadyDone(working, list[k - 1], act, nt, find)) return push('skipped', { reason: 'مطبق مسبقاً' });
      targets = [list[k - 1]];
    } else if (remaining.length > 1) {
      const lines = remaining.slice(0, 8).map(m => lineOf(working, m.i)).join(', ');
      return fail('PATCH_AMBIGUOUS', 'النص مكرر', { message: 'وُجد ' + remaining.length + ' تطابقات (الأسطر: ' + lines + (remaining.length > 8 ? '…' : '') + ')', searchText: find, severity: 'warn', suggestion: 'اجعل find أطول ليصبح فريداً، أو أضف "all":true أو "occurrence":رقم' });
    } else targets = [remaining[0]];

    const sorted = targets.slice().sort((a, b) => a.i - b.i);
    const firstLine = lineOf(working, sorted[0].i);
    const exB = (act === 'insert_after' || act === 'insert_before') ? '' : working.substr(sorted[0].i, Math.min(sorted[0].len, 1500));
    const bfX = working, edX = sorted.map(m => act === 'insert_after' ? { at: m.i + m.len, del: '', ins: nt } : act === 'insert_before' ? { at: m.i, del: '', ins: nt } : act === 'delete' ? { at: m.i, del: working.substr(m.i, m.len), ins: '' } : { at: m.i, del: working.substr(m.i, m.len), ins: nt });
    sorted.reverse().forEach(m => {
      if (act === 'insert_after') working = working.slice(0, m.i + m.len) + nt + working.slice(m.i + m.len);
      else if (act === 'insert_before') working = working.slice(0, m.i) + nt + working.slice(m.i);
      else if (act === 'delete') working = working.slice(0, m.i) + working.slice(m.i + m.len);
      else working = working.slice(0, m.i) + nt + working.slice(m.i + m.len);
    });
    push('applied', { line: firstLine, count: targets.length, flex: res.flex, ex: { b: exB, a: nt.slice(0, 1500) }, bf: bfX, ed: edX });
  });
  return { results, output: working };
}
function diffRange(a, b) {
  const la = a.length, lb = b.length, m = Math.min(la, lb);
  let p = 0; while (p < m && a.charCodeAt(p) === b.charCodeAt(p)) p++;
  let q = 0; while (q < m - p && a.charCodeAt(la - 1 - q) === b.charCodeAt(lb - 1 - q)) q++;
  return { at: p, del: a.slice(p, la - q), ins: b.slice(p, lb - q) };
}
/*ENGINE_END*/

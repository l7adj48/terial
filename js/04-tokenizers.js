'use strict';
/* التلوين والفحص (JS/JSON/CSS/HTML) */
/* ---------- Tokenizers: out = [start,end,class, ...] ---------- */
const JS_KW = new Set('var let const function return if else for while do switch case break continue new this typeof instanceof in of delete void try catch finally throw class extends super import export default async await yield static null true false undefined NaN Infinity'.split(' '));
const RX_BEFORE = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw', 'new', 'else', 'do', 'yield', 'await']);
const JS_BUILTIN = new Set('SpreadsheetApp DriveApp UrlFetchApp Logger console JSON Math Date Array Object String Number Boolean RegExp Promise Map Set Utilities PropertiesService CacheService ScriptApp ContentService HtmlService GmailApp CalendarApp DocumentApp SlidesApp LockService Session XmlService Blob window document Error'.split(' '));
const RE_ID = /[A-Za-z_$\u0080-\uffff][\w$\u0080-\uffff]*/y;
const RE_NUM = /0[xX][\da-fA-F]+|0[bB][01]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;

function tokTpl(s, i, end, out) {
  let st = i; i++;
  while (i < end) {
    const c = s[i];
    if (c === '\\') { i += 2; continue; }
    if (c === '`') { out.push(st, i + 1, 's'); return i + 1; }
    if (c === '$' && s[i + 1] === '{') {
      out.push(st, i, 's'); out.push(i, i + 2, 'p');
      const j = tokJS(s, i + 2, end, out, true);
      if (j < end && s[j] === '}') { out.push(j, j + 1, 'p'); i = j + 1; } else i = j;
      st = i; continue;
    }
    i++;
  }
  out.push(st, Math.min(i, end), 'se'); return end;
}
function tokJS(s, i, end, out, inTpl) {
  let depth = 0, prev = 'op', prevWord = '';
  while (i < end) {
    const c = s[i], n = s[i + 1];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '/' && n === '/') { let e = s.indexOf('\n', i); if (e < 0 || e > end) e = end; out.push(i, e, 'c'); i = e; continue; }
    if (c === '/' && n === '*') {
      const e = s.indexOf('*/', i + 2);
      if (e < 0 || e + 2 > end) { out.push(i, end, 'se'); i = end; } else { out.push(i, e + 2, 'c'); i = e + 2; }
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < end && s[j] !== c && s[j] !== '\n') { if (s[j] === '\\') j++; j++; }
      j = Math.min(j, end);
      if (j < end && s[j] === c) { out.push(i, j + 1, 's'); i = j + 1; } else { out.push(i, j, 'se'); i = j; }
      prev = 'val'; prevWord = ''; continue;
    }
    if (c === '`') { i = tokTpl(s, i, end, out); prev = 'val'; prevWord = ''; continue; }
    if ((c >= '0' && c <= '9') || (c === '.' && n >= '0' && n <= '9')) {
      RE_NUM.lastIndex = i; const m = RE_NUM.exec(s);
      if (m && i + m[0].length <= end) { out.push(i, i + m[0].length, 'n'); i += m[0].length; } else i++;
      prev = 'val'; prevWord = ''; continue;
    }
    RE_ID.lastIndex = i;
    const m = RE_ID.exec(s);
    if (m && m.index === i) {
      const w = m[0], e = i + w.length; let q = e;
      while (s[q] === ' ' || s[q] === '\t') q++;
      let cls = null;
      if (prev === 'dot') cls = s[q] === '(' ? 'f' : 'pr';
      else if (JS_KW.has(w)) cls = 'k';
      else if (JS_BUILTIN.has(w)) cls = 'b';
      else if (s[q] === '(') cls = 'f';
      else if (prevWord === 'class' || prevWord === 'new') cls = 'cl';
      if (cls) out.push(i, e, cls);
      prev = RX_BEFORE.has(w) ? 'op' : 'val'; prevWord = w; i = e; continue;
    }
    if (c === '/') {
      if (prev === 'op') {
        let j = i + 1, inCls = false;
        while (j < end && s[j] !== '\n') {
          const d = s[j];
          if (d === '\\') j++; else if (d === '[') inCls = true; else if (d === ']') inCls = false; else if (d === '/' && !inCls) break;
          j++;
        }
        if (j < end && s[j] === '/') {
          j++; while (j < end && /[a-z]/i.test(s[j])) j++;
          out.push(i, j, 'rx'); i = j; prev = 'val'; prevWord = ''; continue;
        }
      }
      i++; prev = 'op'; prevWord = ''; continue;
    }
    if (c === '{') depth++;
    else if (c === '}') { if (depth === 0 && inTpl) return i; depth--; }
    if (c === '.') prev = (n !== '.' && s[i - 1] !== '.') ? 'dot' : 'op';
    else if (c === ')' || c === ']') prev = 'val';
    else prev = 'op';
    prevWord = ''; i++;
  }
  return i;
}
const RE_JNUM = /-?\d+\.?\d*(?:[eE][+-]?\d+)?/y, RE_JLIT = /true|false|null/y;
function tokJSON(s, i, end, out) {
  while (i < end) {
    const c = s[i];
    if (c === '"') {
      let j = i + 1;
      while (j < end && s[j] !== '"' && s[j] !== '\n') { if (s[j] === '\\') j++; j++; }
      j = Math.min(j, end);
      const closed = j < end && s[j] === '"', e = closed ? j + 1 : j;
      let q = e; while (q < end && (s[q] === ' ' || s[q] === '\n' || s[q] === '\t' || s[q] === '\r')) q++;
      out.push(i, e, !closed ? 'se' : (s[q] === ':' ? 'pr' : 's')); i = Math.max(e, i + 1); continue;
    }
    if ((c >= '0' && c <= '9') || c === '-') {
      RE_JNUM.lastIndex = i; const m = RE_JNUM.exec(s);
      if (m && m[0].length) { out.push(i, i + m[0].length, 'n'); i += m[0].length; continue; }
    }
    if (c === 't' || c === 'f' || c === 'n') {
      RE_JLIT.lastIndex = i; const m = RE_JLIT.exec(s);
      if (m) { out.push(i, i + m[0].length, 'k'); i += m[0].length; continue; }
    }
    i++;
  }
}
const RE_CSSID = /[\w-]+/y, RE_HEX = /#[0-9a-fA-F]{3,8}\b/y, RE_IMP = /!\s*important/y, RE_CNUM = /-?(?:\d+\.?\d*|\.\d+)(?:%|[a-zA-Z]+)?/y;
const RE_CIDENT = /[a-zA-Z_-][\w-]*/y, RE_AT = /@[\w-]+/y, RE_CCLS = /[.#][\w-]+/y, RE_PSEUDO = /::?[\w-]+/y, RE_TAGN = /[a-zA-Z][\w-]*/y;
function tokCSS(s, i, end, out) {
  const stack = []; let pre = i, inVal = false;
  const at = (re, cls) => { re.lastIndex = i; const m = re.exec(s); if (m && m.index === i && m[0].length) { out.push(i, i + m[0].length, cls); i += m[0].length; return true; } return false; };
  while (i < end) {
    const c = s[i];
    if (c === '/' && s[i + 1] === '*') {
      const e = s.indexOf('*/', i + 2);
      if (e < 0 || e + 2 > end) { out.push(i, end, 'se'); i = end; } else { out.push(i, e + 2, 'c'); i = e + 2; }
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1; while (j < end && s[j] !== c && s[j] !== '\n') { if (s[j] === '\\') j++; j++; }
      j = Math.min(j, end);
      if (j < end && s[j] === c) { out.push(i, j + 1, 's'); i = j + 1; } else { out.push(i, j, 'se'); i = j; }
      continue;
    }
    if (c === '{') { stack.push(/^\s*@(media|supports|document|layer|container|-?[a-z]*-?keyframes)/i.test(s.slice(pre, i)) ? 'g' : 'd'); inVal = false; i++; pre = i; continue; }
    if (c === '}') { stack.pop(); inVal = false; i++; pre = i; continue; }
    if (c === ';') { inVal = false; i++; pre = i; continue; }
    const mode = stack.length ? stack[stack.length - 1] : 'g';
    if (mode === 'd') {
      if (!inVal) {
        RE_CSSID.lastIndex = i; const m = RE_CSSID.exec(s);
        if (m && m.index === i) {
          let q = i + m[0].length; while (s[q] === ' ' || s[q] === '\n' || s[q] === '\t') q++;
          if (s[q] === ':') { out.push(i, i + m[0].length, 'pr'); i = q + 1; inVal = true; continue; }
          i += m[0].length; continue;
        }
        i++; continue;
      }
      if (c === '#' && at(RE_HEX, 'n')) continue;
      if (c === '!' && at(RE_IMP, 'k')) continue;
      if (((c >= '0' && c <= '9') || c === '.' || (c === '-' && /[\d.]/.test(s[i + 1] || ''))) && at(RE_CNUM, 'n')) continue;
      RE_CIDENT.lastIndex = i; const m2 = RE_CIDENT.exec(s);
      if (m2 && m2.index === i) { const e = i + m2[0].length; if (s[e] === '(') out.push(i, e, 'f'); i = e; continue; }
      i++; continue;
    }
    if (c === '@' && at(RE_AT, 'k')) continue;
    if ((c === '.' || c === '#') && at(RE_CCLS, 'cl')) continue;
    if (c === ':' && at(RE_PSEUDO, 'k')) continue;
    if (at(RE_TAGN, 'tg')) continue;
    i++;
  }
}
const RE_TAG = /<\/?([a-zA-Z][\w:-]*)/y, RE_ATTR = /[^\s=>\/"']+/y, RE_UNQ = /[^\s>]+/y;
function tokHTML(s, i, end, out) {
  while (i < end) {
    const lt = s.indexOf('<', i); if (lt < 0 || lt >= end) break;
    if (s.startsWith('<!--', lt)) { let e = s.indexOf('-->', lt + 4); e = (e < 0 || e + 3 > end) ? end : e + 3; out.push(lt, e, 'c'); i = e; continue; }
    if (s[lt + 1] === '!' || s[lt + 1] === '?') { let e = s.indexOf('>', lt); e = (e < 0 || e >= end) ? end : e + 1; out.push(lt, e, 'k'); i = e; continue; }
    RE_TAG.lastIndex = lt; const m = RE_TAG.exec(s);
    if (!m || m.index !== lt) { i = lt + 1; continue; }
    const name = m[1].toLowerCase(), closing = m[0][1] === '/';
    out.push(lt, lt + m[0].length, 'tg');
    let j = lt + m[0].length, attrType = '', selfClosed = false;
    while (j < end) {
      const c = s[j];
      if (c === ' ' || c === '\n' || c === '\t' || c === '\r') { j++; continue; }
      if (c === '>') { out.push(j, j + 1, 'tg'); j++; break; }
      if (c === '/' && s[j + 1] === '>') { out.push(j, j + 2, 'tg'); j += 2; selfClosed = true; break; }
      RE_ATTR.lastIndex = j; const a = RE_ATTR.exec(s);
      if (!a || a.index !== j) { j++; continue; }
      out.push(j, j + a[0].length, 'at'); const an = a[0].toLowerCase(); j += a[0].length;
      let q = j; while (s[q] === ' ') q++;
      if (s[q] === '=') {
        j = q + 1; while (s[j] === ' ') j++;
        const v = s[j];
        if (v === '"' || v === "'") {
          let e = s.indexOf(v, j + 1); e = (e < 0 || e >= end) ? end : e + 1;
          out.push(j, e, 's'); if (an === 'type') attrType = s.slice(j + 1, e - 1).toLowerCase(); j = e;
        } else {
          RE_UNQ.lastIndex = j; const u = RE_UNQ.exec(s);
          if (u && u.index === j) { out.push(j, j + u[0].length, 's'); if (an === 'type') attrType = u[0].toLowerCase(); j += u[0].length; }
        }
      }
    }
    i = j;
    if (!closing && !selfClosed && (name === 'script' || name === 'style')) {
      const re = new RegExp('</' + name, 'ig'); re.lastIndex = i;
      const cm = re.exec(s); const ce = (cm && cm.index < end) ? cm.index : end;
      if (name === 'style') tokCSS(s, i, ce, out);
      else if (/json/.test(attrType)) tokJSON(s, i, ce, out);
      else if (!attrType || /javascript|module|ecmascript/.test(attrType)) tokJS(s, i, ce, out, false);
      i = ce;
    }
  }
}
function langOf(name) {
  const e = (String(name).split('.').pop() || '').toLowerCase();
  return { js: 'js', gs: 'js', mjs: 'js', jsx: 'js', ts: 'js', html: 'html', htm: 'html', xml: 'html', svg: 'html', css: 'css', json: 'json' }[e] || 'plain';
}
function tokenize(text, lang) {
  const out = [];
  if (lang === 'plain' || text.length > MAX_HL) return out;
  try {
    if (lang === 'js') tokJS(text, 0, text.length, out, false);
    else if (lang === 'html') tokHTML(text, 0, text.length, out);
    else if (lang === 'css') tokCSS(text, 0, text.length, out);
    else if (lang === 'json') tokJSON(text, 0, text.length, out);
  } catch (e) { return []; }
  return out;
}
function lineIn(text, pos) { let n = 1, i = -1; while ((i = text.indexOf('\n', i + 1)) !== -1 && i < pos) n++; return n; }
function lintText(text, tk, lang) {
  const iss = [];
  if (lang === 'json') {
    if (!text.trim()) return iss;
    try { JSON.parse(text); } catch (e) { const m = /position\s+(\d+)/.exec(e.message); iss.push({ line: m ? lineIn(text, +m[1]) : 1, msg: 'JSON: ' + String(e.message).slice(0, 90) }); }
    return iss;
  }
  if (lang !== 'js' && lang !== 'css') return iss;
  const stack = [], pairs = { ')': '(', ']': '[', '}': '{' };
  const scan = (a, b) => {
    for (let p = a; p < b; p++) {
      const c = text[p];
      if (c === '(' || c === '[' || c === '{') stack.push([c, p]);
      else if (c === ')' || c === ']' || c === '}') {
        const top = stack.pop();
        if (!top) iss.push({ line: lineIn(text, p), pos: p, msg: 'إغلاق زائد «' + c + '»' });
        else if (top[0] !== pairs[c]) iss.push({ line: lineIn(text, p), pos: p, msg: '«' + c + '» لا يطابق «' + top[0] + '» (فُتح في سطر ' + lineIn(text, top[1]) + ')' });
      }
    }
  };
  let i = 0;
  for (let k = 0; k < tk.length; k += 3) {
    scan(i, tk[k]);
    if (tk[k + 2] === 'se') iss.push({ line: lineIn(text, tk[k]), pos: tk[k], msg: 'نص أو تعليق غير مغلق' });
    i = tk[k + 1];
  }
  scan(i, text.length);
  stack.forEach(([c, p]) => iss.push({ line: lineIn(text, p), pos: p, msg: '«' + c + '» غير مغلق' }));
  return iss.slice(0, 50);
}

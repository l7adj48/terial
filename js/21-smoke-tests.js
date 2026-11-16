'use strict';
/* اختبار الدخان R4 */
/* ===== R4: اختبار الدخان ===== */
const VOID_T = new Set('area base br col embed hr img input link meta param source track wbr'.split(' ')), OPT_T = new Set('html head body li p td th tr dt dd option thead tbody tfoot colgroup'.split(' '));
function tagIssues(name, html) {
  const out = [], st = [];
  const t = String(html).replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, '')).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, m => m.replace(/[^\n]/g, ''));
  const re = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g; let m;
  const add = (k, idx) => out.push({ k, m: k + ' (سطر ' + (t.slice(0, idx).split('\n').length) + ')' });
  while ((m = re.exec(t))) {
    const close = m[1] === '/', tag = m[2].toLowerCase(), self = /\/\s*$/.test(m[3]);
    if (!close) { if (!VOID_T.has(tag) && !self) st.push([tag, m.index]); continue; }
    if (VOID_T.has(tag)) continue;
    let k = st.length - 1; while (k >= 0 && st[k][0] !== tag) k--;
    if (k < 0) { add(name + ': </' + tag + '> زائد', m.index); continue; }
    while (st.length - 1 > k) { const u = st.pop(); if (!OPT_T.has(u[0])) add(name + ': <' + u[0] + '> غير مغلق', u[1]); }
    st.pop();
  }
  st.forEach(u => { if (!OPT_T.has(u[0])) add(name + ': <' + u[0] + '> غير مغلق', u[1]); });
  return out.slice(0, 30);
}
function jsSyntaxIssues(name, code) {
  if (/^\s*(import|export)\s/m.test(code)) return [];
  try { new Function(code); return []; } catch (e) { if (e instanceof EvalError) return []; const k = name + ': ' + String(e.message).slice(0, 80); return [{ k, m: k }]; }
}
function staticIssues(map) {
  let out = [];
  Object.keys(map).forEach(n => {
    const lang = langOf(n), c = String(map[n]);
    if (lang === 'js') out = out.concat(jsSyntaxIssues(n, c));
    else if (lang === 'html') {
      c.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (m, a, body) => { if (/\bsrc\s*=/i.test(a)) return m; const ty = /\btype\s*=\s*["']?([^"'\s>]+)/i.exec(a); if (ty && !/javascript/i.test(ty[1])) return m; out = out.concat(jsSyntaxIssues(n + ' (سكربت مضمّن)', body)); return m; });
      out = out.concat(tagIssues(n, c));
    }
  });
  return out;
}
function diffNew(b, a) {
  const cnt = {}; b.forEach(x => { cnt[x.k] = (cnt[x.k] || 0) + 1; });
  const added = []; a.forEach(x => { if (cnt[x.k] > 0) cnt[x.k]--; else added.push(x); });
  const fixed = Object.keys(cnt).reduce((s, k) => s + cnt[k], 0);
  return { added, fixed };
}
function smokeRun(map, ms) {
  return new Promise(res => {
    const errs = []; let srcT;
    try { srcT = sourceOfState(map); } catch (e) { return res({ errs, ran: false }); }
    if (!/<[a-z!][^>]*>/i.test(srcT) || !Object.keys(map).some(n => langOf(n) === 'html')) return res({ errs, ran: false });
    const f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts'); f.style.cssText = 'position:absolute;width:360px;height:640px;left:-9999px;top:0;border:0';
    let done = false, tm = 0;
    const fin = () => { if (done) return; done = true; clearTimeout(tm); window.removeEventListener('message', on); f.remove(); res({ errs, ran: true }); };
    const on = e => { if (!previewMsgOk(e, f.contentWindow)) return; const d = e.data; if (d.t === 'error' && errs.length < 30) { const k = (Array.isArray(d.a) ? d.a : []).map(x => truncate(String(x), 300)).join(' '); errs.push({ k: k.replace(/\s*\(line \d+\)/, ''), m: k }); } };
    tm = setTimeout(fin, ms || 2200);
    window.addEventListener('message', on); document.body.appendChild(f); f.srcdoc = withHook(srcT);
  });
}
let smokeSeq = 0;
const SMOKE_EXT = /\.(html?|m?js|gs|css|json)$/i;
async function smokeTest(ev) {
  if (!ev) return; const my = ++smokeSeq; lastSmoke = { ev, pending: true };
  const box = $('smokeBox'), say = h => { if (my === smokeSeq) box.innerHTML = h; };
  if (ev.blocked) return lastSmoke = { ev, skip: 'الدفعة مرفوضة كاملاً (الكل أو لا شيء)، فلا ناتج لاختباره.' }, say('<div class="pnote">' + ic('alert-circle', 'xs') + '<span>الباتش مرفوض كاملاً (الكل أو لا شيء) — لا شيء لاختباره.</span></div>');
  if (!ev.changed.length) return lastSmoke = { ev, skip: 'لا تغييرات لاختبارها.' }, say('<div class="pnote">' + ic('skip', 'xs') + '<span>لا تغييرات لاختبارها.</span></div>');
  if (!ev.changed.some(n => SMOKE_EXT.test(n))) return lastSmoke = { ev, skip: 'الملفات المتغيّرة ليست html/js/css/json.' }, say('<div class="pnote">' + ic('skip', 'xs') + '<span>لا ينطبق: الملفات المتغيّرة ليست html/js/css/json (مثل md وtxt).</span></div>');
  say('<div class="pnote">' + ic('alert-circle', 'xs') + '<span>جارٍ الاختبار (نحو 5 ثوانٍ)…</span></div>');
  try {
    const rb = await smokeRun(ev.before), ra = await smokeRun(ev.work);
    const sb = staticIssues(ev.before), sa = staticIssues(ev.work);
    const st = diffNew(sb, sa), rt = rb.ran && ra.ran ? diffNew(rb.errs, ra.errs) : { added: [], fixed: 0 };
    const n = st.added.length + rt.added.length, pre = sb.length + rb.errs.length;
    let h = '<div class="summary"><span class="badge ' + (n ? 'failed' : 'applied') + '">' + ic(n ? 'x-circle' : 'check', 'xs') + ' ' + (n ? 'تحذير: يضيف ' + n + ' ' + (n > 10 ? 'خطأ' : 'أخطاء') + ' ❌' : 'معاينة جاهزة — آمن ✅') + '</span>' + ((st.fixed + rt.fixed) ? '<span class="badge skipped">يزيل ' + (st.fixed + rt.fixed) + '</span>' : '') + '<span class="summary-mode">اختبار الدخان</span></div>';
    const list = (t, a) => a.length ? '<div class="pnote">' + ic('alert', 'xs') + '<span><b>' + t + ':</b> ' + a.slice(0, 8).map(x => esc(truncate(x.m, 160))).join(' | ') + (a.length > 8 ? ' …' : '') + '</span></div>' : '';
    h += list('أخطاء تشغيل جديدة', rt.added) + list('صياغة/وسوم جديدة', st.added);
    if (pre) h += '<div class="pnote">' + ic('skip', 'xs') + '<span>موجود قبل الباتش (لا يُحسب): ' + pre + '</span></div>';
    if (!ra.ran) h += '<div class="pnote">' + ic('skip', 'xs') + '<span>لم يُشغَّل المشروع (لا ملف html) — فُحصت الصياغة والوسوم فقط.</span></div>';
    h += '<div class="pnote">' + ic('alert-circle', 'xs') + '<span>الحد: يكشف الأخطاء الظاهرة عند التشغيل لنحو ثانيتين فقط، وصياغة JS ووسوم HTML. لا يكشف أخطاء المنطق أو ما يظهر بعد نقرات المستخدم، ولا ينطبق على md وtxt. «آمن» ليس ضماناً.</span></div>';
    say(h);
    if (my === smokeSeq) lastSmoke = { ev, ran: ra.ran, n, rt: rt.added.map(x => x.m), st: st.added.map(x => x.m), pre, t: Date.now() };
    if (my === smokeSeq) log(n ? 'err' : 'ok', 'اختبار الدخان: ' + (n ? 'يضيف ' + n : 'آمن'));
  } catch (e) { lastSmoke = { ev, skip: 'تعذّر الاختبار: ' + (e && e.message || e) }; say('<div class="pnote">' + ic('alert', 'xs') + '<span>تعذّر الاختبار: ' + esc(e && e.message || e) + '</span></div>'); }
}

/*PURE2_START*/
const INVIS_RE = /[\uFEFF\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, NBSP_RE = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;function cleanPatchText(s) { return String(s).replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019]/g, "'").replace(NBSP_RE, ' ').replace(INVIS_RE, ''); }
function stripInvisible(s) { let n = 0; const t = String(s).replace(INVIS_RE, () => { n++; return ''; }).replace(NBSP_RE, () => { n++; return ' '; }); return { text: t, count: n }; }
function decodeBytes(u8) {
  const dec = (enc, o) => new TextDecoder(enc, o).decode(u8);
  if (u8[0] === 0xFF && u8[1] === 0xFE) return { text: dec('utf-16le'), enc: 'utf-16le' };
  if (u8[0] === 0xFE && u8[1] === 0xFF) return { text: dec('utf-16be'), enc: 'utf-16be' };
  try { return { text: dec('utf-8', { fatal: true }), enc: 'utf-8' }; } catch (e) { }
  try {
    const t = dec('windows-1256'), hi = t.match(/[^\x00-\x7F]/g) || [], ar = t.match(/[\u0600-\u06FF]/g) || [];
    if (hi.length && ar.length / hi.length >= 0.6) return { text: t, enc: 'windows-1256' };
  } catch (e) { }
  return null;
}
function detectEol(t) { const c = (t.match(/\r\n/g) || []).length, l = (t.match(/(^|[^\r])\n/g) || []).length; return c > 0 && c >= l ? 'crlf' : 'lf'; }
function withEol(f) { return f.eol === 'crlf' ? String(f.content).replace(/\n/g, '\r\n') : f.content; }
const LAZY_RE = /^[ \t]*(?:\/\/|#|\/\*|<!--|--)?[ \t]*(?:\.{3}|…|(?:rest|remaining|existing|other|same)\b[^\n]{0,40}(?:code|file|unchanged|here)|(?:بقية|باقي|بقيه)\s+(?:الكود|الملف)[^\n]{0,30})[ \t]*(?:\*\/|-->)?[ \t]*$/im;
function lazyScan(parsed, before, rej) {
  rej = rej || new Set();
  const out = [], chk = (l, x) => { if (typeof x === 'string' && LAZY_RE.test(x)) out.push(l + ': نص كسول («... بقية الكود»)'); };
  if (parsed.bundle) parsed.bundle.forEach((b, i) => { if (rej.has(i + 1)) return; chk(b.name, b.content); const o = before[b.name]; if (o && o.length > 200 && b.content.length < o.length * 0.5) out.push(b.name + ': انكمش ' + Math.round(100 - b.content.length / o.length * 100) + '%'); });
  else (parsed.patches || []).forEach((p, i) => { if (rej.has(i + 1)) return; if (p && typeof p === 'object') { chk('باتش #' + (i + 1), p.replace); chk('باتش #' + (i + 1), p.content); } });
  return out;
}
function pureTests2() {
  const T = [], t = (n, ok) => T.push({ n, ok: !!ok });
  const ar = new Uint8Array([0xE3, 0xD1, 0xCD, 0xC8, 0xC7]);
  let d = decodeBytes(ar); t('D1: windows-1256 عربي يُكتشف', d && d.enc === 'windows-1256' && d.text === 'مرحبا');
  d = decodeBytes(new TextEncoder().encode('مرحبا')); t('D1: UTF-8 أولاً', d && d.enc === 'utf-8' && d.text === 'مرحبا');
  d = decodeBytes(new Uint8Array([0xFF, 0xFE, 0x41, 0x00, 0x42, 0x00])); t('D1: UTF-16 BOM', d && d.enc === 'utf-16le' && d.text === 'AB');
  t('D1: بيانات عشوائية غير عربية تُرفض', decodeBytes(new Uint8Array([0x63, 0x61, 0x66, 0xE9])) === null);
  const crlf = 'a\r\nb\r\n'; t('D2: كشف CRLF', detectEol(crlf) === 'crlf' && detectEol('a\nb\n') === 'lf');
  t('D2: دورة CRLF مطابقة حرفياً', withEol({ eol: 'crlf', content: nl(crlf) }) === crlf);
  t('D2: LF لا يتغير', withEol({ eol: 'lf', content: 'a\nb' }) === 'a\nb');
  let p = parsePatches('{“patches”:[{“find”:“a”,“replace”:“b”}]}');
  t('P1: اقتباسات ذكية تُنظَّف', p.patches[0].find === 'a' && p.cleaned === true);
  p = parsePatches('[{"find":"x\u00A0y","replace":"مرحبا"}]'); t('P1: JSON سليم لا يُمسّ (NBSP والعربية)', p.patches[0].find === 'x\u00A0y' && p.patches[0].replace === 'مرحبا' && !p.cleaned);
  p = parsePatches('\uFEFF[{\u200F"find":"a","replace":"b"}]'); t('P1: أحرف خفية خارج القيم', p.patches[0].find === 'a');
  const L = x => lazyScan({ patches: [{ replace: x }] }, {}).length;
  t('P2: «// rest of code» يُكشف', L('a\n// rest of code\nb') === 1);
  t('P2: «...» وحدها تُكشف', L('a\n...\nb') === 1);
  t('P2: «بقية الكود» تُكشف', L('// بقية الكود') === 1);
  t('P2: spread لا يُكشف', L('const a=[...b];\nfunction f(...args){}') === 0);
  const big = 'x'.repeat(400); t('P2: انكماش الملف يُكشف', lazyScan({ bundle: [{ name: 'f', content: 'y' }] }, { f: big }).length === 1);
  const s = stripInvisible('a\u200Fb\u00A0c\uFEFF'); t('A10: حذف الأحرف الخفية', s.text === 'ab c' && s.count === 3);
  return T;
}
/*PURE2_END*/
let popSkip = 0, dHist = 0;
window.addEventListener('popstate', () => {
  if (popSkip > 0) { popSkip--; return; }
  if (ui.modal.classList.contains('open')) { ui._pop = true; ui.close(ui.kind === 'confirm' ? false : null); ui._pop = false; }
  else if (drawerOn) { dHist = 0; closeDrawer(); }
});
function histPush() { try { history.pushState({ cp: 1 }, ''); return 1; } catch (e) { return 0; } }
function histBack() { popSkip++; try { history.back(); } catch (e) { popSkip--; } }

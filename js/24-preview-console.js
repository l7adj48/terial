'use strict';
/* المعاينة والكونسول */
/* ===== المعاينة والكونسول ===== */
const CSPM = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' \'unsafe-eval\' data: blob:; style-src \'unsafe-inline\'; img-src data: blob:; font-src data:; media-src data: blob:">';
const HOOK = '<script>' + [
  SHIM_SRC,
  '(function(){',
  'var P=function(t,a){try{parent.postMessage({__cp:1,t:t,a:a},"*")}catch(e){}};',
  'var S=function(v){try{if(v instanceof Error)return v.stack||String(v);if(typeof v==="object"&&v!==null)return JSON.stringify(v);return String(v)}catch(e){return String(v)}};',
  '["log","info","warn","error","debug"].forEach(function(k){var o=console[k];console[k]=function(){P(k,[].map.call(arguments,S));try{o.apply(console,arguments)}catch(e){}}});',
  'window.addEventListener("error",function(e){P("error",[(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":"")])});',
  'window.addEventListener("unhandledrejection",function(e){P("error",["Promise: "+S(e.reason)])});',
  '})();'
].join('') + '<\/script>';
function withHook(src) {
  const H = (S.noNet ? CSPM : '') + HOOK;
  const m = src.match(/<head[^>]*>/i) || src.match(/<html[^>]*>/i) || src.match(/<!doctype[^>]*>/i);
  if (m) { const i = m.index + m[0].length; return src.slice(0, i) + H + src.slice(i); }
  return H + src;
}
function runCode() {
  if (!cur()) return toast('لا يوجد ملف', 'err');
  clearConsole();
  hideVerBar(); const frame = $('runFrame'), src = projectSource();
  frame.srcdoc = '';
  setTimeout(() => { frame.srcdoc = withHook(src); }, 30);
  switchTab('p-run');
}
window.addEventListener('message', e => {
  const d = e.data;
  if (!previewMsgOk(e, $('runFrame').contentWindow)) return;
  const t = ['log', 'info', 'warn', 'error', 'debug'].includes(d.t) ? d.t : 'log';
  addConsole(t, (Array.isArray(d.a) ? d.a : []).slice(0, 10).map(x => truncate(String(x), 2000)));
});
function addConsole(t, args) {
  const txt = args.join(' ');
  conMsgs.push({ t, txt }); if (conMsgs.length > 300) conMsgs.shift();
  if (t === 'error') { $('consoleFab').classList.add('has-err'); log('err', 'معاينة: ' + truncate(txt, 300)); }
  renderConsole();
}
function renderConsole() {
  if (!conOpen) return;
  const el = $('conList');
  el.innerHTML = conMsgs.length ? conMsgs.map(m => `<div class="con-line ${m.t === 'error' ? 'error' : m.t === 'warn' ? 'warn' : ''}">${esc(m.txt)}</div>`).join('') : uiEmpty('لا توجد رسائل');
  el.scrollTop = el.scrollHeight;
}
function clearConsole() { conMsgs = []; $('consoleFab').classList.remove('has-err'); renderConsole(); }
function toggleConsole() { conOpen = !conOpen; $('conPane').classList.toggle('open', conOpen); $('consoleFab').classList.toggle('hide', conOpen); renderConsole(); }
function copyConsole() { copyToClipboard(conMsgs.map(m => `[${m.t}] ${m.txt}`).join('\n') || '(فارغ)').then(() => toast('تم نسخ الكونسول', 'ok')); }
function toggleFullscreen() { const on = document.body.classList.toggle('runfs'); $('fsBtn').innerHTML = ic(on ? 'shrink' : 'expand'); setTimeout(syncViewport, 60); }
function openInBrowser() {
  try {
    const inner = withHook(projectSource()).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    const page = '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#fff}iframe{border:0;width:100%;height:100%}</style><iframe sandbox="allow-scripts allow-modals allow-forms allow-popups" srcdoc="' + inner + '"></iframe>';
    const url = URL.createObjectURL(new Blob([page], { type: 'text/html;charset=utf-8' }));
    window.open(url, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { toast('تعذر الفتح', 'err'); }
}
function switchTab(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nt').forEach(t => t.classList.remove('active'));
  $(id).classList.add('active');
  const nt = document.querySelector(`.nt[data-t="${id}"]`); if (nt) nt.classList.add('active');
  document.body.classList.remove('runfs'); $('fsBtn').innerHTML = ic('expand');
  if (id !== 'p-edit' && id !== 'p-patch' && document.activeElement && document.activeElement.blur) document.activeElement.blur();
  currentTab = id; scheduleSave(); setTimeout(syncViewport, 60);
  if (id === 'p-edit') requestAnimationFrame(() => { paintWindow(); });
  if (id === 'p-v1') showV1();
}

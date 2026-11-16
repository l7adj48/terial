'use strict';
/* toast، السجل، النسخ، النوافذ */
/* ===== Helpers ===== */
function toast(m, kind, act) {
  const t = $('toast'); t.textContent = m; t.className = 'toast show ' + (kind || '') + (act ? ' act' : '');
  if (act) {
    const b = document.createElement('button'); b.className = 'tact'; b.textContent = act.label;
    b.addEventListener('click', () => { clearTimeout(t._t); t.className = 'toast'; act.fn(); });
    t.appendChild(b);
  }
  clearTimeout(t._t); t._t = setTimeout(() => { t.className = 'toast'; }, act ? 7000 : Math.min(12000, Math.max(2600, String(m).length * 60)));
}
function warnOnce(m) { const now = Date.now(); if (now - lastWarn > 30000) { lastWarn = now; toast(m, 'err'); } }
function cur() { return files.find(f => f.id === activeId) || null; }
function makeFile(name, content, baseline) {
  return { id: 'f' + (++idSeq) + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name, lang: langOf(name), content, baseline, cursor: 0, scroll: 0, undo: [], redo: [], dirtySave: true };
}
function log(kind, msg) {
  logs.unshift({ time: new Date().toLocaleTimeString('en-US', { hour12: false }), kind: kind || 'info', msg });
  if (logs.length > 200) logs.pop();
  renderLog();
}
function renderLog() {
  const el = $('logList');
  if (!logs.length) { el.innerHTML = uiEmpty('لا يوجد سجل'); return; }
  el.innerHTML = logs.map(l => `<div class="logentry ${l.kind}"><span class="time">${l.time}</span><span class="msg">${esc(l.msg)}</span></div>`).join('');
}
function clearLogs() {
  if (!logs.length) return toast('السجل فارغ بالفعل');
  logs = []; renderLog();
  if (typeof cpRefreshHome === 'function' && currentTab === 'p-home') cpRefreshHome();
  toast('تم مسح السجل', 'ok');
}
function fallbackCopy(text) {
  const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(ta); ta.select();
  try { document.execCommand('copy'); } catch (e) { }
  document.body.removeChild(ta);}
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  fallbackCopy(text); return Promise.resolve();
}

/* ===== نوافذ التطبيق ===== */
function uiRow(act, icName, title, desc, dataAttr) {
  return '<div class="mi" data-act="' + act + '"' + (dataAttr ? ' ' + dataAttr : '') + '><svg class="ic' + (icName === 'github' ? ' brand' : '') + '" aria-hidden="true"><use href="#i-' + icName + '"/></svg><span class="mi-body"><span class="mi-title">' + title + '</span>' + (desc ? '<span class="mi-desc">' + desc + '</span>' : '') + '</span></div>';
}
function uiScroll(html, size) { return '<div class="scroll-box ' + (size || 'md') + '">' + html + '</div>'; }
function uiNote(html, cls) { return '<div class="slabel' + (cls ? ' ' + cls : '') + '">' + html + '</div>'; }
function uiEmpty(msg) { return '<div class="empty-msg">' + esc(msg) + '</div>'; }
function uiSub(text) { return '<small class="meta-sub" dir="ltr">' + text + '</small>'; }

const ui = {
  modal: $('modal'), sheet: $('sheet'), resolve: null, kind: '', onAct: null,
  show(html, onAct) { this.finish(this.kind === 'confirm' ? false : null); this.onAct = onAct || null; this.sheet.innerHTML = html; this.modal.classList.add('open'); if (typeof updateSymBar === 'function') updateSymBar(); if (!this._h) this._h = histPush(); },
  finish(v) { const r = this.resolve; this.resolve = null; if (r) r(v); },
  close(v) { this.modal.classList.remove('open'); this.onAct = null; this.finish(v); if (typeof updateSymBar === 'function') updateSymBar(); setTimeout(syncViewport, 60); if (this._h) { this._h = 0; if (!this._pop) histBack(); } },
  prompt(title, val, ok) {
    return new Promise(res => {
      this.show(`<h3>${esc(title)}</h3><input type="text" id="uiIn" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false"><div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button><button type="button" class="btn primary" data-ui="ok">${esc(ok || 'موافق')}</button></div>`);
      this.kind = 'prompt'; this.resolve = res;
      const i = $('uiIn'); i.value = val || '';
      i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.close(i.value); } });
      setTimeout(() => { i.focus(); i.select(); }, 60);
    });
  },
  confirm(msg, ok) {
    return new Promise(res => {
      this.show(`<h3>${esc(msg)}</h3><div class="srow"><button type="button" class="btn" data-ui="cancel">إلغاء</button><button type="button" class="btn primary" data-ui="ok">${esc(ok || 'موافق')}</button></div>`);
      this.kind = 'confirm'; this.resolve = res;
    });
  }
};
ui.modal.addEventListener('click', e => {
  const b = e.target.closest('[data-ui]');
  if (b) {
    if (b.dataset.ui === 'ok') ui.close(ui.kind === 'prompt' ? $('uiIn').value : true);
    else if (b.dataset.ui === 'cancel') ui.close(ui.kind === 'confirm' ? false : null);
    return;
  }
  if (e.target === ui.modal) { ui.close(ui.kind === 'confirm' ? false : null); return; }
  const a = e.target.closest('[data-act]');
  if (a && ui.onAct) ui.onAct(a.dataset.act, a);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && ui.modal.classList.contains('open')) ui.close(ui.kind === 'confirm' ? false : null); });

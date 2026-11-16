'use strict';
/* دوال مساعدة صغيرة (esc, nl, lineOf...) */
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escT(s) { return s.replace(/[&<>]/g, c => c === '&' ? '&amp;' : c === '<' ? '&lt;' : '&gt;'); }
function truncate(s, n) { s = String(s || ''); return s.length > n ? s.substring(0, n) + '…' : s; }
function lineOf(content, idx) { if (idx <= 0) return 1; return content.substring(0, idx).split('\n').length; }
function nl(s) { return String(s).replace(/\r\n?/g, '\n'); }
/* أيقونة SVG — تُستدعى أثناء التحميل من ملفات مبكرة، لذلك مكانها هنا */
function ic(n, c) { return '<svg class="ic' + (c ? ' ' + c : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

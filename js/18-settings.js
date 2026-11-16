'use strict';
/* الإعدادات والمظهر */
/* ===== الإعدادات والمظهر ===== */
function applyTheme() {
  const t = S.theme || 'dark';
  document.body.dataset.theme = t;
  document.body.dataset.density = S.density || 'normal';
  document.body.dataset.radius = S.radius || 'round';
  if (S.accent && S.accent !== 'default') document.body.dataset.accent = S.accent;
  else delete document.body.dataset.accent;
  document.body.classList.toggle('light', t === 'light' || t === 'paper');
  const m = document.querySelector('meta[name=theme-color]');
  if (m) {
    const bg = getComputedStyle(document.body).getPropertyValue('--surface-app').trim();
    m.setAttribute('content', bg || (t === 'light' ? '#f4f5f8' : t === 'paper' ? '#f3ede2' : t === 'royal' ? '#08080a' : '#090b10'));
  }
}
function applyFont() {
  LH = Math.round(S.fs * 1.7); _cw = 0;
  const r = document.documentElement.style; r.setProperty('--fs', S.fs + 'px'); r.setProperty('--lh', LH + 'px');
  applyTheme();
}
let setTab = 'look';
function openSettings() {
  const ic = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const seg = (cur, key, opts) => `<div class="set-seg">${opts.map(([v, l]) => `<button type="button" class="${cur === v ? 'sel' : ''}" data-act="${key}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const group = (title, html) => `<section class="set-group">${title ? `<div class="set-gt">${title}</div>` : ''}<div class="set-card">${html}</div></section>`;
  const field = (title, html) => `<div class="set-field"><div class="set-ft">${title}</div>${html}</div>`;
  const toggle = (act, on, title, desc) => `<button type="button" class="set-row" role="switch" aria-checked="${on}" data-act="${act}" data-v="${on ? 'off' : 'on'}"><span class="set-txt"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</span><span class="set-sw${on ? ' on' : ''}" aria-hidden="true"></span></button>`;
  const go = (act, icon, title, desc) => `<button type="button" class="set-row" data-act="${act}">${ic(icon)}<span class="set-txt"><b>${title}</b>${desc ? `<small>${desc}</small>` : ''}</span><span class="set-chev">${ic('arrow-left')}</span></button>`;
  const themes = [['dark', 'أوبسيديان'], ['royal', 'ملكي'], ['light', 'خزفي'], ['ocean', 'محيطي'], ['paper', 'ورقي'], ['contrast', 'تباين عالٍ']];
  const accents = [['default', 'الافتراضي'], ['gold', 'ذهبي'], ['indigo', 'بنفسجي'], ['cyan', 'سماوي'], ['emerald', 'زمردي'], ['amber', 'عنبر'], ['rose', 'وردي']];
  const tabs = [['look', 'المظهر'], ['edit', 'المحرر'], ['run', 'الباتشات'], ['tools', 'الأدوات']];
  const pages = {
    look: () => group('الألوان', field('الثيم', `<div class="set-themes">${themes.map(([v, l]) => `<button type="button" class="sw-theme${(S.theme || 'dark') === v ? ' sel' : ''}" data-act="theme" data-v="${v}" data-th="${v}"><span class="sw-prev"><i></i><i></i><i></i></span><b>${l}</b></button>`).join('')}</div>`) +
      field('لون التمييز', `<div class="set-dots">${accents.map(([v, l]) => `<button type="button" class="sw-dot${(S.accent || 'default') === v ? ' sel' : ''}" data-act="accent" data-v="${v}" data-ac="${v}" aria-label="${l}" title="${l}"></button>`).join('')}</div>`)) +
      group('الشكل', field('كثافة الواجهة', seg(S.density || 'normal', 'density', [['compact', 'مضغوط'], ['normal', 'متوازن'], ['spacious', 'مريح']])) +
        field('استدارة الحواف', seg(S.radius || 'round', 'radius', [['sharp', 'حاد'], ['round', 'قياسي'], ['soft', 'ناعم']])) +
        `<div class="set-field set-inline"><div class="set-ft">حجم خط المحرر</div><div class="set-step"><button type="button" data-act="fs-" aria-label="تصغير">A−</button><span class="fs-readout">${S.fs}px</span><button type="button" data-act="fs+" aria-label="تكبير">A+</button></div></div>`) +
      `<button type="button" class="btn outline" data-act="theme_reset">إعادة ضبط المظهر الافتراضي</button>`,
    edit: () => group('الكتابة', toggle('sym', S.sym !== 'off', 'شريط الرموز', 'يظهر مع كيبورد المحرر فقط') + toggle('ac', !!S.autoClose, 'إغلاق الأقواس تلقائياً', 'الأقواس والعلامات والاقتباسات')) +
      group('الملف الحالي' + (cur() ? ' — <span dir="ltr">' + esc(cur().name) + '</span>' : ''), `<button type="button" class="set-row" data-act="eol"><span class="set-txt"><b>نهاية السطر</b><small>تُطبَّق عند التصدير</small></span><span class="set-val" dir="ltr">${cur() && cur().eol === 'crlf' ? 'CRLF' : 'LF'}</span></button>` +
        go('inv', 'trash', 'حذف الأحرف الخفية', 'يأخذ نقطة حفظ قبل التنفيذ')),
    run: () => group('المعاينة', toggle('as', S.autoSmoke !== false, 'الفحص التلقائي عند المعاينة', 'اختبار الدخان، نحو 5 ثوانٍ') + toggle('nn', !!S.noNet, 'منع الشبكة في المعاينة', 'سياسة CSP تحجب كل الطلبات')) +
      group('الباتشات', toggle('sl', S.strictLazy !== false, 'حارس الباتش الكسول', 'يحجب الباتش الناقص بدل التحذير فقط')),
    tools: () => group('', go('pal', 'search', 'لوحة الأوامر', 'ابحث عن أي أمر أو ملف') + go('snaps', 'save', 'نقاط الحفظ', 'تُؤخذ تلقائياً قبل كل تغيير كبير') + go('vers', 'layers', 'الإصدارات والتصحيحات', 'المقارنة والاسترجاع') + go('selftest', 'check-all', 'اختبار ذاتي', 'يتحقق من سلامة المحرك')) +
      group('التطبيق', `<button type="button" class="set-row" data-act="inst">${ic('import')}<span class="set-txt"><b>${STANDALONE ? 'يعمل كتطبيق' : 'تثبيت كتطبيق'}</b><small>${STANDALONE ? 'مثبّت على جهازك' : 'يعمل دون إنترنت بعد التثبيت'}</small></span>${STANDALONE ? `<span class="set-val ok">${ic('check')}</span>` : `<span class="set-chev">${ic('arrow-left')}</span>`}</button>`)
  };
  const build = () => `<div class="set-head"><h3>${ic('settings')} الإعدادات</h3><button type="button" class="set-x" data-ui="cancel" aria-label="إغلاق">${ic('x')}</button></div>` +
    `<div class="set-tabs" role="tablist">${tabs.map(([v, l]) => `<button type="button" role="tab" aria-selected="${setTab === v}" class="${setTab === v ? 'sel' : ''}" data-act="stab" data-v="${v}">${l}</button>`).join('')}</div>` +
    `<div class="set-page">${pages[setTab]()}</div>`;
  const handler = (act, el) => {
    if (act === 'stab') { setTab = el.dataset.v; ui.sheet.innerHTML = build(); ui.sheet.scrollTop = 0; return; }
    if (act === 'vers') { ui.close(null); setTimeout(showV1, 120); return; }
    if (act === 'inst') { installApp(); return; } if (act === 'pal') { ui.close(null); setTimeout(openPalette, 120); return; } if (act === 'snaps') { ui.close(null); showSnaps(); return; } if (act === 'selftest') { ui.close(null); runSelfTest(); return; }
    if (act === 'fs-') S.fs = Math.max(11, S.fs - 1);
    else if (act === 'fs+') S.fs = Math.min(22, S.fs + 1);
    else if (act === 'sym') S.sym = el.dataset.v;
    else if (act === 'ac') S.autoClose = el.dataset.v === 'on';
    else if (act === 'nn') S.noNet = el.dataset.v === 'on';
    else if (act === 'sl') S.strictLazy = el.dataset.v === 'on';
    else if (act === 'as') S.autoSmoke = el.dataset.v === 'on';
    else if (act === 'eol') { const f = cur(); if (f) { f.eol = f.eol === 'crlf' ? 'lf' : 'crlf'; f.dirtySave = true; toast('نهاية السطر عند التصدير: ' + (f.eol === 'crlf' ? 'CRLF' : 'LF'), 'ok'); } }
    else if (act === 'inv') { const r = stripInvisible(editor.value); if (!r.count) toast('لا أحرف خفية'); else { snapNow('قبل حذف الأحرف الخفية'); setAll(r.text); toast('حُذف/استُبدل ' + r.count + ' حرف خفي', 'ok'); } }
    else if (act === 'theme') S.theme = el.dataset.v;
    else if (act === 'accent') S.accent = el.dataset.v;
    else if (act === 'density') S.density = el.dataset.v;
    else if (act === 'radius') S.radius = el.dataset.v;
    else if (act === 'theme_reset') { S.theme = 'dark'; S.density = 'normal'; S.radius = 'round'; S.accent = 'default'; S.fs = 14; toast('أُعيد ضبط المظهر الافتراضي', 'ok'); }
    applyFont(); updateSymBar(); paintWindow(); scheduleSave();
    ui.sheet.innerHTML = build();
  };
  ui.show(build(), handler);
}

/* CodePatcher — الشاشة الرئيسية (#p-home) وقائمة «المزيد» والتنقل.
   الهيكل (التنقل السفلي وحاوية #p-home) معرّف في index.html؛ هذا الملف يملأ المحتوى ويربط الأحداث فقط. */
(function () {
  'use strict';
  const nav = document.querySelector('body > .nav');
  const home = document.getElementById('p-home');
  if (!nav || !home) return;

  const icon = name => '<svg class="ic" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function projectName() {
    try {
      if (typeof S !== 'undefined' && S.proj) return String(S.proj);
      if (typeof files !== 'undefined' && files.length) {
        const names = files.map(f => f.name.split('/')[0]);
        if (names.every(n => n === names[0]) && names[0]) return names[0];
      }
    } catch (_) {}
    return 'مشروع CodePatcher';
  }

  function recentList() {
    const out = [];
    try {
      const rec = typeof recentFiles === 'function' ? recentFiles() : [];
      rec.forEach(f => { if (f && !out.includes(f)) out.push(f); });
      if (typeof files !== 'undefined' && Array.isArray(files)) {
        files.forEach(f => { if (out.length < 3 && f && !out.includes(f)) out.push(f); });
      }
    } catch (_) {}
    return out.slice(0, 3);
  }

  function renderHome() {
    if (!home.isConnected) return;
    const count = typeof files !== 'undefined' ? files.length : 0;
    const dirtyCount = typeof files !== 'undefined' ? files.filter(f => f.content !== f.baseline).length : 0;
    const versionCount = typeof V1 !== 'undefined' && Array.isArray(V1.releases) ? V1.releases.length : 0;
    const draft = typeof V1 !== 'undefined' && V1.draft ? V1.draft : null;
    const draftNum = draft ? draft.n : versionCount + 1;
    const draftFixes = draft && Array.isArray(draft.fixes) ? draft.fixes : [];
    const draftDone = draftFixes.filter(f => f.status === 'applied').length;
    const logCount = typeof logs !== 'undefined' ? logs.length : 0;
    const active = typeof cur === 'function' ? cur() : null;
    const fileName = active ? active.name : 'لا يوجد ملف مفتوح';
    const recents = recentList();

    const recentsHtml = recents.length
      ? recents.map(f => {
          const kind = typeof fiOf === 'function' ? fiOf(f.name) : 'txt';
          const dirty = f.content !== f.baseline;
          const chars = (f.content || '').length;
          return '<button type="button" class="cp-recent-row" data-open-fid="' + safe(f.id) + '">' +
            '<span class="cp-recent-ic fi-' + safe(kind) + '">' + icon('file-' + kind) + '</span>' +
            '<span class="cp-recent-meta"><b>' + safe(f.name) + '</b><small>' + chars + ' حرف</small></span>' +
            '<span class="cp-recent-tag' + (dirty ? ' dirty' : '') + '">' + (dirty ? 'معدّل' : 'محفوظ') + '</span>' +
          '</button>';
        }).join('')
      : '<div class="empty-msg">لا توجد ملفات بعد — استورد حزمة نصية أو ملف ZIP للبدء</div>';

    home.innerHTML =
      '<div class="cp-home-grid">' +
        '<div class="cp-home-main">' +
          '<div class="cp-welcome">' +
            '<div class="eyebrow">جسر التعديل مع الذكاء الاصطناعي</div>' +
            '<h2>' + safe(projectName()) + '</h2>' +
            '<div class="cp-hero-sub"><span>' + count + ' ملف</span><span>·</span><span>' + dirtyCount + ' معدّل</span><span>·</span><span>النشط:</span><b dir="ltr">' + safe(fileName) + '</b></div>' +
            '<div class="cp-hero-actions">' +
              '<button type="button" class="btn primary" data-cp="patch">' + icon('wrench') + ' لصق وتطبيق الباتشات</button>' +
              '<button type="button" class="btn outline" data-cp="versions">' + icon('layers') + ' الإصدارات والمقارنة</button>' +
            '</div>' +
          '</div>' +
          '<div class="cp-section-head"><h3>التبادل النصي مع الذكاء الاصطناعي</h3><span>نص ↔ مشروع</span></div>' +
          '<div class="cp-bridge-grid">' +
            '<button type="button" class="cp-bridge-card" data-cp="bundle-out"><span class="cp-bridge-ic">' + icon('export') + '</span><div><b>المشروع ← نص للذكاء</b><small>نسخ الكود وخريطة الملفات بصيغة نصية أو أجزاء</small></div></button>' +
            '<button type="button" class="cp-bridge-card" data-cp="bundle-in"><span class="cp-bridge-ic">' + icon('import') + '</span><div><b>نص ← توليد ملفات</b><small>تحويل === FILE: === أو الخريطة لمشروع</small></div></button>' +
          '</div>' +
          '<div class="cp-stats">' +
            '<div class="cp-stat"><b>' + count + '</b><span>الملفات</span></div>' +
            '<div class="cp-stat"><b>' + versionCount + '</b><span>الإصدارات</span></div>' +
            '<div class="cp-stat"><b>' + logCount + '</b><span>السجل</span></div>' +
          '</div>' +
          '<div class="cp-section-head"><h3>آخر الملفات</h3><span>مراجعة سريعة</span></div>' +
          '<div class="cp-recents">' + recentsHtml + '</div>' +
        '</div>' +
        '<div class="cp-home-side">' +
          '<div class="cp-section-head"><h3>تتبع الإصدارات</h3><span>السجل والمقارنة</span></div>' +
          '<button type="button" class="cp-draft-banner" data-cp="versions">' +
            '<span class="cp-draft-num">' + draftNum + '</span>' +
            '<span class="cp-draft-meta"><b>إصدار ' + draftNum + ' — قيد العمل</b><small>' + (draftFixes.length ? draftDone + ' من ' + draftFixes.length + ' تصحيح منجز' : 'سجّل التصحيحات، قارن الفروق، وثبّت الإصدارات') + '</small></span>' +
            '<span class="cp-draft-pill' + (dirtyCount ? '' : ' ok') + '">' + (dirtyCount ? dirtyCount + ' تعديل' : versionCount + ' إصدار') + '</span>' +
          '</button>' +
          '<div class="cp-section-head"><h3>دورة العمل</h3><span>اختصارات مباشرة</span></div>' +
          '<div class="cp-actions">' +
            '<button type="button" class="cp-action" data-cp="patch"><span class="cp-ai">' + icon('wrench') + '</span><div><b>استوديو الباتشات</b><small>معاينة، فحص الدخان، وتقارير الإصلاح</small></div></button>' +
            '<button type="button" class="cp-action" data-cp="versions"><span class="cp-ai">' + icon('layers') + '</span><div><b>الإصدارات والفروق</b><small>مقارنة أي إصدارين، معاينة، واسترجاع</small></div></button>' +
          '</div>' +
          '<div class="cp-section-head"><h3>إدارة وتشغيل المشروع</h3><span>أدوات متكاملة</span></div>' +
          '<div class="cp-tool-list">' +
            '<button type="button" class="cp-tool-row" data-cp="manage">' + icon('folder') + '<span class="cp-tool-text"><b>فتح وتصدير ZIP</b><small>استيراد أرشيف، مجلدات، أو حفظ مشروع</small></span></button>' +
            '<button type="button" class="cp-tool-row" data-cp="files">' + icon('folder-open') + '<span class="cp-tool-text"><b>مستكشف الملفات</b><small>تصفح، بحث، ونقل داخل المشروع</small></span></button>' +
            '<button type="button" class="cp-tool-row" data-cp="editor">' + icon('code') + '<span class="cp-tool-text"><b>محرر الكود</b><small>مراجعة الملفات أو التعديل اليدوي</small></span></button>' +
            '<button type="button" class="cp-tool-row" data-cp="preview">' + icon('monitor') + '<span class="cp-tool-text"><b>معاينة التشغيل</b><small>اختبار المشروع مع مراقب الأخطاء</small></span></button>' +
            '<button type="button" class="cp-tool-row" data-cp="history">' + icon('list') + '<span class="cp-tool-text"><b>سجل العمليات</b><small>مراجعة العمليات وتقرير AI</small></span></button>' +
            '<button type="button" class="cp-tool-row" data-cp="settings">' + icon('settings') + '<span class="cp-tool-text"><b>المظهر والإعدادات</b><small>6 ثيمات منها الملكي الذهبي وأوبسيديان</small></span></button>' +
          '</div>' +
          '<div class="cp-tip">' + icon('alert-circle') + '<div><b>دورة العمل المثالية</b><span>انسخ المشروع كنص للذكاء ← طبّق الباتشات ← إذا تعذّر باتش انسخ تقرير الإصلاح للذكاء ← ثبّت الإصدار وقارن الفروق.</span></div></div>' +
        '</div>' +
      '</div>';
  }

  function about() {
    ui.show('<h3>حول CodePatcher</h3><div class="cp-project"><div class="cp-project-icon">' + icon('code') +
      '</div><div class="cp-project-meta"><b>CodePatcher</b><small>منصة إدارة الباتشات والنسخ والتبادل مع الذكاء الاصطناعي</small></div></div>' +
      '<div class="slabel">تحويل المشاريع لنص والعكس · تطبيق الباتشات الذري · تقارير الإصلاح للذكاء · تتبع الإصدارات والمقارنة بينها</div>' +
      '<button type="button" class="btn" data-ui="cancel">إغلاق</button>');
  }

  function runAction(action) {
    if (!action) return;
    if (action === 'home') return switchTab('p-home');
    if (action === 'editor') return switchTab('p-edit');
    if (action === 'patch') return switchTab('p-patch');
    if (action === 'preview') return switchTab('p-run');
    if (action === 'history') return switchTab('p-log');
    if (action === 'versions') return typeof showV1 === 'function' ? showV1() : switchTab('p-v1');
    if (action === 'files') return openDrawer('files');
    if (action === 'manage') return typeof openManage === 'function' && openManage();
    if (action === 'bundle-out') return typeof exportBundleDialog === 'function' && exportBundleDialog('');
    if (action === 'bundle-in') return typeof importBundleDialog === 'function' && importBundleDialog();
    if (action === 'outline') return typeof showOutline === 'function' && showOutline();
    if (action === 'settings') return openSettings();
    if (action === 'patch-history') return showPH();
    if (action === 'about') return about();
  }

  function moreMenu() {
    ui.show('<h3>المزيد من الأدوات</h3><div class="ctx">' +
      '<button type="button" class="btn" data-cp="files">' + icon('folder-open') + ' مستكشف الملفات</button>' +
      '<button type="button" class="btn" data-cp="bundle-out">' + icon('export') + ' المشروع ← نص (للذكاء)</button>' +
      '<button type="button" class="btn" data-cp="bundle-in">' + icon('import') + ' نص ← توليد ملفات</button>' +
      '<button type="button" class="btn" data-cp="manage">' + icon('folder') + ' إدارة المشروع و ZIP</button>' +
      '<button type="button" class="btn" data-cp="outline">' + icon('list') + ' مخطط الملف</button>' +
      '<button type="button" class="btn" data-cp="preview">' + icon('monitor') + ' معاينة المشروع</button>' +
      '<button type="button" class="btn" data-cp="history">' + icon('list') + ' سجل العمليات</button>' +
      '<button type="button" class="btn" data-cp="patch-history">' + icon('layers') + ' سجل الباتشات</button>' +
      '<button type="button" class="btn" data-cp="settings">' + icon('settings') + ' الإعدادات والمظهر</button>' +
      '<button type="button" class="btn" data-cp="about">' + icon('alert-circle') + ' حول CodePatcher</button>' +
      '</div><button type="button" class="btn" data-ui="cancel">إغلاق</button>',
      action => runAction(action));
  }

  window.mobileMore = moreMenu;
  window.cpRefreshHome = renderHome;

  const originalSwitchTab = window.switchTab;
  if (typeof originalSwitchTab === 'function') {
    window.switchTab = function (id) {
      const result = originalSwitchTab.apply(this, arguments);
      if (id === 'p-home') renderHome();
      if (typeof updateSymBar === 'function') updateSymBar();
      nav.querySelectorAll('.nt').forEach(el => el.classList.toggle('active', el.dataset.t === id));
      return result;
    };
  }

  const originalRender = window.render;
  if (typeof originalRender === 'function') {
    window.render = function () {
      const result = originalRender.apply(this, arguments);
      if (home.classList.contains('active')) renderHome();
      else if (typeof currentTab !== 'undefined' && currentTab === 'p-v1' && typeof showV1 === 'function') showV1();
      return result;
    };
  }

  const modalActions = new Set(['manage', 'bundle-out', 'bundle-in', 'settings', 'patch-history', 'about']);
  document.addEventListener('click', function (e) {
    const fileBtn = e.target.closest('[data-open-fid]');
    if (fileBtn) {
      const fid = fileBtn.dataset.openFid;
      if (typeof openFileById === 'function') openFileById(fid);
      return;
    }
    const el = e.target.closest('[data-cp]');
    if (!el) return;
    const action = el.dataset.cp;
    if (typeof ui !== 'undefined' && ui.modal && ui.modal.classList.contains('open') && !modalActions.has(action)) ui.close(null);
    runAction(action);
  });

  renderHome();
  if (typeof switchTab === 'function') switchTab('p-home');
})();


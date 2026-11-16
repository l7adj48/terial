'use strict';
/* شريط أدوات مستكشف الملفات: أربعة أزرار، لكل منها قائمة منسدلة في مكانها (بلا نوافذ إضافية) */
(function () {
  const defZipName = () => { const b = cleanName(commonRoot()) || 'project'; return b + '-v' + (((S.exportVer && S.exportVer[b]) || 0) + 1); };
  const needFiles = () => { if (!files.length) { toast('لا ملفات للتصدير', 'err'); return false; } return true; };
  const zipAs = mode => () => { if (needFiles()) exportZip(null, null, defZipName(), mode); };

  function ghItems() {
    const raw = ghRaw(), c = ghCfg(), linked = !!raw.token && ghRepoOk(c.repo);
    if (!raw.token) return [
      { i: 'github', t: 'ربط حساب GitHub', d: 'للدفع والمستودعات الخاصة', fn: () => githubDialog('connect') },
      { i: 'download-cloud', t: 'استيراد من GitHub', d: 'المستودعات العامة بلا ربط', fn: () => ghImportDialog() }
    ];
    return [
      { h: linked ? c.repo + ' · ' + c.branch + (c.dir ? ' · ' + c.dir : '') : 'لم يُحدَّد مستودع بعد' + (raw.login ? ' · ' + raw.login : '') },
      { i: 'upload-cloud', t: 'دفع التعديلات', d: linked ? 'commit واحد — ويمكن تغيير المستودع قبل الدفع' : 'تختار المستودع أولاً', fn: () => githubPush() },
      ...(linked ? [{ i: 'download-cloud', t: 'سحب آخر تحديثات', d: 'يسأل قبل استبدال أي ملف', fn: () => ghPull() }] : []),
      { i: 'import', t: 'استيراد مشروع من GitHub', d: 'مستودع عام أو خاص', fn: () => ghImportDialog() },
      ...(linked ? [
        { sep: 1 },
        { i: 'layers', t: 'تحويل المشروع إلى تطبيق (PWA)', d: 'يُدفع المشروع ويصير قابلاً للتثبيت', fn: () => ghConvertApp() },
        { i: 'monitor', t: 'فتح الصفحة', d: 'موقع المشروع على GitHub Pages', fn: () => ghOpenSite() }
      ] : []),
      { sep: 1 },
      { i: linked ? 'folder-open' : 'github', t: linked ? 'تغيير المستودع' : 'اختيار مستودع', fn: () => githubDialog('pick') },
      { i: 'plus', t: 'مستودع جديد', fn: () => githubDialog('create') },
      ...(linked ? [{ i: 'external', t: 'فتح المستودع', d: 'في المتصفح', fn: () => window.open('https://github.com/' + c.repo, '_blank', 'noopener') }] : []),
      { sep: 1 },
      { i: 'settings', t: 'إعدادات GitHub', fn: () => githubDialog(linked ? 'set' : 'connect') }
    ];
  }

  const MENUS = {
    new: () => [
      { i: 'file-plus', t: 'ملف جديد', fn: () => newFile() },
      { i: 'folder-plus', t: 'مجلد جديد', fn: () => newFolder() },
      { sep: 1 },
      { i: 'layers', t: 'مشروع جديد', d: 'يغلق المشروع الحالي', fn: () => newProject() }
    ],
    import: () => [
      { i: 'import', t: 'ملفات أو ZIP', d: 'من جهازك', fn: () => openFiles() },
      { i: 'github', t: 'من GitHub', d: 'مستودع عام أو خاص', fn: () => ghImportDialog() },
      { i: 'file-md', t: 'من نص / حزمة الذكاء', d: 'توليد ملفات من نص ملصوق', fn: () => importBundleDialog() }
    ],
    export: () => [
      { i: 'arrow-down', t: 'تنزيل ZIP', d: 'المشروع كاملاً', fn: zipAs('download') },
      ...(window.showSaveFilePicker ? [{ i: 'save', t: 'حفظ في…', d: 'اختر المكان والاسم', fn: zipAs(null) }] : []),
      ...(typeof navigator.canShare === 'function' ? [{ i: 'external', t: 'مشاركة', fn: zipAs('share') }] : []),
      { sep: 1 },
      { i: 'file-md', t: 'نص واحد للذكاء الاصطناعي', fn: () => exportBundleDialog('') },
      { i: 'file', t: 'الملف الحالي فقط', d: 'بدون ZIP', fn: () => { if (needFiles()) saveToDevice(true); } },
      { sep: 1 },
      { i: 'settings', t: 'خيارات متقدمة…', d: 'مجلد محدد واسم مخصص', fn: () => exportDialog() }
    ],
    github: ghItems
  };

  const closeAll = closePop;
  closePop = function () { closeAll(); document.querySelectorAll('.dtb.open').forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); }); };

  function tbMenu(btn, items) {
    closePop();
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    const back = document.createElement('div'); back.id = 'pback'; back.className = 'tb-back'; back.addEventListener('click', closePop);
    const pop = document.createElement('div'); pop.id = 'pop'; pop.className = 'pop tb-pop'; pop.setAttribute('role', 'menu');
    const fns = [];
    pop.innerHTML = items.map(it => {
      if (it.sep) return '<div class="psep"></div>';
      if (it.h) return '<div class="pi-h" dir="auto">' + esc(it.h) + '</div>';
      fns.push(it.fn);
      return '<div class="pi' + (it.cls ? ' ' + it.cls : '') + '" role="menuitem" tabindex="0" data-n="' + (fns.length - 1) + '">' + ic(it.i, it.i === 'github' ? 'brand' : '') + '<span class="pt"><b>' + esc(it.t) + '</b>' + (it.d ? '<small>' + esc(it.d) + '</small>' : '') + '</span></div>';
    }).join('');
    document.body.append(back, pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8));
    let top = r.bottom + 6; if (top + h > vh - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.style.setProperty('--tb-origin', Math.round(r.left + r.width / 2 - left) + 'px');
    pop.addEventListener('click', e => {
      const x = e.target.closest('[data-n]'); if (!x) return;
      const fn = fns[+x.dataset.n]; closePop(); if (fn) setTimeout(fn, 60);
    });
    pop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.n) { e.preventDefault(); e.target.click(); } });
  }

  const BTNS = [['new', 'file-plus', 'جديد', 'primary'], ['import', 'import', 'استيراد', ''], ['export', 'export', 'تصدير', ''], ['github', 'github', 'GitHub', '']];
  const host = $('dtool');
  host.innerHTML = '<div class="dtool-grid">' + BTNS.map(b =>
    '<button type="button" class="dtb ' + b[3] + '" data-menu="' + b[0] + '" aria-haspopup="menu" aria-expanded="false">' + ic(b[1], b[0] === 'github' ? 'brand' : '') + '<span>' + b[2] + ic('chev-down') + '</span></button>').join('') + '</div>';
  host.addEventListener('click', e => { const b = e.target.closest('[data-menu]'); if (b) tbMenu(b, MENUS[b.dataset.menu]()); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('pop') && $('pop').classList.contains('tb-pop')) { e.stopPropagation(); closePop(); } }, true);
})();

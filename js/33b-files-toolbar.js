'use strict';
/* شريط أدوات مستكشف الملفات: أربعة أزرار، لكل منها قائمة منسدلة في مكانها (بلا نوافذ إضافية) */
(function () {
  const defZipName = () => { const b = cleanName(commonRoot()) || 'project'; return b + '-v' + (((S.exportVer && S.exportVer[b]) || 0) + 1); };
  const needFiles = () => { if (!files.length) { toast('لا ملفات للتصدير', 'err'); return false; } return true; };
  const zipAs = mode => () => { if (needFiles()) exportZip(null, null, defZipName(), mode); };

  function ghItems() {
    const raw = ghRaw(), c = ghCfg(), linked = !!raw.token && ghRepoOk(c.repo);
    if (!raw.token) return [
      { i: 'github', t: 'ربط حساب GitHub', d: 'للدفع وإدارة المستودعات', fn: () => githubDialog('connect') },
      { sep: 1 },
      { i: 'download-cloud', t: 'استيراد مشروع من GitHub', d: 'مستودع عام دون ربط الحساب', fn: () => ghImportDialog() }
    ];
    return [
      { ghHead: 1 },
      { h: linked
          ? c.repo + ' · ' + c.branch + (c.dir ? ' · ' + c.dir : '')
          : 'حساب GitHub متصل' + (raw.login ? ' · ' + raw.login : '') },
      { i: 'upload-cloud', t: 'دفع التعديلات', d: linked ? 'رفع التغييرات في commit واحد' : 'اختر المستودع أولاً', fn: () => githubPush() },
      ...(linked ? [{ i: 'download-cloud', t: 'سحب آخر التحديثات', d: 'مراجعة قبل استبدال الملفات', fn: () => ghPull() }] : []),
      { sep: 1 },
      { i: 'import', t: 'استيراد مشروع من GitHub', d: 'مستودع عام أو خاص', fn: () => ghImportDialog() },
      { i: 'settings', t: 'إعدادات حساب GitHub', fn: () => githubDialog('set') }
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
  closePop = function () { closeAll(); document.querySelectorAll('.pi-gh-submenu').forEach(el => el.remove()); document.querySelectorAll('.dtb.open').forEach(b => { b.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); }); };

  function tbMenu(btn, items) {
    const anchorRect = btn.getBoundingClientRect();
    closePop();
    btn.classList.add('open'); btn.setAttribute('aria-expanded', 'true');
    const back = document.createElement('div'); back.id = 'pback'; back.className = 'tb-back'; back.addEventListener('click', closePop);
    const pop = document.createElement('div'); pop.id = 'pop'; pop.className = 'pop tb-pop'; pop.setAttribute('role', 'menu');
    const fns = [];
    pop.innerHTML = items.map(it => {
      if (it.sep) return '<div class="psep"></div>';
      if (it.ghHead) return '<div class="pi-gh-head"><span>' + ic('github', 'brand') + '<b>GitHub</b></span><button type="button" class="pi-gh-manage" data-gh-manage aria-expanded="false">إدارة المستودع' + ic('chev-down') + '</button></div>';
      if (it.h) return '<div class="pi-h" dir="auto">' + esc(it.h) + '</div>';
      fns.push(it.fn);
      return '<div class="pi' + (it.cls ? ' ' + it.cls : '') + '" role="menuitem" tabindex="0" data-n="' + (fns.length - 1) + '">' + ic(it.i, it.i === 'github' ? 'brand' : '') + '<span class="pt"><b>' + esc(it.t) + '</b>' + (it.d ? '<small>' + esc(it.d) + '</small>' : '') + '</span></div>';
    }).join('');
    document.body.append(back, pop);
    const r = anchorRect, w = pop.offsetWidth, h = pop.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8));
    let top = r.bottom + 6; if (top + h > vh - 8) top = Math.max(8, r.top - h - 6);
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
    pop.style.setProperty('--tb-origin', Math.round(r.left + r.width / 2 - left) + 'px');
    const manageFns = [];
    const manageSub = document.createElement('div');
    manageSub.className = 'pi-gh-submenu';
    manageSub.hidden = true;
    manageSub.setAttribute('role', 'menu');
    document.body.appendChild(manageSub);
    const manageItems = () => {
      const raw = ghRaw(), cfg = ghCfg(), linked = !!raw.token && ghRepoOk(cfg.repo);
      return [
        { i: 'folder-open', t: linked ? 'تغيير المستودع' : 'اختيار مستودع', fn: () => githubDialog('pick') },
        { i: 'plus', t: 'إنشاء مستودع جديد', fn: () => githubDialog('create') },
        ...(linked ? [{ i: 'external', t: 'فتح المستودع على GitHub', fn: () => window.open('https://github.com/' + cfg.repo, '_blank', 'noopener') }] : [])
      ];
    };
    pop.addEventListener('click', e => {
      const manage = e.target.closest('[data-gh-manage]');
      if (manage) {
        const opening = manageSub.hidden;
        manageSub.hidden = !opening;
        manage.setAttribute('aria-expanded', String(opening));
        manage.innerHTML = 'إدارة المستودع' + ic(opening ? 'chev-up' : 'chev-down');
        if (opening) {
          manageFns.length = 0;
          manageSub.innerHTML = manageItems().map(it => {
            manageFns.push(it.fn);
            return '<button type="button" class="pi-gh-subitem" data-gh-action="' + (manageFns.length - 1) + '">' + ic(it.i) + '<span>' + esc(it.t) + '</span></button>';
          }).join('');
          const sr = manageSub.getBoundingClientRect();
          const pr = pop.getBoundingClientRect();
          const mr = manage.getBoundingClientRect();
          const left = Math.max(8, Math.min(mr.left + mr.width / 2 - sr.width / 2, window.innerWidth - sr.width - 8));
          manageSub.style.left = left + 'px';
          manageSub.style.top = (mr.bottom + 5) + 'px';
        }
        return;
      }
      const x = e.target.closest('[data-n]'); if (!x) return;
      const fn = fns[+x.dataset.n]; closePop(); if (fn) setTimeout(fn, 60);
    });
    manageSub.addEventListener('click', e => {
      const action = e.target.closest('[data-gh-action]');
      if (!action) return;
      const fn = manageFns[+action.dataset.ghAction];
      closePop(); if (fn) setTimeout(fn, 60);
    });
    pop.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset && e.target.dataset.n) { e.preventDefault(); e.target.click(); } });
  }

  const BTNS = [['new', 'file-plus', 'جديد', 'primary'], ['import', 'import', 'استيراد', ''], ['export', 'export', 'تصدير', ''], ['github', 'github', 'GitHub', '']];
  const host = $('dtool');
  host.innerHTML = '<div class="dtool-grid">' + BTNS.map(b =>
    '<button type="button" class="dtb ' + b[3] + '" data-menu="' + b[0] + '" aria-haspopup="menu" aria-expanded="false">' + ic(b[1], b[0] === 'github' ? 'brand' : '') + '<span>' + b[2] + ic('chev-down') + '</span></button>').join('') + '</div>';
  host.insertAdjacentHTML('beforeend', '<div class="dtool-grid two"><button type="button" class="dtb" data-go="app">' + ic('layers') + '<span>تحويل إلى تطبيق</span></button><button type="button" class="dtb" data-go="site">' + ic('monitor') + '<span>فتح التطبيق</span></button></div>');
  host.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { if (g.dataset.go === 'app') ghConvertApp(); else ghOpenSite(); } });
  host.addEventListener('click', e => { const b = e.target.closest('[data-menu]'); if (b) tbMenu(b, MENUS[b.dataset.menu]()); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('pop') && $('pop').classList.contains('tb-pop')) { e.stopPropagation(); closePop(); } }, true);
})();

// تشغيل: node tools/check.js
// يفحص: صياغة كل ملف JS، تسجيله في index.html وsw.js، وتكرار أسماء الدوال بين الملفات.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), sw = read('sw.js');
let bad = 0; const fail = m => { bad++; console.log('✗ ' + m); };
const jsFiles = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).sort();
const cssFiles = fs.readdirSync(path.join(root, 'css')).filter(f => f.endsWith('.css'));
const seen = {};
for (const f of jsFiles) {
  const r = cp.spawnSync(process.execPath, ['--check', path.join(root, 'js', f)], { encoding: 'utf8' });
  if (r.status) fail(f + ': خطأ صياغة\n' + r.stderr.split('\n').slice(0, 4).join('\n'));
  if (!html.includes(`src="js/${f}"`)) fail(f + ': غير مضاف في index.html');
  if (!sw.includes(`./js/${f}`)) fail(f + ': غير مضاف في قائمة sw.js');
  for (const m of read('js/' + f).matchAll(/^(?:async function|function|class|const|let|var) +([A-Za-z_$][\w$]*)/gm)) {
    if (seen[m[1]]) fail(`الاسم ${m[1]} مكرر: ${seen[m[1]]} و ${f}`); else seen[m[1]] = f;
  }
}
const order = [...html.matchAll(/src="js\/([^"]+)"/g)].map(m => m[1]);
if (order.join() !== jsFiles.join()) fail('ترتيب <script> في index.html لا يطابق ترتيب الأسماء');
for (const f of cssFiles) { if (!html.includes(`css/${f}`)) fail(f + ': غير مضاف في index.html'); if (!sw.includes(`./css/${f}`)) fail(f + ': غير مضاف في sw.js'); }

// ---- فحوص إضافية ----
const allJs = jsFiles.map(f => [f, read('js/' + f)]);
// 1) كل onclick في index.html يشير لدالة معرّفة
const defined = new Set();
for (const [, src] of allJs) {
  for (const m of src.matchAll(/(?:function\s+|window\.|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)/g)) defined.add(m[1]);
}
for (const m of html.matchAll(/onclick="\s*([A-Za-z_$][\w$]*)\s*\(/g)) if (!defined.has(m[1])) fail(`onclick يشير لدالة غير معرّفة: ${m[1]}()`);
// 2) كل data-cp في الشاشة الرئيسية له فرع في runAction
if (jsFiles.includes('30-home.js')) {
  const home = read('js/30-home.js');
  const run = (home.match(/function runAction[\s\S]*?\n  }\n/) || [''])[0];
  for (const m of new Set([...home.matchAll(/data-cp="([\w-]+)"/g)].map(x => x[1]))) if (!run.includes(`'${m}'`)) fail(`data-cp="${m}" بلا فرع في runAction`);
}
// 3) لا تنسيقات style="..." مبعثرة (المسموح: متغيرات CSS الديناميكية، وشاشة الاسترداد المستقلة)
const styleLeak = /style=\\?["'](?!--)/g;
if (styleLeak.test(html)) fail('index.html فيه style="..." — استخدم فئة في css/');
for (const [f, src] of allJs) if (f !== '19-isolation-selftest.js' && /style=\\?["'](?!--)/.test(src)) fail(f + ': style="..." مضمّن — استخدم فئة أو دوال 06-ui-core.js');
// 4) التنقل السفلي معرّف في index.html وفيه الرئيسية
if (!/class="nav"[\s\S]*?data-t="p-home"/.test(html) || !html.includes('id="p-home"')) fail('التنقل أو #p-home غير معرّف في index.html');
// 5) الوثائق لا تثبّت رقم نسخة الـ service worker
for (const d of ['README.md', 'DESIGN-SYSTEM.md']) { try { if (/codepatcher-v\d+/.test(read(d))) fail(d + ': رقم نسخة sw ثابت يتقادم — استخدم codepatcher-vN'); } catch (e) { } }

console.log(bad ? `\n${bad} مشكلة` : `✓ سليم: ${jsFiles.length} ملف JS و ${cssFiles.length} ملف CSS`);
process.exit(bad ? 1 : 0);

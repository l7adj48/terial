'use strict';
/* تطبيق PWA */
/* ===== v30.1: تطبيق قابل للتثبيت (PWA) + تنبيه بيئة الملف المباشر ===== */
const SECURE = !!window.isSecureContext && /^https?:$/.test(location.protocol);
const STANDALONE = (() => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch (e) { return false; } })();
let deferredInstall = null;
function noPickMsg() {
  return SECURE ? 'هذا المتصفح لا يسمح باختيار مكان الحفظ — يُحفظ في مجلد التنزيلات'
    : 'الملف مفتوح مباشرة من الجهاز فلا تعمل قائمة اختيار المكان. حلّ فوري: كروم ← الإعدادات ← التنزيلات ← «اسأل أين تريد حفظ الملفات». حلّ دائم: افتح التطبيق من رابط HTTPS (ثبّته من الإعدادات ‹ تثبيت كتطبيق)';
}
function setupPWA() {
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
  window.addEventListener('appinstalled', () => { deferredInstall = null; toast('تم تثبيت التطبيق', 'ok'); });
  if (!SECURE) return;
  try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {}); } catch (e) {}
}
async function installApp() {
  if (STANDALONE) return toast('التطبيق يعمل كتطبيق مثبّت الآن', 'ok');
  if (!SECURE) return ui.show('<h3>لا يمكن التثبيت من الملف المباشر</h3><div class="slabel">التثبيت وقائمة اختيار مكان الحفظ يحتاجان فتح CodePatcher من رابط HTTPS (مجاني عبر GitHub Pages). بعد الاستضافة افتح الرابط في كروم ثم اختر من هنا «تثبيت كتطبيق».<br><br>مهم: صدّر مشروعك ZIP من هنا أولاً ثم استورده في النسخة المستضافة، لأن مساحة التخزين تختلف بين الملف المباشر والرابط.</div><button type="button" class="btn" data-ui="cancel">إغلاق</button>');
  if (deferredInstall) { try { deferredInstall.prompt(); await deferredInstall.userChoice; } catch (e) { } deferredInstall = null; return; }
  toast('من قائمة كروم ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 'ok');
}
setupPWA();
const editor = $('editor'), hlInner = $('hlInner'), gInner = $('gInner'), gutter = $('gutter');

/*ENGINE_START*/

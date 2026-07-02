try {
  var t = localStorage.getItem('crm-theme');
  var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if ((t || sys) === 'dark') document.documentElement.classList.add('dark');
} catch (e) {}
try {
  var lang = localStorage.getItem('crm-lang') || 'en';
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  if (lang === 'ar') document.documentElement.classList.add('lang-ar');
} catch (e) {}
try {
  // Mark the document when running as an INSTALLED app (home-screen / standalone)
  // vs. a normal browser tab. Runs before first paint so the native launch
  // screen and app-only touch behaviours apply with no flash. The website in a
  // regular browser keeps normal website behaviour.
  var standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('pwa-standalone');
} catch (e) {}

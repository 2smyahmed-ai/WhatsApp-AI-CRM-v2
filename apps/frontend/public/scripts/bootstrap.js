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

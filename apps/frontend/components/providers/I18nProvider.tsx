'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n, { type Language, LANGUAGE_STORAGE_KEY, getStoredLanguage, isRTL } from '@/lib/i18n';

// Module-level reset: runs whenever this module is evaluated on the client.
// In HMR/Turbopack dev mode, i18n.ts may not be re-evaluated between reloads,
// leaving i18n.language as 'ar' while the server always produces English HTML.
// This ensures i18n is at 'en' before any React hydration render runs.
if (typeof window !== 'undefined' && i18n.isInitialized && i18n.language !== 'en') {
  i18n.changeLanguage('en');
}

interface I18nContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
  isRTL: boolean;
}

const I18nContext = createContext<I18nContextValue>({
  language: 'en',
  setLanguage: () => {},
  dir: 'ltr',
  isRTL: false,
});

export function useLanguage() {
  return useContext(I18nContext);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // `language` is always 'en' for the server render AND the first client render.
  // The stored language (which may be Arabic) is only applied after mount, in an
  // effect. This guarantees the server-rendered HTML and the first client render
  // are identical, so there is never a hydration mismatch — the localized tree is
  // produced in a second, client-only render once `mounted` flips to true.
  const [language, setLanguageState] = useState<Language>('en');
  const [mounted, setMounted] = useState(false);

  const applyLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    i18n.changeLanguage(lang);
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    const dir = isRTL(lang) ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    // Arabic fonts applied via CSS class on <html>
    if (lang === 'ar') {
      document.documentElement.classList.add('lang-ar');
    } else {
      document.documentElement.classList.remove('lang-ar');
    }
  }, []);

  useEffect(() => {
    applyLanguage(getStoredLanguage());
    setMounted(true);
  }, [applyLanguage]);

  const setLanguage = useCallback((lang: Language) => {
    applyLanguage(lang);
  }, [applyLanguage]);

  const dir = isRTL(language) ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ language, setLanguage, dir, isRTL: isRTL(language) }}>
      <I18nextProvider i18n={i18n}>
        {mounted
          ? children
          : (
            // Language-neutral placeholder rendered on the server and on the
            // first client paint. bootstrap.js has already applied the correct
            // theme/dir to <html>, so this is a clean, flash-free shell.
            <div suppressHydrationWarning style={{ minHeight: '100vh' }} />
          )}
      </I18nextProvider>
    </I18nContext.Provider>
  );
}

'use client';

import { useEffect } from 'react';

/**
 * Fades out and removes the static #app-splash launch screen once the app is
 * interactive. The splash markup lives in the root layout (server HTML) so it
 * paints instantly with no white flash; this controller just dismisses it.
 *
 * It only *shows* in the installed app (CSS gates #app-splash behind
 * html.pwa-standalone), but the dismiss logic is harmless in a browser tab too.
 * Because the splash is part of the initial document, it appears on cold
 * start / hard refresh only — never on client-side navigations.
 */
const MIN_VISIBLE_MS = 700; // let the entrance animation breathe
const SAFETY_MS = 4000;     // never trap the user behind the splash

export default function SplashController() {
  useEffect(() => {
    const el = document.getElementById('app-splash');
    if (!el) return;

    const start = performance.now();
    let dismissed = false;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start));
      window.setTimeout(() => {
        el.classList.add('is-hiding');
        // Remove after the CSS opacity transition (0.5s) finishes.
        window.setTimeout(() => el.remove(), 550);
      }, wait);
    };

    if (document.readyState === 'complete') dismiss();
    else window.addEventListener('load', dismiss, { once: true });

    const safety = window.setTimeout(dismiss, SAFETY_MS);
    return () => {
      window.clearTimeout(safety);
      window.removeEventListener('load', dismiss);
    };
  }, []);

  return null;
}

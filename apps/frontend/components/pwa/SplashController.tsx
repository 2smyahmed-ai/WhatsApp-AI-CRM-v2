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
 *
 * Dismiss signal: this effect running means React has hydrated and the first
 * frame of real UI is committed behind the splash — that's the moment the app
 * is usable, and it fires well before window `load` (which waits on every
 * image). We still keep `load` + a safety timer as fallbacks.
 */
const MIN_VISIBLE_MS = 1600; // premium startup animation — hold even if ready early
const EXIT_MS = 700;         // blur+scale content exit (0.5s) + delayed backdrop fade
const SAFETY_MS = 5000;      // never trap the user behind the splash

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
        window.setTimeout(() => el.remove(), EXIT_MS);
      }, wait);
    };

    // Hydration just finished — give the app one painted frame, then go.
    const raf = requestAnimationFrame(() => requestAnimationFrame(dismiss));

    window.addEventListener('load', dismiss, { once: true });
    const safety = window.setTimeout(dismiss, SAFETY_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
      window.removeEventListener('load', dismiss);
    };
  }, []);

  return null;
}

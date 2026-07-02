/**
 * Hard refresh for the installed app / mobile web.
 *
 * A normal reload isn't enough when the PWA is stuck on a stale shell: the
 * service worker keeps serving cached _next/static chunks and a waiting SW
 * update never activates. This clears the Cache Storage layer, activates any
 * waiting service worker, then does a real full-document reload.
 *
 * Deliberately does NOT touch cookies, localStorage or IndexedDB — the
 * NextAuth session cookie and access/refresh tokens survive, so the user
 * lands back on the same screen still signed in, just with fresh code + data.
 */

declare global {
  interface Window {
    __swWaitingWorker?: ServiceWorker | null;
  }
}

/** Race a promise against a timeout so a hung SW/cache API can't block the reload. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | void> {
  return Promise.race([promise, new Promise<void>((resolve) => setTimeout(resolve, ms))]);
}

export async function hardRefresh(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    // 1. If an updated service worker is parked in "waiting", activate it now
    //    so the reload boots the new version instead of the stale one.
    const waiting = window.__swWaitingWorker;
    if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });

    if ('serviceWorker' in navigator) {
      const reg = await withTimeout(navigator.serviceWorker.getRegistration(), 1500);
      if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      // Nudge an update check so the reload picks up a brand-new sw.js too.
      if (reg) await withTimeout(reg.update().catch(() => undefined), 1500);
    }

    // 2. Drop every Cache Storage bucket (app shell, hashed assets, icons).
    //    Auth lives in cookies/localStorage and is untouched.
    if ('caches' in window) {
      await withTimeout(
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))),
        2500,
      );
    }
  } catch {
    // Best effort — the reload below still gets fresh HTML (navigations are
    // network-first in sw.js), which is the part that matters.
  }

  // 3. Real full-document reload. replace() avoids stacking a history entry,
  //    so Back doesn't return to the stale copy of the page.
  window.location.replace(window.location.href);
}

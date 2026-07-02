import { api } from './api';

/** VAPID public keys are URL-safe base64 — convert to the Uint8Array the
 * PushManager expects for applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

let inFlight = false;
let done = false;

/**
 * Ensure this device is subscribed to Web Push so the user gets phone/desktop
 * notifications for hot leads and other important alerts — even when the app is
 * closed. Safe to call repeatedly; only acts once permission is granted and push
 * is configured on the server. Never throws.
 */
export async function ensurePushSubscription(): Promise<void> {
  if (done || inFlight) return;
  inFlight = true;
  try {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;

    let permission = Notification.permission;
    if (permission === 'default') permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Is push configured server-side? (VAPID keys present.)
    const info = await api
      .get<{ enabled: boolean; publicKey: string | null }>('/api/push/public-key')
      .catch(() => null);
    if (!info?.enabled || !info.publicKey) return;

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(info.publicKey) as BufferSource,
      });
    }
    await api.post('/api/push/subscribe', { subscription: sub.toJSON() });
    done = true;
  } catch {
    /* best-effort — allow a retry on the next call */
  } finally {
    inFlight = false;
  }
}

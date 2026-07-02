import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { env } from '../lib/env';
import { logger } from '../lib/logger';

/**
 * Web Push (phone / desktop) notifications. Fires alongside the in-app socket
 * notification so agents get alerted even when the app is closed.
 *
 * Enabled only when VAPID keys are configured (env.webPush). Everything here is
 * a safe no-op otherwise, so the CRM runs fine without push set up.
 */
export interface PushPayload {
  title: string;
  body?: string;
  /** In-app path to open when the notification is tapped. */
  url?: string;
  /** Collapse key — a newer notification with the same tag replaces the older. */
  tag?: string;
  type?: string;
}

interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

class PushService {
  private configured = false;

  private init(): boolean {
    if (this.configured) return true;
    const cfg = env.webPush;
    if (!cfg) return false;
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    this.configured = true;
    return true;
  }

  isEnabled(): boolean {
    return Boolean(env.webPush);
  }

  get publicKey(): string | null {
    return env.webPush?.publicKey ?? null;
  }

  /** Store (or refresh) a device subscription for a user. Idempotent per endpoint. */
  async saveSubscription(userId: string, sub: BrowserSubscription, userAgent?: string): Promise<void> {
    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
      update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
  }

  async removeSubscription(endpoint: string): Promise<void> {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }

  /**
   * Send a push to every device of the given users. Best-effort and never
   * throws into the caller — dead subscriptions (410/404) are pruned.
   */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.init() || userIds.length === 0) return;

    const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    if (subs.length === 0) return;

    const data = JSON.stringify(payload);
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            data,
            { TTL: 600, urgency: 'high' },
          );
        } catch (err) {
          const code = (err as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) {
            // Subscription expired / unsubscribed — drop it.
            await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } }).catch(() => {});
          } else {
            logger.warn('push.send_failed', {
              code,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }),
    );
  }
}

export const pushService = new PushService();

import { Router } from 'express';
import { authMiddleware } from '../../auth/auth.middleware';
import { pushService } from '../../notifications/push.service';

const router = Router();
router.use(authMiddleware);

function userId(req: any): string {
  return req.user?.id;
}

// ── GET /api/push/public-key — VAPID public key + whether push is enabled ──────
router.get('/public-key', (_req, res) => {
  res.json({ enabled: pushService.isEnabled(), publicKey: pushService.publicKey });
});

// ── POST /api/push/subscribe — register this device for push ───────────────────
router.post('/subscribe', async (req, res) => {
  try {
    const subscription = req.body?.subscription;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid push subscription' });
    }
    await pushService.saveSubscription(userId(req), subscription, req.get('user-agent') || undefined);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── POST /api/push/unsubscribe — drop this device's subscription ───────────────
router.post('/unsubscribe', async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (endpoint) await pushService.removeSubscription(endpoint);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

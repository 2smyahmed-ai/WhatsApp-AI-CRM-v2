import { Router } from 'express';
import { authMiddleware } from '../../auth/auth.middleware';
import { notificationsService } from '../../notifications/notifications.service';
import { emitToUser } from '../../realtime/socket';

const router = Router();
router.use(authMiddleware);

function userId(req: any): string {
  return req.user?.id;
}

// ── POST /api/notifications/test — DEV ONLY: push a sample lead alert to me ─────
// Lets you preview the LeadAlertPopup without waiting for a real AI-qualified
// lead. Body: { type?: 'NEEDS_ATTENTION' | 'BUYING_INTENT' | 'STATUS_UPGRADE' }.
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', (req, res) => {
    const type = (req.body?.type as string) || 'NEEDS_ATTENTION';
    emitToUser(userId(req), 'notification:new', {
      id: `test-${Date.now()}`,
      type,
      priority: 'HIGH',
      title: { en: 'Sara Ahmed — test alert', ar: 'سارة أحمد — تنبيه تجريبي' },
      body: {
        en: 'Customer is asking about pricing and ready to buy. Reply now.',
        ar: 'العميل يسأل عن الأسعار وجاهز للشراء. الرجاء الرد الآن.',
      },
      contactId: null,
      conversationId: null,
      isRead: false,
      createdAt: new Date().toISOString(),
    });
    res.json({ success: true });
  });
}

// ── GET /api/notifications — recent notifications for the current user ──────────
router.get('/', async (req, res) => {
  try {
    const unreadOnly = (req.query.unreadOnly as string) === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const items = await notificationsService.list(userId(req), { unreadOnly, limit });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── GET /api/notifications/unread-count ────────────────────────────────────────
router.get('/unread-count', async (req, res) => {
  try {
    const count = await notificationsService.unreadCount(userId(req));
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── POST /api/notifications/read-all ───────────────────────────────────────────
router.post('/read-all', async (req, res) => {
  try {
    await notificationsService.markAllRead(userId(req));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── POST /api/notifications/:id/read ───────────────────────────────────────────
router.post('/:id/read', async (req, res) => {
  try {
    await notificationsService.markRead(userId(req), req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

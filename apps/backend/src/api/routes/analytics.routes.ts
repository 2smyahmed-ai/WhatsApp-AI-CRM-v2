import { Router } from 'express';
import { AnalyticsService } from '../../analytics/analytics.service';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/overview', checkPermission('read', 'dashboard'), async (req, res) => {
  try {
    const overview = await AnalyticsService.getOverview();
    res.json(overview);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.get('/messages', checkPermission('read', 'dashboard'), async (req, res) => {
  try {
    const messages = await AnalyticsService.getMessagesChart();
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.get('/agents', checkPermission('read', 'dashboard'), async (req, res) => {
  try {
    const stats = await AnalyticsService.getAgentStats((req as any).user?.teamId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.get('/pipeline', checkPermission('read', 'dashboard'), async (req, res) => {
  try {
    const stats = await AnalyticsService.getPipelineStats((req as any).user?.teamId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

export default router;

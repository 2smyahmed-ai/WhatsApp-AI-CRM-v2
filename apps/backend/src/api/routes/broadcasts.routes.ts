import { Router } from 'express';
import { BroadcastsService } from '../../broadcasts/broadcasts.service';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'broadcasts'), async (req, res) => {
  try {
    const broadcasts = await BroadcastsService.getBroadcasts((req as any).user?.teamId);
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.get('/:id', checkPermission('read', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.getBroadcastById(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.post('/', checkPermission('create', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.createBroadcast({
      ...req.body,
      teamId: (req as any).user?.teamId,
    });
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.put('/:id', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.updateBroadcast(req.params.id, {
      ...req.body,
      teamId: (req as any).user?.teamId,
    });
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.post('/:id/send', checkPermission('create', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.sendBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.post('/:id/pause', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.pauseBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    res.status(400).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.post('/:id/resume', checkPermission('update', 'broadcasts'), async (req, res) => {
  try {
    const broadcast = await BroadcastsService.resumeBroadcast(req.params.id, (req as any).user?.teamId);
    res.json(broadcast);
  } catch (error) {
    res.status(400).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.delete('/:id', checkPermission('delete', 'broadcasts'), async (req, res) => {
  try {
    await BroadcastsService.deleteBroadcast(req.params.id, (req as any).user?.teamId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.get('/:id/stats', checkPermission('read', 'broadcasts'), async (req, res) => {
  try {
    const stats = await BroadcastsService.getBroadcastStats(req.params.id, (req as any).user?.teamId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

export default router;

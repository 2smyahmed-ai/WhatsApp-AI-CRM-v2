import { Router } from 'express';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { DealsService } from '../../deals/deals.service';

const router = Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'deals'), async (req, res) => {
  try {
    const deals = await DealsService.getDeals((req as any).user?.teamId);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/', checkPermission('create', 'deals'), async (req, res) => {
  try {
    const deal = await DealsService.createDeal({ ...req.body, teamId: (req as any).user?.teamId });
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/:id', checkPermission('update', 'deals'), async (req, res) => {
  try {
    const deal = await DealsService.updateDeal(req.params.id, { ...req.body, teamId: (req as any).user?.teamId });
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id', checkPermission('delete', 'deals'), async (req, res) => {
  try {
    const result = await DealsService.deleteDeal(req.params.id, (req as any).user?.teamId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

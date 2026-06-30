import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { DealsService } from '../../deals/deals.service';
import { HttpError, isManager, type AuthActor } from '../../auth/authorize';
import { validateBody } from '../validate';

const router = Router();

router.use(authMiddleware);

const stageEnum = z.enum(['NEW', 'INTERESTED', 'NEGOTIATION', 'CLOSED']);

const createDealSchema = z.object({
  contactId: z.string().min(1).optional(),
  ownerId: z.string().min(1).optional(),
  title: z.string().min(1).max(200),
  stage: stageEnum.optional(),
  value: z.coerce.number().min(0).optional(),
  notes: z.string().max(5000).optional(),
});

const updateDealSchema = createDealSchema.partial();

function actorOf(req: any): AuthActor {
  return { id: req.user?.id, role: req.user?.role, teamId: req.user?.teamId ?? null };
}

function sendError(res: any, error: unknown) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ error: error.message });
  }
  return res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
}

router.get('/', checkPermission('read', 'deals'), async (req, res) => {
  try {
    const user = (req as any).user;
    // Managers see every team's deals (matching the realtime events they now
    // receive); team members are scoped to their own team.
    const scopeTeamId = isManager(user?.role) ? undefined : user?.teamId;
    const deals = await DealsService.getDeals(scopeTeamId);
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/', checkPermission('create', 'deals'), validateBody(createDealSchema), async (req, res) => {
  try {
    const deal = await DealsService.createDeal({ ...req.body, teamId: (req as any).user?.teamId });
    res.json(deal);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/:id', checkPermission('update', 'deals'), validateBody(updateDealSchema), async (req, res) => {
  try {
    const actor = actorOf(req);
    const deal = await DealsService.updateDeal(req.params.id, { ...req.body, teamId: actor.teamId ?? undefined }, actor);
    res.json(deal);
  } catch (error) {
    sendError(res, error);
  }
});

router.delete('/:id', checkPermission('delete', 'deals'), async (req, res) => {
  try {
    const result = await DealsService.deleteDeal(req.params.id, actorOf(req));
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;

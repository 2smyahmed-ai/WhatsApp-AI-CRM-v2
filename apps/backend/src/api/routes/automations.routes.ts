import { Router } from 'express';
import { AutomationsService } from '../../automations/automations.service';
import { FlowsService } from '../../automations/flows.service';
import { authMiddleware, checkPermission, requireAdmin } from '../../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'automations'), async (req, res) => {
  try {
    const rules = await AutomationsService.getRules((req as any).user?.teamId);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error' });
  }
});

router.post('/', checkPermission('create', 'automations'), async (req, res) => {
  try {
    const rule = await AutomationsService.createRule({
      ...req.body,
      teamId: (req as any).user?.teamId,
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.put('/:id', checkPermission('update', 'automations'), async (req, res) => {
  try {
    const rule = await AutomationsService.updateRule(req.params.id, req.body);
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.delete('/:id', checkPermission('delete', 'automations'), async (req, res) => {
  try {
    await AutomationsService.deleteRule(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

router.put('/:id/toggle', checkPermission('update', 'automations'), async (req, res) => {
  try {
    const rule = await AutomationsService.toggleRule(req.params.id);
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: (error instanceof Error ? error.message : 'Unknown error') });
  }
});

// ── Multi-step flows ──────────────────────────────────────────────────────────

router.get('/flows', checkPermission('read', 'automations'), async (req, res) => {
  try {
    const flows = await FlowsService.getFlows((req as any).user?.teamId);
    res.json(flows);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/flows/:id', checkPermission('read', 'automations'), async (req, res) => {
  try {
    const flow = await FlowsService.getFlow(req.params.id);
    if (!flow) return res.status(404).json({ error: 'Flow not found' });
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/flows', checkPermission('create', 'automations'), async (req, res) => {
  try {
    const flow = await FlowsService.createFlow({ ...req.body, teamId: (req as any).user?.teamId });
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/flows/:id', checkPermission('update', 'automations'), async (req, res) => {
  try {
    const flow = await FlowsService.updateFlow(req.params.id, req.body);
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/flows/:id', checkPermission('delete', 'automations'), async (req, res) => {
  try {
    await FlowsService.deleteFlow(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/flows/:id/toggle', checkPermission('update', 'automations'), async (req, res) => {
  try {
    const flow = await FlowsService.toggleFlow(req.params.id);
    res.json(flow);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

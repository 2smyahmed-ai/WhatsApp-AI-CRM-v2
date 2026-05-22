import { Router } from 'express';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { prisma } from '../../lib/prisma';
import templateService from '../../services/template.service';
import metaTemplateService from '../../services/meta-template.service';

const router = Router();

router.use(authMiddleware);

// ── List ────────────────────────────────────────────────────────────────────
router.get('/', checkPermission('read', 'templates'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const where = teamId ? { OR: [{ teamId }, { teamId: null }] } : {};
    const templates = await (prisma as any).messageTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Create ──────────────────────────────────────────────────────────────────
router.post('/', checkPermission('create', 'templates'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { name, content, mediaUrl, type, status, payload, variables, language, category } = req.body;
    if (!name?.trim() || !(content?.trim() || payload)) {
      return res.status(400).json({ error: 'name and content or payload are required' });
    }

    const template = await (prisma as any).messageTemplate.create({
      data: {
        name: name.trim(),
        content: content?.trim() ?? '',
        mediaUrl: mediaUrl || null,
        teamId,
        type: type || undefined,
        status: status || undefined,
        payload: payload || undefined,
        variables: variables || undefined,
        language: language || 'en_US',
        category: category || null,
      },
    });
    res.status(201).json(template);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Update ──────────────────────────────────────────────────────────────────
router.put('/:id', checkPermission('update', 'templates'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { name, content, mediaUrl, type, status, payload, variables, language, category } = req.body;
    const existing = await (prisma as any).messageTemplate.findFirst({
      where: { id: req.params.id, ...(teamId ? { teamId } : {}) },
    });
    if (!existing) return res.status(404).json({ error: 'Template not found' });

    const template = await (prisma as any).messageTemplate.update({
      where: { id: req.params.id },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(content !== undefined ? { content: content?.trim() ?? '' } : {}),
        ...(mediaUrl !== undefined ? { mediaUrl: mediaUrl || null } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(payload !== undefined ? { payload } : {}),
        ...(variables !== undefined ? { variables } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(category !== undefined ? { category } : {}),
      },
    });
    res.json(template);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Delete ──────────────────────────────────────────────────────────────────
router.delete('/:id', checkPermission('delete', 'templates'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const existing = await (prisma as any).messageTemplate.findFirst({
      where: { id: req.params.id, ...(teamId ? { teamId } : {}) },
    });
    if (!existing) return res.status(404).json({ error: 'Template not found' });
    await (prisma as any).messageTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Render (variable preview) ───────────────────────────────────────────────
router.post('/:id/render', checkPermission('read', 'templates'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const vars = req.body?.variables || {};
    const template = await (prisma as any).messageTemplate.findFirst({
      where: { id: req.params.id, ...(teamId ? { teamId } : {}) },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const rendered = templateService.renderTemplate(template, vars);
    res.json(rendered);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Submit to Meta for approval ─────────────────────────────────────────────
router.post('/:id/submit', checkPermission('update', 'templates'), async (req, res) => {
  try {
    const result = await metaTemplateService.submit(req.params.id);
    res.json({ success: true, meta: result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Sync approved templates from Meta ──────────────────────────────────────
router.post('/sync', checkPermission('update', 'templates'), async (req, res) => {
  try {
    const result = await metaTemplateService.syncFromMeta();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Send a template message ─────────────────────────────────────────────────
router.post('/:id/send', checkPermission('create', 'messages'), async (req, res) => {
  try {
    const { phone, variables } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });
    const result = await metaTemplateService.send(phone, req.params.id, variables ?? {});
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Delete from Meta ────────────────────────────────────────────────────────
router.delete('/:id/meta', checkPermission('delete', 'templates'), async (req, res) => {
  try {
    await metaTemplateService.deleteFromMeta(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

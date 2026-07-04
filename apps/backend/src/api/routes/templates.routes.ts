import { Router } from 'express';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { prisma } from '../../lib/prisma';
import { renderTemplate, sendTemplate } from '../../services/template.service';

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
      where: { id: req.params.id, ...(teamId ? { OR: [{ teamId }, { teamId: null }] } : {}) },
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
      where: { id: req.params.id, ...(teamId ? { OR: [{ teamId }, { teamId: null }] } : {}) },
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
      where: { id: req.params.id, ...(teamId ? { OR: [{ teamId }, { teamId: null }] } : {}) },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    const rendered = renderTemplate(template, vars);
    res.json(rendered);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Send via Baileys (single phone / test send) ─────────────────────────────
router.post('/:id/send', checkPermission('create', 'messages'), async (req, res) => {
  try {
    const { phone, variables } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const teamId = (req as any).user?.teamId;
    const template = await (prisma as any).messageTemplate.findFirst({
      where: { id: req.params.id, ...(teamId ? { OR: [{ teamId }, { teamId: null }] } : {}) },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const result = await sendTemplate(phone, template, variables ?? {});
    res.json({ success: true, messageId: result.messageId });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── Send to selected conversations (bulk, personalized per contact) ─────────
const AUTO_DELAY_MIN_MS = 500;
const AUTO_DELAY_MAX_MS = 1500;
const MAX_BULK_RECIPIENTS = 100;

router.post('/:id/send-bulk', checkPermission('create', 'messages'), async (req, res) => {
  try {
    const { conversationIds, variables } = req.body as {
      conversationIds?: string[];
      variables?: Record<string, string>;
    };
    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return res.status(400).json({ error: 'conversationIds is required' });
    }
    if (conversationIds.length > MAX_BULK_RECIPIENTS) {
      return res.status(400).json({
        error: `Maximum ${MAX_BULK_RECIPIENTS} recipients per send — use Broadcasts for larger audiences`,
      });
    }

    const teamId = (req as any).user?.teamId;
    const template = await (prisma as any).messageTemplate.findFirst({
      where: { id: req.params.id, ...(teamId ? { OR: [{ teamId }, { teamId: null }] } : {}) },
    });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      include: { contact: { select: { name: true, phone: true } } },
    });
    const byId = new Map(conversations.map(c => [c.id, c]));

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < conversationIds.length; i++) {
      const conv = byId.get(conversationIds[i]);
      if (!conv?.contact?.phone) { failed += 1; continue; }

      const contactName = conv.contact.name?.trim() || '';
      // Contact fields win over manually entered values for the auto variables.
      const perContactVars: Record<string, string> = {
        ...(variables ?? {}),
        ...(contactName ? { name: contactName, first_name: contactName.split(/\s+/)[0] } : {}),
        phone: conv.contact.phone,
      };

      try {
        await sendTemplate(conv.contact.phone, template, perContactVars, { conversationId: conv.id });
        sent += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (errors.length < 5) errors.push(message);
        // Stop the whole batch on connection loss or warm-up limit — the rest would fail too.
        if (message.includes('not connected') || (error as any)?.code === 'WARMUP_DAILY_LIMIT') {
          return res.status((error as any)?.code === 'WARMUP_DAILY_LIMIT' ? 429 : 503).json({
            error: message, sent, failed: failed + (conversationIds.length - i - 1),
          });
        }
      }

      // Anti-ban: small randomized delay between recipients
      if (i < conversationIds.length - 1) {
        const ms = AUTO_DELAY_MIN_MS + Math.floor(Math.random() * (AUTO_DELAY_MAX_MS - AUTO_DELAY_MIN_MS));
        await new Promise(r => setTimeout(r, ms));
      }
    }

    res.json({ success: failed === 0, sent, failed, errors: errors.length ? errors : undefined });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

import { Router } from 'express';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { prisma } from '../../lib/prisma';

const router = Router();

router.use(authMiddleware);

router.get('/', checkPermission('read', 'saved_replies'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const replies = await prisma.savedReply.findMany({
      where: teamId ? { teamId } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json(replies);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/', checkPermission('create', 'saved_replies'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { shortcut, message } = req.body;
    if (!shortcut || !message) {
      return res.status(400).json({ error: 'Shortcut and message are required' });
    }

    const existing = await prisma.savedReply.findFirst({
      where: teamId ? { shortcut, teamId } : { shortcut, teamId: null },
    });

    const reply = existing
      ? await prisma.savedReply.update({
          where: { id: existing.id },
          data: { message, teamId },
        })
      : await prisma.savedReply.create({
          data: { shortcut, message, teamId },
        });

    res.status(201).json(reply);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/shortcut/:shortcut', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const reply = await prisma.savedReply.findFirst({
      where: teamId ? { shortcut: req.params.shortcut, teamId } : { shortcut: req.params.shortcut },
    });
    if (!reply) {
      return res.status(404).json({ error: 'Saved reply not found' });
    }
    res.json(reply);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id', checkPermission('delete', 'saved_replies'), async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const reply = await prisma.savedReply.findFirst({
      where: teamId ? { id: req.params.id, teamId } : { id: req.params.id },
    });
    if (!reply) {
      return res.status(404).json({ error: 'Saved reply not found' });
    }

    await prisma.savedReply.delete({ where: { id: reply.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

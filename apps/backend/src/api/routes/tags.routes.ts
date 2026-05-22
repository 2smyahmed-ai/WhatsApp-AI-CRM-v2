import { Router } from 'express';
import { authMiddleware } from '../../auth/auth.middleware';
import { prisma } from '../../lib/prisma';
import { emitRealtime } from '../../realtime/socket';

const router = Router();

router.use(authMiddleware);

// List all tags for the team
router.get('/', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const tags = await prisma.tag.findMany({
      where: teamId ? { teamId } : {},
      orderBy: { name: 'asc' },
      include: { _count: { select: { contacts: true } } },
    });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Create a tag
router.post('/', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: color || '#6366f1', teamId },
    });
    emitRealtime('tag:created', tag, teamId);
    res.json(tag);
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ error: 'Tag name already exists' });
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Update a tag
router.put('/:id', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    const { name, color } = req.body;
    const tag = await prisma.tag.update({
      where: { id: req.params.id },
      data: { ...(name ? { name: name.trim() } : {}), ...(color ? { color } : {}) },
    });
    emitRealtime('tag:updated', tag, teamId);
    res.json(tag);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Delete a tag
router.delete('/:id', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    await prisma.tag.delete({ where: { id: req.params.id } });
    emitRealtime('tag:deleted', { tagId: req.params.id }, teamId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Add tag to contact
router.post('/contacts/:contactId/tags/:tagId', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    await prisma.contactTag.upsert({
      where: { contactId_tagId: { contactId: req.params.contactId, tagId: req.params.tagId } },
      create: { contactId: req.params.contactId, tagId: req.params.tagId },
      update: {},
    });
    emitRealtime('contact:tag_added', { contactId: req.params.contactId, tagId: req.params.tagId }, teamId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Remove tag from contact
router.delete('/contacts/:contactId/tags/:tagId', async (req, res) => {
  try {
    const teamId = (req as any).user?.teamId;
    await prisma.contactTag.delete({
      where: { contactId_tagId: { contactId: req.params.contactId, tagId: req.params.tagId } },
    });
    emitRealtime('contact:tag_removed', { contactId: req.params.contactId, tagId: req.params.tagId }, teamId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get tags for a contact
router.get('/contacts/:contactId', async (req, res) => {
  try {
    const contactTags = await prisma.contactTag.findMany({
      where: { contactId: req.params.contactId },
      include: { tag: true },
    });
    res.json(contactTags.map((ct) => ct.tag));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

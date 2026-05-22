import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authMiddleware, requireAdmin } from '../../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

// Get activity log — admin sees all, others see their own
router.get('/', async (req, res) => {
  try {
    const user = (req as any).user;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN', 'TEAM_LEAD'].includes(user?.role);
    const { resource, limit = '50', offset = '0' } = req.query;

    const where: any = {};
    if (!isAdmin) where.userId = user.id;
    if (resource) where.resource = resource;

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit) || 50, 200),
      skip: Number(offset) || 0,
    });

    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// Get activity for a specific conversation
router.get('/conversation/:conversationId', async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        resource: 'conversation',
        details: { path: ['conversationId'], equals: req.params.conversationId },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authMiddleware } from '../../auth/auth.middleware';

const router = Router();

router.use(authMiddleware);

/**
 * Global search across contacts, templates, broadcasts, and conversations
 * Returns results from multiple sections in a single query
 */
router.get('/', async (req, res) => {
  try {
    const { q } = req.query;
    const query = typeof q === 'string' ? q.trim() : '';

    if (!query || query.length < 2) {
      return res.json({
        contacts: [],
        templates: [],
        broadcasts: [],
        conversations: [],
      });
    }

    const iLike = `%${query}%`;

    const [contacts, templates, broadcasts, conversations] = await Promise.all([
      // Search contacts by name, phone, email, or company
      prisma.contact.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query } },
            { email: { contains: query, mode: 'insensitive' } },
            { company: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, phone: true, email: true },
        take: 5,
      }),

      // Search message templates by name
      prisma.messageTemplate.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true },
        take: 5,
      }),

      // Search broadcasts by name
      prisma.broadcast.findMany({
        where: { name: { contains: query, mode: 'insensitive' } },
        select: { id: true, name: true, status: true },
        take: 5,
      }),

      // Search conversations by contact name
      prisma.conversation.findMany({
        where: {
          contact: {
            name: { contains: query, mode: 'insensitive' },
          },
        },
        include: { contact: { select: { id: true, name: true, phone: true } } },
        take: 5,
      }),
    ]);

    res.json({
      contacts: contacts.map((c) => ({
        id: c.id,
        type: 'contact',
        title: c.name || c.phone,
        subtitle: c.phone,
        href: `/contacts/${c.id}`,
      })),
      templates: templates.map((t) => ({
        id: t.id,
        type: 'template',
        title: t.name,
        href: `/templates/builder/${t.id}`,
      })),
      broadcasts: broadcasts.map((b) => ({
        id: b.id,
        type: 'broadcast',
        title: b.name,
        subtitle: b.status,
        href: `/broadcasts/${b.id}`,
      })),
      conversations: conversations.map((c) => ({
        id: c.id,
        type: 'conversation',
        title: c.contact?.name || c.contact?.phone || 'Unknown',
        subtitle: c.contact?.phone,
        href: `/conversations?phone=${encodeURIComponent(c.contact?.phone || '')}`,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Search failed' });
  }
});

export default router;

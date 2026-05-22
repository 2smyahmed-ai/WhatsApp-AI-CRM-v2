import { Router } from 'express';
import { ContactsService } from '../../contacts/contacts.service';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { prisma } from '../../lib/prisma';

const router = Router();
const upload = multer();

router.use(authMiddleware);

async function ensurePhase2Tables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Deal" (
      id TEXT PRIMARY KEY,
      "teamId" TEXT NULL,
      "contactId" TEXT NOT NULL,
      title TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'NEW',
      value DOUBLE PRECISION NOT NULL DEFAULT 0,
      "ownerId" TEXT NULL,
      notes TEXT NULL,
      "closedAt" TIMESTAMP(3) NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "Task" (
      id TEXT PRIMARY KEY,
      "teamId" TEXT NULL,
      "contactId" TEXT NULL,
      title TEXT NOT NULL,
      description TEXT NULL,
      "dueDate" TIMESTAMP(3) NULL,
      status TEXT NOT NULL DEFAULT 'OPEN',
      "assigneeId" TEXT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

router.get('/', async (req, res) => {
  try {
    const { search, tag } = req.query;
    const contacts = await ContactsService.getContacts({
      search: search as string,
      tag: tag as string,
    });
    res.json(contacts);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/', checkPermission('create', 'contacts'), async (req, res) => {
  try {
    const contact = await ContactsService.createContact({
      ...req.body,
      teamId: (req as any).user?.teamId,
    });
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.put('/:id', checkPermission('update', 'contacts'), async (req, res) => {
  try {
    const contact = await ContactsService.updateContact(req.params.id, req.body);
    res.json(contact);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.delete('/:id', checkPermission('delete', 'contacts'), async (req, res) => {
  try {
    await ContactsService.deleteContact(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:id/details', async (req, res) => {
  try {
    await ensurePhase2Tables();
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    const deals = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        d.*,
        u.id AS "owner__id",
        u.name AS "owner__name",
        u.email AS "owner__email"
      FROM "Deal" d
      LEFT JOIN "User" u ON u.id = d."ownerId"
      WHERE d."contactId" = $1
      ORDER BY d."updatedAt" DESC
      `,
      contact.id,
    );
    const tasks = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT
        t.*,
        u.id AS "assignee__id",
        u.name AS "assignee__name",
        u.email AS "assignee__email"
      FROM "Task" t
      LEFT JOIN "User" u ON u.id = t."assigneeId"
      WHERE t."contactId" = $1
      ORDER BY t."updatedAt" DESC
      `,
      contact.id,
    );
    const conversations = await prisma.conversation.findMany({
      where: { contactId: contact.id },
      select: {
        id: true,
        status: true,
        lastMessage: true,
        lastMessageAt: true,
        assignedTo: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({ contact, deals, tasks, conversations });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/:id/timeline', async (req, res) => {
  try {
    const contactId = req.params.id;

    const [conversations, deals, tasks, notes] = await Promise.all([
      prisma.conversation.findMany({
        where: { contactId },
        select: { id: true, status: true, createdAt: true, lastMessage: true, lastMessageAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.deal.findMany({
        where: { contactId },
        include: { owner: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.task.findMany({
        where: { contactId },
        include: { assignee: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.internalNote.findMany({
        where: { conversation: { contactId } },
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    type TimelineEvent = { type: string; at: Date; data: unknown };

    const events: TimelineEvent[] = [
      ...conversations.map((c) => ({ type: 'conversation', at: c.createdAt, data: c })),
      ...deals.map((d) => ({ type: 'deal', at: (d as any).createdAt, data: d })),
      ...tasks.map((t) => ({ type: 'task', at: (t as any).createdAt, data: t })),
      ...notes.map((n) => ({ type: 'note', at: n.createdAt, data: n })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime());

    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/import', checkPermission('create', 'contacts'), upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const teamId = (req as any).user?.teamId;
    const contacts: Array<{ phone: string; name?: string; tag?: string }> = [];

    const stream = Readable.from(file.buffer);
    stream
      .pipe(csv())
      .on('data', (row) => {
        if (row.phone) {
          contacts.push({
            phone: String(row.phone).trim(),
            name: row.name ? String(row.name).trim() : undefined,
            tag: row.tag ? String(row.tag).trim() : undefined,
          });
        }
      })
      .on('error', (err) => {
        res.status(400).json({ error: `CSV parse error: ${err.message}` });
      })
      .on('end', async () => {
        try {
          const results = await ContactsService.importContacts(contacts, teamId);
          res.json({ imported: results.length, total: contacts.length });
        } catch (err) {
          res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
        }
      });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

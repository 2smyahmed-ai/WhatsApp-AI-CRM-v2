import { Router } from 'express';
import { prisma } from '../../lib/prisma';
import { authMiddleware, checkPermission } from '../../auth/auth.middleware';
import { teamScope, type AuthActor } from '../../auth/authorize';
import { qualifyContact, serializeQualification } from '../../lead-qualification/lead-qualification.service';
import { notificationsService } from '../../notifications/notifications.service';
import type { LeadStatus, Priority } from '@prisma/client';

const router = Router();
router.use(authMiddleware);

function actorOf(req: any): AuthActor {
  return { id: req.user?.id, role: req.user?.role, teamId: req.user?.teamId ?? null };
}

// Higher = more urgent. Used to sort leads so agents see the top opportunities first.
const PRIORITY_WEIGHT: Record<Priority, number> = { URGENT: 3, HIGH: 2, NORMAL: 1, LOW: 0 };

const contactSelect = {
  id: true, name: true, phone: true, lifecycleStage: true,
  conversations: { where: { isGroup: false }, select: { id: true, assignedTo: true }, take: 1 },
} as const;

function shape(q: any) {
  const conv = q.contact?.conversations?.[0] ?? null;
  return {
    ...serializeQualification(q),
    contact: q.contact ? { id: q.contact.id, name: q.contact.name, phone: q.contact.phone, lifecycleStage: q.contact.lifecycleStage } : null,
    conversationId: conv?.id ?? null,
    assignedTo: conv?.assignedTo ?? null,
  };
}

// ── GET /api/leads — list qualified contacts (team-scoped, sorted by opportunity)
router.get('/', checkPermission('read', 'leads'), async (req, res) => {
  try {
    const actor = actorOf(req);
    const { status, priority, needsAttention, buyingIntent, search } = req.query as Record<string, string>;

    const where: any = { ...teamScope(actor) };
    if (status && status !== 'ALL') {
      where.status = { in: status.split(',').filter(Boolean) as LeadStatus[] };
    }
    if (priority) where.priority = priority as Priority;
    if (needsAttention === 'true') where.needsAttention = true;
    if (buyingIntent === 'true') where.buyingIntent = true;
    if (search?.trim()) {
      where.contact = {
        OR: [
          { name: { contains: search.trim(), mode: 'insensitive' } },
          { phone: { contains: search.trim() } },
        ],
      };
    }

    const rows = await prisma.leadQualification.findMany({
      where,
      include: { contact: { select: contactSelect } },
      take: 500,
    });

    const leads = rows
      .map(shape)
      .sort((a, b) =>
        PRIORITY_WEIGHT[b.priority as Priority] - PRIORITY_WEIGHT[a.priority as Priority] ||
        b.score - a.score ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      );

    res.json(leads);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── GET /api/leads/stats — counts per status + attention/intent (for tabs/badges)
router.get('/stats', checkPermission('read', 'leads'), async (req, res) => {
  try {
    const actor = actorOf(req);
    const where: any = { ...teamScope(actor) };

    // noHandoff: actionable leads whose contact has no 1-to-1 conversation
    // currently assigned to any agent — meaning nobody is handling them.
    const noHandoffWhere: any = {
      ...where,
      OR: [
        { status: { in: ['HOT', 'QUALIFIED'] as LeadStatus[] } },
        { needsAttention: true },
        { buyingIntent: true },
      ],
      contact: {
        conversations: {
          none: { isGroup: false, assignedTo: { not: null } },
        },
      },
    };

    const [byStatus, needsAttention, buyingIntent, total, noHandoff] = await Promise.all([
      prisma.leadQualification.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.leadQualification.count({ where: { ...where, needsAttention: true } }),
      prisma.leadQualification.count({ where: { ...where, buyingIntent: true } }),
      prisma.leadQualification.count({ where }),
      prisma.leadQualification.count({ where: noHandoffWhere }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) statusCounts[row.status] = row._count._all;

    res.json({ total, statusCounts, needsAttention, buyingIntent, noHandoff });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── POST /api/leads/refresh-alerts — fire realtime notifications for every
//    actionable lead (HOT/QUALIFIED/needsAttention/buyingIntent) that has no
//    human agent currently assigned to their conversation.
router.post('/refresh-alerts', checkPermission('update', 'leads'), async (req, res) => {
  try {
    const actor = actorOf(req);
    const scope: any = { ...teamScope(actor) };

    const leads = await prisma.leadQualification.findMany({
      where: {
        ...scope,
        OR: [
          { status: { in: ['HOT', 'QUALIFIED'] as LeadStatus[] } },
          { needsAttention: true },
          { buyingIntent: true },
        ],
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            conversations: {
              where: { isGroup: false },
              select: { id: true, assignedTo: true },
              orderBy: { lastMessageAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    // Only notify for leads with no agent assigned on their primary conversation.
    const unhandled = leads.filter((q) => {
      const conv = q.contact?.conversations?.[0];
      return conv && !conv.assignedTo;
    });

    let alertCount = 0;
    for (const q of unhandled) {
      const conv = q.contact?.conversations?.[0];
      if (!conv) continue;
      const name = q.contact?.name?.trim() || q.contact?.phone || 'Unknown';
      const bodyEn = q.recommendationEn || q.summaryEn || '';
      const bodyAr = q.recommendationAr || q.summaryAr || '';
      const base = {
        contactId: q.contactId,
        conversationId: conv.id,
        teamId: q.teamId,
        // No assignedTo → notificationsService broadcasts to the whole team.
      };

      if (q.buyingIntent) {
        await notificationsService.create({
          ...base,
          type: 'BUYING_INTENT',
          priority: (q.priority === 'LOW' ? 'HIGH' : q.priority) as Priority,
          titleEn: `Unhandled buying intent — ${name}`,
          titleAr: `نية شراء غير معالجة — ${name}`,
          bodyEn,
          bodyAr,
        });
      } else if (q.needsAttention) {
        await notificationsService.create({
          ...base,
          type: 'NEEDS_ATTENTION',
          priority: (q.priority === 'LOW' || q.priority === 'NORMAL' ? 'HIGH' : q.priority) as Priority,
          titleEn: `No agent — ${name} needs attention`,
          titleAr: `لا يوجد وكيل — ${name} يحتاج اهتمامًا`,
          bodyEn,
          bodyAr,
        });
      } else {
        // HOT or QUALIFIED with no buying intent / needs attention flag
        const labelEn = q.status === 'HOT' ? 'hot lead' : 'qualified lead';
        const labelAr = q.status === 'HOT' ? 'عميل ساخن' : 'عميل مؤهل';
        await notificationsService.create({
          ...base,
          type: 'STATUS_UPGRADE',
          priority: (q.priority === 'LOW' || q.priority === 'NORMAL' ? 'HIGH' : q.priority) as Priority,
          titleEn: `No agent assigned — ${name} is a ${labelEn}`,
          titleAr: `لا يوجد وكيل — ${name} ${labelAr}`,
          bodyEn,
          bodyAr,
        });
      }
      alertCount++;
    }

    res.json({ alertCount, unhandledCount: unhandled.length });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── GET /api/leads/:contactId — single qualification + status history ──────────
router.get('/:contactId', checkPermission('read', 'leads'), async (req, res) => {
  try {
    const actor = actorOf(req);
    const q = await prisma.leadQualification.findUnique({
      where: { contactId: req.params.contactId },
      include: { contact: { select: contactSelect } },
    });

    if (!q) return res.json({ qualification: null, history: [] });

    // Team scoping: shared (null) or same-team only, unless admin.
    const allowed = actor.role === 'SUPER_ADMIN' || actor.role === 'ADMIN'
      || q.teamId == null || q.teamId === actor.teamId;
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const history = await prisma.leadStatusEvent.findMany({
      where: { contactId: req.params.contactId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json({
      qualification: shape(q),
      history: history.map((h) => ({
        id: h.id,
        fromStatus: h.fromStatus,
        toStatus: h.toStatus,
        score: h.score,
        reason: h.reason,
        createdAt: h.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

// ── POST /api/leads/:contactId/analyze — manual "Analyze now" (costs an LLM call)
router.post('/:contactId/analyze', checkPermission('update', 'leads'), async (req, res) => {
  try {
    const result = await qualifyContact(req.params.contactId);
    if (!result) {
      return res.status(409).json({
        error: 'Could not analyze: qualification disabled/unconfigured, no customer messages, or a group chat.',
      });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;

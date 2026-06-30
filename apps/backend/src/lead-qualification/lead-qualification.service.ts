import type { LeadStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitRealtime } from '../realtime/socket';
import { chatbotSettingsService } from '../services/chatbot-settings.service';
import { notificationsService } from '../notifications/notifications.service';
import { analyzeConversation } from './qualification.provider';
import type { QualificationContext, QualificationResult } from './types';

/** Bilingual labels for each status — used in notification text. */
const STATUS_LABEL: Record<LeadStatus, { en: string; ar: string }> = {
  NEW_LEAD:       { en: 'New Lead',       ar: 'عميل محتمل جديد' },
  QUALIFIED:      { en: 'Qualified',      ar: 'مؤهل' },
  HOT:            { en: 'Hot Lead',       ar: 'عميل ساخن' },
  WARM:           { en: 'Warm Lead',      ar: 'عميل دافئ' },
  COLD:           { en: 'Cold Lead',      ar: 'عميل بارد' },
  CUSTOMER:       { en: 'Customer',       ar: 'عميل' },
  LOST:           { en: 'Lost',           ar: 'خسارة' },
  NOT_INTERESTED: { en: 'Not Interested', ar: 'غير مهتم' },
  SPAM:           { en: 'Spam',           ar: 'سبام' },
};

/** Statuses that fire a "status upgrade" notification when newly reached. */
const UPGRADE_STATUSES = new Set<LeadStatus>(['HOT', 'QUALIFIED']);

function contactLabel(name: string | null, phone: string): string {
  return name?.trim() || phone;
}

/**
 * Analyze a contact's 1-to-1 conversation and persist the result.
 * Returns the saved qualification, or null when skipped (group, no customer
 * messages, AI disabled/unconfigured, or provider failure).
 *
 * Advisory-only: never mutates Conversation/Contact state.
 */
export async function qualifyContact(contactId: string): Promise<{ qualification: any } | null> {
  const cfg = chatbotSettingsService.qualificationConfig();
  if (!cfg.enabled) return null;

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true, name: true, phone: true, teamId: true },
  });
  if (!contact) return null;

  // Per-contact, 1-to-1 only — groups are explicitly excluded from analysis.
  const conversation = await prisma.conversation.findFirst({
    where: { contactId, isGroup: false },
    orderBy: { lastMessageAt: 'desc' },
    select: { id: true, teamId: true, assignedTo: true },
  });
  if (!conversation) return null;

  const recent = await prisma.message.findMany({
    where: { conversationId: conversation.id },
    orderBy: { timestamp: 'desc' },
    take: cfg.contextWindow,
    select: { fromMe: true, body: true },
  });
  const messages = recent.reverse();
  const inboundCount = messages.filter((m) => !m.fromMe).length;
  if (inboundCount === 0) return null;

  const teamId = conversation.teamId ?? contact.teamId ?? null;

  const previous = await prisma.leadQualification.findUnique({ where: { contactId } });
  const totalInbound = await prisma.message.count({
    where: { conversationId: conversation.id, fromMe: false },
  });

  // Skip the LLM call for leads already in a settled "dead" state (lost / not
  // interested / spam) unless the customer has clearly re-engaged (≥3 new
  // messages since the last analysis). Avoids re-scoring closed conversations.
  const DEAD_STATUSES = new Set<LeadStatus>(['LOST', 'NOT_INTERESTED', 'SPAM']);
  if (previous && DEAD_STATUSES.has(previous.status)) {
    const newInbound = totalInbound - (previous.messageCountAtAnalysis ?? 0);
    if (newInbound < 3) {
      logger.info('lead_qual.skipped_terminal', { contactId, status: previous.status, newInbound });
      return null;
    }
  }

  const ctx: QualificationContext = {
    contactId: contact.id,
    conversationId: conversation.id,
    teamId,
    contactName: contact.name,
    messages,
  };

  const result = await analyzeConversation(ctx);
  if (!result) return null;

  const qualification = await prisma.leadQualification.upsert({
    where: { contactId },
    create: {
      contactId,
      teamId,
      status: result.status,
      score: result.score,
      priority: result.priority,
      confidence: result.confidence,
      needsAttention: result.needsAttention,
      buyingIntent: result.buyingIntent,
      signals: result.signals as any,
      summaryEn: result.summaryEn,
      summaryAr: result.summaryAr,
      recommendationEn: result.recommendationEn,
      recommendationAr: result.recommendationAr,
      messageCountAtAnalysis: totalInbound,
      lastAnalyzedAt: new Date(),
    },
    update: {
      teamId,
      status: result.status,
      score: result.score,
      priority: result.priority,
      confidence: result.confidence,
      needsAttention: result.needsAttention,
      buyingIntent: result.buyingIntent,
      signals: result.signals as any,
      summaryEn: result.summaryEn,
      summaryAr: result.summaryAr,
      recommendationEn: result.recommendationEn,
      recommendationAr: result.recommendationAr,
      messageCountAtAnalysis: totalInbound,
      lastAnalyzedAt: new Date(),
    },
  });

  // ── Append status-history event on change ───────────────────────────────────
  const statusChanged = previous?.status !== result.status;
  if (statusChanged) {
    await prisma.leadStatusEvent.create({
      data: {
        qualificationId: qualification.id,
        contactId,
        teamId,
        fromStatus: previous?.status ?? null,
        toStatus: result.status,
        score: result.score,
        reason: result.summaryEn.slice(0, 280),
      },
    });
  }

  // ── Notifications (opportunity-focused triggers) ────────────────────────────
  // New customer messages since the last analysis? If so, a still-active
  // buying-intent / needs-attention signal is allowed to re-fire (not just on
  // the rising edge), so agents keep getting pinged as a hot lead keeps engaging.
  const hasNewInbound = totalInbound > (previous?.messageCountAtAnalysis ?? 0);
  await fireNotifications({
    result,
    previous,
    statusChanged,
    hasNewInbound,
    contactName: contactLabel(contact.name, contact.phone),
    contactId,
    conversationId: conversation.id,
    teamId,
    assignedTo: conversation.assignedTo,
  });

  emitRealtime('lead:updated', { qualification: serializeQualification(qualification) }, teamId);

  logger.info('lead_qual.analyzed', {
    contactId,
    status: result.status,
    score: result.score,
    statusChanged,
  });

  return { qualification: serializeQualification(qualification) };
}

async function fireNotifications(args: {
  result: QualificationResult;
  previous: { needsAttention: boolean; buyingIntent: boolean; status: LeadStatus; score: number } | null;
  statusChanged: boolean;
  hasNewInbound: boolean;
  contactName: string;
  contactId: string;
  conversationId: string;
  teamId: string | null;
  assignedTo: string | null;
}): Promise<void> {
  const { result, previous, statusChanged, hasNewInbound, contactName } = args;
  const base = {
    contactId: args.contactId,
    conversationId: args.conversationId,
    teamId: args.teamId,
    assignedTo: args.assignedTo,
    priority: result.priority,
  };

  // 1. Buying intent — fire on the rising edge (false → true), or again whenever
  // the signal is still active and the customer has sent new messages since the
  // last analysis (so a persistent hot lead keeps pinging the agent).
  if (result.buyingIntent && (!previous?.buyingIntent || hasNewInbound)) {
    await notificationsService.create({
      ...base,
      type: 'BUYING_INTENT',
      priority: result.priority === 'LOW' ? 'HIGH' : result.priority,
      titleEn: `Buying intent — ${contactName}`,
      titleAr: `نية شراء — ${contactName}`,
      bodyEn: result.recommendationEn || result.summaryEn,
      bodyAr: result.recommendationAr || result.summaryAr,
    });
  }

  // 2. Needs immediate human attention — same policy: rising edge, or re-fire on
  // new customer messages while the signal is still active.
  if (result.needsAttention && (!previous?.needsAttention || hasNewInbound)) {
    await notificationsService.create({
      ...base,
      type: 'NEEDS_ATTENTION',
      priority: result.priority === 'LOW' || result.priority === 'NORMAL' ? 'HIGH' : result.priority,
      titleEn: `Needs attention — ${contactName}`,
      titleAr: `يحتاج اهتمام — ${contactName}`,
      bodyEn: result.recommendationEn || result.summaryEn,
      bodyAr: result.recommendationAr || result.summaryAr,
    });
  }

  // 3. HOT / QUALIFIED — fire when first reaching the status, OR when the lead
  // is already HOT/QUALIFIED, scores ≥75, and sends new messages (re-engaging).
  // This ensures active hot leads keep surfacing in the popup even without a
  // status change.
  const isHotOrQualified = UPGRADE_STATUSES.has(result.status);
  if (isHotOrQualified && (statusChanged || (hasNewInbound && result.score >= 75))) {
    const label = STATUS_LABEL[result.status];
    await notificationsService.create({
      ...base,
      type: 'STATUS_UPGRADE',
      priority: result.priority === 'LOW' ? 'NORMAL' : result.priority,
      titleEn: statusChanged
        ? `${contactName} is now ${label.en}`
        : `${label.en} re-engaging — ${contactName} (${result.score}/100)`,
      titleAr: statusChanged
        ? `${contactName} أصبح الآن ${label.ar}`
        : `${label.ar} يتواصل مجددًا — ${contactName} (${result.score}/100)`,
      bodyEn: result.summaryEn,
      bodyAr: result.summaryAr,
    });
  }

  // 4. High-score threshold (≥75) for leads not yet HOT/QUALIFIED — fires the
  // first time a lead crosses the 75-point mark. Surfaces strong opportunities
  // the agent might otherwise miss because no status change occurred.
  const prevScore = previous?.score ?? 0;
  if (!isHotOrQualified && result.score >= 75 && prevScore < 75) {
    await notificationsService.create({
      ...base,
      type: 'STATUS_UPGRADE',
      priority: result.priority === 'LOW' ? 'NORMAL' : result.priority,
      titleEn: `High-potential lead — ${contactName} scored ${result.score}/100`,
      titleAr: `عميل واعد — ${contactName} حصل على ${result.score}/100`,
      bodyEn: result.summaryEn,
      bodyAr: result.summaryAr,
    });
  }
}

/** Shape qualification for the wire (Date → ISO, no internal-only fields dropped). */
export function serializeQualification(q: {
  id: string;
  contactId: string;
  teamId: string | null;
  status: LeadStatus;
  score: number;
  priority: string;
  confidence: number;
  needsAttention: boolean;
  buyingIntent: boolean;
  signals: unknown;
  summaryEn: string | null;
  summaryAr: string | null;
  recommendationEn: string | null;
  recommendationAr: string | null;
  lastAnalyzedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    id: q.id,
    contactId: q.contactId,
    teamId: q.teamId,
    status: q.status,
    score: q.score,
    priority: q.priority,
    confidence: q.confidence,
    needsAttention: q.needsAttention,
    buyingIntent: q.buyingIntent,
    signals: q.signals ?? null,
    summaryEn: q.summaryEn,
    summaryAr: q.summaryAr,
    recommendationEn: q.recommendationEn,
    recommendationAr: q.recommendationAr,
    lastAnalyzedAt: q.lastAnalyzedAt ? q.lastAnalyzedAt.toISOString() : null,
    updatedAt: q.updatedAt.toISOString(),
  };
}

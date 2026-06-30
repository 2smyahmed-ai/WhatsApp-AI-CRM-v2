import type { NotificationType, Priority } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { emitToUser } from '../realtime/socket';
import { excludeDevSuperuser } from '../auth/authorize';

export interface CreateNotificationInput {
  type: NotificationType;
  priority?: Priority;
  /** Bilingual titles/bodies — the recipient's client renders the right one. */
  titleEn: string;
  titleAr: string;
  bodyEn?: string;
  bodyAr?: string;
  contactId: string;
  conversationId: string;
  teamId: string | null;
  /** If the conversation is assigned, only this user is notified. */
  assignedTo?: string | null;
}

const NON_RECIPIENT_ROLES = new Set(['VIEWER']);

/**
 * Resolve who should receive a lead notification:
 * - assigned conversation → just the assigned agent
 * - otherwise            → every actionable member of the team
 *   (team-less conversations notify all actionable users — single-org fallback).
 */
async function resolveRecipients(teamId: string | null, assignedTo?: string | null): Promise<string[]> {
  if (assignedTo) return [assignedTo];

  const users = await prisma.user.findMany({
    where: { ...(teamId ? { teamId } : {}), ...excludeDevSuperuser() },
    select: { id: true, role: true },
  });
  return users.filter((u) => !NON_RECIPIENT_ROLES.has(u.role)).map((u) => u.id);
}

class NotificationsService {
  /**
   * Persist one notification per recipient and push it over the socket.
   * Titles/bodies are stored as a JSON-ish "en | ar" pair so a single row
   * serves agents on either language. We keep them in `title`/`body` columns
   * using a delimiter the client splits on.
   */
  async create(input: CreateNotificationInput): Promise<void> {
    const recipients = await resolveRecipients(input.teamId, input.assignedTo);
    if (recipients.length === 0) return;

    const title = packBilingual(input.titleEn, input.titleAr);
    const body = input.bodyEn || input.bodyAr ? packBilingual(input.bodyEn ?? '', input.bodyAr ?? '') : null;
    const priority: Priority = input.priority ?? 'NORMAL';

    await Promise.all(
      recipients.map(async (recipientId) => {
        try {
          const n = await prisma.notification.create({
            data: {
              recipientId,
              teamId: input.teamId,
              type: input.type,
              priority,
              title,
              body,
              contactId: input.contactId,
              conversationId: input.conversationId,
            },
          });
          emitToUser(recipientId, 'notification:new', serialize(n));
        } catch (err) {
          logger.warn('notifications.create_failed', {
            recipientId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );
    logger.info('notifications.created', { type: input.type, recipients: recipients.length });
  }

  async list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const rows = await prisma.notification.findMany({
      where: { recipientId: userId, ...(opts.unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? 30, 100),
    });
    return rows.map(serialize);
  }

  async unreadCount(userId: string): Promise<number> {
    return prisma.notification.count({ where: { recipientId: userId, isRead: false } });
  }

  async markRead(userId: string, id: string): Promise<void> {
    // Scope by recipientId so a user can only mark their own notifications.
    await prisma.notification.updateMany({
      where: { id, recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { recipientId: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }
}

const BILINGUAL_DELIM = '␟'; // unit separator — won't appear in normal text

function packBilingual(en: string, ar: string): string {
  return `${en}${BILINGUAL_DELIM}${ar}`;
}

/** Split a packed "en␟ar" string into { en, ar }; tolerant of legacy plain text. */
export function unpackBilingual(value: string | null): { en: string; ar: string } {
  if (!value) return { en: '', ar: '' };
  const idx = value.indexOf(BILINGUAL_DELIM);
  if (idx === -1) return { en: value, ar: value };
  return { en: value.slice(0, idx), ar: value.slice(idx + 1) };
}

function serialize(n: {
  id: string;
  type: NotificationType;
  priority: Priority;
  title: string;
  body: string | null;
  contactId: string | null;
  conversationId: string | null;
  isRead: boolean;
  createdAt: Date;
}) {
  return {
    id: n.id,
    type: n.type,
    priority: n.priority,
    title: unpackBilingual(n.title),
    body: n.body ? unpackBilingual(n.body) : null,
    contactId: n.contactId,
    conversationId: n.conversationId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

export const notificationsService = new NotificationsService();

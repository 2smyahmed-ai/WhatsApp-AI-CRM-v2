import { prisma } from '../lib/prisma';
import { normalizePhone } from '../lib/phone';
import { emitRealtime } from '../realtime/socket';
import { providerManager } from '../providers/manager';

// How long a cached profile-picture URL is trusted before we ask the provider
// for a fresh one. WhatsApp CDN URLs are signed and eventually expire, so we
// refresh periodically rather than caching forever (the old behaviour, which
// left broken images once a URL expired).
const AVATAR_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export async function enrichContactAvatar(contact: any) {
  if (!contact?.id) return contact;
  const customFields = (contact.customFields as Record<string, unknown> | null | undefined) || {};
  const fetchedAt = typeof customFields.avatarUrlAt === 'number' ? customFields.avatarUrlAt : 0;
  const isFresh = Boolean(customFields.avatarUrl) && Date.now() - fetchedAt < AVATAR_TTL_MS;
  if (isFresh) return contact;

  const avatarUrl = await providerManager.getProfilePictureUrl(contact.phone);
  // Provider offline or contact has no picture: keep whatever we already have.
  if (!avatarUrl) return contact;

  return prisma.contact.update({
    where: { id: contact.id },
    data: { customFields: { ...customFields, avatarUrl, avatarUrlAt: Date.now() } },
  });
}

export async function logActivity(
  action: string,
  resource: string,
  details?: Record<string, unknown>,
  userId?: string,
) {
  await prisma.auditLog.create({
    data: { action, resource, details: (details ?? {}) as any, userId: userId ?? null },
  });
}

type ConversationFilters = {
  status?: string;
  search?: string;
  assignedTo?: string;
  teamId?: string;
  view?: 'all' | 'mine' | 'my-team' | 'unassigned' | 'closed';
  currentUserId?: string;
  currentUserTeamId?: string;
  limit?: number;
};

export class ConversationsService {
  static async getConversations(filters?: ConversationFilters) {
    const where: any = { isGroup: false };

    if (filters?.view) {
      switch (filters.view) {
        case 'mine':
          where.assignedTo = filters.currentUserId;
          break;
        case 'my-team':
          if (filters.currentUserTeamId) where.assignedTeamId = filters.currentUserTeamId;
          break;
        case 'unassigned':
          where.assignedTo = null;
          where.assignedTeamId = null;
          break;
        case 'closed':
          where.status = { in: ['RESOLVED', 'ARCHIVED'] };
          break;
      }
    }

    if (filters?.status && filters.view !== 'closed') {
      where.status = filters.status;
    }

    if (filters?.search) {
      where.contact = {
        is: {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search } },
          ],
        },
      };
    }

    if (filters?.assignedTo) where.assignedTo = filters.assignedTo;
    if (filters?.teamId) where.teamId = filters.teamId;

    const take = Math.min(filters?.limit ?? 100, 200);

    const conversations = await prisma.conversation.findMany({
      include: {
        contact: {
          include: {
            contactTags: { include: { tag: true } },
          },
        },
        assignedUser: { select: { id: true, name: true, email: true, role: true } },
        assignedTeam: { select: { id: true, name: true } },
        messages: { orderBy: { timestamp: 'desc' }, take: 1 },
      },
      orderBy: [
        { isPinned: 'desc' },
        { lastMessageAt: 'desc' },
      ],
      where,
      take,
    });

    const deduped = new Map<string, (typeof conversations)[number]>();
    for (const conv of conversations) {
      const existing = deduped.get(conv.contactId);
      if (!existing) { deduped.set(conv.contactId, conv); continue; }
      const existingTime = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
      const currentTime = conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0;
      if (currentTime >= existingTime) deduped.set(conv.contactId, conv);
    }

    // Avatar URLs are already stored in contact.customFields.avatarUrl from
    // previous fetches. The single-conversation path (getConversation) refreshes
    // stale avatars when a chat is opened — no provider calls needed here.
    return [...deduped.values()];
  }

  static async getConversation(id: string) {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        contact: true,
        assignedUser: { select: { id: true, name: true, email: true, role: true } },
        assignedTeam: { select: { id: true, name: true } },
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 50,
          include: {
            reactions: { include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (conversation?.contact) {
      conversation.contact = await enrichContactAvatar(conversation.contact);
    }
    if (conversation?.messages) {
      (conversation.messages as any[]).reverse();
    }
    return conversation;
  }

  static async getMessages(conversationId: string, cursor?: string, limit = 50) {
    const take = Math.min(limit, 100);
    const messages = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        reactions: { include: { user: { select: { id: true, name: true } } } },
      },
    });

    const hasMore = messages.length > take;
    const items = hasMore ? messages.slice(0, take) : messages;
    // Return in ascending order for chat display
    items.reverse();

    return {
      messages: items,
      nextCursor: hasMore ? messages[take - 1].id : null,
      hasMore,
    };
  }

  static async updateConversationStatus(id: string, status: string, userId?: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    const updated = await prisma.conversation.update({
      where: { id },
      data: { status: status as any },
    });
    emitRealtime('conversation:updated', { conversationId: updated.id, status: updated.status }, conversation.teamId);
    await logActivity('status_change', 'conversation', { conversationId: id, status }, userId);
    return updated;
  }

  static async assignConversation(id: string, agentId: string | null, userId?: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    const updated = await prisma.conversation.update({
      where: { id },
      data: { assignedTo: agentId },
      include: { assignedUser: { select: { id: true, name: true, email: true } } },
    });
    emitRealtime('conversation:updated', {
      conversationId: updated.id,
      assignedTo: agentId,
      assignedUser: updated.assignedUser,
    }, conversation.teamId);
    await logActivity('assign_user', 'conversation', { conversationId: id, agentId }, userId);
    return updated;
  }

  static async assignTeam(id: string, teamId: string | null, userId?: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    const team = teamId
      ? await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } })
      : null;
    const updated = await prisma.conversation.update({
      where: { id },
      data: { assignedTeamId: teamId },
    });
    emitRealtime('conversation:updated', {
      conversationId: updated.id,
      assignedTeamId: teamId,
      assignedTeam: team,
    }, conversation.teamId);
    await logActivity('assign_team', 'conversation', { conversationId: id, teamId }, userId);
    return { ...updated, assignedTeam: team };
  }

  static async updatePipeline(id: string, pipeline: string | null, userId?: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    const updated = await prisma.conversation.update({
      where: { id },
      data: { pipeline: pipeline as any },
    });
    emitRealtime('conversation:updated', {
      conversationId: updated.id,
      pipeline: updated.pipeline,
    }, conversation.teamId);
    await logActivity('pipeline_change', 'conversation', { conversationId: id, pipeline }, userId);
    return updated;
  }

  static async markAsRead(id: string) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    if (conversation.unreadCount === 0) return conversation;
    const updated = await prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
    emitRealtime('conversation:updated', { conversationId: updated.id, unreadCount: 0 }, conversation.teamId);
    return updated;
  }

  static async pinConversation(id: string, isPinned: boolean) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    const updated = await prisma.conversation.update({
      where: { id },
      data: { isPinned },
    });
    emitRealtime('conversation:updated', { conversationId: id, isPinned }, conversation.teamId);
    return updated;
  }

  static async snoozeConversation(id: string, snoozedUntil: Date | null) {
    const conversation = await prisma.conversation.findUnique({ where: { id } });
    if (!conversation) throw new Error('Conversation not found');
    const updated = await prisma.conversation.update({
      where: { id },
      data: {
        snoozedUntil,
        // When snoozed, move to ON_HOLD; when unsnoozing, restore to OPEN
        status: snoozedUntil ? ('ON_HOLD' as any) : ('OPEN' as any),
      },
    });
    emitRealtime('conversation:updated', {
      conversationId: id,
      snoozedUntil: snoozedUntil?.toISOString() ?? null,
      status: updated.status,
    }, conversation.teamId);
    return updated;
  }

  static async sendReply(
    conversationId: string,
    message: string,
    contactId?: string,
    media?: {
      mediaBuffer?: Buffer;
      mediaMimeType?: string;
      mediaFileName?: string;
      mediaCaption?: string;
      mediaDuration?: number;
      mediaUrl?: string;
      mediaIsVoiceNote?: boolean;
    },
    replyTo?: { replyToId?: string; replyToBody?: string },
    clientId?: string,
    agentId?: string,
  ) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { contact: true },
    });
    if (!conversation) throw new Error('Conversation not found');

    const resolvedContact = contactId
      ? await prisma.contact.findUnique({ where: { id: contactId } })
      : conversation.contact;
    if (!resolvedContact) throw new Error('Contact not found');

    const exactPhone = normalizePhone(resolvedContact.phone);
    if (!exactPhone) throw new Error('Invalid contact phone number');

    const { providerManager: pm } = await import('../providers/manager');
    await pm.sendMessage({
      clientId,
      conversationId,
      phone: exactPhone,
      text: message,
      media: media?.mediaBuffer
        ? {
            buffer: media.mediaBuffer,
            mimetype: media.mediaMimeType || 'application/octet-stream',
            filename: media.mediaFileName ?? undefined,
            caption: media.mediaCaption ?? undefined,
            duration: media.mediaDuration ?? undefined,
            isVoiceNote: media.mediaIsVoiceNote,
            url: media.mediaUrl ?? undefined,
          }
        : undefined,
      replyTo: replyTo?.replyToId
        ? { id: replyTo.replyToId, body: replyTo.replyToBody || '' }
        : undefined,
    });

    // Auto-assign to the sending agent if the conversation has no assigned agent
    if (agentId && !conversation.assignedTo) {
      await ConversationsService.assignConversation(conversationId, agentId, agentId);
    }
  }
}

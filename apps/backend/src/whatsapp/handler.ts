import { prisma } from '../lib/prisma';
import { processIncomingMessage } from '../workflow/inbound-workflow';
import { emitRealtime } from '../realtime/socket';
import { emitEvent } from '../realtime/event-bus';
import type { MessageStatus } from '@crm/messaging-schema';

export async function handleIncomingMessages(upsert: any, sock: any) {
  if (!Array.isArray(upsert?.messages)) return;
  if (upsert?.type !== 'notify' && upsert?.type !== 'append') return;
  const sessionId = String(sock?.user?.id || process.env.WHATSAPP_SESSION_ID || 'default').trim();
  await Promise.allSettled(upsert.messages.map((message: any) => processIncomingMessage(message, { sessionId })));
}

export async function handleMessageStatusUpdates(updates: any[]) {
  for (const update of updates || []) {
    const id = update?.key?.id;
    if (!id) continue;

    const legacyStatus =
      update.status === 2 ? 'DELIVERED' :
      update.status === 3 ? 'READ' :
      update.status === 1 ? 'SENT' :
      undefined;

    if (!legacyStatus) continue;

    // Normalised schema status for crm:event
    const schemaStatus: MessageStatus =
      legacyStatus === 'DELIVERED' ? 'delivered' :
      legacyStatus === 'READ' ? 'read' :
      'server_confirmed';

    const messages = await prisma.message.findMany({
      where: { externalId: id } as any,
      select: { id: true, conversationId: true },
    });

    if (messages.length === 0) continue;

    const now = new Date();
    await prisma.message.updateMany({
      where: { externalId: id } as any,
      data: {
        status: legacyStatus,
        ...(legacyStatus === 'DELIVERED' ? { deliveredAt: now } : {}),
        ...(legacyStatus === 'READ' ? { readAt: now } : {}),
      },
    });

    for (const msg of messages) {
      const conv = await prisma.conversation.findUnique({
        where: { id: msg.conversationId },
        select: { teamId: true },
      });
      const at = now.toISOString();

      // Legacy event (existing UI subscribers)
      emitRealtime('message:status', {
        messageId: msg.id,
        conversationId: msg.conversationId,
        status: legacyStatus,
      }, conv?.teamId ?? null);

      // New envelope event (Zustand store)
      if (conv?.teamId) {
        emitEvent('message.status_changed', {
          messageId: msg.id,
          conversationId: msg.conversationId,
          status: schemaStatus,
          at,
        }, conv.teamId);
      }
    }
  }
}

import { MessageDirection } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { getOrCreateConversationByPhone } from '../conversations/conversation-resolver';
import { emitRealtime } from '../realtime/socket';

export interface OutboundMessageData {
  externalId: string;
  sessionId: string;
  from: string;
  to: string;
  body: string;
  type: string;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaCaption?: string | null;
  mediaDuration?: number | null;
  replyToId?: string | null;
  replyToBody?: string | null;
  timestamp?: Date;
}

export async function persistOutboundMessage(data: OutboundMessageData) {
  const { contact, conversation } = await getOrCreateConversationByPhone(data.to);
  const timestamp = data.timestamp ?? new Date();
  const teamId = (conversation as any).teamId ?? null;

  const msg = await prisma.message.create({
    data: {
      externalId: data.externalId,
      sessionId: data.sessionId,
      direction: MessageDirection.OUTBOUND,
      from: data.from,
      to: data.to,
      phone: data.to,
      conversationId: conversation.id,
      fromMe: true,
      body: data.body,
      type: data.type as any,
      mediaUrl: data.mediaUrl ?? null,
      mediaMimeType: data.mediaMimeType ?? null,
      mediaFileName: data.mediaFileName ?? null,
      mediaCaption: data.mediaCaption ?? null,
      mediaDuration: data.mediaDuration ?? null,
      timestamp,
      status: 'SENT',
      replyToId: data.replyToId ?? null,
      replyToBody: data.replyToBody ?? null,
    } as any,
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: data.body || 'Message',
      lastMessagePreview: data.body || 'Message',
      lastMessageAt: timestamp,
    },
  });

  emitRealtime('message:new', {
    conversationId: conversation.id,
    message: {
      id: msg.id,
      externalId: data.externalId,
      sessionId: data.sessionId,
      direction: 'OUTBOUND',
      from: data.from,
      to: data.to,
      phone: data.to,
      conversationId: conversation.id,
      fromMe: true,
      body: msg.body,
      type: msg.type,
      mediaUrl: msg.mediaUrl,
      mediaMimeType: msg.mediaMimeType,
      mediaFileName: msg.mediaFileName,
      mediaCaption: msg.mediaCaption,
      mediaDuration: msg.mediaDuration,
      timestamp: msg.timestamp,
      status: 'SENT',
      replyToId: data.replyToId ?? null,
      replyToBody: data.replyToBody ?? null,
    },
  }, teamId);

  emitRealtime('conversation:updated', {
    conversationId: conversation.id,
    lastMessage: data.body || 'Message',
    lastMessageAt: timestamp.toISOString(),
    fromMe: true,
  }, teamId);

  return msg;
}

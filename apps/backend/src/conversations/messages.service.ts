import { prisma } from '../lib/prisma';
import { MessageDirection, MessageType, MsgStatus } from '@prisma/client';

export class MessagesService {
  static async getMessages(conversationId: string) {
    return await prisma.message.findMany({
      where: { conversationId },
      orderBy: { timestamp: 'asc' },
    });
  }

  static async createMessage(conversationId: string, data: {
    externalId: string;
    sessionId: string;
    direction: MessageDirection;
    from: string;
    to: string;
    phone: string;
    fromMe: boolean;
    body: string;
    type?: MessageType;
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaFileName?: string;
    mediaCaption?: string;
    mediaDuration?: number;
  }) {
    return await prisma.message.create({
      data: {
        conversationId,
        ...data,
        timestamp: new Date(),
      },
    });
  }
}

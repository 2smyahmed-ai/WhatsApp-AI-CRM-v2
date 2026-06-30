import { prisma } from '../lib/prisma';
import { broadcastQueue, ensureBroadcastWorker } from './broadcast.queue';

ensureBroadcastWorker();

async function resolveRecipients(data: { recipients?: string[]; tag?: string; teamId?: string }) {
  const directRecipients = (data.recipients ?? []).map((phone) => phone.trim()).filter(Boolean);
  const tag = data.tag?.trim();

  if (!tag) {
    return Array.from(new Set(directRecipients));
  }

  const contacts = await prisma.contact.findMany({
    where: {
      ...(data.teamId ? { teamId: data.teamId } : {}),
      contactTags: { some: { tag: { name: { equals: tag, mode: 'insensitive' } } } },
    },
    select: { phone: true },
  });

  const taggedRecipients = contacts
    .map((contact) => contact.phone)
    .filter((p): p is string => Boolean(p));

  return Array.from(new Set([...directRecipients, ...taggedRecipients]));
}

export class BroadcastsService {
  static async getBroadcasts(teamId?: string) {
    return await prisma.broadcast.findMany({
      where: teamId ? { teamId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getBroadcastById(id: string, teamId?: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: teamId ? { id, teamId } : { id },
      include: { recipients: true },
    });

    if (!broadcast) throw new Error('Broadcast not found');

    return broadcast;
  }

  static async createBroadcast(data: {
    name: string;
    message: string;
    recipients?: string[];
    tag?: string;
    scheduledAt?: Date;
    teamId?: string;
    interactiveContent?: object;
  }) {
    const recipients = await resolveRecipients(data);
    if (!recipients.length) {
      throw new Error('At least one recipient or tag is required');
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        teamId: data.teamId,
        name: data.name,
        message: data.message,
        interactiveContent: data.interactiveContent ?? undefined,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt,
        description: data.tag ? `Tag: ${data.tag}` : null,
        recipients: {
          create: recipients.map(phone => ({ phone })),
        },
      },
    });

    return broadcast;
  }

  static async updateBroadcast(
    id: string,
    data: {
      name: string;
      message: string;
      recipients?: string[];
      tag?: string;
      scheduledAt?: Date;
      teamId?: string;
      interactiveContent?: object;
    }
  ) {
    const recipients = await resolveRecipients(data);
    const existing = await prisma.broadcast.findFirst({
      where: data.teamId ? { id, teamId: data.teamId } : { id },
      include: { recipients: true },
    });

    if (!existing) throw new Error('Broadcast not found');
    if (!recipients.length) {
      throw new Error('At least one recipient or tag is required');
    }

    return await prisma.broadcast.update({
      where: { id: existing.id },
      data: {
        teamId: data.teamId,
        name: data.name,
        message: data.message,
        interactiveContent: data.interactiveContent ?? undefined,
        status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
        scheduledAt: data.scheduledAt ?? null,
        description: data.tag ? `Tag: ${data.tag}` : null,
        recipients: {
          deleteMany: {},
          create: recipients.map(phone => ({ phone })),
        },
      },
    });
  }

  static async sendBroadcast(id: string, teamId?: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: teamId ? { id, teamId } : { id },
      include: { recipients: true },
    });

    if (!broadcast) throw new Error('Broadcast not found');

    const job = await broadcastQueue.add({ broadcastId: id });
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { status: 'SENDING', sentAt: new Date() },
    });

    return { ...broadcast, queueJobId: job.id, status: 'SENDING' };
  }

  static async pauseBroadcast(id: string, teamId?: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: teamId ? { id, teamId } : { id },
    });
    if (!broadcast) throw new Error('Broadcast not found');
    if (broadcast.status !== 'SENDING') throw new Error('Broadcast is not currently sending');
    return prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: 'PAUSED' } });
  }

  static async resumeBroadcast(id: string, teamId?: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: teamId ? { id, teamId } : { id },
      include: { recipients: true },
    });
    if (!broadcast) throw new Error('Broadcast not found');
    if (broadcast.status !== 'PAUSED') throw new Error('Broadcast is not paused');
    await prisma.broadcast.update({ where: { id: broadcast.id }, data: { status: 'SENDING' } });
    // Re-queue — worker will skip already-sent recipients
    await broadcastQueue.add({ broadcastId: id });
    return { ...broadcast, status: 'SENDING' };
  }

  static async deleteBroadcast(id: string, teamId?: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: teamId ? { id, teamId } : { id },
      select: { id: true },
    });

    if (!broadcast) throw new Error('Broadcast not found');

    return await prisma.$transaction([
      prisma.broadcastRecipient.deleteMany({
        where: { broadcastId: broadcast.id },
      }),
      prisma.broadcast.delete({
        where: { id: broadcast.id },
      }),
    ]);
  }

  static async getBroadcastStats(id: string, teamId?: string) {
    const broadcast = await prisma.broadcast.findFirst({
      where: teamId ? { id, teamId } : { id },
      include: { recipients: true },
    });

    if (!broadcast) throw new Error('Broadcast not found');

    return {
      ...broadcast,
      recipients: broadcast.recipients.map(r => ({
        phone: r.phone,
        status: r.status,
      })),
    };
  }
}

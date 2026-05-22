import Queue from 'bull';
import { prisma } from '../lib/prisma';
import { providerManager } from '../providers/manager';
import { emitRealtime } from '../realtime/socket';
import { logger } from '../lib/logger';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

export const broadcastQueue = new Queue('broadcast-sends', redisUrl, {
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

// Min and max ms to wait between each recipient send (anti-ban)
const SEND_DELAY_MIN = Number(process.env.BROADCAST_DELAY_MIN_MS ?? 1500);
const SEND_DELAY_MAX = Number(process.env.BROADCAST_DELAY_MAX_MS ?? 4000);

function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Replace {{name}}, {{phone}} etc. with contact data */
function personalizeMessage(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

let workerInitialized = false;

export function ensureBroadcastWorker() {
  if (workerInitialized) return;
  workerInitialized = true;

  broadcastQueue.process(async (job) => {
    const { broadcastId } = job.data as { broadcastId: string };

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      include: { recipients: true },
    });

    if (!broadcast) throw new Error('Broadcast not found');

    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: 'SENDING', sentAt: new Date() },
    });

    let sent = 0;
    let failed = 0;
    const total = broadcast.recipients.length;

    for (let i = 0; i < broadcast.recipients.length; i++) {
      const recipient = broadcast.recipients[i];

      // Skip recipients already sent
      if (recipient.status === 'sent') { sent += 1; continue; }

      // Re-check if broadcast was paused/cancelled between iterations
      const current = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
        select: { status: true },
      });
      if (current?.status === 'PAUSED') {
        logger.info('broadcast.paused', { broadcastId, sentSoFar: sent });
        // Update running totals but keep status as PAUSED
        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { totalSent: sent, totalFailed: failed },
        });
        return { broadcastId, sent, failed, paused: true };
      }
      if (current?.status === 'FAILED' || current?.status === 'DRAFT') {
        logger.info('broadcast.aborted', { broadcastId, reason: current.status });
        break;
      }

      // Resolve contact name for personalization
      let contactName = '';
      try {
        const contact = await prisma.contact.findFirst({ where: { phone: recipient.phone }, select: { name: true } });
        contactName = contact?.name ?? '';
      } catch { /* non-critical */ }

      const personalizedMessage = personalizeMessage(broadcast.message, {
        name: contactName,
        phone: recipient.phone,
      });

      try {
        await providerManager.sendMessage({ phone: recipient.phone, text: personalizedMessage });
        await prisma.broadcastRecipient.updateMany({
          where: { broadcastId, phone: recipient.phone },
          data: { status: 'sent' },
        });
        sent += 1;
      } catch (error) {
        logger.warn('broadcast.send_failed', {
          broadcastId,
          phone: recipient.phone,
          error: error instanceof Error ? error.message : String(error),
        });
        await prisma.broadcastRecipient.updateMany({
          where: { broadcastId, phone: recipient.phone },
          data: { status: 'failed' },
        });
        failed += 1;
      }

      emitRealtime('broadcast:progress', { broadcastId, sent, failed, total }, broadcast.teamId);

      // Anti-ban: randomized delay between sends (skip after last recipient)
      if (i < broadcast.recipients.length - 1) {
        await randomDelay(SEND_DELAY_MIN, SEND_DELAY_MAX);
      }
    }

    const finalStatus = sent === 0 ? 'FAILED' : 'SENT';
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: finalStatus, totalSent: sent, totalFailed: failed },
    });

    emitRealtime('broadcast:complete', { broadcastId, sent, failed, total, status: finalStatus }, broadcast.teamId);
    return { broadcastId, sent, failed };
  });
}

import Queue from 'bull';
import { prisma } from '../lib/prisma';
import { providerManager } from '../providers/manager';
import { emitRealtime } from '../realtime/socket';
import { logger } from '../lib/logger';
import interactiveMessageService from '../services/interactive-message.service';

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

// Fallback mime per message type when the file server doesn't return a useful one.
const MEDIA_MIME_FALLBACK: Record<string, string> = {
  IMAGE: 'image/jpeg',
  VIDEO: 'video/mp4',
  DOCUMENT: 'application/octet-stream',
};

/**
 * Download the broadcast attachment ONCE (the same file goes to every recipient)
 * and resolve a usable mimetype. Returns null if there's no media or the fetch fails,
 * in which case the worker falls back to a plain-text send.
 */
async function fetchBroadcastMedia(
  url: string,
  mediaType?: string | null,
  filename?: string | null,
): Promise<{ buffer: Buffer; mimetype: string; filename?: string } | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const buffer = Buffer.from(await resp.arrayBuffer());
    const headerMime = resp.headers.get('content-type')?.split(';')[0]?.trim();
    const mimetype =
      headerMime && headerMime !== 'application/octet-stream'
        ? headerMime
        : (mediaType && MEDIA_MIME_FALLBACK[mediaType]) || 'application/octet-stream';
    return { buffer, mimetype, filename: filename ?? undefined };
  } catch (err) {
    logger.warn('broadcast.media_fetch_failed', {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
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

    // Media is the same for everyone — fetch it once up front, then reuse the buffer.
    const mediaUrl = (broadcast as any).mediaUrl as string | null | undefined;
    const media = mediaUrl
      ? await fetchBroadcastMedia(
          mediaUrl,
          (broadcast as any).mediaType,
          (broadcast as any).mediaFilename,
        )
      : null;

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

      const interactiveContent = (broadcast as any).interactiveContent as
        | { kind: string; [key: string]: unknown }
        | null
        | undefined;

      try {
        if (interactiveContent?.kind) {
          // Personalize the body field inside the interactive payload
          const personalizedInteractive = {
            ...interactiveContent,
            body: personalizeMessage(
              typeof interactiveContent.body === 'string' ? interactiveContent.body : '',
              { name: contactName, phone: recipient.phone },
            ),
          };
          // Use native Baileys interactive send (real buttons/list/CTA) instead of text fallback.
          // We need a conversationId — resolve or create one for this phone.
          try {
            const { getOrCreateConversationByPhone } = await import('../conversations/conversation-resolver');
            const { conversation } = await getOrCreateConversationByPhone(recipient.phone);
            const { sendInteractiveViaBaileys } = await import('../whatsapp/sender');
            await sendInteractiveViaBaileys(recipient.phone, personalizedInteractive as any, conversation.id);
          } catch (interactiveErr) {
            // If native send fails, fall back to numbered-text so the message still goes out.
            logger.warn('broadcast.interactive_native_failed_using_text_fallback', {
              broadcastId,
              phone: recipient.phone,
              error: interactiveErr instanceof Error ? interactiveErr.message : String(interactiveErr),
            });
            await interactiveMessageService.send(recipient.phone, personalizedInteractive as any);
          }
        } else if (media) {
          // Image / video / document broadcast — the personalized text rides as the caption.
          await providerManager.sendMessage({
            phone: recipient.phone,
            text: '',
            media: {
              buffer: media.buffer,
              mimetype: media.mimetype,
              filename: media.filename,
              caption: personalizedMessage,
            },
          });
        } else {
          await providerManager.sendMessage({ phone: recipient.phone, text: personalizedMessage });
        }
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

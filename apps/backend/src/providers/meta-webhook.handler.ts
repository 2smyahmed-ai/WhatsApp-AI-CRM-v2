import { processIncomingMessage } from '../workflow/inbound-workflow';
import { handleMessageStatusUpdates } from '../whatsapp/handler';
import { logger } from '../lib/logger';

function mapStatus(status: string): number | undefined {
  switch (status) {
    case 'sent': return 1;
    case 'delivered': return 2;
    case 'read': return 3;
    default: return undefined;
  }
}

function mapType(type: string): string {
  switch (type) {
    case 'image':
    case 'sticker': return 'IMAGE';
    case 'video': return 'VIDEO';
    case 'audio': return 'AUDIO';
    case 'document': return 'DOCUMENT';
    default: return 'TEXT';
  }
}

function buildInboundPayload(message: any) {
  const phone: string = message.from;
  const externalId: string = message.id;
  const timestamp = Number(message.timestamp);
  const type: string = message.type ?? 'text';

  let content = '';
  let mediaUrl: string | null = null;
  let mediaMimeType: string | null = null;
  let mediaFileName: string | null = null;
  let mediaCaption: string | null = null;
  let mediaDuration: number | null = null;

  switch (type) {
    case 'text':
      content = message.text?.body ?? '';
      break;

    case 'image':
      mediaCaption = message.image?.caption ?? null;
      mediaMimeType = message.image?.mime_type ?? 'image/jpeg';
      // Store media ID as reference; actual download requires a separate call
      mediaUrl = message.image?.id ? `meta-media://${message.image.id}` : null;
      content = mediaCaption ?? '';
      break;

    case 'video':
      mediaCaption = message.video?.caption ?? null;
      mediaMimeType = message.video?.mime_type ?? 'video/mp4';
      mediaUrl = message.video?.id ? `meta-media://${message.video.id}` : null;
      content = mediaCaption ?? '';
      break;

    case 'audio':
      mediaMimeType = message.audio?.mime_type ?? 'audio/ogg';
      mediaUrl = message.audio?.id ? `meta-media://${message.audio.id}` : null;
      break;

    case 'document':
      mediaFileName = message.document?.filename ?? null;
      mediaCaption = message.document?.caption ?? null;
      mediaMimeType = message.document?.mime_type ?? 'application/octet-stream';
      mediaUrl = message.document?.id ? `meta-media://${message.document.id}` : null;
      content = mediaCaption ?? mediaFileName ?? '';
      break;

    case 'sticker':
      mediaMimeType = message.sticker?.mime_type ?? 'image/webp';
      mediaUrl = message.sticker?.id ? `meta-media://${message.sticker.id}` : null;
      break;

    case 'button':
      content = message.button?.text ?? '';
      break;

    case 'interactive':
      content =
        message.interactive?.button_reply?.title ??
        message.interactive?.list_reply?.title ??
        '';
      break;

    case 'reaction':
      // Contact reactions are processed separately — skip here
      return null;

    default:
      return null;
  }

  if (!phone || !externalId) return null;

  return {
    externalId,
    phone,
    type: mapType(type),
    content,
    timestamp,
    mediaUrl,
    mediaMimeType,
    mediaFileName,
    mediaCaption,
    mediaDuration,
  };
}

export async function handleMetaWebhook(body: any, sessionId: string): Promise<void> {
  const entries: any[] = body?.entry ?? [];

  for (const entry of entries) {
    for (const change of (entry?.changes ?? [])) {
      const value = change?.value;
      if (!value || change.field !== 'messages') continue;

      // Inbound messages
      for (const message of (value.messages ?? [])) {
        try {
          const payload = buildInboundPayload(message);
          if (!payload) continue;
          await processIncomingMessage(payload, { sessionId, provider: 'meta' });
        } catch (err) {
          logger.error('meta_webhook.message_failed', {
            messageId: message?.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Delivery / read status updates
      const statusUpdates = (value?.statuses ?? [])
        .map((s: any) => ({ key: { id: s.id }, status: mapStatus(s.status) }))
        .filter((u: any) => u.status !== undefined);

      if (statusUpdates.length > 0) {
        try {
          await handleMessageStatusUpdates(statusUpdates);
        } catch (err) {
          logger.error('meta_webhook.status_failed', {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }
}

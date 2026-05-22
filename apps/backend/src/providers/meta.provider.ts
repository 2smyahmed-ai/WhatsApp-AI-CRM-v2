import type { MessagingProvider, ProviderName, ProviderStatus, SendMessageInput } from './types';
import { normalizePhone } from '../lib/phone';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { getOrCreateConversationByPhone } from '../conversations/conversation-resolver';
import { buildMetaOutbound } from '../messaging/normalizers/meta.normalizer';
import { compileRenderable } from '../messaging/compile-renderable';
import { persistNormalizedMessage } from '../messaging/persist';

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function cfg() {
  return {
    accessToken: process.env.META_ACCESS_TOKEN ?? '',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID ?? '',
    fromPhone: process.env.META_FROM_PHONE ?? '',
  };
}

async function metaFetch(path: string, init: RequestInit = {}): Promise<any> {
  const { accessToken } = cfg();
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers as Record<string, string> ?? {}),
    },
  });
  const data = (await res.json()) as any;
  if (!res.ok) {
    throw new Error(data?.error?.message ?? `Meta API error ${res.status}`);
  }
  return data;
}

async function uploadMedia(buffer: Buffer, mimetype: string): Promise<string> {
  const { accessToken, phoneNumberId } = cfg();
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mimetype);
  form.append('file', new Blob([buffer], { type: mimetype }), 'upload');

  const res = await fetch(`${GRAPH_BASE}/${phoneNumberId}/media`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = (await res.json()) as any;
  if (!res.ok) throw new Error(data?.error?.message ?? `Media upload failed: ${res.status}`);
  return data.id as string;
}

function outboundType(media?: SendMessageInput['media']): string {
  if (!media) return 'TEXT';
  const m = media.mimetype.toLowerCase();
  if (m.startsWith('image/')) return 'IMAGE';
  if (m.startsWith('video/')) return 'VIDEO';
  if (m.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
}

export class MetaWhatsAppProvider implements MessagingProvider {
  readonly name: ProviderName = 'meta';
  private _connectedPhone: string | null = null;

  async connect(): Promise<void> {
    const { accessToken, phoneNumberId, fromPhone } = cfg();
    if (!accessToken || !phoneNumberId) {
      throw new Error('META_ACCESS_TOKEN and META_PHONE_NUMBER_ID must be configured');
    }
    try {
      const info = await metaFetch(`/${phoneNumberId}?fields=display_phone_number`);
      this._connectedPhone = normalizePhone(info.display_phone_number ?? '') ?? fromPhone ?? phoneNumberId;
      logger.info('meta.connected', { phone: this._connectedPhone });
    } catch (err) {
      // Treat as connected if config exists — token validation failed but we proceed
      this._connectedPhone = fromPhone || phoneNumberId;
      logger.warn('meta.connect_verify_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async disconnect(): Promise<void> {
    this._connectedPhone = null;
  }

  getStatus(): ProviderStatus {
    const { accessToken, phoneNumberId } = cfg();
    const configured = !!(accessToken && phoneNumberId);
    return {
      status: configured ? 'connected' : 'disconnected',
      qr: null,
      connectedPhone: this._connectedPhone ?? (configured ? phoneNumberId : null),
      error: null,
    };
  }

  async sendMessage(input: SendMessageInput): Promise<{ messageId: string }> {
    const { phoneNumberId } = cfg();
    const phone = normalizePhone(input.phone);
    if (!phone) throw new Error('Invalid phone number');
    const toNumber = phone.replace(/\D/g, '');

    // Single lookup for reply — reused for both Meta context and persist layer
    let replyExternalId: string | null = null;
    let replyContext: { message_id: string } | undefined;
    if (input.replyTo?.id) {
      const original = await prisma.message.findUnique({
        where: { id: input.replyTo.id },
        select: { externalId: true },
      });
      replyExternalId = original?.externalId ?? null;
      if (replyExternalId) replyContext = { message_id: replyExternalId };
    }

    const base: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toNumber,
      ...(replyContext ? { context: replyContext } : {}),
    };

    let payload: any;

    if (input.media) {
      const { mimetype, buffer, url, caption, filename } = input.media;
      const mime = mimetype.toLowerCase();

      let mediaRef: Record<string, string>;
      if (buffer) {
        const id = await uploadMedia(buffer, mimetype);
        mediaRef = { id };
      } else if (url) {
        mediaRef = { link: url };
      } else {
        throw new Error('Media requires either a buffer or a url');
      }

      if (mime.startsWith('image/')) {
        payload = { ...base, type: 'image', image: { ...mediaRef, ...(caption ? { caption } : {}) } };
      } else if (mime.startsWith('video/')) {
        payload = { ...base, type: 'video', video: { ...mediaRef, ...(caption ? { caption } : {}) } };
      } else if (mime.startsWith('audio/')) {
        payload = { ...base, type: 'audio', audio: mediaRef };
      } else {
        payload = {
          ...base,
          type: 'document',
          document: { ...mediaRef, ...(filename ? { filename } : {}), ...(caption ? { caption } : {}) },
        };
      }
    } else {
      payload = {
        ...base,
        type: 'text',
        text: { preview_url: false, body: input.text ?? '' },
      };
    }

    const result = await metaFetch(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const wamid: string = result?.messages?.[0]?.id;
    if (!wamid) throw new Error('Meta API did not return a message ID');

    const fromPhone = this._connectedPhone ?? cfg().fromPhone ?? phoneNumberId;

    let conversationRow: { id: string; teamId?: string | null };
    if (input.conversationId) {
      const found = await prisma.conversation.findUnique({
        where: { id: input.conversationId },
        select: { id: true, teamId: true },
      });
      if (!found) throw new Error('Conversation not found');
      conversationRow = found;
    } else {
      const { conversation: resolved } = await getOrCreateConversationByPhone(phone);
      conversationRow = resolved;
    }
    const teamId = (conversationRow as any).teamId ?? null;

    const msg = buildMetaOutbound({
      clientId: input.clientId,
      contactPhone: phone,
      wamid,
      sessionId: phoneNumberId,
      fromPhone,
      conversationId: conversationRow.id,
      teamId,
      text: input.text?.trim(),
      media: input.media
        ? {
            url: input.media.url,
            mimetype: input.media.mimetype,
            filename: input.media.filename,
            caption: input.media.caption,
            duration: input.media.duration,
          }
        : undefined,
      replyToExternalId: replyExternalId,
      replyToPreview: input.replyTo?.body ?? null,
    });

    const renderable = compileRenderable(msg, 'cloud_api');
    await persistNormalizedMessage(msg, renderable);

    return { messageId: wamid };
  }

  async sendReaction(
    phone: string,
    messageExternalId: string,
    _fromMe: boolean,
    emoji: string,
  ): Promise<void> {
    const { phoneNumberId } = cfg();
    await metaFetch(`/${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone.replace(/\D/g, ''),
        type: 'reaction',
        reaction: { message_id: messageExternalId, emoji },
      }),
    });
  }

  async getProfilePictureUrl(_phone: string): Promise<string | null> {
    return null;
  }
}

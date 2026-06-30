import { randomUUID } from 'crypto';
import { MessageType } from '@prisma/client';
import type {
  NormalizedMessage,
  MessageContent,
  MessageMetadata,
  ReplyReference,
  Media,
  MediaType,
  ProviderName,
} from '@crm/messaging-schema';

// ── Shared context ────────────────────────────────────────────────────────────

export interface InboundFlatContext {
  sessionId: string;
  systemPhone: string;
  conversationId: string;
  teamId: string | null;
  /** Which provider produced the raw message. Defaults to 'baileys'. */
  provider?: ProviderName;
  /** DB message id of the quoted message, if the contact replied to one. */
  replyToId?: string | null;
  /** Short preview body of the quoted message for the reply bubble. */
  replyToBody?: string | null;
}

/**
 * Flat representation produced by inbound-workflow's normalizeRawMessage().
 * Mirrors the NormalizedInboundMessage type in inbound-workflow.ts.
 */
export interface FlatInboundMessage {
  externalId: string;
  phone: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  rawType: string;
  mediaUrl: string | null;
  mediaMimeType: string | null;
  mediaFileName: string | null;
  mediaCaption: string | null;
  mediaDuration: number | null;
}

export interface BaileysOutboundParams {
  /** Caller-generated UUID for optimistic reconciliation. Generated here if absent. */
  clientId?: string;
  phone: string;           // normalised recipient E.164
  sentMessageId: string;   // key.id from Baileys sentMessage
  sessionId: string;       // sock.user.id
  systemPhone: string;     // connected WhatsApp number
  timestamp: Date;
  conversationId: string;
  teamId: string | null;
  text: string;
  media?: {
    mediaUrl?: string;
    mediaMimeType?: string;
    mediaFileName?: string;
    mediaCaption?: string;
    mediaDuration?: number;
    mediaIsVoiceNote?: boolean;
  };
  replyToId?: string | null;
  replyToBody?: string | null;
}

// ── Media helpers ─────────────────────────────────────────────────────────────

function mediaTypeFromMime(mime: string, isVoiceNote?: boolean): MediaType {
  const m = mime.toLowerCase();
  if (m === 'image/webp') return 'sticker';
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return isVoiceNote ? 'voice' : 'audio';
  return 'document';
}

function mediaTypeFromRawType(rawType: string): MediaType {
  const r = rawType.toLowerCase();
  if (r.includes('sticker')) return 'sticker';
  if (r.includes('image')) return 'image';
  if (r.includes('video')) return 'video';
  if (r.includes('audio')) return 'audio';
  if (r.includes('document')) return 'document';
  return 'document';
}

function mediaTypeFromPrismaType(prismaType: MessageType, rawType: string): MediaType {
  // rawType carries finer-grained info (e.g. "stickerMessage")
  if (rawType) return mediaTypeFromRawType(rawType);
  switch (prismaType) {
    case MessageType.IMAGE:    return 'image';
    case MessageType.VIDEO:    return 'video';
    case MessageType.AUDIO:    return 'audio';
    case MessageType.DOCUMENT: return 'document';
    default:                   return 'document';
  }
}

// ── Content builders ──────────────────────────────────────────────────────────

function buildContentFromFlat(flat: FlatInboundMessage): MessageContent {
  if (flat.type === MessageType.TEXT || flat.type === MessageType.INTERACTIVE) {
    // INTERACTIVE in legacy is a customer reply to a button — store as text
    return { kind: 'text', body: flat.content, previewUrl: false };
  }

  const mediaType = mediaTypeFromPrismaType(flat.type, flat.rawType);
  const media: Media = {
    mediaType,
    mime: flat.mediaMimeType ?? '',
    url: flat.mediaUrl,
    providerMediaId: null,
    fileName: flat.mediaFileName,
    sizeBytes: null,
    durationSec: flat.mediaDuration,
    width: null,
    height: null,
    thumbnailUrl: null,
  };

  return {
    kind: 'media',
    media,
    caption: flat.mediaCaption ?? undefined,
  };
}

function buildMetadata(
  compatibilityMode: 'cloud_api' | 'baileys_native' | 'fallback_text',
  overrides: Partial<MessageMetadata> = {},
): MessageMetadata {
  const now = new Date().toISOString();
  return {
    sequenceNumber: 0,
    traceId: randomUUID(),
    attemptCount: 0,
    errorReason: null,
    errorCode: null,
    compatibilityMode,
    timestamps: { received: now },
    origin: null,
    originRef: null,
    rawRetained: true,
    ...overrides,
  };
}

// ── Public: inbound from flat representation ──────────────────────────────────

/**
 * Convert the inbound-workflow's flat NormalizedInboundMessage into a
 * full NormalizedMessage, ready for compileRenderable + persistNormalizedMessage.
 *
 * `raw` is the original socket / webhook payload — retained for debugging.
 */
export function buildNormalizedFromFlat(
  flat: FlatInboundMessage,
  context: InboundFlatContext,
  raw: unknown,
): NormalizedMessage {
  const provider: ProviderName = 'baileys';
  const compatibilityMode = 'baileys_native';

  return {
    schemaVersion: 1,
    id: null,
    clientId: randomUUID(),
    externalId: flat.externalId,
    provider,
    sessionId: context.sessionId,
    conversationId: context.conversationId,
    contactPhone: flat.phone,
    teamId: context.teamId,
    direction: 'inbound',
    content: buildContentFromFlat(flat),
    status: 'received',
    metadata: buildMetadata(compatibilityMode),
    reply: context.replyToId
      ? { messageId: context.replyToId, externalId: null, preview: context.replyToBody ?? '', kind: 'text' }
      : null,
    timestamp: flat.timestamp.toISOString(),
    raw,
  };
}

// ── Public: outbound builder ──────────────────────────────────────────────────

/**
 * Build a NormalizedMessage for a Baileys outbound send.
 * Called AFTER sock.sendMessage() returns — status is `provider_accepted`.
 */
export function buildBaileysOutbound(params: BaileysOutboundParams): NormalizedMessage {
  const now = params.timestamp.toISOString();

  let content: MessageContent;
  const media = params.media;
  if (media && (media.mediaUrl || media.mediaMimeType)) {
    const mime = media.mediaMimeType ?? 'application/octet-stream';
    const mediaType = mediaTypeFromMime(mime, media.mediaIsVoiceNote);
    content = {
      kind: 'media',
      media: {
        mediaType,
        mime,
        url: media.mediaUrl ?? null,
        providerMediaId: null,
        fileName: media.mediaFileName ?? null,
        sizeBytes: null,
        durationSec: media.mediaDuration ?? null,
        width: null,
        height: null,
        thumbnailUrl: null,
      },
      caption: media.mediaCaption ?? undefined,
    };
  } else {
    content = { kind: 'text', body: params.text || '', previewUrl: false };
  }

  const reply: ReplyReference | null = params.replyToId
    ? { messageId: params.replyToId, externalId: null, preview: params.replyToBody ?? '', kind: 'text' }
    : null;

  return {
    schemaVersion: 1,
    id: null,
    clientId: params.clientId ?? randomUUID(),
    externalId: params.sentMessageId,
    provider: 'baileys',
    sessionId: params.sessionId,
    conversationId: params.conversationId,
    contactPhone: params.phone,
    teamId: params.teamId,
    direction: 'outbound',
    content,
    status: 'provider_accepted',
    metadata: buildMetadata('baileys_native', {
      attemptCount: 1,
      timestamps: { provider_accepted: now },
      origin: 'agent',
      rawRetained: false,
    }),
    reply,
    timestamp: now,
    raw: null,
  };
}

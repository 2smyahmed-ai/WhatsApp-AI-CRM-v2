import {
  makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} from '@whiskeysockets/baileys';
import { clearDbAuthState, useDbAuthState } from './db-auth-state';
import { Boom } from '@hapi/boom';
import { MessageDirection, MessageType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { emitRealtime } from '../realtime/socket';
import { normalizePhone, parseWhatsAppJid } from '../lib/phone';
import { logger } from '../lib/logger';
import { getOrCreateConversationByPhone } from '../conversations/conversation-resolver';
import { processIncomingMessage } from '../workflow/inbound-workflow';

let sock: any;
let currentQR: string | null = null;
let waStatus: 'connected' | 'disconnected' | 'connecting' = 'disconnected';
let connectInFlight: Promise<any> | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let lastConnectionError: { statusCode?: number; reason?: string; message?: string } | null = null;
let connectedAt: Date | null = null;

function clearActiveQr(): void {
  currentQR = null;
  emitRealtime('wa:qr', { qr: null });
}

function getSessionId() {
  return String(sock?.user?.id || process.env.WHATSAPP_SESSION_ID || 'default').trim();
}

function extractMessageText(message: any) {
  const normalizedMessage =
    message?.message?.message ||
    message?.message ||
    message?.msg ||
    message;

  return String(
    normalizedMessage?.conversation ||
    normalizedMessage?.extendedTextMessage?.text ||
    normalizedMessage?.imageMessage?.caption ||
    normalizedMessage?.videoMessage?.caption ||
    normalizedMessage?.documentMessage?.caption ||
    normalizedMessage?.stickerMessage?.caption ||
    '',
  ).trim();
}

async function syncOutboundMessage(message: any, sessionId: string) {
  const remoteJid = String(message?.key?.remoteJid || message?.remoteJid || '').split(':')[0];
  const phone = parseWhatsAppJid(remoteJid) || normalizePhone(remoteJid);
  if (!phone) return null;

  const body = extractMessageText(message);
  const messageId = String(message?.key?.id || message?.id || `local-${Date.now()}`);
  const timestampValue = Number(message?.messageTimestamp || Date.now() / 1000);
  const timestamp = new Date((Number.isFinite(timestampValue) ? timestampValue : Date.now() / 1000) * 1000);
  const { conversation } = await getOrCreateConversationByPhone(phone, undefined, prisma);

  const existing = await prisma.message.findFirst({
    where: { externalId: messageId, sessionId },
  });

  if (existing) return existing;

  const saved = await prisma.message.create({
    data: {
      externalId: messageId,
      sessionId,
      direction: MessageDirection.OUTBOUND,
      from: parseWhatsAppJid(sock?.user?.id || '') || normalizePhone(sock?.user?.id || '') || phone,
      to: phone,
      phone,
      conversationId: conversation.id,
      fromMe: true,
      body,
      type: MessageType.TEXT,
      timestamp,
      status: 'SENT',
    } as any,
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessage: body || 'Message',
      lastMessagePreview: body || 'Message',
      lastMessageAt: timestamp,
    },
  });

  emitRealtime('message:new', {
    conversationId: conversation.id,
    message: {
      id: saved.id,
      externalId: saved.externalId,
      sessionId,
      direction: 'OUTBOUND',
      from: saved.from,
      to: saved.to,
      phone: saved.phone,
      conversationId: conversation.id,
      fromMe: true,
      body: saved.body,
      type: saved.type,
      timestamp: saved.timestamp,
      status: saved.status,
    },
  });

  emitRealtime('conversation:updated', {
    conversationId: conversation.id,
    lastMessageAt: timestamp.toISOString(),
    lastMessagePreview: body || 'Message',
    fromMe: true,
  });

  return saved;
}

export async function connectToWhatsApp() {
  if (sock && waStatus === 'connected') {
    return sock;
  }
  if (connectInFlight) return connectInFlight;

  // Auth state is stored in PostgreSQL (WhatsAppSession.data) so the session
  // survives container restarts and ephemeral filesystem deployments.
  const authSessionId = process.env.WHATSAPP_SESSION_ID || 'default';
  const { state, saveCreds } = await useDbAuthState(authSessionId);
  const { version } = await fetchLatestBaileysVersion();

  connectInFlight = (async () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    clearActiveQr();

    sock = makeWASocket({
      auth: state,
      version,
      browser: Browsers.windows('Chrome'),
      // Deprecated in Baileys; QR is handled via `connection.update` and exposed via API/UI.
      printQRInTerminal: false,
    });
    waStatus = 'connecting';
    lastConnectionError = null;

    sock.ev.on('connection.update', async (update: any) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        logger.info('WhatsApp QR code received');
        currentQR = qr;
        emitRealtime('wa:qr', { qr });
      }

      if (connection === 'close') {
        const disconnectStatus = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const boomPayload = (lastDisconnect?.error as Boom)?.output?.payload as any;
        const boomData = (lastDisconnect?.error as any)?.data as any;
        const errorMessage = boomPayload?.message ?? (lastDisconnect?.error as any)?.message ?? String(lastDisconnect?.error ?? '');
        const loggedOut = disconnectStatus === DisconnectReason.loggedOut;
        const shouldReconnect = !loggedOut;
        const isAuthFailure = [401, 403, 405].includes(Number(disconnectStatus)) || /unauthorized|forbidden|session|auth|logged out|connection failure/i.test(errorMessage);

        lastConnectionError = {
          statusCode: disconnectStatus,
          reason: boomData?.reason,
          message: errorMessage,
        };

        logger.warn('WhatsApp connection closed', {
          shouldReconnect,
          isAuthFailure,
          error: errorMessage,
        });
        clearActiveQr();
        waStatus = 'disconnected';
        emitRealtime('wa:status', { status: 'disconnected' });

        sock = null;
        connectInFlight = null;
        connectedAt = null;

        if (loggedOut || isAuthFailure) {
          void clearDbAuthState(authSessionId);
          return;
        }

        // Avoid tight reconnect loops (seen as 405 spam). Retry after a short backoff.
        reconnectTimer = setTimeout(() => {
          void connectToWhatsApp();
        }, 3000);
      } else if (connection === 'open') {
        logger.info('WhatsApp connected');
        clearActiveQr();
        waStatus = 'connected';
        lastConnectionError = null;
        connectedAt = new Date();
        emitRealtime('wa:status', { status: 'connected' });
        connectInFlight = null;
        // Note: the WhatsAppSession row is created/updated by useDbAuthState
        // on every saveCreds call — no separate upsert needed here.
      } else if (connection === 'connecting') {
        waStatus = 'connecting';
        emitRealtime('wa:status', { status: 'connecting' });
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m: any) => {
      try {
        if (!Array.isArray(m?.messages)) return;
        if (m?.type !== 'notify' && m?.type !== 'append') return;
        const sessionId = getSessionId();
        await Promise.allSettled(
          m.messages.map(async (message: any) => {
            return processIncomingMessage(message, { sessionId });
          }),
        );
      } catch (error) {
        logger.error('Failed to process incoming WhatsApp message', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    sock.ev.on('messages.update', async (updates: any) => {
      try {
        const { handleMessageStatusUpdates } = await import('./handler');
        await handleMessageStatusUpdates(updates);
      } catch (error) {
        logger.error('Failed to process WhatsApp message updates', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    sock.ev.on('message-receipt.update', async (updates: any) => {
      try {
        const { handleMessageStatusUpdates } = await import('./handler');
        const normalizedUpdates = (updates || []).map((update: any) => ({
          key: update.key,
          status:
            update.read ? 3 :
            update.delivered ? 2 :
            update.received ? 1 :
            undefined,
        }));
        await handleMessageStatusUpdates(normalizedUpdates);
      } catch (error) {
        logger.error('Failed to process WhatsApp receipt updates', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return sock;
  })().finally(() => {
    // keep connectInFlight set while connected/connecting;
    // it gets cleared on 'close' above.
  });

  return connectInFlight;
}

export async function disconnectWhatsApp() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  const currentSock = sock;
  sock = null;
  clearActiveQr();
  waStatus = 'disconnected';
  connectInFlight = null;
  lastConnectionError = null;

  if (currentSock) {
    try {
      await currentSock.logout();
    } catch {
      // Logout can fail when the socket is already closed; we still treat the session as disconnected.
    }
  }

  emitRealtime('wa:status', { status: 'disconnected' });
}

export { sock, currentQR, waStatus, connectedAt };
export { lastConnectionError };
export { getSessionId };

/**
 * The connected account's own number in E.164, or null when not connected.
 * Local-number imports use this to infer their default region — contacts you
 * import without a country code almost always share your business's country.
 */
export function getConnectedNumber(): string | null {
  const rawId = sock?.user?.id;
  if (!rawId) return null;
  return parseWhatsAppJid(rawId) || normalizePhone(rawId);
}

export async function getWhatsAppProfilePictureUrl(phone: string) {
  if (!sock || waStatus !== 'connected') return null;

  try {
    const jid = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
    return await sock.profilePictureUrl(jid, 'image');
  } catch {
    return null;
  }
}

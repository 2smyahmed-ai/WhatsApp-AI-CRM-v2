import { prisma } from '../lib/prisma';
import { sock, waStatus } from './client';
import { normalizePhone, normalizeRecipient, parseWhatsAppJid } from '../lib/phone';
import { getOrCreateConversationByPhone } from '../conversations/conversation-resolver';
import { retryAsync } from '../lib/retry';
import { logger } from '../lib/logger';
import { buildBaileysOutbound } from '../messaging/normalizers/baileys.normalizer';
import { compileRenderable } from '../messaging/compile-renderable';
import { persistNormalizedMessage } from '../messaging/persist';
import { BAILEYS_CAPABILITIES } from '../messaging/capabilities';
import ffmpegPath from 'ffmpeg-static';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';

type SendPayload = {
  text?: string;
  image?: Buffer;
  video?: Buffer;
  document?: Buffer;
  audio?: Buffer;
  sticker?: Buffer;
  mimetype?: string;
  fileName?: string;
  caption?: string;
  ptt?: boolean;
};

function pickPayloadFromMedia(input?: {
  mediaBuffer?: Buffer;
  mediaMimeType?: string;
  mediaFileName?: string;
  mediaCaption?: string;
  mediaDuration?: number;
  mediaIsVoiceNote?: boolean;
}) {
  if (!input?.mediaBuffer) return null;
  return {
    fileBuffer: input.mediaBuffer,
    fileName: input.mediaFileName || 'attachment',
    mimetype: input.mediaMimeType || 'application/octet-stream',
    caption: input.mediaCaption,
    duration: input.mediaDuration,
    isVoiceNote: input.mediaIsVoiceNote || false,
  };
}

async function convertAudioToOggOpus(buffer: Buffer): Promise<Buffer> {
  if (!ffmpegPath) {
    throw new Error('ffmpeg binary is not available');
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'wa-audio-'));
  const inputPath = path.join(tempDir, 'input');
  const outputPath = path.join(tempDir, 'output.ogg');

  try {
    await writeFile(inputPath, buffer);

    await new Promise<void>((resolve, reject) => {
      const child = spawn(ffmpegPath as string, [
        '-y',
        '-i', inputPath,
        '-vn',
        '-c:a', 'libopus',
        '-b:a', '64k',
        '-f', 'ogg',
        outputPath,
      ]);

      let stderr = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
        }
      });
    });

    return await readFile(outputPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export async function sendMessage(
  inputPhone: string,
  message: string,
  media?: {
    mediaBuffer?: Buffer;
    mediaMimeType?: string;
    mediaFileName?: string;
    mediaCaption?: string;
    mediaDuration?: number;
    mediaIsVoiceNote?: boolean;
    mediaUrl?: string;
  },
  replyTo?: { replyToId?: string; replyToBody?: string },
  clientId?: string,
  knownConversationId?: string,
) {
  if (!sock || waStatus !== 'connected') throw new Error('WhatsApp is not connected');

  const normalizedPhone = normalizePhone(inputPhone);
  if (!normalizedPhone) {
    logger.warn('invalid_phone', { inputPhone });
    throw new Error('Invalid phone number');
  }
  if (!message?.trim() && !media?.mediaBuffer) throw new Error('Message cannot be empty');

  const jid = normalizeRecipient(normalizedPhone);
  if (!jid) throw new Error('Invalid recipient');

  const waLookup = await sock.onWhatsApp(jid);
  const waEntry = waLookup?.[0];
  if (!waEntry?.exists) {
    throw new Error(`Recipient ${inputPhone} is not available on WhatsApp`);
  }

  const targetJid = waEntry.jid || jid;
  const mediaPayload = pickPayloadFromMedia(media);
  let payload: SendPayload = { text: message.trim() };

  if (mediaPayload) {
    const mime = mediaPayload.mimetype.toLowerCase();
    const isAudio = mime.startsWith('audio/');
    const isVoiceNote = Boolean(mediaPayload.isVoiceNote);
    let buffer = mediaPayload.fileBuffer;
    if (isAudio) {
      try {
        buffer = await convertAudioToOggOpus(mediaPayload.fileBuffer);
      } catch (err) {
        logger.warn('audio_convert_failed_using_original', { error: err instanceof Error ? err.message : String(err) });
      }
    }
    if (mime.startsWith('image/')) {
      payload = { image: buffer, caption: mediaPayload.caption?.trim() || undefined, mimetype: mime };
    } else if (mime.startsWith('video/')) {
      payload = { video: buffer, caption: mediaPayload.caption?.trim() || undefined, mimetype: mime };
    } else if (isAudio) {
      payload = {
        audio: buffer,
        mimetype: 'audio/ogg; codecs=opus',
        ptt: isVoiceNote,
      };
    } else if (mime.includes('sticker')) {
      payload = { sticker: buffer };
    } else {
      payload = {
        document: buffer,
        fileName: mediaPayload.fileName,
        mimetype: mime,
        caption: mediaPayload.caption?.trim() || undefined,
      };
    }
  }

  // Build quoted message for Baileys if this is a reply
  let quotedMsg: any = undefined;
  if (replyTo?.replyToId) {
    try {
      const original = await prisma.message.findFirst({
        where: { id: replyTo.replyToId },
        select: { externalId: true, fromMe: true, body: true, type: true, mediaMimeType: true },
      });
      if (original?.externalId) {
        const msgType = (original.type || 'TEXT').toUpperCase();
        quotedMsg = {
          key: { remoteJid: targetJid, fromMe: original.fromMe, id: original.externalId },
          message:
            msgType === 'IMAGE'
              ? { imageMessage: { caption: original.body || '' } }
              : msgType === 'VIDEO'
              ? { videoMessage: { caption: original.body || '' } }
              : msgType === 'AUDIO'
              ? { audioMessage: { ptt: false } }
              : msgType === 'DOCUMENT'
              ? { documentMessage: { fileName: original.body || 'file' } }
              : { conversation: original.body || '' },
        };
      }
    } catch {
      // non-critical — send without quote if lookup fails
    }
  }

  const sentMessage = await retryAsync(
    async () => sock.sendMessage(targetJid, payload as any, quotedMsg ? { quoted: quotedMsg } : {}),
    {
      attempts: 3,
      delayMs: 300,
      onRetry: (error, attempt, delayMs) => {
        logger.warn('Retrying WhatsApp send', {
          phone: normalizedPhone,
          attempt,
          delayMs,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    },
  );
  const sentMessageId = sentMessage?.key?.id;
  const sessionId = String(sock?.user?.id || process.env.WHATSAPP_SESSION_ID || 'default').trim();
  const systemPhone = parseWhatsAppJid(sock?.user?.id || '') || normalizePhone(sock?.user?.id || '') || normalizedPhone;
  const sentTimestamp = new Date((sentMessage?.messageTimestamp ? Number(sentMessage.messageTimestamp) : Date.now() / 1000) * 1000);

  let conversationRow: { id: string; teamId?: string | null };
  if (knownConversationId) {
    const found = await prisma.conversation.findUnique({
      where: { id: knownConversationId },
      select: { id: true, teamId: true },
    });
    if (!found) throw new Error('Conversation not found');
    conversationRow = found;
  } else {
    const { conversation: resolved } = await getOrCreateConversationByPhone(normalizedPhone);
    conversationRow = resolved;
  }
  const conversation = conversationRow;
  const teamId = (conversation as any).teamId ?? null;

  const normalizedMsg = buildBaileysOutbound({
    clientId,
    phone: normalizedPhone,
    sentMessageId: sentMessageId || `local-${Date.now()}`,
    sessionId,
    systemPhone,
    timestamp: sentTimestamp,
    conversationId: conversation.id,
    teamId,
    text: message,
    media: media
      ? {
          mediaUrl: media.mediaUrl,
          mediaMimeType: media.mediaMimeType,
          mediaFileName: media.mediaFileName,
          mediaCaption: media.mediaCaption,
          mediaDuration: media.mediaDuration,
          mediaIsVoiceNote: media.mediaIsVoiceNote,
        }
      : undefined,
    replyToId: replyTo?.replyToId ?? null,
    replyToBody: replyTo?.replyToBody ?? null,
  });

  const renderable = compileRenderable(normalizedMsg, BAILEYS_CAPABILITIES.defaultMode);
  const { messageId } = await persistNormalizedMessage(normalizedMsg, renderable);

  return { id: messageId };
}

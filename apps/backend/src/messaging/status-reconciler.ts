import { MsgStatus } from '@prisma/client';
import type { MessageStatus } from '@crm/messaging-schema';

// ── Meta Cloud API ────────────────────────────────────────────────────────────
// Webhook statuses come as lowercase strings from the Meta API.

const META_STRING_TO_MSG_STATUS: Record<string, MessageStatus> = {
  sent:      'server_confirmed', // Meta "sent" = server confirmed receipt
  delivered: 'delivered',
  read:      'read',
  failed:    'failed',
};

const META_STRING_TO_PRISMA: Record<string, MsgStatus> = {
  sent:      MsgStatus.SERVER_CONFIRMED,
  delivered: MsgStatus.DELIVERED,
  read:      MsgStatus.READ,
  failed:    MsgStatus.FAILED,
};

export function reconcileMetaStatus(webhookStatus: string): MessageStatus {
  return META_STRING_TO_MSG_STATUS[webhookStatus.toLowerCase()] ?? 'failed';
}

export function reconcileMetaStatusToPrisma(webhookStatus: string): MsgStatus | null {
  return META_STRING_TO_PRISMA[webhookStatus.toLowerCase()] ?? null;
}

// ── Baileys (legacy numeric ACK codes) ───────────────────────────────────────
// Code values come from @whiskeysockets/baileys WAMessageStatus.
// The existing handler.ts uses 1=SENT 2=DELIVERED 3=READ — keep that mapping
// for backward compat; map forward to the normalized pipeline's MessageStatus.

const BAILEYS_CODE_TO_MSG_STATUS: Record<number, MessageStatus> = {
  0: 'failed',             // ERROR
  1: 'server_confirmed',  // SERVER_ACK (historically called SENT)
  2: 'delivered',
  3: 'read',
  4: 'read',              // PLAYED (audio)
};

const BAILEYS_CODE_TO_PRISMA: Record<number, MsgStatus> = {
  0: MsgStatus.FAILED,
  1: MsgStatus.SERVER_CONFIRMED,
  2: MsgStatus.DELIVERED,
  3: MsgStatus.READ,
  4: MsgStatus.READ,
};

export function reconcileBaileysStatus(code: number): MessageStatus {
  return BAILEYS_CODE_TO_MSG_STATUS[code] ?? 'failed';
}

export function reconcileBaileysStatusToPrisma(code: number): MsgStatus | null {
  return BAILEYS_CODE_TO_PRISMA[code] ?? null;
}

// ── Shared: Prisma → MessageStatus ───────────────────────────────────────────

const PRISMA_TO_MSG_STATUS: Record<MsgStatus, MessageStatus> = {
  [MsgStatus.QUEUED]:            'queued',
  [MsgStatus.SENDING]:           'sending',
  [MsgStatus.SENT]:              'server_confirmed', // legacy SENT ≈ server_confirmed
  [MsgStatus.PROVIDER_ACCEPTED]: 'provider_accepted',
  [MsgStatus.SERVER_CONFIRMED]:  'server_confirmed',
  [MsgStatus.DELIVERED]:         'delivered',
  [MsgStatus.READ]:              'read',
  [MsgStatus.RECEIVED]:          'received',
  [MsgStatus.PROCESSED]:         'processed',
  [MsgStatus.FAILED]:            'failed',
  [MsgStatus.EXPIRED]:           'expired',
};

export function prismaStatusToMessageStatus(s: MsgStatus): MessageStatus {
  return PRISMA_TO_MSG_STATUS[s] ?? 'failed';
}

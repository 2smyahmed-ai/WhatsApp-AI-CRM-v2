/**
 * The lifecycle state of a message. Single enum covering both directions;
 * the status reconciler validates that transitions are legal for each.
 *
 * Outbound progression:
 *   queued → sending → provider_accepted → server_confirmed → delivered → read
 *
 * Inbound progression:
 *   received → processed
 *
 * Terminal failures:
 *   failed | expired
 *
 * The `provider_accepted` vs `server_confirmed` split is the key fix for
 * today's ghost-message problem: an HTTP 200 with a wamid only proves the
 * provider's API accepted the call. The async webhook (status=sent) is what
 * proves it was actually queued for delivery. A 131047 failure happens between
 * those two states and is invisible today.
 */
export type MessageStatus =
  | 'queued'
  | 'sending'
  | 'provider_accepted'
  | 'server_confirmed'
  | 'delivered'
  | 'read'
  | 'received'
  | 'processed'
  | 'failed'
  | 'expired';

export const MESSAGE_STATUSES = [
  'queued',
  'sending',
  'provider_accepted',
  'server_confirmed',
  'delivered',
  'read',
  'received',
  'processed',
  'failed',
  'expired',
] as const;

/**
 * Statuses that apply to outbound messages. Used by the reconciler for
 * direction-aware transition validation and by the UI to map to ticks.
 */
export const OUTBOUND_STATUSES = [
  'queued',
  'sending',
  'provider_accepted',
  'server_confirmed',
  'delivered',
  'read',
  'failed',
  'expired',
] as const;

export const INBOUND_STATUSES = [
  'received',
  'processed',
  'failed',
] as const;

export const TERMINAL_STATUSES = ['delivered', 'read', 'processed', 'failed', 'expired'] as const;

/** Message direction. Hard property — never derived from `fromMe`. */
export type MessageDirection = 'inbound' | 'outbound';

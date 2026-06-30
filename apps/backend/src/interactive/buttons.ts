/**
 * interactive/buttons.ts
 *
 * Quick-reply and CTA URL buttons via Baileys nativeFlowMessage.
 *
 * ─── WHATSAPP NATIVE FLOW ARCHITECTURE ───────────────────────────────────────
 *
 * Both quick-reply and CTA URL buttons are wrapped in the proto path:
 *
 *   interactiveMessage
 *     └─ nativeFlowMessage
 *          └─ buttons[]
 *               ├─ { name: 'quick_reply', buttonParamsJson: '{"display_text":"...", "id":"..."}' }
 *               └─ { name: 'cta_url',     buttonParamsJson: '{"display_text":"...", "url":"..."}' }
 *
 * Why relayMessage instead of sendMessage?
 *   sock.sendMessage() accepts AnyMessageContent — a union that does NOT include
 *   interactiveMessage. relayMessage() sends an arbitrary proto.IMessage directly,
 *   bypassing that union constraint. This is the only way to deliver native interactive
 *   messages via the Baileys library.
 *
 * ─── WHATSAPP LIMITS (as of 2025) ────────────────────────────────────────────
 *
 *   quick_reply buttons:  max 3 per message, 20-char title each
 *   cta_url buttons:      max 2 per message, 20-char display text
 *   body text:            max 1 024 chars
 *   footer text:          max 60 chars
 *   header (text):        max 60 chars
 *   header (media):       image/video/document uploaded via prepareWAMessageMedia
 *
 * ─── RENDERING ───────────────────────────────────────────────────────────────
 *
 *   Android WhatsApp:   renders natively as tappable pill buttons below the bubble
 *   iOS WhatsApp:       same native rendering
 *   WhatsApp Web:       buttons appear as interactive elements (may look slightly different)
 *   Very old clients:   fall back to plain text if they don't support nativeFlowMessage
 */

import { generateMessageID, prepareWAMessageMedia } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import {
  normalizeJid,
  assertConnected,
  retryAsync,
  simulateTyping,
  rateLimiter,
  validateLength,
  validateButtonCount,
} from './utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_QR_BUTTONS    = 3;
const MAX_CTA_BUTTONS   = 2;
const MAX_BTN_TITLE_LEN = 20;   // WhatsApp hard limit for button labels on mobile
const MAX_BODY_LEN      = 1_024;
const MAX_FOOTER_LEN    = 60;
const MAX_HEADER_LEN    = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickReplyButton {
  /** The payload ID sent back when the user taps the button. */
  id: string;
  /** Label shown on the button (max 20 chars). */
  title: string;
  /** Optional emoji prepended to the title (counts toward the 20-char limit). */
  emoji?: string;
}

export interface CtaUrlButton {
  /** Text shown on the button. */
  displayText: string;
  /** URL to open when tapped. Must be https://. */
  url: string;
  /**
   * If provided, appended as `?_tid=<trackingId>` for click attribution.
   * URL-encoded automatically.
   */
  trackingId?: string;
}

/** Media or text header above the message body. */
export type ButtonHeader =
  | { type: 'text'; text: string }
  | {
      type: 'image' | 'video' | 'document';
      buffer: Buffer;
      mimetype?: string;
      /** Used only for document headers — sets the visible file name. */
      filename?: string;
    };

export interface SendButtonsOptions {
  body: string;
  buttons: QuickReplyButton[];
  footer?: string;
  header?: ButtonHeader;
  /**
   * Send a typing-presence indicator before the message.
   * Default: true.  Set to false in batch sends where you manage timing yourself.
   */
  simulateTyping?: boolean;
}

export interface SendCtaButtonsOptions {
  body: string;
  ctaButtons: CtaUrlButton[];
  footer?: string;
  header?: ButtonHeader;
  simulateTyping?: boolean;
}

export interface SendResult {
  messageId: string;
  jid: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level button builders
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a single `quick_reply` entry for nativeFlowMessage.buttons.
 *
 * When the user taps the button, WhatsApp sends back an interactiveResponseMessage
 * whose nativeFlowResponseMessage.paramsJson decodes to `{ id, display_text }`.
 */
export function buildQuickReplyButton(
  btn: QuickReplyButton,
): { name: string; buttonParamsJson: string } {
  if (!btn?.id) throw new TypeError('QuickReplyButton.id is required');

  const rawTitle = btn.emoji ? `${btn.emoji} ${btn.title}` : btn.title;
  const title    = validateLength(rawTitle, 'button.title', MAX_BTN_TITLE_LEN, /* truncate */ true);

  return {
    name: 'quick_reply',
    buttonParamsJson: JSON.stringify({ display_text: title, id: btn.id }),
  };
}

/**
 * Build a single `cta_url` entry for nativeFlowMessage.buttons.
 *
 * When the user taps, WhatsApp opens the URL in the built-in in-app browser.
 * A response event is NOT sent back to the sender — clicks are one-way.
 */
export function buildCtaUrlButton(
  btn: CtaUrlButton,
): { name: string; buttonParamsJson: string } {
  if (!btn?.url)         throw new TypeError('CtaUrlButton.url is required');
  if (!btn?.displayText) throw new TypeError('CtaUrlButton.displayText is required');

  let url = btn.url;
  if (btn.trackingId) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}_tid=${encodeURIComponent(btn.trackingId)}`;
  }

  const displayText = validateLength(btn.displayText, 'displayText', MAX_BTN_TITLE_LEN, true);
  return {
    name: 'cta_url',
    buttonParamsJson: JSON.stringify({ display_text: displayText, url }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Header builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the `header` sub-object of interactiveMessage.
 *
 * Text headers:  { title, hasMediaAttachment: false }
 * Media headers: upload via prepareWAMessageMedia, then inject the prepared proto field.
 *
 * Media is uploaded to WhatsApp's CDN through the authenticated Baileys session.
 * The returned URL + mediaKey + fileSha256 are embedded in the proto message.
 */
async function buildHeader(
  header: ButtonHeader | undefined,
  sock: WASocket,
): Promise<Record<string, unknown> | undefined> {
  if (!header) return undefined;

  if (header.type === 'text') {
    return {
      title:              validateLength(header.text ?? '', 'header.text', MAX_HEADER_LEN, true),
      hasMediaAttachment: false,
    };
  }

  // Media header — upload the buffer
  if (!header.buffer) {
    throw new Error(`header.buffer is required for header.type="${header.type}"`);
  }

  const mediaInput: Record<string, unknown> = {
    [header.type]: header.buffer,
    ...(header.mimetype                              ? { mimetype:  header.mimetype  } : {}),
    ...(header.type === 'document' && header.filename ? { fileName: header.filename  } : {}),
  };

  const prepared = await prepareWAMessageMedia(mediaInput as any, {
    upload: sock.waUploadToServer,
  });

  const fieldKey = `${header.type}Message`; // "imageMessage" | "videoMessage" | "documentMessage"
  return {
    hasMediaAttachment: true,
    [fieldKey]: (prepared as any)[fieldKey],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Send: Quick-reply buttons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an interactive quick-reply button message.
 *
 * Renders as tappable pill buttons beneath the message bubble on all modern
 * WhatsApp clients (Android, iOS, Web).  Max 3 buttons per WhatsApp's native limit.
 *
 * The response is received as an `interactiveResponseMessage` with
 * `nativeFlowResponseMessage.name === "quick_reply"` and
 * `nativeFlowResponseMessage.paramsJson` containing the button's `id`.
 * Parse it with `handleInteractiveResponse()` from interactive/responses.ts.
 *
 * @example
 * const result = await sendButtons(sock, '14155550000', {
 *   header:  { type: 'text', text: 'Main Menu' },
 *   body:    'How can we help you today?',
 *   footer:  'Tap a button to continue',
 *   buttons: [
 *     { id: 'support',    title: 'Support',     emoji: '🛠' },
 *     { id: 'sales',      title: 'Sales',        emoji: '💰' },
 *     { id: 'my_order',   title: 'Track Order',  emoji: '📦' },
 *   ],
 * });
 * console.log('Sent with ID:', result.messageId);
 */
export async function sendButtons(
  sock: WASocket,
  jid: string,
  options: SendButtonsOptions,
): Promise<SendResult> {
  assertConnected(sock);

  const normalJid = normalizeJid(jid);
  rateLimiter.check(normalJid);

  const body   = validateLength(options.body ?? '', 'body', MAX_BODY_LEN);
  const footer = options.footer
    ? validateLength(options.footer, 'footer', MAX_FOOTER_LEN, true)
    : undefined;

  validateButtonCount(options.buttons, MAX_QR_BUTTONS, 'quick reply buttons');
  const nativeButtons = options.buttons.map(buildQuickReplyButton);

  // Build header — catch upload failures and degrade gracefully (no header)
  const headerObj = await buildHeader(options.header, sock).catch((err) => {
    console.error('[interactive/buttons] header build failed (sending without header):', err.message);
    return undefined;
  });

  const interactiveMsg: Record<string, unknown> = {
    body:              { text: body },
    nativeFlowMessage: { messageVersion: 1, buttons: nativeButtons },
    ...(footer    ? { footer: { text: footer } } : {}),
    ...(headerObj ? { header: headerObj }         : {}),
  };

  if (options.simulateTyping !== false) {
    await simulateTyping(sock, normalJid, body.length);
  }

  const msgId = generateMessageID();

  await retryAsync(
    () =>
      (sock as any).relayMessage(
        normalJid,
        { interactiveMessage: interactiveMsg },
        { messageId: msgId },
      ),
    {
      maxAttempts: 3,
      baseDelayMs: 400,
      onRetry: (err, attempt, delayMs) =>
        console.warn(`[interactive/buttons] retry ${attempt} in ${delayMs}ms:`, (err as Error).message),
    },
  );

  const result: SendResult = {
    messageId: msgId,
    jid:       normalJid,
    timestamp: new Date().toISOString(),
  };

  console.log('[interactive/buttons] quick-reply buttons sent', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send: CTA URL buttons
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an interactive CTA URL button message.
 *
 * Opens a URL in WhatsApp's built-in browser when the user taps the button.
 * Clicks are one-way — no response event is sent back to the sender.
 * Use `trackingId` to attribute clicks via your analytics pipeline.
 *
 * Max 2 CTA URL buttons per message.
 *
 * @example
 * await sendCtaButtons(sock, '14155550000', {
 *   body:   'Your order #1234 is ready for pickup!',
 *   footer: 'View your order details',
 *   ctaButtons: [
 *     {
 *       displayText: 'Track Order',
 *       url:         'https://shop.example.com/orders/1234',
 *       trackingId:  'wa_order_ready_001',
 *     },
 *   ],
 * });
 */
export async function sendCtaButtons(
  sock: WASocket,
  jid: string,
  options: SendCtaButtonsOptions,
): Promise<SendResult> {
  assertConnected(sock);

  const normalJid = normalizeJid(jid);
  rateLimiter.check(normalJid);

  const body   = validateLength(options.body ?? '', 'body', MAX_BODY_LEN);
  const footer = options.footer
    ? validateLength(options.footer, 'footer', MAX_FOOTER_LEN, true)
    : undefined;

  if (!Array.isArray(options.ctaButtons) || options.ctaButtons.length === 0) {
    throw new TypeError('ctaButtons must be a non-empty array');
  }
  if (options.ctaButtons.length > MAX_CTA_BUTTONS) {
    throw new RangeError(
      `Maximum ${MAX_CTA_BUTTONS} CTA buttons per message (got ${options.ctaButtons.length})`,
    );
  }

  const nativeButtons = options.ctaButtons.map(buildCtaUrlButton);
  const headerObj     = await buildHeader(options.header, sock).catch(() => undefined);

  const interactiveMsg: Record<string, unknown> = {
    body:              { text: body },
    nativeFlowMessage: { messageVersion: 1, buttons: nativeButtons },
    ...(footer    ? { footer: { text: footer } } : {}),
    ...(headerObj ? { header: headerObj }         : {}),
  };

  if (options.simulateTyping !== false) {
    await simulateTyping(sock, normalJid, body.length);
  }

  const msgId = generateMessageID();

  await retryAsync(
    () =>
      (sock as any).relayMessage(
        normalJid,
        { interactiveMessage: interactiveMsg },
        { messageId: msgId },
      ),
    { maxAttempts: 3, baseDelayMs: 400 },
  );

  const result: SendResult = {
    messageId: msgId,
    jid:       normalJid,
    timestamp: new Date().toISOString(),
  };

  console.log('[interactive/buttons] CTA buttons sent', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mixed builder: quick-reply + CTA in one message
// ─────────────────────────────────────────────────────────────────────────────

export interface SendMixedButtonsOptions {
  body: string;
  /** Up to 2 quick-reply buttons */
  quickReplies?: QuickReplyButton[];
  /** Up to 1 CTA URL button (mix reduces the native QR cap) */
  cta?: CtaUrlButton;
  footer?: string;
  header?: ButtonHeader;
  simulateTyping?: boolean;
}

/**
 * Send a message that combines quick-reply buttons AND a CTA URL button.
 *
 * WhatsApp supports mixing button types in a single nativeFlowMessage.
 * The combined total must not exceed 3 buttons.
 *
 * @example
 * await sendMixedButtons(sock, jid, {
 *   body:         'Would you like to proceed?',
 *   quickReplies: [{ id: 'yes', title: '✅ Yes' }, { id: 'no', title: '❌ No' }],
 *   cta:          { displayText: 'Learn More', url: 'https://docs.example.com' },
 * });
 */
export async function sendMixedButtons(
  sock: WASocket,
  jid: string,
  options: SendMixedButtonsOptions,
): Promise<SendResult> {
  assertConnected(sock);

  const normalJid = normalizeJid(jid);
  rateLimiter.check(normalJid);

  const body   = validateLength(options.body ?? '', 'body', MAX_BODY_LEN);
  const footer = options.footer
    ? validateLength(options.footer, 'footer', MAX_FOOTER_LEN, true)
    : undefined;

  const nativeButtons: Array<{ name: string; buttonParamsJson: string }> = [
    ...(options.quickReplies ?? []).map(buildQuickReplyButton),
    ...(options.cta ? [buildCtaUrlButton(options.cta)] : []),
  ];

  if (nativeButtons.length === 0) throw new TypeError('At least one button is required');
  if (nativeButtons.length > 3) {
    throw new RangeError(
      `Total buttons must not exceed 3 (got ${nativeButtons.length})`,
    );
  }

  const headerObj = await buildHeader(options.header, sock).catch(() => undefined);

  const interactiveMsg: Record<string, unknown> = {
    body:              { text: body },
    nativeFlowMessage: { messageVersion: 1, buttons: nativeButtons },
    ...(footer    ? { footer: { text: footer } } : {}),
    ...(headerObj ? { header: headerObj }         : {}),
  };

  if (options.simulateTyping !== false) {
    await simulateTyping(sock, normalJid, body.length);
  }

  const msgId = generateMessageID();

  await retryAsync(
    () =>
      (sock as any).relayMessage(
        normalJid,
        { interactiveMessage: interactiveMsg },
        { messageId: msgId },
      ),
    { maxAttempts: 3, baseDelayMs: 400 },
  );

  return { messageId: msgId, jid: normalJid, timestamp: new Date().toISOString() };
}

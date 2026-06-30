/**
 * interactive/responses.ts
 *
 * Parses incoming Baileys messages that are user replies to interactive messages.
 *
 * ─── SUPPORTED RESPONSE PATHS ────────────────────────────────────────────────
 *
 *   Path 1 — Modern WhatsApp (primary)
 *     message.message.interactiveResponseMessage
 *       └─ nativeFlowResponseMessage
 *            ├─ name: "quick_reply"    → user tapped a quick_reply button
 *            ├─ name: "single_select"  → user selected a list row
 *            └─ name: "cta_url"        → (rare) CTA click events on some clients
 *
 *   Path 2 — Legacy quick-reply API
 *     message.message.buttonsResponseMessage
 *       └─ selectedButtonId, selectedDisplayText
 *
 *   Path 3 — Legacy list API
 *     message.message.listResponseMessage
 *       └─ singleSelectReply.selectedRowId, title, description
 *
 *   Path 4 — Template button replies
 *     message.message.templateButtonReplyMessage
 *       └─ selectedId, selectedIndex, selectedDisplayText
 *
 * ─── HOW paramsJson WORKS ────────────────────────────────────────────────────
 *
 *   When you build a nativeFlowMessage button, you supply:
 *     buttonParamsJson: JSON.stringify({ display_text: "Button label", id: "my_action" })
 *
 *   WhatsApp echoes that JSON verbatim inside:
 *     nativeFlowResponseMessage.paramsJson
 *
 *   For single_select rows the shape is:
 *     { id: "row_id", title: "Row Title", description: "Row description" }
 *
 *   For cta_url:
 *     { display_text: "Visit Site", url: "https://..." }
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   // One-shot parse inside a messages.upsert listener:
 *   sock.ev.on('messages.upsert', ({ messages }) => {
 *     for (const msg of messages) {
 *       const resp = handleInteractiveResponse(msg);
 *       if (resp?.type === 'quick_reply') {
 *         console.log('User pressed button with id:', resp.id);
 *       }
 *     }
 *   });
 *
 *   // Or use the managed listener helper:
 *   const stop = onInteractiveResponse(sock, (resp) => {
 *     if (resp.type === 'list_selection') {
 *       console.log('User chose list row:', resp.id, resp.payload);
 *     }
 *   });
 *   // Later: stop(); // removes the listener
 */

import { jidNormalizedUser } from '@whiskeysockets/baileys';
import type { WASocket, WAMessage } from '@whiskeysockets/baileys';

// ─────────────────────────────────────────────────────────────────────────────
// Response type constants
// ─────────────────────────────────────────────────────────────────────────────

export const RESPONSE_TYPES = {
  QUICK_REPLY:    'quick_reply',
  LIST_SELECTION: 'list_selection',
  CTA_CLICKED:    'cta_url',
  FLOW_RESPONSE:  'native_flow',
  UNKNOWN:        'unknown',
} as const;

export type ResponseType = (typeof RESPONSE_TYPES)[keyof typeof RESPONSE_TYPES];

// ─────────────────────────────────────────────────────────────────────────────
// Parsed response shape
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedInteractiveResponse {
  /** Which button / interaction type triggered the response. */
  type: ResponseType;

  /**
   * The primary identifier from the response:
   *   quick_reply    → the button's `id` from buttonParamsJson
   *   list_selection → the selected row's `id`
   *   cta_url        → the URL (cta clicks are rarely delivered back)
   *   native_flow    → paramsJson.id or the flow name
   */
  id: string;

  /**
   * The full decoded payload from paramsJson (or equivalent legacy fields).
   * Shape depends on `type` — see module doc for details.
   */
  payload: unknown;

  /** Normalised sender JID (individual @s.whatsapp.net, even in groups). */
  user: string;

  /** Remote JID of the conversation. May be a group JID (@g.us). */
  jid: string;

  /** Unix epoch seconds from the message timestamp. */
  timestamp: number;

  /** Raw contextInfo (quoted message metadata), null if absent. */
  contextInfo: unknown;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Safely parse JSON without throwing. */
function safeJson(str: string | null | undefined): Record<string, unknown> | null {
  if (!str || typeof str !== 'string') return null;
  try {
    return JSON.parse(str) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Extract the human sender JID, handling both DM and group messages. */
function extractSenderJid(message: WAMessage): string {
  const key         = message.key ?? {};
  const remoteJid   = String(key.remoteJid ?? '');
  const participant = key.participant ? String(key.participant) : undefined;
  // In a group, key.participant carries the actual sender's JID
  return participant
    ? jidNormalizedUser(participant)
    : jidNormalizedUser(remoteJid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Native flow response parser (Path 1 — modern WA)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a nativeFlowResponseMessage sub-object.
 *
 * `nativeFlowResponseMessage.name` identifies the button type:
 *   "quick_reply"    → tapped a quick_reply button
 *   "single_select"  → selected a list row
 *   "cta_url"        → tapped a CTA URL button (rare — not all clients emit this)
 *
 * `nativeFlowResponseMessage.paramsJson` contains the JSON string from
 * the original buttonParamsJson you supplied when building the message.
 */
function parseNativeFlowResponse(
  flowResp: Record<string, unknown>,
): Pick<ParsedInteractiveResponse, 'type' | 'id' | 'payload'> | null {
  if (!flowResp) return null;

  const name       = String(flowResp['name'] ?? '');
  const paramsJson = safeJson(flowResp['paramsJson'] as string | undefined);

  switch (name) {
    case 'quick_reply':
      return {
        type:    RESPONSE_TYPES.QUICK_REPLY,
        // `id` carries the button's id; display_text is the label
        id:      String(paramsJson?.['id'] ?? paramsJson?.['display_text'] ?? ''),
        payload: paramsJson,
      };

    case 'single_select':
      // paramsJson shape: { id: "row_id", title: "...", description: "..." }
      return {
        type:    RESPONSE_TYPES.LIST_SELECTION,
        id:      String(paramsJson?.['id'] ?? ''),
        payload: paramsJson,
      };

    case 'cta_url':
      // paramsJson shape: { display_text: "...", url: "https://..." }
      return {
        type:    RESPONSE_TYPES.CTA_CLICKED,
        id:      String(paramsJson?.['url'] ?? ''),
        payload: paramsJson,
      };

    default:
      // Catch-all for custom flow names or future button types
      return {
        type:    RESPONSE_TYPES.FLOW_RESPONSE,
        id:      String(paramsJson?.['id'] ?? name),
        payload: paramsJson,
      };
  }
}

/** Parse an interactiveResponseMessage (the outer envelope). */
function parseInteractiveResponseMessage(
  interactiveResp: Record<string, unknown>,
): Pick<ParsedInteractiveResponse, 'type' | 'id' | 'payload'> | null {
  if (!interactiveResp) return null;

  // Modern path: nativeFlowResponseMessage inside the outer envelope
  const nativeFlow = interactiveResp['nativeFlowResponseMessage'] as Record<string, unknown> | undefined;
  if (nativeFlow) {
    return parseNativeFlowResponse(nativeFlow);
  }

  // Fallback: some older WA versions set interactiveResponseMessage.body.text
  // to the selected button's display text, without a nativeFlowResponseMessage
  const bodyText = ((interactiveResp['body'] as Record<string, unknown>)?.['text'] as string) ?? '';
  return {
    type:    RESPONSE_TYPES.QUICK_REPLY,
    id:      bodyText,
    payload: { text: bodyText },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a raw Baileys WAMessage and extract any interactive response data.
 *
 * Call this inside your `messages.upsert` event handler.
 * Returns `null` if the message is not any kind of interactive response.
 *
 * Works across all known WhatsApp client versions:
 *   - Modern Android / iOS with nativeFlowMessage
 *   - Older clients using buttonsResponseMessage / listResponseMessage
 *   - Template button replies (templateButtonReplyMessage)
 *
 * @example
 * sock.ev.on('messages.upsert', ({ messages }) => {
 *   for (const msg of messages) {
 *     if (msg.key?.fromMe) continue;
 *     const resp = handleInteractiveResponse(msg);
 *     if (!resp) continue;
 *
 *     switch (resp.type) {
 *       case 'quick_reply':
 *         await router.dispatch(resp.jid, resp.id, resp.payload);
 *         break;
 *       case 'list_selection':
 *         await handleListSelection(resp.jid, resp.id);
 *         break;
 *     }
 *   }
 * });
 */
export function handleInteractiveResponse(message: WAMessage): ParsedInteractiveResponse | null {
  if (!message?.message) return null;

  const jid       = String(message.key?.remoteJid ?? '');
  const user      = extractSenderJid(message);
  const timestamp = Number(message.messageTimestamp ?? 0);
  const content   = message.message as Record<string, unknown>;

  // ── Path 1: interactiveResponseMessage (modern nativeFlowMessage replies) ──
  const interactiveResp = content['interactiveResponseMessage'] as Record<string, unknown> | undefined;
  if (interactiveResp) {
    const parsed = parseInteractiveResponseMessage(interactiveResp);
    if (parsed) {
      return {
        ...parsed,
        user,
        jid,
        timestamp,
        contextInfo: interactiveResp['contextInfo'] ?? null,
      };
    }
  }

  // ── Path 2: buttonsResponseMessage (legacy button API) ────────────────────
  const buttonsResp = content['buttonsResponseMessage'] as Record<string, unknown> | undefined;
  if (buttonsResp) {
    return {
      type:        RESPONSE_TYPES.QUICK_REPLY,
      id:          String(buttonsResp['selectedButtonId']    ?? ''),
      payload:     { text: buttonsResp['selectedDisplayText'] ?? '' },
      user,
      jid,
      timestamp,
      contextInfo: buttonsResp['contextInfo'] ?? null,
    };
  }

  // ── Path 3: listResponseMessage (legacy list API) ─────────────────────────
  const listResp = content['listResponseMessage'] as Record<string, unknown> | undefined;
  if (listResp) {
    const reply = listResp['singleSelectReply'] as Record<string, unknown> | undefined;
    return {
      type: RESPONSE_TYPES.LIST_SELECTION,
      id:   String(reply?.['selectedRowId'] ?? ''),
      payload: {
        title:       String(listResp['title']       ?? ''),
        description: String(listResp['description'] ?? ''),
        rowId:       String(reply?.['selectedRowId']  ?? ''),
      },
      user,
      jid,
      timestamp,
      contextInfo: listResp['contextInfo'] ?? null,
    };
  }

  // ── Path 4: templateButtonReplyMessage (template button taps) ─────────────
  const templateReply = content['templateButtonReplyMessage'] as Record<string, unknown> | undefined;
  if (templateReply) {
    return {
      type: RESPONSE_TYPES.QUICK_REPLY,
      id:   String(templateReply['selectedId'] ?? ''),
      payload: {
        index:       templateReply['selectedIndex'],
        displayText: String(templateReply['selectedDisplayText'] ?? ''),
      },
      user,
      jid,
      timestamp,
      contextInfo: templateReply['contextInfo'] ?? null,
    };
  }

  return null; // Not an interactive response
}

// ─────────────────────────────────────────────────────────────────────────────
// Managed event listener
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a listener on the Baileys socket for ALL incoming interactive responses
 * (quick-reply buttons, list selections, CTA clicks, template button taps).
 *
 * Automatically skips outbound messages (`key.fromMe === true`).
 * Errors thrown inside `handler` are caught and logged — they do not crash the process.
 *
 * @returns A cleanup function.  Call it to remove the listener when shutting down.
 *
 * @example
 * const stopListening = onInteractiveResponse(sock, async (resp) => {
 *   console.log(`User ${resp.user} tapped: type=${resp.type} id=${resp.id}`);
 *
 *   if (resp.type === 'quick_reply') {
 *     await handleMenuAction(resp.jid, resp.id);
 *   } else if (resp.type === 'list_selection') {
 *     await handleListPick(resp.jid, resp.id, resp.payload);
 *   }
 * });
 *
 * // On application shutdown:
 * stopListening();
 */
export function onInteractiveResponse(
  sock: WASocket,
  handler: (response: ParsedInteractiveResponse) => void | Promise<void>,
): () => void {
  if (!sock?.ev?.on) {
    throw new Error(
      'Invalid Baileys socket — sock.ev.on is not available. ' +
      'Pass the WASocket instance returned by makeWASocket().',
    );
  }

  async function listener({ messages }: { messages: WAMessage[] }): Promise<void> {
    for (const msg of messages) {
      if (msg.key?.fromMe) continue; // skip our own outbound messages

      const parsed = handleInteractiveResponse(msg);
      if (!parsed) continue;

      try {
        await handler(parsed);
      } catch (err) {
        console.error('[interactive/responses] handler threw:', err);
      }
    }
  }

  sock.ev.on('messages.upsert', listener as any);
  return () => sock.ev.off('messages.upsert', listener as any);
}

// ─────────────────────────────────────────────────────────────────────────────
// Action router
// ─────────────────────────────────────────────────────────────────────────────

/** A handler for a specific response ID or type. */
export type ActionHandler = (resp: ParsedInteractiveResponse) => void | Promise<void>;

export interface RouterConfig {
  /** Map of button ID / row ID → handler. Exact-match first. */
  actions?: Record<string, ActionHandler>;
  /** Fallback if no action matched. */
  fallback?: ActionHandler;
}

/**
 * Simple action router for mapping response IDs to handler functions.
 *
 * Attach it to the managed listener and dispatch every response through it.
 *
 * @example
 * const router = createActionRouter({
 *   actions: {
 *     support:    (r) => sendSupportMenu(sock, r.jid),
 *     sales:      (r) => sendSalesMenu(sock, r.jid),
 *     my_order:   (r) => sendOrderStatus(sock, r.jid, r.id),
 *     rating_5:   (r) => recordFeedback(r.user, 5),
 *   },
 *   fallback: (r) => sock.sendMessage(r.jid, { text: "Didn't understand that — please try again." }),
 * });
 *
 * onInteractiveResponse(sock, (resp) => router.dispatch(resp));
 */
export function createActionRouter(config: RouterConfig) {
  return {
    async dispatch(resp: ParsedInteractiveResponse): Promise<void> {
      const handler = config.actions?.[resp.id];
      if (handler) {
        await handler(resp);
      } else {
        await config.fallback?.(resp);
      }
    },
  };
}

/**
 * interactive/lists.ts
 *
 * Single-select list messages via Baileys nativeFlowMessage → single_select.
 *
 * ─── ARCHITECTURE ────────────────────────────────────────────────────────────
 *
 *   interactiveMessage
 *     └─ nativeFlowMessage
 *          └─ buttons[0]
 *               └─ { name: 'single_select',
 *                    buttonParamsJson: JSON.stringify({
 *                      title: "Select an option",
 *                      sections: [
 *                        {
 *                          title: "Section A",
 *                          highlight_label: "",
 *                          rows: [
 *                            { header: "Row 1", title: "Row 1", description: "Details", id: "row_1" }
 *                          ]
 *                        }
 *                      ]
 *                    })
 *                  }
 *
 * A single_select button renders as a "Select option" pill at the bottom of the
 * message.  When tapped, WhatsApp opens a native bottom-sheet picker showing the
 * sections and rows.  The selected row's `id` is returned in an
 * interactiveResponseMessage → nativeFlowResponseMessage with name="single_select".
 *
 * ─── WHATSAPP LIMITS ─────────────────────────────────────────────────────────
 *
 *   sections per message:    max 10
 *   rows per section:        max 10
 *   total rows:              max 100 (10 × 10)
 *   row.title:               max 24 chars
 *   row.description:         max 72 chars
 *   section.title:           max 24 chars
 *   button text (pill label):max 20 chars
 *   body:                    max 1 024 chars
 *   footer:                  max 60 chars
 *   header (text only):      max 60 chars  — media headers are NOT supported on lists
 *
 * ─── RENDERING ───────────────────────────────────────────────────────────────
 *
 *   Android WhatsApp:  native bottom-sheet list with section headers
 *   iOS WhatsApp:      native list picker
 *   WhatsApp Web:      rendered as a side-panel picker
 *   Old clients:       may fall back to plain text
 */

import { generateMessageID } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import {
  normalizeJid,
  assertConnected,
  retryAsync,
  simulateTyping,
  rateLimiter,
  validateLength,
} from './utils';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_SECTIONS      = 10;
const MAX_ROWS_PER_SEC  = 10;
const MAX_ROW_TITLE_LEN = 24;
const MAX_ROW_DESC_LEN  = 72;
const MAX_SEC_TITLE_LEN = 24;
const MAX_BODY_LEN      = 1_024;
const MAX_FOOTER_LEN    = 60;
const MAX_BTN_TEXT_LEN  = 20;
const MAX_HEADER_LEN    = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ListRow {
  /** Returned to your server when the user selects this row. */
  id: string;
  /** Primary label shown in the list (max 24 chars). */
  title: string;
  /** Secondary text below the title (max 72 chars, optional). */
  description?: string;
}

export interface ListSection {
  /** Section heading shown in the bottom sheet (max 24 chars). */
  title: string;
  rows: ListRow[];
}

export interface SendListMenuOptions {
  body: string;
  /** Label on the pill button that opens the list picker (default: "Select"). */
  buttonText?: string;
  sections: ListSection[];
  footer?: string;
  /**
   * Plain-text header shown above the body.
   * NOTE: List messages do NOT support media headers — only text.
   */
  header?: string;
  simulateTyping?: boolean;
}

export interface SendResult {
  messageId: string;
  jid: string;
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the single_select button payload embedded in nativeFlowMessage.buttons.
 *
 * Validates all limits and normalises section/row content.
 * Returns the raw `{ name, buttonParamsJson }` object ready for Baileys.
 */
export function buildSingleSelectButton(
  buttonText: string,
  sections: ListSection[],
): { name: string; buttonParamsJson: string } {
  const title = validateLength(buttonText, 'buttonText', MAX_BTN_TEXT_LEN, /* truncate */ true);

  if (!Array.isArray(sections) || sections.length === 0) {
    throw new TypeError('sections must be a non-empty array');
  }
  if (sections.length > MAX_SECTIONS) {
    throw new RangeError(
      `Maximum ${MAX_SECTIONS} sections per list message (got ${sections.length})`,
    );
  }

  const builtSections = sections.map((sec, si) => {
    if (!Array.isArray(sec.rows) || sec.rows.length === 0) {
      throw new TypeError(`sections[${si}] must contain at least 1 row`);
    }
    if (sec.rows.length > MAX_ROWS_PER_SEC) {
      throw new RangeError(
        `sections[${si}] has ${sec.rows.length} rows but the maximum is ${MAX_ROWS_PER_SEC}`,
      );
    }

    const secTitle = validateLength(sec.title ?? '', `sections[${si}].title`, MAX_SEC_TITLE_LEN, true);

    const rows = sec.rows.map((row, ri) => {
      if (!row?.id) {
        throw new TypeError(`sections[${si}].rows[${ri}].id is required`);
      }

      const rowTitle = validateLength(
        row.title,
        `sections[${si}].rows[${ri}].title`,
        MAX_ROW_TITLE_LEN,
        true,
      );
      const rowDesc = row.description
        ? validateLength(
            row.description,
            `sections[${si}].rows[${ri}].description`,
            MAX_ROW_DESC_LEN,
            true,
          )
        : '';

      return {
        // `header` is the bold top text inside the row card (same as title in most clients)
        header:      rowTitle,
        title:       rowTitle,
        description: rowDesc,
        id:          row.id,
      };
    });

    return { title: secTitle, highlight_label: '', rows };
  });

  return {
    name: 'single_select',
    buttonParamsJson: JSON.stringify({ title, sections: builtSections }),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Send: list menu
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a single-select list message.
 *
 * The list opens a native WhatsApp bottom-sheet picker organised into sections
 * and rows.  When the user selects a row, your backend receives an
 * interactiveResponseMessage with `nativeFlowResponseMessage.name === "single_select"`
 * and `paramsJson` containing `{ id, title, description }` of the selected row.
 * Parse it with `handleInteractiveResponse()` from interactive/responses.ts.
 *
 * @example
 * await sendListMenu(sock, '14155550000', {
 *   header:     'Choose your department',
 *   body:       'Select the team you need and we\'ll connect you right away.',
 *   buttonText: 'Open menu',
 *   footer:     'Available Mon–Fri, 9am–6pm',
 *   sections: [
 *     {
 *       title: 'Support',
 *       rows: [
 *         { id: 'tech',    title: 'Technical Support', description: 'Hardware & software issues' },
 *         { id: 'billing', title: 'Billing & Payments', description: 'Invoices, refunds, plans' },
 *       ],
 *     },
 *     {
 *       title: 'Sales',
 *       rows: [
 *         { id: 'new_deal', title: 'New Order',    description: 'Start a new purchase' },
 *         { id: 'b2b',      title: 'Enterprise',   description: 'Bulk & corporate pricing' },
 *       ],
 *     },
 *   ],
 * });
 */
export async function sendListMenu(
  sock: WASocket,
  jid: string,
  options: SendListMenuOptions,
): Promise<SendResult> {
  assertConnected(sock);

  const normalJid = normalizeJid(jid);
  rateLimiter.check(normalJid);

  const body       = validateLength(options.body ?? '', 'body', MAX_BODY_LEN);
  const buttonText = options.buttonText ?? 'Select';
  const footer     = options.footer
    ? validateLength(options.footer, 'footer', MAX_FOOTER_LEN, true)
    : undefined;
  const headerText = options.header
    ? validateLength(options.header, 'header', MAX_HEADER_LEN, true)
    : undefined;

  const singleSelectButton = buildSingleSelectButton(buttonText, options.sections);

  const interactiveMsg: Record<string, unknown> = {
    body:              { text: body },
    nativeFlowMessage: { messageVersion: 1, buttons: [singleSelectButton] },
    ...(footer     ? { footer: { text: footer } }                                 : {}),
    ...(headerText ? { header: { title: headerText, hasMediaAttachment: false } } : {}),
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
      onRetry: (err, attempt) =>
        console.warn(`[interactive/lists] retry ${attempt}:`, (err as Error).message),
    },
  );

  const result: SendResult = {
    messageId: msgId,
    jid:       normalJid,
    timestamp: new Date().toISOString(),
  };

  console.log('[interactive/lists] list menu sent', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pagination utility
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Split a flat array of rows into paginated ListSections.
 *
 * Use this when your dataset exceeds 10 rows — each page of `pageSize` rows
 * becomes its own section.  The hard cap of 10 sections × 10 rows = 100 total
 * items is enforced automatically.
 *
 * @example
 * const allProducts: ListRow[] = catalogue.map((p) => ({ id: p.sku, title: p.name, description: p.price }));
 * const sections = paginateListItems(allProducts, { sectionTitle: 'Products', pageSize: 8 });
 * await sendListMenu(sock, jid, { body: 'Choose a product', sections });
 */
export function paginateListItems(
  items: ListRow[],
  opts: { sectionTitle?: string; pageSize?: number } = {},
): ListSection[] {
  const pageSize    = opts.pageSize    ?? 10;
  const sectionBase = opts.sectionTitle ?? 'Options';
  const sections: ListSection[] = [];

  for (let i = 0; i < items.length && sections.length < MAX_SECTIONS; i += pageSize) {
    const chunk = items.slice(i, i + pageSize);
    const page  = Math.floor(i / pageSize) + 1;
    sections.push({
      title: sections.length === 0 ? sectionBase : `${sectionBase} (${page})`,
      rows:  chunk,
    });
  }

  return sections;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: send a paginated list from a flat array
// ─────────────────────────────────────────────────────────────────────────────

export interface SendPaginatedListOptions {
  body: string;
  items: ListRow[];
  sectionTitle?: string;
  pageSize?: number;
  buttonText?: string;
  footer?: string;
  header?: string;
  simulateTyping?: boolean;
}

/**
 * Build sections automatically from a flat items array and send the list.
 *
 * @example
 * await sendPaginatedList(sock, jid, {
 *   header: 'Available Slots',
 *   body:   'Pick an appointment time',
 *   items:  slots.map((s) => ({ id: s.id, title: s.label, description: s.date })),
 * });
 */
export async function sendPaginatedList(
  sock: WASocket,
  jid: string,
  options: SendPaginatedListOptions,
): Promise<SendResult> {
  const sections = paginateListItems(options.items, {
    sectionTitle: options.sectionTitle,
    pageSize:     options.pageSize,
  });

  return sendListMenu(sock, jid, {
    body:           options.body,
    buttonText:     options.buttonText,
    sections,
    footer:         options.footer,
    header:         options.header,
    simulateTyping: options.simulateTyping,
  });
}

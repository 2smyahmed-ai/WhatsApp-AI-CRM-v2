/**
 * interactive/carousel.ts
 *
 * Carousel messages via Baileys interactiveMessage → carouselMessage.
 *
 * ─── ARCHITECTURE ────────────────────────────────────────────────────────────
 *
 *   interactiveMessage
 *     └─ carouselMessage
 *          ├─ messageVersion: 1
 *          └─ cards: InteractiveMessage[]
 *               └─ (each card IS an InteractiveMessage proto object)
 *                    ├─ header:   { hasMediaAttachment: true, imageMessage | videoMessage }
 *                    ├─ body:     { text: "..." }
 *                    ├─ footer:   { text: "..." }
 *                    └─ nativeFlowMessage
 *                         └─ buttons[]
 *                              ├─ { name: 'quick_reply', buttonParamsJson: '...' }
 *                              └─ { name: 'cta_url',     buttonParamsJson: '...' }
 *
 * Key points:
 *   • Each `card` in carouselMessage.cards is itself a full InteractiveMessage proto.
 *   • Media for each card is uploaded to WhatsApp CDN via prepareWAMessageMedia()
 *     before the proto is assembled.  All card uploads run in parallel.
 *   • Carousels are sent via sock.relayMessage() — same reason as buttons.ts.
 *   • If a card's media upload fails, the card is sent without a header rather
 *     than failing the entire carousel.
 *
 * ─── WHATSAPP LIMITS ─────────────────────────────────────────────────────────
 *
 *   cards per carousel:      max 10
 *   buttons per card:        max 2 (ideal: 1 quick_reply + 1 cta_url)
 *   card body:               max 160 chars (shorter than a standalone message)
 *   card footer:             max 60 chars
 *   button title:            max 20 chars
 *
 * ─── RENDERING ───────────────────────────────────────────────────────────────
 *
 *   Android WhatsApp (modern):  horizontally scrollable card strip with native buttons
 *   iOS WhatsApp:               same native rendering
 *   WhatsApp Web:               may degrade to a stacked layout
 *   Old clients / WhatsApp Web legacy:  may not render carousel — falls back to text
 *
 * ─── BEST PRACTICES ──────────────────────────────────────────────────────────
 *
 *   • Keep card bodies concise — they're viewed in a narrow card viewport
 *   • Square or landscape images look best in card headers (1:1 or 16:9)
 *   • Limit to 3–5 cards for optimal UX; 10 is the max, not the target
 *   • Always include at least one button per card so users have a clear CTA
 */

import { prepareWAMessageMedia } from '@whiskeysockets/baileys';
import type { WASocket } from '@whiskeysockets/baileys';
import {
  normalizeJid,
  assertConnected,
  retryAsync,
  simulateTyping,
  rateLimiter,
  validateLength,
  relayInteractive,
} from './utils';
import { buildQuickReplyButton, buildCtaUrlButton } from './buttons';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MAX_CARDS         = 10;
const MAX_BTNS_PER_CARD = 2;
const MAX_BODY_LEN      = 160;
const MAX_FOOTER_LEN    = 60;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** A button that can appear on a carousel card. */
export type CardButtonSpec =
  | { kind: 'quick_reply'; id: string; title: string; emoji?: string }
  | { kind: 'cta_url'; displayText: string; url: string; trackingId?: string };

export interface CarouselCard {
  /**
   * Card body text (max 160 chars).
   * Supports WhatsApp markdown: *bold*, _italic_, ~strikethrough~, ```code```
   */
  body: string;
  /** Optional footer shown below the body (max 60 chars). */
  footer?: string;
  /**
   * Image or video to display as the card's visual header.
   * Uploaded to WhatsApp CDN via prepareWAMessageMedia on send.
   * Omit for text-only cards (rare — carousels look best with media).
   */
  media?: {
    buffer: Buffer;
    mimetype?: string;
    /**
     * Explicit media type override.
     * If omitted, auto-detected from mimetype ('video/' → 'video', else 'image').
     */
    type?: 'image' | 'video';
  };
  /**
   * Buttons for this card (max 2).
   * Best practice: 1 quick_reply + 1 cta_url per card.
   */
  buttons?: CardButtonSpec[];
}

export interface SendResult {
  messageId: string;
  jid: string;
  timestamp: string;
  cardCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Card builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upload a card's media and assemble the card's InteractiveMessage proto object.
 *
 * Each card in carouselMessage.cards IS an InteractiveMessage.  This function
 * builds exactly that sub-proto: header + body + footer + nativeFlowMessage.
 */
async function buildCarouselCard(
  card: CarouselCard,
  cardIndex: number,
  sock: WASocket,
): Promise<Record<string, unknown>> {
  if (!card) throw new TypeError(`cards[${cardIndex}] is required`);

  const body   = validateLength(card.body ?? '', `cards[${cardIndex}].body`, MAX_BODY_LEN, true);
  const footer = card.footer
    ? validateLength(card.footer, `cards[${cardIndex}].footer`, MAX_FOOTER_LEN, true)
    : undefined;

  // ── Upload card media ──────────────────────────────────────────────────────
  let header: Record<string, unknown> | undefined;

  if (card.media?.buffer) {
    const mediaType = card.media.type
      ?? (card.media.mimetype?.startsWith('video/') ? 'video' : 'image');

    try {
      const mediaInput: Record<string, unknown> = {
        [mediaType]: card.media.buffer,
        ...(card.media.mimetype ? { mimetype: card.media.mimetype } : {}),
      };

      const prepared = await prepareWAMessageMedia(mediaInput as any, {
        upload: sock.waUploadToServer,
      });

      // The prepared object contains e.g. { imageMessage: { url, mediaKey, ... } }
      const fieldKey = `${mediaType}Message`; // "imageMessage" | "videoMessage"
      header = {
        hasMediaAttachment: true,
        [fieldKey]: (prepared as any)[fieldKey],
      };
    } catch (uploadErr) {
      // Non-critical — send the card without a media header rather than failing
      console.error(
        `[interactive/carousel] cards[${cardIndex}] media upload failed (continuing without header):`,
        (uploadErr as Error).message,
      );
    }
  }

  // ── Build card buttons ─────────────────────────────────────────────────────
  const rawButtons = (card.buttons ?? []).slice(0, MAX_BTNS_PER_CARD);

  const buttons = rawButtons.map((btn) => {
    switch (btn.kind) {
      case 'quick_reply':
        return buildQuickReplyButton({ id: btn.id, title: btn.title, emoji: btn.emoji });
      case 'cta_url':
        return buildCtaUrlButton({ displayText: btn.displayText, url: btn.url, trackingId: btn.trackingId });
      default:
        throw new TypeError(`cards[${cardIndex}] unknown button kind: "${(btn as any).kind}"`);
    }
  });

  // ── Assemble card proto ────────────────────────────────────────────────────
  return {
    ...(header ? { header } : {}),
    body:  { text: body },
    ...(footer ? { footer: { text: footer } } : {}),
    ...(buttons.length > 0
      ? { nativeFlowMessage: { messageVersion: 1, buttons } }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Send: carousel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a carousel message — a horizontally scrollable strip of product/content cards.
 *
 * Each card can have an image or video header, body text, a footer, and up to
 * two native buttons (quick-reply and/or CTA URL).
 *
 * All card media uploads happen concurrently before the proto message is assembled
 * and relayed.  A failed individual upload degrades that card to text-only rather
 * than aborting the entire carousel.
 *
 * @example
 * import { readFileSync } from 'fs';
 *
 * await sendCarousel(sock, '14155550000', [
 *   {
 *     body:    '*AirPods Pro (2nd Gen)*\nActive noise cancellation · 30h battery',
 *     footer:  '$249',
 *     media:   { buffer: readFileSync('./assets/airpods.jpg'), type: 'image' },
 *     buttons: [
 *       { kind: 'quick_reply', id: 'buy_airpods',   title: '🛒 Buy Now'    },
 *       { kind: 'cta_url',     displayText: 'Details', url: 'https://apple.com/airpods-pro' },
 *     ],
 *   },
 *   {
 *     body:    '*MacBook Air M3*\nUltra-thin · All-day battery · Apple Silicon',
 *     footer:  '$1 099',
 *     media:   { buffer: readFileSync('./assets/macbook.jpg'), type: 'image' },
 *     buttons: [
 *       { kind: 'quick_reply', id: 'buy_macbook',   title: '🛒 Buy Now'    },
 *       { kind: 'cta_url',     displayText: 'Details', url: 'https://apple.com/macbook-air' },
 *     ],
 *   },
 * ]);
 */
export async function sendCarousel(
  sock: WASocket,
  jid: string,
  cards: CarouselCard[],
  opts: { simulateTyping?: boolean } = {},
): Promise<SendResult> {
  assertConnected(sock);

  const normalJid = normalizeJid(jid);
  rateLimiter.check(normalJid);

  if (!Array.isArray(cards) || cards.length === 0) {
    throw new TypeError('cards must be a non-empty array');
  }
  if (cards.length > MAX_CARDS) {
    throw new RangeError(
      `Maximum ${MAX_CARDS} carousel cards per message (got ${cards.length})`,
    );
  }

  // Upload all card media in parallel — independent CDN operations
  const builtCards = await Promise.all(
    cards.map((card, i) => buildCarouselCard(card, i, sock)),
  );

  const interactiveMsg = {
    carouselMessage: {
      messageVersion: 1,
      cards: builtCards,
    },
  };

  if (opts.simulateTyping !== false) {
    await simulateTyping(sock, normalJid, 80);
  }

  const msgId = await retryAsync(
    () => relayInteractive(sock, normalJid, interactiveMsg),
    {
      // Slightly higher base delay for carousels — they carry heavier CDN-upload state
      maxAttempts: 3,
      baseDelayMs: 600,
      onRetry: (err, attempt) =>
        console.warn(`[interactive/carousel] retry ${attempt}:`, (err as Error).message),
    },
  );

  const result: SendResult = {
    messageId: msgId,
    jid:       normalJid,
    timestamp: new Date().toISOString(),
    cardCount: cards.length,
  };

  console.log('[interactive/carousel] carousel sent', result);
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: product-card carousel builder
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductCard {
  /** Display name shown in bold in the card body. */
  name: string;
  /** Short description (combined with name, must fit in 160 chars). */
  description: string;
  /** Price string shown at the end of the body, e.g. "$29.99". */
  price?: string;
  /** Product image buffer to upload as the card header. */
  imageBuffer?: Buffer;
  /** URL for the "View Details" CTA button. */
  productUrl?: string;
  /**
   * If set, a "🛒 Add to Cart" quick-reply button is added.
   * The button ID will be `add_cart_<addToCartId>`.
   */
  addToCartId?: string;
}

/**
 * Build carousel cards from an array of product objects.
 * Does NOT send — returns CarouselCard[] for use with sendCarousel().
 *
 * @example
 * const cards = buildProductCards(catalogue.slice(0, 5));
 * await sendCarousel(sock, jid, cards);
 */
export function buildProductCards(products: ProductCard[]): CarouselCard[] {
  if (!Array.isArray(products) || products.length === 0) {
    throw new TypeError('products must be a non-empty array');
  }

  return products.slice(0, MAX_CARDS).map((p): CarouselCard => {
    const priceLine = p.price ? `\n\n💰 ${p.price}` : '';
    const body      = `*${p.name}*\n${p.description}${priceLine}`;

    const buttons: CardButtonSpec[] = [
      ...(p.addToCartId
        ? [{ kind: 'quick_reply' as const, id: `add_cart_${p.addToCartId}`, title: '🛒 Add to Cart' }]
        : []),
      ...(p.productUrl
        ? [{ kind: 'cta_url' as const, displayText: 'View Details', url: p.productUrl }]
        : []),
    ];

    return {
      body,
      footer: p.price ?? '',
      media:  p.imageBuffer ? { buffer: p.imageBuffer, type: 'image' } : undefined,
      buttons,
    };
  });
}

/**
 * Build product carousel cards and send them in one call.
 *
 * @example
 * await sendProductCarousel(sock, '14155550000', [
 *   { name: 'Widget A', description: 'Best widget ever', price: '$9.99', addToCartId: 'wA1', productUrl: 'https://...' },
 *   { name: 'Widget B', description: 'Even better',      price: '$14.99', addToCartId: 'wB1' },
 * ]);
 */
export async function sendProductCarousel(
  sock: WASocket,
  jid: string,
  products: ProductCard[],
  opts: { simulateTyping?: boolean } = {},
): Promise<SendResult> {
  const cards = buildProductCards(products);
  return sendCarousel(sock, jid, cards, opts);
}

import type {
  RenderablePayload,
  RenderableBlock,
  TemplateMarkerBlock,
  BodyTextBlock,
  HeaderTextBlock,
  HeaderMediaBlock,
  MediaBlock,
  FooterBlock,
  ReplyButtonBlock,
  UrlButtonBlock,
  PhoneButtonBlock,
  ListButtonBlock,
  CtaCardBlock,
  NumberedOptionsBlock,
  LocationBlock,
  ContactCardBlock,
  ProductCardBlock,
} from '@crm/messaging-schema';
import type { ProviderName } from '@crm/messaging-schema';
import type { Media } from '@crm/messaging-schema';

// ── Output types — opaque provider API shapes ─────────────────────────────────

/** Meta Cloud API message payload (posted to /{phone_number_id}/messages). */
export interface MetaMessagePayload {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  /** Set when replying to a message. */
  context?: { message_id: string };
  type: string;
  [key: string]: unknown;
}

/** Baileys sendMessage content shape (AnyMessageContent subset). */
export type BaileysMessageContent = Record<string, unknown>;

/** Union returned by compileProviderPayload. */
export type ProviderPayload =
  | { provider: 'meta'; payload: MetaMessagePayload }
  | { provider: 'baileys'; payload: BaileysMessageContent };

// ── Block lookup helpers ──────────────────────────────────────────────────────

function findBlock<T extends RenderableBlock>(blocks: RenderableBlock[], type: T['type']): T | undefined {
  return blocks.find((b) => b.type === type) as T | undefined;
}

function findBlocks<T extends RenderableBlock>(blocks: RenderableBlock[], type: T['type']): T[] {
  return blocks.filter((b) => b.type === type) as T[];
}

// ── Meta header builder ───────────────────────────────────────────────────────

function metaInteractiveHeader(
  headerText: HeaderTextBlock | undefined,
  headerMedia: HeaderMediaBlock | undefined,
): Record<string, unknown> | undefined {
  if (headerText) return { type: 'text', text: headerText.text };
  if (headerMedia) {
    const m = headerMedia.media;
    const mime = m.mime?.toLowerCase() ?? '';
    const mediaRef = m.url ? { link: m.url } : (m.providerMediaId ? { id: m.providerMediaId } : { link: '' });
    if (mime.startsWith('image/')) return { type: 'image', image: mediaRef };
    if (mime.startsWith('video/')) return { type: 'video', video: mediaRef };
    return { type: 'document', document: mediaRef };
  }
  return undefined;
}

// ── Meta media type from MIME ─────────────────────────────────────────────────

function metaMediaType(mime: string): 'image' | 'video' | 'audio' | 'document' {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  return 'document';
}

function metaMediaRef(media: Media): Record<string, string> {
  if (media.providerMediaId) return { id: media.providerMediaId };
  if (media.url) return { link: media.url };
  return { link: '' };
}

// ── Meta compiler ─────────────────────────────────────────────────────────────

function compileMetaPayload(
  renderable: RenderablePayload,
  to: string,
  replyExternalId: string | null | undefined,
): MetaMessagePayload {
  const base: MetaMessagePayload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    ...(replyExternalId ? { context: { message_id: replyExternalId } } : {}),
  };

  const { kind, blocks } = renderable;

  // ── Template ──
  if (kind === 'template') {
    const marker = findBlock<TemplateMarkerBlock>(blocks, 'template_marker');
    if (!marker) return { ...base, type: 'text', text: { body: '[template]', preview_url: false } };

    const components: unknown[] = [];
    for (const comp of marker.components) {
      if (comp.type === 'header') {
        if (comp.format === 'text') {
          components.push({ type: 'header', parameters: [{ type: 'text', text: comp.text }] });
        } else {
          const mediaRef = metaMediaRef(comp.media);
          components.push({ type: 'header', parameters: [{ type: comp.format, [comp.format]: mediaRef }] });
        }
      } else if (comp.type === 'body') {
        // Extract positional variables: {{1}}, {{2}}, ...
        const positionalKeys = Object.keys(marker.variables)
          .filter((k) => /^\d+$/.test(k))
          .sort((a, b) => Number(a) - Number(b));

        const params = positionalKeys.map((k) => ({ type: 'text', text: marker.variables[k] }));
        if (params.length > 0) {
          components.push({ type: 'body', parameters: params });
        }
      } else if (comp.type === 'buttons') {
        comp.buttons.forEach((btn, idx) => {
          if (btn.kind === 'quick_reply') {
            components.push({
              type: 'button',
              sub_type: 'quick_reply',
              index: idx,
              parameters: [{ type: 'payload', payload: btn.payload ?? btn.text }],
            });
          } else if (btn.kind === 'url' && btn.urlVariables?.length) {
            components.push({
              type: 'button',
              sub_type: 'url',
              index: idx,
              parameters: [{ type: 'text', text: btn.urlVariables[0] }],
            });
          }
        });
      }
    }

    return {
      ...base,
      type: 'template',
      template: {
        name: marker.templateName,
        language: { code: marker.language },
        components,
      },
    };
  }

  // ── Media ──
  if (kind === 'media') {
    const mediaBlock = findBlock<MediaBlock>(blocks, 'media');
    if (mediaBlock) {
      const { media, caption } = mediaBlock;
      const mediaType = metaMediaType(media.mime ?? 'application/octet-stream');
      const mediaRef = metaMediaRef(media);
      const mediaBody: Record<string, unknown> = { ...mediaRef };
      if (caption && mediaType !== 'audio') mediaBody.caption = caption;
      if (mediaType === 'document' && media.thumbnailUrl) mediaBody.filename = media.thumbnailUrl;
      return { ...base, type: mediaType, [mediaType]: mediaBody };
    }
  }

  // ── Interactive buttons ──
  if (kind === 'interactive_buttons') {
    const headerText = findBlock<HeaderTextBlock>(blocks, 'header_text');
    const headerMedia = findBlock<HeaderMediaBlock>(blocks, 'header_media');
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const footer = findBlock<FooterBlock>(blocks, 'footer');
    const buttons = findBlocks<ReplyButtonBlock>(blocks, 'reply_button');

    const interactive: Record<string, unknown> = {
      type: 'button',
      body: { text: body?.text ?? '' },
      action: {
        buttons: buttons.map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title },
        })),
      },
    };
    const header = metaInteractiveHeader(headerText, headerMedia);
    if (header) interactive.header = header;
    if (footer) interactive.footer = { text: footer.text };

    return { ...base, type: 'interactive', interactive };
  }

  // ── Interactive list ──
  if (kind === 'interactive_list') {
    const headerText = findBlock<HeaderTextBlock>(blocks, 'header_text');
    const headerMedia = findBlock<HeaderMediaBlock>(blocks, 'header_media');
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const footer = findBlock<FooterBlock>(blocks, 'footer');
    const listBtn = findBlock<ListButtonBlock>(blocks, 'list_button');

    const interactive: Record<string, unknown> = {
      type: 'list',
      body: { text: body?.text ?? '' },
      action: {
        button: listBtn?.buttonText ?? 'Select',
        sections: (listBtn?.sections ?? []).map((sec) => ({
          title: sec.title,
          rows: sec.rows.map((row) => ({
            id: row.id,
            title: row.title,
            ...(row.description ? { description: row.description } : {}),
          })),
        })),
      },
    };
    const header = metaInteractiveHeader(headerText, headerMedia);
    if (header) interactive.header = header;
    if (footer) interactive.footer = { text: footer.text };

    return { ...base, type: 'interactive', interactive };
  }

  // ── Interactive CTA ──
  if (kind === 'interactive_cta') {
    const headerText = findBlock<HeaderTextBlock>(blocks, 'header_text');
    const headerMedia = findBlock<HeaderMediaBlock>(blocks, 'header_media');
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const footer = findBlock<FooterBlock>(blocks, 'footer');
    const cta = findBlock<CtaCardBlock>(blocks, 'cta_card');

    const interactive: Record<string, unknown> = {
      type: 'cta_url',
      body: { text: body?.text ?? '' },
      action: {
        name: 'cta_url',
        parameters: { display_text: cta?.displayText ?? '', url: cta?.url ?? '' },
      },
    };
    const header = metaInteractiveHeader(headerText, headerMedia);
    if (header) interactive.header = header;
    if (footer) interactive.footer = { text: footer.text };

    return { ...base, type: 'interactive', interactive };
  }

  // ── Interactive product ──
  if (kind === 'interactive_product') {
    const product = findBlock<ProductCardBlock>(blocks, 'product_card');
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const footer = findBlock<FooterBlock>(blocks, 'footer');

    const interactive: Record<string, unknown> = {
      type: 'product',
      body: { text: body?.text ?? '' },
      action: {
        catalog_id: product?.catalogId ?? '',
        product_retailer_id: product?.productId ?? '',
      },
    };
    if (footer) interactive.footer = { text: footer.text };

    return { ...base, type: 'interactive', interactive };
  }

  // ── Interactive product list ──
  if (kind === 'interactive_product_list') {
    const headerText = findBlock<HeaderTextBlock>(blocks, 'header_text');
    const body = findBlock<BodyTextBlock>(blocks, 'body_text');
    const footer = findBlock<FooterBlock>(blocks, 'footer');
    const products = findBlocks<ProductCardBlock>(blocks, 'product_card');

    const catalogId = products[0]?.catalogId ?? '';
    const interactive: Record<string, unknown> = {
      type: 'product_list',
      header: { type: 'text', text: headerText?.text ?? '' },
      body: { text: body?.text ?? '' },
      action: {
        catalog_id: catalogId,
        sections: [
          {
            product_items: products.map((p) => ({ product_retailer_id: p.productId })),
          },
        ],
      },
    };
    if (footer) interactive.footer = { text: footer.text };

    return { ...base, type: 'interactive', interactive };
  }

  // ── Location ──
  if (kind === 'location') {
    const loc = findBlock<LocationBlock>(blocks, 'location');
    if (loc) {
      return {
        ...base,
        type: 'location',
        location: {
          latitude: loc.latitude,
          longitude: loc.longitude,
          ...(loc.name ? { name: loc.name } : {}),
          ...(loc.address ? { address: loc.address } : {}),
        },
      };
    }
  }

  // ── Contact card ──
  if (kind === 'contact_card') {
    const cardBlock = findBlock<ContactCardBlock>(blocks, 'contact_card');
    if (cardBlock) {
      return {
        ...base,
        type: 'contacts',
        contacts: cardBlock.contacts.map((ct) => ({
          name: {
            formatted_name: ct.name.formattedName,
            first_name: ct.name.firstName,
            last_name: ct.name.lastName,
          },
          phones: ct.phones?.map((p) => ({ phone: p.phone, type: p.type, wa_id: p.waId })),
          emails: ct.emails?.map((e) => ({ email: e.email, type: e.type })),
          org: ct.org,
          birthday: ct.birthday,
        })),
      };
    }
  }

  // ── Fallback: plain text (covers text, numbered_options, order, system, unknown) ──
  const bodyBlock = findBlock<BodyTextBlock>(blocks, 'body_text');
  const numberedBlock = findBlock<NumberedOptionsBlock>(blocks, 'numbered_options');

  let textBody = bodyBlock?.text ?? '';

  if (numberedBlock) {
    const intro = numberedBlock.intro ? `${numberedBlock.intro}\n\n` : '';
    const optionLines = numberedBlock.options.map((o) => `${o.number}. ${o.label}`).join('\n');
    const suffix = '\n\nReply with the number of your choice.';
    textBody = textBody ? `${textBody}\n\n${intro}${optionLines}${suffix}` : `${intro}${optionLines}${suffix}`;
  }

  return { ...base, type: 'text', text: { body: textBody, preview_url: false } };
}

// ── Baileys compiler ──────────────────────────────────────────────────────────

function compileBaileysContent(renderable: RenderablePayload): BaileysMessageContent {
  const { kind, blocks } = renderable;

  // Media
  if (kind === 'media') {
    const mediaBlock = findBlock<MediaBlock>(blocks, 'media');
    if (mediaBlock) {
      const { media, caption } = mediaBlock;
      const mime = media.mime?.toLowerCase() ?? '';
      const src = media.url ? { url: media.url } : {};
      if (mime.startsWith('image/')) return { image: src, ...(caption ? { caption } : {}) };
      if (mime.startsWith('video/')) return { video: src, ...(caption ? { caption } : {}) };
      if (mime === 'audio/ogg' || mime.startsWith('audio/')) return { audio: src, ptt: mime === 'audio/ogg' };
      return {
        document: src,
        mimetype: mime || 'application/octet-stream',
        ...(caption ? { caption } : {}),
      };
    }
  }

  // Location
  if (kind === 'location') {
    const loc = findBlock<LocationBlock>(blocks, 'location');
    if (loc) {
      return {
        location: {
          degreesLatitude: loc.latitude,
          degreesLongitude: loc.longitude,
          ...(loc.name ? { name: loc.name } : {}),
        },
      };
    }
  }

  // Everything else (text, templates, interactive fallbacks, numbered_options, order, system, unknown)
  const bodyBlock = findBlock<BodyTextBlock>(blocks, 'body_text');
  const numberedBlock = findBlock<NumberedOptionsBlock>(blocks, 'numbered_options');

  let text = bodyBlock?.text ?? '';

  if (numberedBlock) {
    const intro = numberedBlock.intro ? `${numberedBlock.intro}\n\n` : '';
    const optionLines = numberedBlock.options.map((o) => `${o.number}. ${o.label}`).join('\n');
    const suffix = '\n\nReply with the number of your choice.';
    text = text ? `${text}\n\n${intro}${optionLines}${suffix}` : `${intro}${optionLines}${suffix}`;
  }

  // Template: if the marker block is present but mode allowed it to render as template,
  // Baileys has no native support — fall back to resolved body text.
  if (!text) {
    const marker = findBlock<TemplateMarkerBlock>(blocks, 'template_marker');
    if (marker) text = `[Template: ${marker.templateName}]`;
  }

  return { text: text || '[Unsupported message]' };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compile a RenderablePayload into a provider-specific API payload.
 *
 * Pure function — no I/O, no side effects.
 *
 * @param renderable  Pre-compiled RenderablePayload from compileRenderable().
 * @param provider    Target provider.
 * @param to          Recipient phone in E.164 format (digits only, no +).
 * @param replyExternalId  Provider-issued ID of the message being replied to,
 *                    if any. Used by Meta to set `context.message_id`.
 */
export function compileProviderPayload(
  renderable: RenderablePayload,
  provider: ProviderName,
  to: string,
  replyExternalId?: string | null,
): ProviderPayload {
  if (provider === 'meta') {
    return {
      provider: 'meta',
      payload: compileMetaPayload(renderable, to, replyExternalId),
    };
  }

  // baileys (and any future provider falls back to text)
  return {
    provider: 'baileys',
    payload: compileBaileysContent(renderable),
  };
}

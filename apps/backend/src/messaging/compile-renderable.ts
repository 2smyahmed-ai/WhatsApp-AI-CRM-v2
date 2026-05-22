import type {
  NormalizedMessage,
  CompatibilityMode,
  CompatibilityReport,
  RenderablePayload,
  RenderableBlock,
  MessageKind,
  ValidationIssue,
  InteractiveHeader,
  Media,
} from '@crm/messaging-schema';
import type {
  MessageContent,
  TextContent,
  MediaContent,
  TemplateContent,
  InteractiveButtonsContent,
  InteractiveListContent,
  InteractiveCtaContent,
  InteractiveProductContent,
  InteractiveProductListContent,
  LocationContent,
  ContactCardContent,
  OrderContent,
  SystemContent,
  UnknownContent,
} from '@crm/messaging-schema';

// ── Helpers ──────────────────────────────────────────────────────────────────

function noDowngrade(
  mode: CompatibilityMode,
  originalKind: MessageKind,
): CompatibilityReport {
  return {
    mode,
    originalKind,
    effectiveKind: originalKind,
    downgraded: false,
    downgradeReason: null,
    warnings: [],
  };
}

function downgraded(
  mode: CompatibilityMode,
  originalKind: MessageKind,
  effectiveKind: MessageKind,
  reason: string,
  warnings: ValidationIssue[] = [],
): CompatibilityReport {
  return {
    mode,
    originalKind,
    effectiveKind,
    downgraded: true,
    downgradeReason: reason,
    warnings,
  };
}

function headerBlocks(header: InteractiveHeader | undefined): RenderableBlock[] {
  if (!header) return [];
  if (header.type === 'text') return [{ type: 'header_text', text: header.text }];
  return [{ type: 'header_media', media: header.media }];
}

function mediaToBlock(media: Media, caption?: string): RenderableBlock {
  return { type: 'media', media, caption };
}

// ── Per-kind compilers ────────────────────────────────────────────────────────

function compileText(
  c: TextContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);
  blocks.push({ type: 'body_text', text: c.body });
  return { kind: 'text', blocks, compatibility: noDowngrade(mode, 'text') };
}

function compileMedia(
  c: MediaContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);

  if (mode === 'fallback_text') {
    const textParts: string[] = [];
    if (c.caption) textParts.push(c.caption);
    if (c.media.url) textParts.push(`[Media: ${c.media.url}]`);
    blocks.push({ type: 'body_text', text: textParts.join('\n') || '[Media attachment]' });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'media', 'text', 'fallback_text mode: media rendered as text link'),
    };
  }

  blocks.push(mediaToBlock(c.media, c.caption));
  return { kind: 'media', blocks, compatibility: noDowngrade(mode, 'media') };
}

function compileTemplate(
  c: TemplateContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);

  // Template marker always first — carries original components for provider compiler
  blocks.push({
    type: 'template_marker',
    templateName: c.templateName,
    language: c.templateLanguage,
    variables: c.variables,
    components: c.components,
  });

  if (mode === 'fallback_text') {
    // Extract body text for plain-text fallback
    const bodyComp = c.components.find((co) => co.type === 'body');
    const bodyText = bodyComp?.type === 'body' ? bodyComp.text : `[Template: ${c.templateName}]`;
    blocks.push({ type: 'body_text', text: bodyText });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'template', 'text', 'fallback_text mode: template rendered as plain text'),
    };
  }

  for (const comp of c.components) {
    if (comp.type === 'header') {
      if (comp.format === 'text') {
        blocks.push({ type: 'header_text', text: comp.text });
      } else {
        blocks.push({ type: 'header_media', media: comp.media });
      }
    } else if (comp.type === 'body') {
      blocks.push({ type: 'body_text', text: comp.text });
    } else if (comp.type === 'footer') {
      blocks.push({ type: 'footer', text: comp.text });
    } else if (comp.type === 'buttons') {
      for (const btn of comp.buttons) {
        if (btn.kind === 'quick_reply') {
          blocks.push({ type: 'reply_button', id: btn.payload ?? btn.text, title: btn.text });
        } else if (btn.kind === 'url') {
          blocks.push({ type: 'url_button', title: btn.text, url: btn.url });
        } else if (btn.kind === 'phone') {
          blocks.push({ type: 'phone_button', title: btn.text, phoneNumber: btn.phoneNumber });
        }
      }
    }
  }

  return { kind: 'template', blocks, compatibility: noDowngrade(mode, 'template') };
}

function compileInteractiveButtons(
  c: InteractiveButtonsContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);
  blocks.push(...headerBlocks(c.header));
  blocks.push({ type: 'body_text', text: c.body });
  if (c.footer) blocks.push({ type: 'footer', text: c.footer });

  if (mode === 'fallback_text') {
    const options = c.buttons.map((btn, i) => ({
      number: i + 1,
      label: btn.title,
      optionId: btn.id,
    }));
    blocks.push({ type: 'numbered_options', options });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'interactive_buttons', 'text', 'fallback_text mode: quick-reply buttons converted to numbered list'),
    };
  }

  for (const btn of c.buttons) {
    blocks.push({ type: 'reply_button', id: btn.id, title: btn.title });
  }
  return { kind: 'interactive_buttons', blocks, compatibility: noDowngrade(mode, 'interactive_buttons') };
}

function compileInteractiveList(
  c: InteractiveListContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);
  blocks.push(...headerBlocks(c.header));
  blocks.push({ type: 'body_text', text: c.body });
  if (c.footer) blocks.push({ type: 'footer', text: c.footer });

  if (mode === 'fallback_text') {
    // Flatten sections into numbered options
    const options = c.sections.flatMap((sec) =>
      sec.rows.map((row, i) => ({
        number: i + 1, // renumbered globally below
        label: row.title,
        optionId: row.id,
      })),
    );
    options.forEach((opt, i) => { opt.number = i + 1; });
    blocks.push({ type: 'numbered_options', options });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'interactive_list', 'text', 'fallback_text mode: list converted to numbered list'),
    };
  }

  blocks.push({ type: 'list_button', buttonText: c.buttonText, sections: c.sections });
  return { kind: 'interactive_list', blocks, compatibility: noDowngrade(mode, 'interactive_list') };
}

function compileInteractiveCta(
  c: InteractiveCtaContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);
  blocks.push(...headerBlocks(c.header));
  blocks.push({ type: 'body_text', text: c.body });
  if (c.footer) blocks.push({ type: 'footer', text: c.footer });

  if (mode === 'fallback_text') {
    blocks.push({ type: 'body_text', text: `${c.cta.displayText}: ${c.cta.url}` });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'interactive_cta', 'text', 'fallback_text mode: CTA button rendered as text link'),
    };
  }

  blocks.push({ type: 'cta_card', displayText: c.cta.displayText, url: c.cta.url });
  return { kind: 'interactive_cta', blocks, compatibility: noDowngrade(mode, 'interactive_cta') };
}

function compileInteractiveProduct(
  c: InteractiveProductContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);

  if (mode === 'web_compatible' || mode === 'fallback_text') {
    blocks.push({
      type: 'body_text',
      text: c.body ?? `[Product: ${c.productRetailerId}]`,
    });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'interactive_product', 'text', `${mode}: product cards rendered as text`),
    };
  }

  if (c.body) blocks.push({ type: 'body_text', text: c.body });
  if (c.footer) blocks.push({ type: 'footer', text: c.footer });
  blocks.push({ type: 'product_card', productId: c.productRetailerId, catalogId: c.catalogId });
  return { kind: 'interactive_product', blocks, compatibility: noDowngrade(mode, 'interactive_product') };
}

function compileInteractiveProductList(
  c: InteractiveProductListContent,
  mode: CompatibilityMode,
  reply: RenderableBlock | null,
): RenderablePayload {
  const blocks: RenderableBlock[] = [];
  if (reply) blocks.push(reply);

  if (mode === 'web_compatible' || mode === 'fallback_text') {
    blocks.push({ type: 'header_text', text: c.header.text });
    blocks.push({ type: 'body_text', text: c.body });
    const items = c.sections.flatMap((s) => s.productItems.map((p) => `• ${p.productRetailerId}`));
    blocks.push({ type: 'body_text', text: items.join('\n') });
    return {
      kind: 'text',
      blocks,
      compatibility: downgraded(mode, 'interactive_product_list', 'text', `${mode}: product list rendered as text`),
    };
  }

  blocks.push({ type: 'header_text', text: c.header.text });
  blocks.push({ type: 'body_text', text: c.body });
  if (c.footer) blocks.push({ type: 'footer', text: c.footer });
  for (const sec of c.sections) {
    for (const item of sec.productItems) {
      blocks.push({ type: 'product_card', productId: item.productRetailerId, catalogId: c.catalogId });
    }
  }
  return { kind: 'interactive_product_list', blocks, compatibility: noDowngrade(mode, 'interactive_product_list') };
}

function compileLocation(
  c: LocationContent,
  mode: CompatibilityMode,
): RenderablePayload {
  return {
    kind: 'location',
    blocks: [{ type: 'location', latitude: c.latitude, longitude: c.longitude, name: c.name, address: c.address }],
    compatibility: noDowngrade(mode, 'location'),
  };
}

function compileContactCard(
  c: ContactCardContent,
  mode: CompatibilityMode,
): RenderablePayload {
  if (mode === 'fallback_text') {
    const lines = c.contacts.map((ct) => {
      const phone = ct.phones?.[0]?.phone ?? '';
      return `${ct.name.formattedName}${phone ? ` — ${phone}` : ''}`;
    });
    return {
      kind: 'text',
      blocks: [{ type: 'body_text', text: lines.join('\n') }],
      compatibility: downgraded(mode, 'contact_card', 'text', 'fallback_text mode: contacts rendered as text'),
    };
  }
  return {
    kind: 'contact_card',
    blocks: [{ type: 'contact_card', contacts: c.contacts }],
    compatibility: noDowngrade(mode, 'contact_card'),
  };
}

function compileOrder(
  c: OrderContent,
  mode: CompatibilityMode,
): RenderablePayload {
  if (mode === 'fallback_text') {
    const lines = c.items.map(
      (item) => `• ${item.productRetailerId} × ${item.quantity} @ ${item.itemPrice} ${item.currency}`,
    );
    if (c.text) lines.unshift(c.text);
    return {
      kind: 'text',
      blocks: [{ type: 'body_text', text: lines.join('\n') }],
      compatibility: downgraded(mode, 'order', 'text', 'fallback_text mode: order rendered as text'),
    };
  }
  const blocks: RenderableBlock[] = [];
  if (c.text) blocks.push({ type: 'body_text', text: c.text });
  for (const item of c.items) {
    blocks.push({ type: 'product_card', productId: item.productRetailerId, catalogId: c.catalogId });
  }
  return { kind: 'order', blocks, compatibility: noDowngrade(mode, 'order') };
}

function compileSystem(
  c: SystemContent,
  mode: CompatibilityMode,
): RenderablePayload {
  const label: Record<SystemContent['event'], string> = {
    session_started: 'Session started',
    session_ended: 'Session ended',
    media_processing: 'Processing media…',
    message_recalled: 'Message deleted',
    contact_changed_number: 'Contact changed number',
    group_event: 'Group event',
    identity_changed: 'Identity changed',
  };
  const text = c.detail ? `${label[c.event]}: ${c.detail}` : label[c.event];
  return {
    kind: 'system',
    blocks: [{ type: 'body_text', text }],
    compatibility: noDowngrade(mode, 'system'),
  };
}

function compileUnknown(
  c: UnknownContent,
  mode: CompatibilityMode,
): RenderablePayload {
  return {
    kind: 'unknown',
    blocks: [{ type: 'unsupported', reason: `Unknown message kind: ${c.providerKind}`, providerKind: c.providerKind }],
    compatibility: noDowngrade(mode, 'unknown'),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Compile a NormalizedMessage into a RenderablePayload.
 *
 * Pure function — no I/O, no side effects. The caller provides the
 * CompatibilityMode resolved for this conversation + provider pair.
 *
 * The resulting payload is:
 *   - Stored on Message.renderable for preview parity
 *   - Passed to compileProviderPayload to produce the wire payload
 *   - Fed directly to the frontend renderer
 */
export function compileRenderable(
  msg: NormalizedMessage,
  mode: CompatibilityMode,
): RenderablePayload {
  const replyBlock: RenderableBlock | null = msg.reply
    ? { type: 'reply_quote', preview: msg.reply.preview, kind: msg.reply.kind }
    : null;

  const c = msg.content;

  switch (c.kind) {
    case 'text':                    return compileText(c, mode, replyBlock);
    case 'media':                   return compileMedia(c, mode, replyBlock);
    case 'template':                return compileTemplate(c, mode, replyBlock);
    case 'interactive_buttons':     return compileInteractiveButtons(c, mode, replyBlock);
    case 'interactive_list':        return compileInteractiveList(c, mode, replyBlock);
    case 'interactive_cta':         return compileInteractiveCta(c, mode, replyBlock);
    case 'interactive_product':     return compileInteractiveProduct(c, mode, replyBlock);
    case 'interactive_product_list': return compileInteractiveProductList(c, mode, replyBlock);
    case 'location':                return compileLocation(c, mode);
    case 'contact_card':            return compileContactCard(c, mode);
    case 'order':                   return compileOrder(c, mode);
    case 'system':                  return compileSystem(c, mode);
    case 'unknown':                 return compileUnknown(c, mode);
  }
}

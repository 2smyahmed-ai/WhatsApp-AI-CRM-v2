import type { ProviderCapabilities, ProviderName } from '@crm/messaging-schema';

// ── Baileys (WhatsApp Web — sole provider) ────────────────────────────────────
// Baileys mirrors WhatsApp Web. All media types work. Interactive messages
// (buttons, lists, CTA, carousel) are sent via nativeFlowMessage proto and
// render as tappable buttons on Android/iOS/Web — not as numbered-text fallbacks.

export const BAILEYS_CAPABILITIES: ProviderCapabilities = {
  kinds: {
    text:                     { inbound: true,  outbound: true  },
    media:                    { inbound: true,  outbound: true  },
    template:                 { inbound: false, outbound: true,  notes: 'Sent as formatted text — no approval required' },
    interactive_buttons:      { inbound: true,  outbound: true  },
    interactive_list:         { inbound: true,  outbound: true  },
    interactive_cta:          { inbound: false, outbound: true  },
    interactive_product:      { inbound: false, outbound: false },
    interactive_product_list: { inbound: false, outbound: false },
    location:                 { inbound: true,  outbound: true  },
    contact_card:             { inbound: true,  outbound: true  },
    order:                    { inbound: true,  outbound: false },
    system:                   { inbound: true,  outbound: false },
    unknown:                  { inbound: true,  outbound: false },
  },

  buttonLimits: {
    quickReplyMax:      3,
    quickReplyTitleMax: 20,
    ctaMax:             2,
  },

  listLimits: {
    sectionsMax:       10,
    rowsPerSectionMax: 10,
    rowTitleMax:       24,
  },

  mediaLimits: {
    image:    { sizeMaxMb: 16,  mimeWhitelist: [] },
    video:    { sizeMaxMb: 16,  mimeWhitelist: [] },
    audio:    { sizeMaxMb: 16,  mimeWhitelist: [] },
    voice:    { sizeMaxMb: 16,  mimeWhitelist: ['audio/ogg'] },
    document: { sizeMaxMb: 100, mimeWhitelist: [] },
    sticker:  { sizeMaxMb: 0.5, mimeWhitelist: ['image/webp'] },
  },

  // Baileys is WhatsApp Web — no Meta 24h session window applies.
  sessionWindow: null,

  templates: { supported: true, requiresApproval: false },
  reactions: { supported: true },

  defaultMode: 'baileys_native',
};

// ── Capability registry ───────────────────────────────────────────────────────

export function getCapabilities(_provider: ProviderName): ProviderCapabilities {
  return BAILEYS_CAPABILITIES;
}

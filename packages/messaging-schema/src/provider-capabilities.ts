import type { ProviderCapabilities } from './capability';

/**
 * Concrete capability objects for each supported provider.
 * These are the authoritative source of truth for what each provider can do.
 * The builder UI reads these to gate options; the send pipeline uses them as
 * the first validation gate.
 */

export const META_CAPABILITIES: ProviderCapabilities = {
  kinds: {
    text:                    { inbound: true,  outbound: true },
    media:                   { inbound: true,  outbound: true },
    template:                { inbound: false, outbound: true, notes: 'Requires Meta-approved template' },
    interactive_buttons:     { inbound: false, outbound: true, notes: 'Max 3 quick-reply buttons, requires session window' },
    interactive_list:        { inbound: false, outbound: true, notes: 'Max 10 sections × 10 rows, requires session window' },
    interactive_cta:         { inbound: false, outbound: true, notes: 'Single CTA URL button, requires session window' },
    interactive_product:     { inbound: false, outbound: true, notes: 'Requires WhatsApp Commerce catalog' },
    interactive_product_list:{ inbound: false, outbound: true, notes: 'Requires WhatsApp Commerce catalog' },
    location:                { inbound: true,  outbound: false, notes: 'Can receive, cannot send via Cloud API' },
    contact_card:            { inbound: true,  outbound: true },
    order:                   { inbound: true,  outbound: false },
    system:                  { inbound: true,  outbound: false },
    unknown:                 { inbound: true,  outbound: false },
  },

  buttonLimits: {
    quickReplyMax:       3,
    quickReplyTitleMax: 20,
    ctaMax:              1,
  },

  listLimits: {
    sectionsMax:        10,
    rowsPerSectionMax:  10,
    rowTitleMax:        24,
  },

  mediaLimits: {
    image:    { sizeMaxMb: 5,   mimeWhitelist: ['image/jpeg', 'image/png'] },
    video:    { sizeMaxMb: 16,  mimeWhitelist: ['video/mp4', 'video/3gp'] },
    audio:    { sizeMaxMb: 16,  mimeWhitelist: ['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg'] },
    document: { sizeMaxMb: 100, mimeWhitelist: [] },
    sticker:  { sizeMaxMb: 0.5, mimeWhitelist: ['image/webp'] },
    voice:    { sizeMaxMb: 16,  mimeWhitelist: ['audio/ogg'] },
  },

  sessionWindow: { hours: 24 },

  templates: { supported: true, requiresApproval: true },

  reactions: { supported: true },

  defaultMode: 'cloud_api',
};

export const BAILEYS_CAPABILITIES: ProviderCapabilities = {
  kinds: {
    text:                    { inbound: true,  outbound: true },
    media:                   { inbound: true,  outbound: true },
    template:                { inbound: false, outbound: false, notes: 'Not supported — use Meta provider for templates' },
    interactive_buttons:     { inbound: true,  outbound: false, notes: 'Can receive; outbound buttons are blocked by WhatsApp — use numbered fallback' },
    interactive_list:        { inbound: true,  outbound: false, notes: 'Can receive; outbound lists are blocked by WhatsApp — use numbered fallback' },
    interactive_cta:         { inbound: true,  outbound: false, notes: 'Can receive; send as plain URL text' },
    interactive_product:     { inbound: true,  outbound: false },
    interactive_product_list:{ inbound: true,  outbound: false },
    location:                { inbound: true,  outbound: true },
    contact_card:            { inbound: true,  outbound: true },
    order:                   { inbound: true,  outbound: false },
    system:                  { inbound: true,  outbound: false },
    unknown:                 { inbound: true,  outbound: false },
  },

  buttonLimits: {
    quickReplyMax:       0,
    quickReplyTitleMax:  0,
    ctaMax:              0,
  },

  listLimits: {
    sectionsMax:       0,
    rowsPerSectionMax: 0,
    rowTitleMax:       0,
  },

  mediaLimits: {
    image:    { sizeMaxMb: 16,  mimeWhitelist: [] },
    video:    { sizeMaxMb: 64,  mimeWhitelist: [] },
    audio:    { sizeMaxMb: 16,  mimeWhitelist: [] },
    document: { sizeMaxMb: 100, mimeWhitelist: [] },
    sticker:  { sizeMaxMb: 0.5, mimeWhitelist: ['image/webp'] },
    voice:    { sizeMaxMb: 16,  mimeWhitelist: ['audio/ogg'] },
  },

  sessionWindow: null,

  templates: { supported: false, requiresApproval: false },

  reactions: { supported: true },

  defaultMode: 'fallback_text',
};

export const PROVIDER_CAPABILITIES: Record<'meta' | 'baileys', ProviderCapabilities> = {
  meta:    META_CAPABILITIES,
  baileys: BAILEYS_CAPABILITIES,
};

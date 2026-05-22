import type { Media } from './media';

/**
 * The semantic shape of a message. Drives discriminated narrowing for
 * MessageContent and RenderablePayload, and gates capability checks on
 * the provider.
 *
 * Closed enum in code; the DB column is `String` so future providers can
 * round-trip unknown kinds without a schema migration.
 */
export type MessageKind =
  | 'text'
  | 'media'
  | 'template'
  | 'interactive_buttons'
  | 'interactive_list'
  | 'interactive_cta'
  | 'interactive_product'
  | 'interactive_product_list'
  | 'location'
  | 'contact_card'
  | 'order'
  | 'system'
  | 'unknown';

export const MESSAGE_KINDS = [
  'text',
  'media',
  'template',
  'interactive_buttons',
  'interactive_list',
  'interactive_cta',
  'interactive_product',
  'interactive_product_list',
  'location',
  'contact_card',
  'order',
  'system',
  'unknown',
] as const;

// ── Per-kind content ─────────────────────────────────────────────────────────

export interface TextContent {
  kind: 'text';
  body: string;
  /** Phone numbers tagged with @mention in the body. */
  mentions?: string[];
  /** Hint to the provider whether to render a URL preview. */
  previewUrl?: boolean;
}

export interface MediaContent {
  kind: 'media';
  media: Media;
  caption?: string;
}

// ── Templates ────────────────────────────────────────────────────────────────

export interface TemplateContent {
  kind: 'template';
  templateName: string;
  templateLanguage: string;
  /** Local MessageTemplate.id, if known. */
  templateId: string | null;
  /** Meta WABA template ID, if approved. */
  metaTemplateId: string | null;
  components: TemplateComponent[];
  /** Resolved variable name → value map (e.g. { name: "Ahmed", order_id: "42" }). */
  variables: Record<string, string>;
}

export type TemplateComponent =
  | { type: 'header'; format: 'text'; text: string }
  | { type: 'header'; format: 'image' | 'video' | 'document'; media: Media }
  | { type: 'body'; text: string }
  | { type: 'footer'; text: string }
  | { type: 'buttons'; buttons: TemplateButton[] };

export type TemplateButton =
  | { kind: 'quick_reply'; text: string; payload?: string }
  | { kind: 'url'; text: string; url: string; urlVariables?: string[] }
  | { kind: 'phone'; text: string; phoneNumber: string };

// ── Interactive messages ─────────────────────────────────────────────────────

export interface InteractiveButtonsContent {
  kind: 'interactive_buttons';
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  /** 1–3 quick-reply buttons (Meta limit). */
  buttons: QuickReplyButton[];
}

export interface QuickReplyButton {
  id: string;
  /** Max 20 chars per Meta limit. */
  title: string;
}

export interface InteractiveListContent {
  kind: 'interactive_list';
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  /** The label on the entry button that opens the list sheet. */
  buttonText: string;
  /** Max 10 sections; each with max 10 rows. */
  sections: ListSection[];
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveCtaContent {
  kind: 'interactive_cta';
  header?: InteractiveHeader;
  body: string;
  footer?: string;
  cta: { displayText: string; url: string };
}

export interface InteractiveProductContent {
  kind: 'interactive_product';
  body?: string;
  footer?: string;
  catalogId: string;
  productRetailerId: string;
}

export interface InteractiveProductListContent {
  kind: 'interactive_product_list';
  header: { type: 'text'; text: string };
  body: string;
  footer?: string;
  catalogId: string;
  sections: ProductSection[];
}

export interface ProductSection {
  title: string;
  productItems: { productRetailerId: string }[];
}

export type InteractiveHeader =
  | { type: 'text'; text: string }
  | { type: 'media'; media: Media };

// ── Location / contact / order / system / unknown ────────────────────────────

export interface LocationContent {
  kind: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactCardContent {
  kind: 'contact_card';
  contacts: VCardLike[];
}

/**
 * Minimal vCard-shaped contact. Mirrors Meta's contacts[] structure.
 */
export interface VCardLike {
  name: { formattedName: string; firstName?: string; lastName?: string };
  phones?: { phone: string; type?: string; waId?: string }[];
  emails?: { email: string; type?: string }[];
  org?: { company?: string; department?: string; title?: string };
  addresses?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    type?: string;
  }[];
  urls?: { url: string; type?: string }[];
  birthday?: string;
}

export interface OrderContent {
  kind: 'order';
  catalogId: string;
  text?: string;
  items: OrderItem[];
}

export interface OrderItem {
  productRetailerId: string;
  quantity: number;
  itemPrice: number;
  currency: string;
}

export interface SystemContent {
  kind: 'system';
  event:
    | 'session_started'
    | 'session_ended'
    | 'media_processing'
    | 'message_recalled'
    | 'contact_changed_number'
    | 'group_event'
    | 'identity_changed';
  detail?: string;
}

/**
 * A message whose kind we don't yet handle. Renders as a graceful fallback.
 * `raw` on the parent NormalizedMessage holds the original provider payload.
 */
export interface UnknownContent {
  kind: 'unknown';
  /** The kind string the provider reported, for diagnostics. */
  providerKind: string;
  /** Best-effort text representation, if any. */
  text?: string;
}

// ── Discriminated union ──────────────────────────────────────────────────────

export type MessageContent =
  | TextContent
  | MediaContent
  | TemplateContent
  | InteractiveButtonsContent
  | InteractiveListContent
  | InteractiveCtaContent
  | InteractiveProductContent
  | InteractiveProductListContent
  | LocationContent
  | ContactCardContent
  | OrderContent
  | SystemContent
  | UnknownContent;

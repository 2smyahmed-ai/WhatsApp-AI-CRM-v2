import type { Media } from './media';
import type { MessageKind, ListSection, VCardLike, TemplateComponent } from './content';
import type { CompatibilityReport } from './compatibility';

/**
 * The visual structure of a message — what the renderer draws.
 *
 * This is the platform's central artifact:
 *   - Compiled from a NormalizedMessage by the compatibility compiler.
 *   - Compiled to a ProviderPayload by the provider compiler.
 *   - Rendered identically in the chat bubble AND the builder preview.
 *
 * Storing the RenderablePayload on the message row guarantees preview parity:
 * the renderer is fed the exact bytes that were used to send.
 */
export interface RenderablePayload {
  /** Kind reflected by the visual blocks. May differ from the originating
   *  NormalizedMessage.content.kind when a downgrade has occurred. */
  kind: MessageKind;

  /** Ordered visual blocks. Provider-agnostic. */
  blocks: RenderableBlock[];

  /** How this payload was produced (mode, downgrade, warnings). */
  compatibility: CompatibilityReport;
}

/**
 * One visual block drawn by the renderer. The full set of block types is the
 * renderer's contract — adding a new kind requires adding a block type and
 * handling it exhaustively in the renderer switch.
 */
export type RenderableBlock =
  | ReplyQuoteBlock
  | HeaderTextBlock
  | HeaderMediaBlock
  | BodyTextBlock
  | MediaBlock
  | FooterBlock
  | ReplyButtonBlock
  | UrlButtonBlock
  | PhoneButtonBlock
  | ListButtonBlock
  | CtaCardBlock
  | NumberedOptionsBlock
  | LocationBlock
  | ContactCardBlock
  | ProductCardBlock
  | TemplateMarkerBlock
  | UnsupportedBlock;

export interface ReplyQuoteBlock {
  type: 'reply_quote';
  /** Short preview of the quoted message. */
  preview: string;
  /** Kind of the quoted message — used to pick the right icon. */
  kind: MessageKind;
}

export interface HeaderTextBlock {
  type: 'header_text';
  text: string;
}

export interface HeaderMediaBlock {
  type: 'header_media';
  media: Media;
}

export interface BodyTextBlock {
  type: 'body_text';
  text: string;
}

export interface MediaBlock {
  type: 'media';
  media: Media;
  caption?: string;
}

export interface FooterBlock {
  type: 'footer';
  text: string;
}

/**
 * A quick-reply button. Tapping it emits the contact's selection — represented
 * to the user as a normal text reply with the button's title.
 */
export interface ReplyButtonBlock {
  type: 'reply_button';
  /** Stable identifier; matches the button.id in InteractiveButtonsContent. */
  id: string;
  title: string;
  /** Greyed-out / non-interactive (e.g. in preview after send). */
  disabled?: boolean;
}

export interface UrlButtonBlock {
  type: 'url_button';
  title: string;
  url: string;
}

export interface PhoneButtonBlock {
  type: 'phone_button';
  title: string;
  phoneNumber: string;
}

export interface ListButtonBlock {
  type: 'list_button';
  /** Label on the entry button that opens the list sheet. */
  buttonText: string;
  sections: ListSection[];
}

export interface CtaCardBlock {
  type: 'cta_card';
  displayText: string;
  url: string;
}

/**
 * The canonical fallback for interactive structures when the provider /
 * compatibility mode can't deliver real buttons.
 *
 *   What would you like to do?
 *
 *   1. Track order
 *   2. Contact support
 *
 *   Reply with the number of your choice.
 */
export interface NumberedOptionsBlock {
  type: 'numbered_options';
  intro?: string;
  options: NumberedOption[];
}

export interface NumberedOption {
  /** 1-indexed for display. */
  number: number;
  /** Visible text. */
  label: string;
  /** Stable id of the original button — preserved so an inbound reply
   *  matching the number can be auto-routed (Phase 2). */
  optionId?: string;
}

export interface LocationBlock {
  type: 'location';
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface ContactCardBlock {
  type: 'contact_card';
  contacts: VCardLike[];
}

export interface ProductCardBlock {
  type: 'product_card';
  productId: string;
  catalogId?: string;
  title?: string;
  price?: string;
  image?: Media;
}

/**
 * Marker block emitted for template messages so the renderer can show
 * "Template: welcome_v1 (en_US)" alongside the resolved body/header blocks.
 */
export interface TemplateMarkerBlock {
  type: 'template_marker';
  templateName: string;
  language: string;
  /** Resolved variable name → value map (e.g. { name: "Ahmed", order_id: "42" }). */
  variables: Record<string, string>;
  /** Original component list — carried so provider compilers can reconstruct
   *  the exact API payload without re-parsing the resolved block text. */
  components: TemplateComponent[];
}

export interface UnsupportedBlock {
  type: 'unsupported';
  reason: string;
  /** The provider-reported kind, for diagnostics. */
  providerKind?: string;
}

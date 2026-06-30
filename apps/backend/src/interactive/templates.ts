/**
 * interactive/templates.ts
 *
 * Reusable message builders, in-memory menu navigation, and ready-made
 * business-grade message templates.
 *
 * ─── WHAT'S IN THIS FILE ─────────────────────────────────────────────────────
 *
 *   1. Config builders (pure, no I/O)
 *      buildButtons()   — assemble a ButtonsConfig object
 *      buildList()      — assemble a ListConfig object
 *      buildCarousel()  — assemble a CarouselConfig object
 *      sendBuilt()      — dispatch any BuiltConfig to the right send function
 *
 *   2. Menu navigation system
 *      SessionStore     — in-memory per-user session (menuStack + arbitrary data)
 *      navigateTo()     — push a menu onto the user's stack and send it
 *      handleMenuResponse() — dispatch a response within the menu tree
 *                             (handles Back / Home navigation automatically)
 *
 *   3. Business templates (fire-and-forget helpers)
 *      sendWelcomeMenu()        — greeting + main-menu buttons
 *      sendOrderStatus()        — order confirmation / tracking CTA
 *      sendFeedbackRequest()    — 1–5 star rating list picker
 *      sendAppointmentPicker()  — available slot list
 *      sendProductShowcase()    — product image carousel
 *      sendReEngagement()       — win-back message with opt-out
 *      sendSupportOptions()     — support department selector
 *      sendPaymentConfirmation()— payment receipt with CTA
 *
 * ─── SESSION STORE ───────────────────────────────────────────────────────────
 *
 *   SessionStore is backed by an in-memory Map with a TTL-based prune cycle.
 *   This is suitable for a single-process deployment.
 *
 *   For multi-process / horizontally scaled deployments, replace the backing
 *   store with Redis:
 *
 *     get(jid)  → redis.get(`session:${jid}`) and JSON.parse
 *     set(jid)  → redis.setex(`session:${jid}`, ttlSeconds, JSON.stringify(state))
 *     delete(jid) → redis.del(`session:${jid}`)
 *
 * ─── MENU TREE ───────────────────────────────────────────────────────────────
 *
 *   A menu tree is a recursive structure of MenuNode objects:
 *
 *   const rootMenu: MenuNode = {
 *     id: 'root',
 *     message: buildButtons({
 *       body: 'How can we help?',
 *       buttons: [
 *         { id: 'support', title: 'Support' },
 *         { id: 'sales',   title: 'Sales'   },
 *       ],
 *     }),
 *     children: {
 *       support: {
 *         id: 'support',
 *         message: buildList({ body: 'Support options', sections: [...] }),
 *       },
 *     },
 *   };
 *
 *   await navigateTo(sock, jid, rootMenu);               // user arrives at root
 *   const next = await handleMenuResponse(sock, jid, responseId, rootMenu);
 *   if (!next) { / leaf action — handle the business event / }
 */

import type { WASocket } from '@whiskeysockets/baileys';
import { sendButtons, sendCtaButtons } from './buttons';
import type { QuickReplyButton, ButtonHeader, SendResult } from './buttons';
import { sendListMenu } from './lists';
import type { ListSection } from './lists';
import { sendCarousel } from './carousel';
import type { CarouselCard } from './carousel';

// ─────────────────────────────────────────────────────────────────────────────
// Config types
// ─────────────────────────────────────────────────────────────────────────────

export interface ButtonsConfig {
  type: 'buttons';
  body: string;
  buttons: QuickReplyButton[];
  footer?: string | null;
  header?: ButtonHeader | null;
  simulateTyping?: boolean;
}

export interface ListConfig {
  type: 'list';
  body: string;
  buttonText: string;
  sections: ListSection[];
  footer?: string | null;
  header?: string | null;
  simulateTyping?: boolean;
}

export interface CarouselConfig {
  type: 'carousel';
  cards: CarouselCard[];
  simulateTyping?: boolean;
}

export type BuiltConfig = ButtonsConfig | ListConfig | CarouselConfig;

// ─────────────────────────────────────────────────────────────────────────────
// Config builders (pure — no I/O)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Assemble a ButtonsConfig without sending it.
 * Pass the result to sendBuilt() or store it in a MenuNode.
 *
 * @example
 * const msg = buildButtons({
 *   header:  { type: 'text', text: 'Main Menu' },
 *   body:    'How can we help you today?',
 *   footer:  'Tap a button to continue',
 *   buttons: [
 *     { id: 'support', title: 'Support', emoji: '🛠' },
 *     { id: 'sales',   title: 'Sales',   emoji: '💰' },
 *   ],
 * });
 */
export function buildButtons(options: Omit<ButtonsConfig, 'type'>): ButtonsConfig {
  if (!options?.body) throw new TypeError('body is required');
  if (!Array.isArray(options.buttons) || options.buttons.length === 0) {
    throw new TypeError('buttons must be a non-empty array');
  }
  return {
    type:    'buttons',
    footer:  null,
    header:  null,
    ...options,
  };
}

/**
 * Assemble a ListConfig without sending it.
 *
 * @example
 * const msg = buildList({
 *   header:     'Choose Department',
 *   body:       'Select the team you need.',
 *   buttonText: 'Open Menu',
 *   sections:   [{ title: 'Support', rows: [{ id: 'tech', title: 'Tech Support' }] }],
 * });
 */
export function buildList(options: Omit<ListConfig, 'type'>): ListConfig {
  if (!options?.body) throw new TypeError('body is required');
  if (!Array.isArray(options.sections) || options.sections.length === 0) {
    throw new TypeError('sections must be a non-empty array');
  }
  const { buttonText = 'Select', footer = null, header = null, ...rest } = options;
  return { type: 'list', buttonText, footer, header, ...rest };
}

/**
 * Assemble a CarouselConfig without sending it.
 */
export function buildCarousel(
  cards: CarouselCard[],
  opts: { simulateTyping?: boolean } = {},
): CarouselConfig {
  if (!Array.isArray(cards) || cards.length === 0) {
    throw new TypeError('cards must be a non-empty array');
  }
  return { type: 'carousel', cards, simulateTyping: opts.simulateTyping };
}

/**
 * Dispatch a BuiltConfig to the correct send function.
 *
 * This is the unified entry point — you can store BuiltConfig objects
 * in your database or menu tree and send them via a single call.
 *
 * @example
 * const config = buildButtons({ body: 'Hello', buttons: [{ id: 'ok', title: 'OK' }] });
 * await sendBuilt(sock, jid, config);
 */
export async function sendBuilt(
  sock: WASocket,
  jid: string,
  config: BuiltConfig,
): Promise<SendResult> {
  switch (config.type) {
    case 'buttons':
      return sendButtons(sock, jid, {
        body:           config.body,
        buttons:        config.buttons,
        footer:         config.footer ?? undefined,
        header:         config.header ?? undefined,
        simulateTyping: config.simulateTyping,
      });

    case 'list':
      return sendListMenu(sock, jid, {
        body:           config.body,
        buttonText:     config.buttonText,
        sections:       config.sections,
        footer:         config.footer ?? undefined,
        header:         config.header ?? undefined,
        simulateTyping: config.simulateTyping,
      });

    case 'carousel':
      return sendCarousel(sock, jid, config.cards, {
        simulateTyping: config.simulateTyping,
      });

    default:
      throw new TypeError(`Unknown BuiltConfig type: "${(config as any).type}"`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Session store
// ─────────────────────────────────────────────────────────────────────────────

export interface UserSession {
  /** Stack of menu IDs the user has visited (most recent last). */
  menuStack: string[];
  /** Arbitrary key-value store for flow state (e.g., selected product, step). */
  data: Record<string, unknown>;
  /** Unix ms — used for TTL-based pruning. */
  updatedAt: number;
}

/**
 * In-memory per-user session store.
 *
 * Tracks the user's menu navigation stack and arbitrary flow data.
 * Sessions expire after `ttlMs` of inactivity (default 30 minutes).
 *
 * ⚠️  Multi-process note: this store is not shared across Node.js processes.
 * Replace with Redis for horizontal scaling.
 */
export class SessionStore {
  readonly #store = new Map<string, UserSession>();
  readonly #ttlMs: number;

  constructor(ttlMs = 30 * 60_000) {
    this.#ttlMs = ttlMs;
    const pruneInterval = setInterval(() => this.prune(), 5 * 60_000);
    pruneInterval.unref?.();
  }

  get(jid: string): UserSession | null {
    const entry = this.#store.get(jid);
    if (!entry) return null;
    if (Date.now() - entry.updatedAt > this.#ttlMs) {
      this.#store.delete(jid);
      return null;
    }
    return entry;
  }

  set(jid: string, state: Omit<UserSession, 'updatedAt'>): void {
    this.#store.set(jid, { ...state, updatedAt: Date.now() });
  }

  /** Merge partial data into an existing session (creates one if absent). */
  update(jid: string, partial: Partial<Pick<UserSession, 'menuStack' | 'data'>>): void {
    const existing = this.get(jid) ?? { menuStack: [], data: {} };
    this.set(jid, {
      menuStack: partial.menuStack ?? existing.menuStack,
      data:      partial.data      ? { ...existing.data, ...partial.data } : existing.data,
    });
  }

  delete(jid: string): void {
    this.#store.delete(jid);
  }

  /** Remove all sessions that have exceeded the TTL. */
  prune(): void {
    const cutoff = Date.now() - this.#ttlMs;
    for (const [jid, entry] of this.#store) {
      if (entry.updatedAt < cutoff) this.#store.delete(jid);
    }
  }

  /** Number of active sessions (for monitoring). */
  get size(): number {
    return this.#store.size;
  }
}

/** Module-level singleton. Shared across all menus in the same process. */
export const sessionStore = new SessionStore();

// ─────────────────────────────────────────────────────────────────────────────
// Menu tree types
// ─────────────────────────────────────────────────────────────────────────────

export interface MenuNode {
  /** Unique identifier for this menu within the tree. */
  id: string;
  /** The message config to send when navigating to this menu. */
  message: ButtonsConfig | ListConfig;
  /**
   * Child menus keyed by the button/row ID that navigates into them.
   * If a response ID matches a key here, navigateTo() is called automatically.
   * If it doesn't match, handleMenuResponse() returns null — the caller handles it.
   */
  children?: Record<string, MenuNode>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Navigation helpers
// ─────────────────────────────────────────────────────────────────────────────

/** DFS search for a menu node by ID. */
function findMenuById(node: MenuNode, id: string): MenuNode | null {
  if (node.id === id) return node;
  for (const child of Object.values(node.children ?? {})) {
    const found = findMenuById(child, id);
    if (found) return found;
  }
  return null;
}

/** Reserved IDs for navigation buttons — callers must not use these as business IDs. */
const NAV_BACK = '__nav_back__';
const NAV_HOME = '__nav_home__';

/**
 * Navigate a user to a specific menu, push it onto their session stack, and send it.
 *
 * If `addNavButtons` is true (the default) and the menu is a ButtonsConfig,
 * navigation buttons (Back / Home) are appended automatically when there is
 * history in the stack.  The combined total must not exceed 3 buttons.
 *
 * @example
 * await navigateTo(sock, jid, rootMenu);   // first page — no nav buttons
 * await navigateTo(sock, jid, subMenu);    // adds ⬅ Back button
 */
export async function navigateTo(
  sock: WASocket,
  jid: string,
  menu: MenuNode,
  opts: { addNavButtons?: boolean } = {},
): Promise<SendResult> {
  if (!menu?.id) throw new TypeError('menu.id is required');

  const session: UserSession = sessionStore.get(jid) ?? { menuStack: [] as string[], data: {}, updatedAt: Date.now() };

  // Avoid duplicate pushes if the user is already at this menu
  if (session.menuStack[session.menuStack.length - 1] !== menu.id) {
    session.menuStack.push(menu.id);
  }
  sessionStore.set(jid, session);

  let config: BuiltConfig = { ...menu.message };

  // Inject navigation buttons into ButtonsConfig menus when there is history
  const shouldAddNav = opts.addNavButtons !== false && config.type === 'buttons' && session.menuStack.length > 1;
  if (shouldAddNav && config.type === 'buttons') {
    const buttonsConfig = config as ButtonsConfig;
    const navButtons: QuickReplyButton[] = [
      { id: NAV_BACK, title: '⬅ Back' },
    ];
    // Only show Home when the stack is deeper than root + 1
    if (session.menuStack.length > 2) {
      navButtons.push({ id: NAV_HOME, title: '🏠 Home' });
    }

    const available = 3 - (buttonsConfig.buttons?.length ?? 0);
    if (available > 0) {
      config = {
        ...buttonsConfig,
        buttons: [...(buttonsConfig.buttons ?? []), ...navButtons.slice(0, available)],
      } as ButtonsConfig;
    }
  }

  return sendBuilt(sock, jid, config);
}

/**
 * Handle a user's response within a menu tree.
 *
 * Automatically handles reserved navigation IDs:
 *   `__nav_home__` → clears the session stack, re-sends root menu
 *   `__nav_back__` → pops the stack, re-sends the parent menu
 *
 * For non-navigation IDs:
 *   Looks up `responseId` in the current menu's `children`.
 *   If found → navigates to the child menu and returns the MenuNode.
 *   If not found → returns `null` (the caller handles the leaf business action).
 *
 * @example
 * const stopListening = onInteractiveResponse(sock, async (resp) => {
 *   const next = await handleMenuResponse(sock, resp.jid, resp.id, rootMenu);
 *   if (!next) {
 *     // Leaf action — dispatch to business logic
 *     await handleLeafAction(resp.jid, resp.id, resp.user);
 *   }
 * });
 */
export async function handleMenuResponse(
  sock: WASocket,
  jid: string,
  responseId: string,
  rootMenu: MenuNode,
): Promise<MenuNode | null> {
  const session = sessionStore.get(jid);

  // ── Home navigation ───────────────────────────────────────────────────────
  if (responseId === NAV_HOME) {
    sessionStore.delete(jid);
    await navigateTo(sock, jid, rootMenu);
    return rootMenu;
  }

  // ── Back navigation ───────────────────────────────────────────────────────
  if (responseId === NAV_BACK) {
    const stack = [...(session?.menuStack ?? [])];
    stack.pop(); // pop current menu

    const parentId   = stack[stack.length - 1];
    const parentMenu = parentId ? findMenuById(rootMenu, parentId) : rootMenu;

    if (parentMenu) {
      sessionStore.set(jid, { menuStack: stack, data: session?.data ?? {} });
      await navigateTo(sock, jid, parentMenu);
      return parentMenu;
    }

    // No parent found — fall back to root
    sessionStore.delete(jid);
    await navigateTo(sock, jid, rootMenu);
    return rootMenu;
  }

  // ── Child-menu navigation ─────────────────────────────────────────────────
  const currentId   = session?.menuStack?.[session.menuStack.length - 1];
  const currentMenu = currentId ? findMenuById(rootMenu, currentId) : rootMenu;
  const childMenu   = currentMenu?.children?.[responseId];

  if (childMenu) {
    await navigateTo(sock, jid, childMenu);
    return childMenu;
  }

  // Leaf response — the caller must handle the business action
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Business templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send a welcome / main-menu message.
 * The first point of contact for most automated WhatsApp flows.
 *
 * @example
 * await sendWelcomeMenu(sock, jid, { businessName: 'Acme Corp', subtitle: 'How can we help you today?' });
 */
export async function sendWelcomeMenu(
  sock: WASocket,
  jid: string,
  opts: { businessName?: string; subtitle?: string } = {},
): Promise<SendResult> {
  const name     = opts.businessName ?? 'Us';
  const subtitle = opts.subtitle     ?? 'How can we help you today?';

  return sendBuilt(sock, jid, buildButtons({
    header:  { type: 'text', text: `Welcome to ${name}! 👋` },
    body:    subtitle,
    footer:  'Tap a button or reply with a number.',
    buttons: [
      { id: 'support',      title: '🛠 Support'     },
      { id: 'sales',        title: '💰 Sales'        },
      { id: 'track_order',  title: '📦 Track Order'  },
    ],
  }));
}

/**
 * Send an order status message with an optional live-tracking CTA button.
 *
 * @example
 * await sendOrderStatus(sock, jid, {
 *   orderId:     '12345',
 *   status:      'Out for delivery',
 *   eta:         'Today by 6pm',
 *   trackingUrl: 'https://track.example.com/12345',
 * });
 */
export async function sendOrderStatus(
  sock: WASocket,
  jid: string,
  order: { orderId: string; status: string; eta?: string; trackingUrl?: string },
): Promise<SendResult> {
  const etaLine = order.eta ? `\n⏱ ETA: *${order.eta}*` : '';
  const body    = `📦 Order *#${order.orderId}*\nStatus: *${order.status}*${etaLine}`;

  if (order.trackingUrl) {
    return sendCtaButtons(sock, jid, {
      body,
      footer:     'Tap to track your delivery in real time.',
      ctaButtons: [
        { displayText: '🔍 Track Order', url: order.trackingUrl },
      ],
    });
  }

  return sendBuilt(sock, jid, buildButtons({
    body,
    buttons: [
      { id: 'contact_support', title: '🛠 Get Help'        },
      { id: 'cancel_order',    title: '❌ Cancel Order'     },
    ],
  }));
}

/**
 * Send a 1–5 star feedback request using a list picker.
 *
 * @example
 * await sendFeedbackRequest(sock, jid, { topic: 'your recent support call' });
 */
export async function sendFeedbackRequest(
  sock: WASocket,
  jid: string,
  opts: { topic?: string } = {},
): Promise<SendResult> {
  const topic = opts.topic ?? 'your recent experience with us';

  return sendBuilt(sock, jid, buildList({
    header:     'Rate Your Experience ⭐',
    body:       `How would you rate ${topic}?`,
    footer:     'Your feedback helps us improve.',
    buttonText: 'Rate Now',
    sections:   [
      {
        title: 'Your Rating',
        rows:  [
          { id: 'rating_5', title: '⭐⭐⭐⭐⭐ Excellent',    description: 'Fully satisfied'   },
          { id: 'rating_4', title: '⭐⭐⭐⭐ Good',          description: 'Mostly satisfied'   },
          { id: 'rating_3', title: '⭐⭐⭐ Average',         description: 'Neutral'            },
          { id: 'rating_2', title: '⭐⭐ Below Average',     description: 'Not satisfied'      },
          { id: 'rating_1', title: '⭐ Poor',               description: 'Very dissatisfied'  },
        ],
      },
    ],
  }));
}

/**
 * Send an appointment-slot picker.
 *
 * @example
 * await sendAppointmentPicker(sock, jid, {
 *   slots: [
 *     { id: 'slot_mon_9', datetime: 'Monday 9:00am',  description: 'Available' },
 *     { id: 'slot_mon_2', datetime: 'Monday 2:00pm',  description: 'Available' },
 *     { id: 'slot_tue_10',datetime: 'Tuesday 10:00am',description: 'Available' },
 *   ],
 * });
 */
export async function sendAppointmentPicker(
  sock: WASocket,
  jid: string,
  opts: { slots: Array<{ id: string; datetime: string; description?: string }> },
): Promise<SendResult> {
  if (!Array.isArray(opts.slots) || opts.slots.length === 0) {
    throw new TypeError('opts.slots must be a non-empty array');
  }

  return sendBuilt(sock, jid, buildList({
    header:     'Book an Appointment 📅',
    body:       'Select a time slot that works for you.',
    footer:     "We'll send a confirmation right away.",
    buttonText: 'Choose Slot',
    sections:   [
      {
        title: 'Available Times',
        rows:  opts.slots.slice(0, 10).map((s) => ({
          id:          s.id,
          title:       s.datetime,
          description: s.description ?? '',
        })),
      },
    ],
  }));
}

/**
 * Send a product showcase carousel.
 * Each product becomes one card with an image header, body text, and CTA/cart buttons.
 *
 * @example
 * await sendProductShowcase(sock, jid, [
 *   {
 *     name:        'Pro Keyboard',
 *     description: 'Mechanical, backlit, wireless',
 *     price:       '$89',
 *     imageBuffer: readFileSync('./assets/keyboard.jpg'),
 *     productUrl:  'https://shop.example.com/keyboard',
 *     addToCartId: 'kb_01',
 *   },
 * ]);
 */
export async function sendProductShowcase(
  sock: WASocket,
  jid: string,
  products: Array<{
    name: string;
    description: string;
    price?: string;
    imageBuffer?: Buffer;
    productUrl?: string;
    addToCartId?: string;
  }>,
): Promise<SendResult> {
  if (!Array.isArray(products) || products.length === 0) {
    throw new TypeError('products must be a non-empty array');
  }

  const cards: CarouselCard[] = products.slice(0, 10).map((p) => {
    const priceLine = p.price ? `\n\n💰 ${p.price}` : '';
    return {
      body:   `*${p.name}*\n${p.description}${priceLine}`,
      footer: p.price ?? '',
      media:  p.imageBuffer ? { buffer: p.imageBuffer, type: 'image' as const } : undefined,
      buttons: [
        ...(p.addToCartId
          ? [{ kind: 'quick_reply' as const, id: `add_cart_${p.addToCartId}`, title: '🛒 Add to Cart' }]
          : []),
        ...(p.productUrl
          ? [{ kind: 'cta_url' as const, displayText: 'View Details', url: p.productUrl }]
          : []),
      ],
    };
  });

  return sendCarousel(sock, jid, cards);
}

/**
 * Send a win-back / re-engagement message after a period of inactivity.
 * Includes an opt-out ("No thanks") button to respect user preferences.
 *
 * @example
 * await sendReEngagement(sock, jid, {
 *   customerName: 'Ahmed',
 *   offerText:    "Here's a 15% discount just for you — valid for 48 hours.",
 *   offerUrl:     'https://shop.example.com/promo/AHMED15',
 * });
 */
export async function sendReEngagement(
  sock: WASocket,
  jid: string,
  opts: { customerName?: string; offerText?: string; offerUrl?: string } = {},
): Promise<SendResult> {
  const name = opts.customerName ?? 'there';
  const body = `Hey ${name}! 👋\n\nWe miss you! ${
    opts.offerText ?? "Here's a special offer just for you."
  }`;

  if (opts.offerUrl) {
    return sendCtaButtons(sock, jid, {
      body,
      footer:     'Tap to claim. Offer expires soon.',
      ctaButtons: [
        {
          displayText: '🎁 Claim Offer',
          url:         opts.offerUrl,
          trackingId:  `reeng_${Date.now()}`,
        },
      ],
    });
  }

  return sendBuilt(sock, jid, buildButtons({
    body,
    buttons: [
      { id: 'reeng_yes',  title: "✅ Yes, I'm in!" },
      { id: 'reeng_no',   title: '❌ No thanks'     },
    ],
  }));
}

/**
 * Send a support department selector.
 *
 * @example
 * await sendSupportOptions(sock, jid);
 */
export async function sendSupportOptions(
  sock: WASocket,
  jid: string,
  opts: { headerText?: string } = {},
): Promise<SendResult> {
  return sendBuilt(sock, jid, buildList({
    header:     opts.headerText ?? 'Customer Support',
    body:       'How can we help you today? Choose a category below.',
    footer:     'Average response time: under 5 minutes',
    buttonText: 'Select',
    sections:   [
      {
        title: 'Technical Issues',
        rows:  [
          { id: 'tech_app',      title: 'App not working',   description: 'Crashes, errors, bugs' },
          { id: 'tech_account',  title: 'Account issues',    description: 'Login, password, 2FA' },
          { id: 'tech_billing',  title: 'Payment issues',    description: 'Failed charges, refunds' },
        ],
      },
      {
        title: 'General Enquiries',
        rows:  [
          { id: 'general_pricing',  title: 'Pricing & plans',  description: 'Upgrade, downgrade, compare' },
          { id: 'general_feature',  title: 'Feature request',  description: 'Suggest an improvement' },
          { id: 'general_other',    title: 'Other',            description: 'Anything else' },
        ],
      },
    ],
  }));
}

/**
 * Send a payment confirmation with an invoice/receipt CTA.
 *
 * @example
 * await sendPaymentConfirmation(sock, jid, {
 *   amount:     '$49.99',
 *   currency:   'USD',
 *   reference:  'INV-2025-001',
 *   receiptUrl: 'https://billing.example.com/receipts/INV-2025-001',
 * });
 */
export async function sendPaymentConfirmation(
  sock: WASocket,
  jid: string,
  opts: {
    amount: string;
    currency?: string;
    reference?: string;
    receiptUrl?: string;
  },
): Promise<SendResult> {
  const ref  = opts.reference ? `\nReference: *${opts.reference}*` : '';
  const body = `✅ Payment confirmed!\n\nAmount: *${opts.amount}${opts.currency ? ` ${opts.currency}` : ''}*${ref}\n\nThank you for your payment.`;

  if (opts.receiptUrl) {
    return sendCtaButtons(sock, jid, {
      body,
      footer:     'Download or view your receipt.',
      ctaButtons: [{ displayText: '🧾 View Receipt', url: opts.receiptUrl }],
    });
  }

  return sendBuilt(sock, jid, buildButtons({
    body,
    buttons: [
      { id: 'payment_support', title: '🛠 Need Help?' },
      { id: 'payment_done',    title: '✅ Got It'      },
    ],
  }));
}

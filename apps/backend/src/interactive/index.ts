/**
 * interactive/index.ts
 *
 * Barrel export for the entire interactive messaging system.
 *
 * ─── COMPLETE USAGE EXAMPLE ───────────────────────────────────────────────────
 *
 * import {
 *   // Core send functions
 *   sendButtons, sendCtaButtons, sendMixedButtons,
 *   sendListMenu, sendPaginatedList,
 *   sendCarousel, sendProductCarousel,
 *
 *   // Low-level builders (used by template builders internally)
 *   buildQuickReplyButton, buildCtaUrlButton,
 *   buildSingleSelectButton,
 *   buildProductCards,
 *
 *   // High-level config builders
 *   buildButtons, buildList, buildCarousel,
 *   sendBuilt,
 *
 *   // Response handling
 *   handleInteractiveResponse,
 *   onInteractiveResponse,
 *   createActionRouter,
 *   RESPONSE_TYPES,
 *
 *   // Menu navigation
 *   sessionStore, navigateTo, handleMenuResponse,
 *
 *   // Business templates
 *   sendWelcomeMenu,
 *   sendOrderStatus,
 *   sendFeedbackRequest,
 *   sendAppointmentPicker,
 *   sendProductShowcase,
 *   sendReEngagement,
 *   sendSupportOptions,
 *   sendPaymentConfirmation,
 *
 *   // Utilities
 *   rateLimiter, RateLimiter,
 *   normalizeJid, assertConnected,
 *   retryAsync, sleep, simulateTyping, humanDelay,
 *   validateLength, validateButtonCount,
 * } from './interactive/index.js';
 *
 * ─── QUICK START ─────────────────────────────────────────────────────────────
 *
 * // 1. Send quick-reply buttons
 * await sendButtons(sock, jid, {
 *   header:  { type: 'text', text: 'Main Menu' },
 *   body:    'How can we help you today?',
 *   footer:  'Tap a button to continue',
 *   buttons: [
 *     { id: 'support',    title: '🛠 Support'    },
 *     { id: 'sales',      title: '💰 Sales'       },
 *     { id: 'my_order',   title: '📦 My Order'    },
 *   ],
 * });
 *
 * // 2. Send a list menu
 * await sendListMenu(sock, jid, {
 *   header:     'Choose Department',
 *   body:       'Select the team you need.',
 *   buttonText: 'Open Menu',
 *   sections: [
 *     {
 *       title: 'Support',
 *       rows:  [
 *         { id: 'tech',    title: 'Technical Support', description: 'Bugs & crashes'    },
 *         { id: 'billing', title: 'Billing',           description: 'Payments & invoices' },
 *       ],
 *     },
 *   ],
 * });
 *
 * // 3. Send a carousel
 * await sendCarousel(sock, jid, [
 *   {
 *     body:    '*Widget Pro*\nHigh performance widget',
 *     footer:  '$29.99',
 *     media:   { buffer: imageBuffer, type: 'image' },
 *     buttons: [
 *       { kind: 'quick_reply', id: 'buy_wp',  title: '🛒 Buy Now'  },
 *       { kind: 'cta_url',     displayText: 'Details', url: 'https://...' },
 *     ],
 *   },
 * ]);
 *
 * // 4. Handle responses
 * const stopListening = onInteractiveResponse(sock, async (resp) => {
 *   console.log(`User ${resp.user} → type: ${resp.type}, id: ${resp.id}`);
 * });
 *
 * // 5. Route actions
 * const router = createActionRouter({
 *   actions: {
 *     support:  (r) => sendSupportOptions(sock, r.jid),
 *     sales:    (r) => sendWelcomeMenu(sock, r.jid, { businessName: 'Sales Dept' }),
 *     my_order: (r) => sendOrderStatus(sock, r.jid, { orderId: '123', status: 'Shipped' }),
 *   },
 *   fallback: (r) => sock.sendMessage(r.jid, { text: "Sorry, didn't get that — try again?" }),
 * });
 * onInteractiveResponse(sock, (resp) => router.dispatch(resp));
 */

// ─── Utilities ────────────────────────────────────────────────────────────────
export {
  normalizeJid,
  assertConnected,
  newMessageId,
  retryAsync,
  sleep,
  simulateTyping,
  humanDelay,
  RateLimiter,
  rateLimiter,
  validateLength,
  validateButtonCount,
  buildSendContext,
} from './utils';
export type { RetryOptions, RateLimiterConfig, SendContext } from './utils';

// ─── Buttons ──────────────────────────────────────────────────────────────────
export {
  buildQuickReplyButton,
  buildCtaUrlButton,
  sendButtons,
  sendCtaButtons,
  sendMixedButtons,
} from './buttons';
export type {
  QuickReplyButton,
  CtaUrlButton,
  ButtonHeader,
  SendButtonsOptions,
  SendCtaButtonsOptions,
  SendMixedButtonsOptions,
  SendResult,
} from './buttons';

// ─── Lists ────────────────────────────────────────────────────────────────────
export {
  buildSingleSelectButton,
  sendListMenu,
  paginateListItems,
  sendPaginatedList,
} from './lists';
export type {
  ListRow,
  ListSection,
  SendListMenuOptions,
  SendPaginatedListOptions,
} from './lists';

// ─── Carousel ─────────────────────────────────────────────────────────────────
export {
  sendCarousel,
  buildProductCards,
  sendProductCarousel,
} from './carousel';
export type {
  CardButtonSpec,
  CarouselCard,
  ProductCard,
} from './carousel';

// ─── Responses ────────────────────────────────────────────────────────────────
export {
  RESPONSE_TYPES,
  handleInteractiveResponse,
  onInteractiveResponse,
  createActionRouter,
} from './responses';
export type {
  ResponseType,
  ParsedInteractiveResponse,
  ActionHandler,
  RouterConfig,
} from './responses';

// ─── Templates & Menu Navigation ─────────────────────────────────────────────
export {
  // Config builders
  buildButtons,
  buildList,
  buildCarousel,
  sendBuilt,
  // Session
  SessionStore,
  sessionStore,
  // Menu navigation
  navigateTo,
  handleMenuResponse,
  // Business templates
  sendWelcomeMenu,
  sendOrderStatus,
  sendFeedbackRequest,
  sendAppointmentPicker,
  sendProductShowcase,
  sendReEngagement,
  sendSupportOptions,
  sendPaymentConfirmation,
} from './templates';
export type {
  ButtonsConfig,
  ListConfig,
  CarouselConfig,
  BuiltConfig,
  UserSession,
  MenuNode,
} from './templates';

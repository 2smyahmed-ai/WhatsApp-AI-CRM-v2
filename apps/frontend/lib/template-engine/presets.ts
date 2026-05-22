import type { CanonicalTemplate } from './schema'

// ── Production-ready canonical presets ───────────────────────────────────────
// Every preset here:
//   ✅ compiles to valid Meta components via toMetaComponents()
//   ✅ previews via toRenderable()
//   ✅ Baileys gracefully downgrades via toBaileysPayload()
//   ✅ follows all Meta button/variable/character limits
//   ✅ ready for Meta approval submission

export interface PresetGroup {
  category: string
  color: string
  templates: CanonicalTemplate[]
}

const PRESETS: PresetGroup[] = [
  {
    category: 'Welcome',
    color: 'emerald',
    templates: [
      {
        name: 'Welcome Friendly',
        category: 'MARKETING',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}! 👋 Welcome to *{{business_name}}*.\n\nWe\'re thrilled to have you. How can we help you today?',
        },
        buttons: [
          { type: 'QUICK_REPLY', text: '🛍️ Browse Products' },
          { type: 'QUICK_REPLY', text: '💬 Talk to Sales' },
          { type: 'QUICK_REPLY', text: '❓ Get Support' },
        ],
        _meta: {
          variableNames: ['name', 'business_name'],
          description: 'Warm greeting for new contacts with quick-reply options',
          previewValues: { name: 'Ahmed', business_name: 'Acme Store' },
        },
      },
      {
        name: 'Onboarding Welcome',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '🎊 Welcome to {{product_name}}' },
        body: {
          text: 'Hi {{name}}, your account is ready!\n\nHere\'s how to get started:\n\n1️⃣ Complete your profile\n2️⃣ Connect your first channel\n3️⃣ Invite your team\n\nNeed help? We\'re always here.',
        },
        buttons: [
          { type: 'URL', text: '🚀 Get Started', url: '{{login_url}}' },
        ],
        _meta: {
          variableNames: ['product_name', 'name', 'login_url'],
          description: 'Post sign-up onboarding with a get-started CTA button',
          previewValues: { product_name: 'MyApp', name: 'Ahmed', login_url: 'https://app.example.com' },
        },
      },
    ],
  },
  {
    category: 'E-commerce',
    color: 'sky',
    templates: [
      {
        name: 'Order Confirmed',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '✅ Order #{{order_id}} Confirmed' },
        body: {
          text: 'Hi {{name}}, thank you for your purchase!\n\n📦 Order: *#{{order_id}}*\n💳 Total: *{{total}}*\n🚚 Est. delivery: *{{delivery_date}}*\n\nWe\'ll notify you as soon as it ships.',
        },
        footer: { text: 'Reply STOP to unsubscribe.' },
        buttons: [
          { type: 'URL', text: '📍 Track Order', url: '{{tracking_url}}' },
        ],
        _meta: {
          variableNames: ['order_id', 'name', 'total', 'delivery_date', 'tracking_url'],
          description: 'Transactional order confirmation with tracking CTA',
          previewValues: {
            order_id: '1234', name: 'Ahmed', total: '$89.99',
            delivery_date: 'May 22', tracking_url: 'https://track.example.com/1234',
          },
        },
      },
      {
        name: 'Order Shipped',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '🚚 Your Order Is On Its Way!' },
        body: {
          text: 'Hi {{name}}!\n\n📦 Order: *#{{order_id}}*\n🏢 Courier: *{{courier}}*\n🔍 Tracking no: *{{tracking_number}}*\n\nClick below to track your delivery in real time.',
        },
        buttons: [
          { type: 'URL', text: '📍 Track Shipment', url: '{{tracking_url}}' },
        ],
        _meta: {
          variableNames: ['name', 'order_id', 'courier', 'tracking_number', 'tracking_url'],
          description: 'Dispatch notification with courier and live tracking button',
          previewValues: {
            name: 'Ahmed', order_id: '1234', courier: 'FedEx',
            tracking_number: 'FX-9988', tracking_url: 'https://track.example.com',
          },
        },
      },
      {
        name: 'Abandoned Cart',
        category: 'MARKETING',
        language: 'en_US',
        body: {
          text: 'Hey {{name}}! 🛒 You left something behind.\n\nYour cart is still waiting:\n📌 *{{product}}*\n💰 Cart total: *{{cart_value}}*\n\nComplete your purchase now — items may sell out!',
        },
        buttons: [
          { type: 'URL', text: '✅ Complete Purchase', url: '{{checkout_url}}' },
          { type: 'QUICK_REPLY', text: 'Need Help?' },
        ],
        _meta: {
          variableNames: ['name', 'product', 'cart_value', 'checkout_url'],
          description: 'Recover lost sales with a cart reminder and checkout button',
          previewValues: {
            name: 'Ahmed', product: 'Blue T-Shirt', cart_value: '$45.00',
            checkout_url: 'https://store.example.com/cart',
          },
        },
      },
      {
        name: 'Payment Failed',
        category: 'UTILITY',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}, we couldn\'t process the payment for order *#{{order_id}}*.\n\nPlease update your payment details to avoid delays.',
        },
        buttons: [
          { type: 'URL', text: '💳 Update Payment', url: '{{payment_url}}' },
          { type: 'QUICK_REPLY', text: 'Contact Support' },
        ],
        _meta: {
          variableNames: ['name', 'order_id', 'payment_url'],
          description: 'Alert customer of failed payment with a direct payment link',
          previewValues: { name: 'Ahmed', order_id: '1234', payment_url: 'https://pay.example.com' },
        },
      },
    ],
  },
  {
    category: 'Appointments',
    color: 'violet',
    templates: [
      {
        name: 'Appointment Reminder',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '📅 Appointment Reminder' },
        body: {
          text: 'Hi {{name}},\n\n🗓️ Service: *{{service}}*\n📅 Date: *{{date}}*\n🕐 Time: *{{time}}*\n📍 Location: *{{location}}*\n\nPlease confirm your attendance below.',
        },
        buttons: [
          { type: 'QUICK_REPLY', text: '✅ Confirm' },
          { type: 'QUICK_REPLY', text: '🔄 Reschedule' },
          { type: 'QUICK_REPLY', text: '❌ Cancel' },
        ],
        _meta: {
          variableNames: ['name', 'service', 'date', 'time', 'location'],
          description: '24h reminder with confirm, reschedule, and cancel quick-replies',
          previewValues: {
            name: 'Ahmed', service: 'Dental Checkup',
            date: 'Monday, May 20', time: '2:00 PM', location: 'Downtown Clinic',
          },
        },
      },
      {
        name: 'Booking Confirmed',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '🎉 Booking Confirmed!' },
        body: {
          text: 'Hi {{name}}, your appointment has been booked.\n\n🗓️ Service: *{{service}}*\n📅 Date: *{{date}}*\n🕐 Time: *{{time}}*\n🔖 Reference: *{{reference}}*\n\nWe look forward to seeing you!',
        },
        footer: { text: 'Save this message for your records.' },
        _meta: {
          variableNames: ['name', 'service', 'date', 'time', 'reference'],
          description: 'Instant booking confirmation with reference number',
          previewValues: {
            name: 'Ahmed', service: 'Haircut', date: 'May 20', time: '3:00 PM', reference: 'BK-4521',
          },
        },
      },
    ],
  },
  {
    category: 'Support',
    color: 'amber',
    templates: [
      {
        name: 'Support Welcome',
        category: 'UTILITY',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}! 👋 Welcome to *Support*.\n\nHow can we help you today? Choose an option below or type your question — an agent will assist you shortly.',
        },
        buttons: [
          { type: 'QUICK_REPLY', text: '📦 Track My Order' },
          { type: 'QUICK_REPLY', text: '↩️ Return / Refund' },
          { type: 'QUICK_REPLY', text: '🧑 Talk to Agent' },
        ],
        _meta: {
          variableNames: ['name'],
          description: 'Greet new support conversations with FAQ quick-reply shortcuts',
          previewValues: { name: 'Ahmed' },
        },
      },
      {
        name: 'Ticket Opened',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '🎫 Support Ticket #{{ticket_id}} Opened' },
        body: {
          text: 'Hi {{name}}, we\'ve received your request.\n\n🔖 Ticket: *#{{ticket_id}}*\n📝 Issue: {{issue_summary}}\n\n⏱️ Expected response: within 24 hours.\n\nWe\'ll keep you updated right here.',
        },
        _meta: {
          variableNames: ['ticket_id', 'name', 'issue_summary'],
          description: 'Acknowledge a support request with a ticket number',
          previewValues: { ticket_id: '5501', name: 'Ahmed', issue_summary: 'Order not received' },
        },
      },
      {
        name: 'Ticket Resolved',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '✅ Ticket #{{ticket_id}} Resolved' },
        body: {
          text: 'Hi {{name}}, your issue has been resolved.\n\nWe hope everything is working well! If the issue persists, just reply here.\n\nHow did we do?',
        },
        buttons: [
          { type: 'QUICK_REPLY', text: '⭐ Rate Support' },
          { type: 'QUICK_REPLY', text: '❓ Still Need Help' },
        ],
        _meta: {
          variableNames: ['ticket_id', 'name'],
          description: 'Close a ticket and collect satisfaction feedback',
          previewValues: { ticket_id: '5501', name: 'Ahmed' },
        },
      },
    ],
  },
  {
    category: 'Sales',
    color: 'rose',
    templates: [
      {
        name: 'Flash Sale Offer',
        category: 'MARKETING',
        language: 'en_US',
        header: { type: 'TEXT', text: '🔥 Flash Sale — {{discount}}% Off Today!' },
        body: {
          text: 'Hi {{name}}!\n\nUse code *{{code}}* at checkout.\n\n⏰ Offer expires: *{{expiry}}*\n\nDon\'t miss out — grab it before it\'s gone!',
        },
        footer: { text: 'Reply STOP to unsubscribe.' },
        buttons: [
          { type: 'URL', text: '🛍️ Shop Now', url: '{{shop_url}}' },
          { type: 'QUICK_REPLY', text: 'Tell Me More' },
        ],
        _meta: {
          variableNames: ['discount', 'name', 'code', 'expiry', 'shop_url'],
          description: 'Time-limited discount with urgency header and redemption code',
          previewValues: {
            discount: '30', name: 'Ahmed', code: 'FLASH30',
            expiry: 'Tonight 11:59 PM', shop_url: 'https://store.example.com/sale',
          },
        },
      },
      {
        name: 'Win-Back Offer',
        category: 'MARKETING',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}, we miss you! 💙\n\nIt\'s been a while since your last visit. As a valued customer, we\'d love to welcome you back with *{{discount}}% off* your next purchase.\n\n🎟️ Code: *{{code}}*\n📅 Valid for *{{days}} days* only.',
        },
        buttons: [
          { type: 'QUICK_REPLY', text: 'Claim Offer 🎁' },
          { type: 'QUICK_REPLY', text: 'No Thanks' },
        ],
        _meta: {
          variableNames: ['name', 'discount', 'code', 'days'],
          description: 'Re-engage inactive customers with a personalised discount',
          previewValues: { name: 'Ahmed', discount: '20', code: 'BACK20', days: '7' },
        },
      },
    ],
  },
  {
    category: 'Follow-up',
    color: 'orange',
    templates: [
      {
        name: 'Feedback Request',
        category: 'MARKETING',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}! 🌟 How was your experience?\n\nWe hope you\'re enjoying *{{product_or_service}}*!\n\nYour feedback helps us improve. Would you mind leaving a quick rating?',
        },
        buttons: [
          { type: 'QUICK_REPLY', text: '😍 Excellent' },
          { type: 'QUICK_REPLY', text: '🙂 Good' },
          { type: 'QUICK_REPLY', text: '😕 Could Be Better' },
        ],
        _meta: {
          variableNames: ['name', 'product_or_service'],
          description: 'Collect a satisfaction rating after purchase or service',
          previewValues: { name: 'Ahmed', product_or_service: 'Blue T-Shirt' },
        },
      },
      {
        name: 'No Reply Follow-up',
        category: 'MARKETING',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}, just checking in! 👋\n\nWe sent you a message a few days ago — did you get a chance to review it?\n\nIf you have any questions, we\'re happy to help. Just reply here!',
        },
        _meta: {
          variableNames: ['name'],
          description: 'Gentle nudge for contacts who haven\'t responded',
          previewValues: { name: 'Ahmed' },
        },
      },
      {
        name: 'Subscription Renewal',
        category: 'UTILITY',
        language: 'en_US',
        header: { type: 'TEXT', text: '🔔 {{service}} Renewal Coming Up' },
        body: {
          text: 'Hi {{name}},\n\nYour *{{service}}* subscription renews on *{{renewal_date}}*.\n\nUpdate your payment details or manage your subscription below.',
        },
        buttons: [
          { type: 'URL', text: '💳 Manage Billing', url: '{{billing_url}}' },
          { type: 'QUICK_REPLY', text: 'Cancel Subscription' },
        ],
        _meta: {
          variableNames: ['service', 'name', 'renewal_date', 'billing_url'],
          description: 'Notify customers of an upcoming subscription renewal',
          previewValues: {
            service: 'Pro Plan', name: 'Ahmed',
            renewal_date: 'June 1, 2025', billing_url: 'https://billing.example.com',
          },
        },
      },
    ],
  },
]

export default PRESETS

import type { CanonicalTemplate } from './schema'

// ── WhatsApp-native preset templates ─────────────────────────────────────────
// Every preset is a plain text message that Baileys sends 100% reliably.
// Links are written inline so they arrive as tappable URLs. Variables use the
// {{name}} syntax and are filled per-contact when sending.

export interface PresetGroup {
  category: string
  color: string
  templates: CanonicalTemplate[]
}

const PRESETS: PresetGroup[] = [
  {
    category: 'Onboarding',
    color: 'emerald',
    templates: [
      {
        name: 'Welcome Friendly',
        category: 'ONBOARDING',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}! 👋 Welcome to *{{business_name}}*.\n\nWe\'re thrilled to have you. Reply here anytime — we\'re happy to help! 💬',
        },
        _meta: {
          variableNames: ['name', 'business_name'],
          description: 'Warm greeting for new contacts',
          previewValues: { name: 'Ahmed', business_name: 'Acme Store' },
        },
      },
      {
        name: 'Onboarding Welcome',
        category: 'ONBOARDING',
        language: 'en_US',
        body: {
          text: '🎊 *Welcome to {{product_name}}*\n\nHi {{name}}, your account is ready!\n\nHere\'s how to get started:\n\n1️⃣ Complete your profile\n2️⃣ Connect your first channel\n3️⃣ Invite your team\n\n🚀 Get started: {{login_url}}',
        },
        _meta: {
          variableNames: ['product_name', 'name', 'login_url'],
          description: 'Post sign-up onboarding with a get-started link',
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
        category: 'ECOMMERCE',
        language: 'en_US',
        body: {
          text: '✅ *Order #{{order_id}} Confirmed*\n\nHi {{name}}, thank you for your purchase!\n\n📦 Order: *#{{order_id}}*\n💳 Total: *{{total}}*\n🚚 Est. delivery: *{{delivery_date}}*\n\n📍 Track your order: {{tracking_url}}',
        },
        _meta: {
          variableNames: ['order_id', 'name', 'total', 'delivery_date', 'tracking_url'],
          description: 'Transactional order confirmation with a tracking link',
          previewValues: {
            order_id: '1234', name: 'Ahmed', total: '$89.99',
            delivery_date: 'May 22', tracking_url: 'https://track.example.com/1234',
          },
        },
      },
      {
        name: 'Order Shipped',
        category: 'ECOMMERCE',
        language: 'en_US',
        body: {
          text: '🚚 *Your Order Is On Its Way!*\n\nHi {{name}}!\n\n📦 Order: *#{{order_id}}*\n🏢 Courier: *{{courier}}*\n🔍 Tracking no: *{{tracking_number}}*\n\n📍 Track your delivery: {{tracking_url}}',
        },
        _meta: {
          variableNames: ['name', 'order_id', 'courier', 'tracking_number', 'tracking_url'],
          description: 'Dispatch notification with live tracking link',
          previewValues: {
            name: 'Ahmed', order_id: '1234', courier: 'FedEx',
            tracking_number: 'FX-9988', tracking_url: 'https://track.example.com',
          },
        },
      },
      {
        name: 'Abandoned Cart',
        category: 'ECOMMERCE',
        language: 'en_US',
        body: {
          text: 'Hey {{name}}! 🛒 You left something behind.\n\nYour cart is still waiting:\n📌 *{{product}}*\n💰 Cart total: *{{cart_value}}*\n\nComplete your purchase now — items may sell out!\n\n✅ Checkout here: {{checkout_url}}',
        },
        _meta: {
          variableNames: ['name', 'product', 'cart_value', 'checkout_url'],
          description: 'Recover lost sales with a cart reminder and checkout link',
          previewValues: {
            name: 'Ahmed', product: 'Blue T-Shirt', cart_value: '$45.00',
            checkout_url: 'https://store.example.com/cart',
          },
        },
      },
      {
        name: 'Payment Failed',
        category: 'ECOMMERCE',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}, we couldn\'t process the payment for order *#{{order_id}}*.\n\nPlease update your payment details to avoid delays.\n\n💳 Update payment: {{payment_url}}',
        },
        _meta: {
          variableNames: ['name', 'order_id', 'payment_url'],
          description: 'Alert customer of failed payment with a direct link',
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
        category: 'APPOINTMENTS',
        language: 'en_US',
        body: {
          text: '📅 *Appointment Reminder*\n\nHi {{name}},\n\n🗓️ Service: *{{service}}*\n📅 Date: *{{date}}*\n🕐 Time: *{{time}}*\n📍 Location: *{{location}}*\n\nReply *CONFIRM* to confirm, or *RESCHEDULE* if the time no longer works.',
        },
        _meta: {
          variableNames: ['name', 'service', 'date', 'time', 'location'],
          description: '24h reminder — customer replies to confirm or reschedule',
          previewValues: {
            name: 'Ahmed', service: 'Dental Checkup',
            date: 'Monday, May 20', time: '2:00 PM', location: 'Downtown Clinic',
          },
        },
      },
      {
        name: 'Booking Confirmed',
        category: 'APPOINTMENTS',
        language: 'en_US',
        body: {
          text: '🎉 *Booking Confirmed!*\n\nHi {{name}}, your appointment has been booked.\n\n🗓️ Service: *{{service}}*\n📅 Date: *{{date}}*\n🕐 Time: *{{time}}*\n🔖 Reference: *{{reference}}*\n\nWe look forward to seeing you!\n\n_Save this message for your records._',
        },
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
        category: 'SUPPORT',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}! 👋 Welcome to *Support*.\n\nHow can we help you today? Just type your question and an agent will assist you shortly. 💬',
        },
        _meta: {
          variableNames: ['name'],
          description: 'Greet new support conversations',
          previewValues: { name: 'Ahmed' },
        },
      },
      {
        name: 'Ticket Opened',
        category: 'SUPPORT',
        language: 'en_US',
        body: {
          text: '🎫 *Support Ticket #{{ticket_id}} Opened*\n\nHi {{name}}, we\'ve received your request.\n\n🔖 Ticket: *#{{ticket_id}}*\n📝 Issue: {{issue_summary}}\n\n⏱️ Expected response: within 24 hours.\n\nWe\'ll keep you updated right here.',
        },
        _meta: {
          variableNames: ['ticket_id', 'name', 'issue_summary'],
          description: 'Acknowledge a support request with a ticket number',
          previewValues: { ticket_id: '5501', name: 'Ahmed', issue_summary: 'Order not received' },
        },
      },
      {
        name: 'Ticket Resolved',
        category: 'SUPPORT',
        language: 'en_US',
        body: {
          text: '✅ *Ticket #{{ticket_id}} Resolved*\n\nHi {{name}}, your issue has been resolved.\n\nWe hope everything is working well! If the issue persists, just reply here and we\'ll jump back in. 🙌',
        },
        _meta: {
          variableNames: ['ticket_id', 'name'],
          description: 'Close a ticket and invite follow-up',
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
        category: 'SALES',
        language: 'en_US',
        body: {
          text: '🔥 *Flash Sale — {{discount}}% Off Today!*\n\nHi {{name}}!\n\nUse code *{{code}}* at checkout.\n\n⏰ Offer expires: *{{expiry}}*\n\n🛍️ Shop now: {{shop_url}}\n\n_Reply STOP to unsubscribe._',
        },
        _meta: {
          variableNames: ['discount', 'name', 'code', 'expiry', 'shop_url'],
          description: 'Time-limited discount with urgency and redemption code',
          previewValues: {
            discount: '30', name: 'Ahmed', code: 'FLASH30',
            expiry: 'Tonight 11:59 PM', shop_url: 'https://store.example.com/sale',
          },
        },
      },
      {
        name: 'Win-Back Offer',
        category: 'SALES',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}, we miss you! 💙\n\nIt\'s been a while since your last visit. As a valued customer, we\'d love to welcome you back with *{{discount}}% off* your next purchase.\n\n🎟️ Code: *{{code}}*\n📅 Valid for *{{days}} days* only.',
        },
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
        category: 'FOLLOW_UP',
        language: 'en_US',
        body: {
          text: 'Hi {{name}}! 🌟 How was your experience?\n\nWe hope you\'re enjoying *{{product_or_service}}*!\n\nYour feedback helps us improve. Just reply with a rating from 1 to 5 ⭐',
        },
        _meta: {
          variableNames: ['name', 'product_or_service'],
          description: 'Collect a satisfaction rating after purchase or service',
          previewValues: { name: 'Ahmed', product_or_service: 'Blue T-Shirt' },
        },
      },
      {
        name: 'No Reply Follow-up',
        category: 'FOLLOW_UP',
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
        category: 'FOLLOW_UP',
        language: 'en_US',
        body: {
          text: '🔔 *{{service}} Renewal Coming Up*\n\nHi {{name}},\n\nYour *{{service}}* subscription renews on *{{renewal_date}}*.\n\n💳 Manage your billing: {{billing_url}}',
        },
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

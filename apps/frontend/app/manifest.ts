import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/dashboard',
    name: 'Nexus CRM — WhatsApp Business Platform',
    short_name: 'Nexus CRM',
    description:
      'Manage WhatsApp conversations, automate campaigns, and grow your business — all from one powerful platform.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',
    background_color: '#0a0f1e',
    theme_color: '#25D366',
    categories: ['business', 'productivity', 'communication'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Conversations',
        short_name: 'Chats',
        url: '/dashboard/conversations',
        description: 'Open your WhatsApp conversations',
      },
      {
        name: 'Contacts',
        short_name: 'Contacts',
        url: '/dashboard/contacts',
        description: 'Manage your contacts',
      },
      {
        name: 'Broadcasts',
        short_name: 'Campaigns',
        url: '/dashboard/broadcasts',
        description: 'Send bulk campaigns',
      },
    ],
  };
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nexus CRM — WhatsApp Business Platform',
    short_name: 'Nexus CRM',
    description:
      'Manage WhatsApp conversations, automate campaigns, and grow your business — all from one powerful platform.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#0a0f1e',
    theme_color: '#25D366',
    categories: ['business', 'productivity', 'communication'],
    icons: [
      {
        src: '/icons/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: '/icons/icon-maskable.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
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

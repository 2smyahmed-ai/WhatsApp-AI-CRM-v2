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
    // Matches the splash canvas (#0d1f16 → #05080c family) so the OS launch
    // frame blends seamlessly into the in-app splash — no color flash.
    background_color: '#081511',
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
        url: '/conversations',
        description: 'Open your WhatsApp conversations',
      },
      {
        name: 'Contacts',
        short_name: 'Contacts',
        url: '/contacts',
        description: 'Manage your contacts',
      },
      {
        name: 'Broadcasts',
        short_name: 'Campaigns',
        url: '/broadcasts',
        description: 'Send bulk campaigns',
      },
    ],
  };
}

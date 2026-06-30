/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@crm/messaging-schema'],
  async headers() {
    return [
      {
        // Service worker must not be cached, otherwise updates won't reach clients
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
      {
        // PWA manifest
        source: '/manifest.webmanifest',
        headers: [
          { key: 'Content-Type', value: 'application/manifest+json' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ]
  },
}

module.exports = nextConfig

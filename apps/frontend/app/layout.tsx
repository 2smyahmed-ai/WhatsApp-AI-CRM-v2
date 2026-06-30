import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { AuthProvider } from '@/components/providers/SessionProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { I18nProvider } from '@/components/providers/I18nProvider'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nexus CRM — WhatsApp Business Platform',
    template: '%s | Nexus CRM',
  },
  description:
    'Manage WhatsApp conversations, automate campaigns, and grow your business. Professional CRM built for WhatsApp at scale.',
  keywords: ['WhatsApp CRM', 'WhatsApp automation', 'business messaging', 'WhatsApp campaigns'],
  authors: [{ name: 'Nexus CRM' }],
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Nexus CRM — WhatsApp Business Platform',
    description: 'Professional WhatsApp CRM for modern businesses',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexus CRM — WhatsApp Business Platform',
    description: 'Professional WhatsApp CRM for modern businesses',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Nexus CRM',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.svg', sizes: '180x180', type: 'image/svg+xml' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Nexus CRM',
    'application-name': 'Nexus CRM',
    'msapplication-TileColor': '#25D366',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#25D366' },
    { media: '(prefers-color-scheme: dark)', color: '#128C7E' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head />
      <body className="antialiased" suppressHydrationWarning>
        {/* Runs before React hydrates — prevents theme/RTL/PWA flash */}
        <Script id="bootstrap" src="/scripts/bootstrap.js" strategy="beforeInteractive" />
        {/* PWA service worker registration */}
        <Script id="register-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .catch(function (err) { console.warn('SW registration failed:', err); });
            });
          }
        `}</Script>
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

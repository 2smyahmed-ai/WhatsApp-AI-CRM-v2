import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { AuthProvider } from '@/components/providers/SessionProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { I18nProvider } from '@/components/providers/I18nProvider'
import SplashController from '@/components/pwa/SplashController'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nexus CRM — WhatsApp Business Platform',
    template: '%s | Nexus CRM',
  },
  description:
    'Turn WhatsApp conversations into revenue. The premium, AI-powered WhatsApp CRM for Saudi businesses — shared inbox, automation, broadcast campaigns, and analytics. Full Arabic & English support. حوّل محادثات واتساب إلى مبيعات حقيقية.',
  keywords: [
    'WhatsApp CRM', 'WhatsApp CRM Saudi Arabia', 'نظام واتساب', 'CRM واتساب',
    'WhatsApp automation', 'business messaging', 'WhatsApp campaigns', 'AI WhatsApp assistant',
  ],
  authors: [{ name: 'Nexus CRM' }],
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'Nexus CRM — WhatsApp Business Platform for Saudi Arabia',
    description: 'Turn WhatsApp conversations into revenue. AI-powered, bilingual (Arabic & English) WhatsApp CRM for Saudi businesses.',
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['ar_SA'],
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
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
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
  // Extend under the notch / home indicator so env(safe-area-*) padding engages.
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head />
      <body className="antialiased" suppressHydrationWarning>
        {/* Runs before React hydrates — prevents theme/RTL/PWA flash */}
        <Script id="bootstrap" src="/scripts/bootstrap.js" strategy="beforeInteractive" />

        {/* Native launch screen — visible only in the installed (standalone) app,
            painted in the initial HTML so there's no white flash on cold start.
            SplashController fades it out once the app is interactive. Swap the
            <img> src for your logo PNG once provided. */}
        <div id="app-splash" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/logo-tight.png" alt="" className="app-splash__logo" />
          <div className="app-splash__wordmark">Nexus<span>CRM</span></div>
          <div className="app-splash__dots"><i /><i /><i /></div>
        </div>
        <SplashController />
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

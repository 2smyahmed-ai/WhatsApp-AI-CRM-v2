import type { Metadata } from 'next'
import Script from 'next/script'
import { AuthProvider } from '@/components/providers/SessionProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { I18nProvider } from '@/components/providers/I18nProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'WhatsApp CRM',
  description: 'WhatsApp CRM — Manage conversations, contacts, and deals',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head />
      <body className="antialiased" suppressHydrationWarning>
        {/* Runs before React hydrates — prevents theme/RTL flash */}
        <Script id="bootstrap" src="/scripts/bootstrap.js" strategy="beforeInteractive" />
        <ThemeProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

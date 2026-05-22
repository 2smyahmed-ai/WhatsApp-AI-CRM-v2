import type { Metadata } from 'next'
import { AuthProvider } from '@/components/providers/SessionProvider'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import './globals.css'

export const metadata: Metadata = {
  title: 'WhatsApp CRM',
  description: 'WhatsApp CRM — Manage conversations, contacts, and deals',
}

// Runs synchronously before React hydrates to prevent theme flash.
const themeScript = `
  try {
    var t = localStorage.getItem('crm-theme');
    var sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    if ((t || sys) === 'dark') document.documentElement.classList.add('dark');
  } catch(e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

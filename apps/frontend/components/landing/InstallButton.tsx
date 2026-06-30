'use client'

import { useState, useEffect } from 'react'
import { Download, Smartphone, Monitor, Apple } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Platform = 'android' | 'ios' | 'desktop' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

interface InstallButtonProps {
  variant?: 'hero' | 'section'
  className?: string
  /** Override the dynamic button text (for i18n) */
  label?: string
  /** Override the "App Installed" text (for i18n) */
  installedLabel?: string
}

export function InstallButton({ variant = 'hero', className = '', label, installedLabel }: InstallButtonProps) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [platform, setPlatform] = useState<Platform>('unknown')
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    setPlatform(detectPlatform())

    // Detect if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
    }

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setIsInstalled(true))

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (platform === 'ios') {
      setShowIOSGuide(true)
      return
    }
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') setIsInstalled(true)
    setInstallPrompt(null)
  }

  if (isInstalled) {
    return (
      <span className={`inline-flex items-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-2.5 text-sm font-semibold text-[#5cf0a0] ${className}`}>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
        </svg>
        {installedLabel ?? 'App Installed'}
      </span>
    )
  }

  // Premium surfaces per placement
  const surface =
    variant === 'hero'
      ? 'lux-glass border border-white/15 text-white hover:border-[#d4af37]/45 hover:shadow-[0_18px_48px_-14px_rgba(212,175,55,0.40)]'
      : 'lux-btn-primary text-white'
  const chip =
    variant === 'hero'
      ? 'bg-gradient-to-br from-[#2ee676] to-[#0f9b6c] text-white shadow-md shadow-emerald-900/40'
      : 'bg-white/20 text-white'

  const sizing = variant === 'hero' ? 'px-7 py-3.5 text-base' : 'px-5 py-3 text-sm'
  const PlatformIcon = platform === 'ios' ? Apple : platform === 'android' ? Smartphone : Monitor

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className={`group relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-xl font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${sizing} ${surface} ${className}`}
      >
        <span className="lux-sheen" />
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${chip}`}>
          <Download className="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" />
        </span>
        <span className="relative">
          {label ??
            (platform === 'ios'
              ? 'Add to Home Screen'
              : platform === 'android'
              ? 'Install Android App'
              : installPrompt
              ? 'Install Desktop App'
              : 'Get the App')}
        </span>
        <PlatformIcon className="relative h-4 w-4 opacity-60" />
      </button>

      {/* iOS instruction modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setShowIOSGuide(false)}
        >
          <div
            className="w-full max-w-sm bg-[#0f1a2e] border border-white/10 rounded-2xl p-6 mb-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
                <Apple className="w-5 h-5 text-[#25D366]" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Add to Home Screen</p>
                <p className="text-xs text-white/50">iOS Safari instructions</p>
              </div>
            </div>
            <ol className="space-y-3 text-sm text-white/70">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#25D366]/20 text-[#25D366] text-xs flex items-center justify-center font-bold">1</span>
                Tap the <strong className="text-white">Share</strong> button at the bottom of Safari
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#25D366]/20 text-[#25D366] text-xs flex items-center justify-center font-bold">2</span>
                Scroll down and tap <strong className="text-white">Add to Home Screen</strong>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#25D366]/20 text-[#25D366] text-xs flex items-center justify-center font-bold">3</span>
                Tap <strong className="text-white">Add</strong> in the top-right corner
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-[#25D366] text-white font-semibold text-sm hover:bg-[#1db954] transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}

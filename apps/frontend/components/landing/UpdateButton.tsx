'use client'

import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

export function UpdateButton() {
  const [available, setAvailable] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ((window as any).__swUpdateAvailable) setAvailable(true)
    const handler = () => setAvailable(true)
    window.addEventListener('sw-update-available', handler)
    return () => window.removeEventListener('sw-update-available', handler)
  }, [])

  if (!available) return null

  return (
    <button
      type="button"
      onClick={() => (window as any).__applySWUpdate?.()}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#d4af37]/40 bg-gradient-to-br from-[#d4af37]/15 to-[#d4af37]/5 px-5 py-3 text-sm font-bold text-[#f3d98b] shadow-lg shadow-black/30 backdrop-blur-sm transition-all duration-200 hover:border-[#d4af37]/70 hover:brightness-110 active:scale-95 sm:w-auto"
    >
      <RefreshCw className="h-4 w-4 animate-spin" />
      Update Available — Tap to Reload
    </button>
  )
}

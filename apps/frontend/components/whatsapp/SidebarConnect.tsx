'use client';

/**
 * SidebarConnect — live WhatsApp connection in the sidebar footer.
 *
 * When connected it's a calm status line. When it isn't, the QR code renders
 * inline right here — the user scans it without opening anything or leaving the
 * page. The handshake and live QR refresh are handled by useWhatsAppConnect.
 */

import { useTranslation } from 'react-i18next';
import { RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { useWhatsAppConnect } from '../../hooks/useWhatsAppConnect';
import QRCodeDisplay from '../shared/QRCodeDisplay';

export default function SidebarConnect() {
  const { t } = useTranslation('common');
  // Enabled once we know we're not connected; the hook fetches status regardless.
  const { status, connectedPhone, qrCode, error, retry } = useWhatsAppConnect(true);

  // ── Connected / still resolving: a quiet status line ──────────────────────
  if (status === 'connected' || status === null) {
    return (
      <div className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#16A34A] opacity-70 dark:bg-[#25D366]" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#16A34A] dark:bg-[#25D366]" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-semibold text-gray-700 dark:text-[#e9edef]">
              {status === 'connected' ? t('sidebarConnect.connectedShort') : t('sidebarConnect.checking')}
            </p>
            {status === 'connected' && connectedPhone && (
              <p className="truncate font-mono text-[10px] text-gray-400 dark:text-[#8696A0]">{connectedPhone}</p>
            )}
          </div>
        </div>
        <Wifi className="h-4 w-4 shrink-0 text-[#16A34A] dark:text-[#25D366]" aria-hidden="true" />
      </div>
    );
  }

  // ── Disconnected / connecting: inline QR card ─────────────────────────────
  return (
    <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-2xl border border-[#128C7E]/25 bg-gradient-to-b from-[#128C7E] via-[#1aa06e] to-[#25D366] shadow-sm">
      {/* Header strip */}
      <div className="relative px-3 pt-2.5 pb-2">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
        <p className="text-[11px] font-bold leading-tight text-white">{t('sidebarConnect.title')}</p>
        <p className="mt-0.5 text-[10px] leading-snug text-white/85">{t('sidebarConnect.subtitle')}</p>
      </div>

      {/* QR panel */}
      <div className="px-2.5 pb-2.5">
        <div className="relative rounded-xl bg-white p-2 shadow-sm">
          {/* scanner corner brackets */}
          <span aria-hidden className="absolute left-1 top-1 h-3 w-3 rounded-tl-md border-l-2 border-t-2 border-[#25D366]" />
          <span aria-hidden className="absolute right-1 top-1 h-3 w-3 rounded-tr-md border-r-2 border-t-2 border-[#25D366]" />
          <span aria-hidden className="absolute bottom-1 left-1 h-3 w-3 rounded-bl-md border-b-2 border-l-2 border-[#25D366]" />
          <span aria-hidden className="absolute bottom-1 right-1 h-3 w-3 rounded-br-md border-b-2 border-r-2 border-[#25D366]" />

          {error ? (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 text-center">
              <WifiOff className="h-6 w-6 text-red-500" />
              <p className="px-2 text-[10px] font-medium text-gray-600">{t('sidebarConnect.error')}</p>
              <button
                type="button"
                onClick={retry}
                className="inline-flex items-center gap-1 rounded-lg bg-[#128C7E] px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-[#0f7a6e]"
              >
                <RefreshCw className="h-3 w-3" />
                {t('sidebarConnect.retry')}
              </button>
            </div>
          ) : qrCode ? (
            <div className="[&_img]:aspect-square [&_img]:h-auto [&_img]:w-full [&_img]:max-w-none">
              <QRCodeDisplay qrCode={qrCode} />
            </div>
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-lg bg-gray-50">
              <RefreshCw className="h-6 w-6 animate-spin text-[#25D366]" />
            </div>
          )}
        </div>

        <p className="mt-2 px-0.5 text-center text-[9px] leading-snug text-white/90">
          {t('sidebarConnect.inlineHint')}
        </p>
      </div>
    </div>
  );
}

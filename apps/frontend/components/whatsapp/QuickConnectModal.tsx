'use client';

/**
 * QuickConnectModal — connect a WhatsApp number without leaving the current page.
 *
 * Used by the global banner CTA. Opens straight onto a live QR and flips to a
 * success state the moment the socket reports `connected`. The connect handshake,
 * QR refresh and polling all live in useWhatsAppConnect (shared with the inline
 * sidebar connector).
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Smartphone, X, RefreshCw, ShieldCheck, CheckCircle2, WifiOff } from 'lucide-react';
import { Modal } from '../ui/modal';
import QRCodeDisplay from '../shared/QRCodeDisplay';
import { useWhatsAppConnect } from '../../hooks/useWhatsAppConnect';

interface QuickConnectModalProps {
  open: boolean;
  onClose: () => void;
}

export default function QuickConnectModal({ open, onClose }: QuickConnectModalProps) {
  const { t } = useTranslation('common');
  const { status, connectedPhone, qrCode, error, retry } = useWhatsAppConnect(open);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss shortly after a successful connect so the success state is seen.
  useEffect(() => {
    if (open && status === 'connected') {
      closeTimer.current = setTimeout(onClose, 1800);
      return () => { if (closeTimer.current) clearTimeout(closeTimer.current); };
    }
  }, [open, status, onClose]);

  const connected = status === 'connected';

  const steps = [
    t('sidebarConnect.steps.open'),
    t('sidebarConnect.steps.linked'),
    t('sidebarConnect.steps.scan'),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      aria-label={t('sidebarConnect.title')}
      className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-[#111B21]"
    >
      {/* ── Header — WhatsApp gradient ────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#128C7E] via-[#1aa06e] to-[#25D366] px-5 py-4">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/40" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/20 text-white ring-1 ring-white/25 backdrop-blur-sm">
            <Smartphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-white">{t('sidebarConnect.title')}</h2>
            <p className="truncate text-xs text-white/85">{t('sidebarConnect.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('sidebarConnect.close')}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="p-5">
        {connected ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center animate-fade-in">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-[#25D366]/15 text-[#16A34A] dark:text-[#25D366]">
              <CheckCircle2 className="h-9 w-9" />
            </span>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{t('sidebarConnect.connectedTitle')}</p>
            {connectedPhone && (
              <p className="font-mono text-sm text-gray-500 dark:text-[#8696A0]">{connectedPhone}</p>
            )}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-red-500/10 text-red-500">
              <WifiOff className="h-7 w-7" />
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">{t('sidebarConnect.error')}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[#128C7E] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#0f7a6e]"
            >
              <RefreshCw className="h-4 w-4" />
              {t('sidebarConnect.retry')}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* QR panel */}
            <div className="flex justify-center">
              <div className="relative rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10">
                {/* corner brackets for a scanner feel */}
                <span aria-hidden className="absolute left-1.5 top-1.5 h-4 w-4 rounded-tl-lg border-l-2 border-t-2 border-[#25D366]" />
                <span aria-hidden className="absolute right-1.5 top-1.5 h-4 w-4 rounded-tr-lg border-r-2 border-t-2 border-[#25D366]" />
                <span aria-hidden className="absolute bottom-1.5 left-1.5 h-4 w-4 rounded-bl-lg border-b-2 border-l-2 border-[#25D366]" />
                <span aria-hidden className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-br-lg border-b-2 border-r-2 border-[#25D366]" />
                {qrCode ? (
                  <div className="[&_img]:h-52 [&_img]:w-52 [&_img]:max-w-none">
                    <QRCodeDisplay qrCode={qrCode} />
                  </div>
                ) : (
                  <div className="grid h-52 w-52 place-items-center rounded-lg bg-gray-50 dark:bg-white/5">
                    <RefreshCw className="h-8 w-8 animate-spin text-[#25D366]" />
                  </div>
                )}
              </div>
            </div>

            {/* Steps */}
            <ol className="space-y-2.5">
              {steps.map((step, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#25D366]/12 text-xs font-bold text-[#16A34A] dark:text-[#25D366]">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-[#c8d2d7]">{step}</span>
                </li>
              ))}
            </ol>

            <div className="flex items-center justify-center gap-1.5 text-[11px] text-gray-400 dark:text-[#8696A0]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{t('sidebarConnect.secure')}</span>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { MessageCircle, Wifi, WifiOff, RotateCw, ShieldCheck, Flame, Zap, ChevronRight } from 'lucide-react';
import { useSessionStatus } from '../../hooks/useSessionStatus';

const CARD =
  'rounded-[20px] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.05)] overflow-hidden dark:bg-[#182229] dark:border-transparent dark:shadow-[0_4px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]';

function ProgressBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(Math.max(percent, 0), 100)}%` }}
      />
    </div>
  );
}

export default function SessionStatusWidget() {
  const { t, i18n } = useTranslation('dashboard');
  const { status, connectedPhone, session, isLoading } = useSessionStatus() as any;

  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-US';
  const connected = status === 'connected';

  // ── Status pill (top-right) ────────────────────────────────────────────────
  const statusPill = (() => {
    if (status === 'connecting') {
      return (
        <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <RotateCw className="h-3.5 w-3.5 animate-spin" />
          {t('session.connecting')}
        </span>
      );
    }
    if (connected) {
      return (
        <span className="flex items-center gap-1.5 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-3 py-1.5 text-xs font-semibold text-[#128C7E] dark:text-[#25D366]">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25D366]" />
          </span>
          {t('session.connected')}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
        <WifiOff className="h-3.5 w-3.5" />
        {t('session.disconnected')}
      </span>
    );
  })();

  const warmup = session?.warmup;
  const dailyPercent = warmup?.dailyLimit ? (warmup.dailySent / warmup.dailyLimit) * 100 : 0;
  const warmupPercent = session ? (session.dayNumber / 15) * 100 : 0;
  const dailyColor = dailyPercent <= 60 ? 'bg-[#25D366]' : dailyPercent <= 85 ? 'bg-amber-400' : 'bg-red-500';

  return (
    <div className={CARD}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#25D366]/10 text-[#128C7E] dark:text-[#25D366]">
            <MessageCircle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {t('session.title')}
            </h3>
            <p className="truncate text-xs text-gray-500 dark:text-[#8696A0]">
              {connected && connectedPhone
                ? connectedPhone
                : connected
                  ? t('session.loadingHint')
                  : status === 'connecting'
                    ? t('session.connectingHint')
                    : t('session.disconnectedHint')}
            </p>
          </div>
        </div>
        {statusPill}
      </div>

      <div className="h-px bg-gray-100/80 dark:bg-white/8" />

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="space-y-4 px-5 py-4">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-1/3 rounded bg-gray-200 dark:bg-white/8" />
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-white/8" />
            <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-white/8" />
          </div>
        ) : !session ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5 py-1 text-sm text-gray-600 dark:text-gray-400">
              {connected ? (
                <Wifi className="h-4 w-4 shrink-0 text-[#25D366]" />
              ) : (
                <WifiOff className="h-4 w-4 shrink-0 text-gray-400" />
              )}
              <span>
                {connected
                  ? t('session.loadingHint')
                  : status === 'connecting'
                    ? t('session.connectingHint')
                    : t('session.disconnectedHint')}
              </span>
            </div>
            {!connected && (
              <Link
                href="/settings?section=whatsapp"
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(37,211,102,0.30)] transition-all hover:bg-[#1FAA5C] hover:shadow-[0_6px_20px_rgba(37,211,102,0.40)] active:scale-95"
              >
                <Wifi className="h-4 w-4" />
                {status === 'connecting' ? t('common:waBanner.scanQr') : t('common:waBanner.connect')}
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Today's messages */}
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
                  {t('session.todaysMessages')}
                </span>
                <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                  {warmup.active && warmup.dailyLimit ? (
                    <>
                      {warmup.dailySent.toLocaleString(locale)}
                      <span className="font-medium text-gray-400 dark:text-[#8696A0]">
                        {' / '}{warmup.dailyLimit.toLocaleString(locale)}
                      </span>
                    </>
                  ) : (
                    <>
                      {warmup.dailySent.toLocaleString(locale)}{' '}
                      <span className="text-xs font-medium text-gray-400 dark:text-[#8696A0]">
                        {t('session.sentSuffix')}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {warmup.active && warmup.dailyLimit ? (
                <>
                  <ProgressBar percent={dailyPercent} color={dailyColor} />
                  <p className="text-xs text-gray-500 dark:text-[#8696A0]">
                    {warmup.dailyRemaining
                      ? t('session.remaining', { count: warmup.dailyRemaining.toLocaleString(locale) })
                      : t('session.limitReached')}
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-2 rounded-lg border border-[#25D366]/20 bg-[#25D366]/5 px-3 py-2">
                  <Zap className="h-3.5 w-3.5 shrink-0 text-[#128C7E] dark:text-[#25D366]" />
                  <span className="text-xs font-medium text-[#128C7E] dark:text-[#25D366]">
                    {t('session.fullCapacity')}
                  </span>
                  <span className="text-xs text-[#128C7E]/70 dark:text-[#25D366]/70">
                    · {t('session.perMinute', { count: warmup.perMinuteCap })}
                  </span>
                </div>
              )}
            </div>

            {/* Warm-up ramp (only while active) */}
            {warmup.active && (
              <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-white/[0.04]">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                    {t('session.warmupTitle')}
                  </span>
                  <span className="text-xs font-medium tabular-nums text-gray-600 dark:text-gray-400">
                    {t('session.dayOf', { day: session.dayNumber })}
                  </span>
                </div>
                <ProgressBar percent={warmupPercent} color="bg-amber-400" />
                {warmup.fullyUnlockedAt && (
                  <p className="text-xs text-gray-500 dark:text-[#8696A0]">
                    {t('session.unlocks', {
                      date: new Date(warmup.fullyUnlockedAt).toLocaleDateString(locale, {
                        day: 'numeric',
                        month: 'short',
                      }),
                    })}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer note ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-gray-100/80 bg-white/40 px-5 py-3 dark:border-white/[0.04] dark:bg-white/[0.03]">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-[#8696A0]" />
        <p className="text-[11px] leading-tight text-gray-500 dark:text-[#8696A0]">
          {t('session.protectNote')}
        </p>
      </div>
    </div>
  );
}

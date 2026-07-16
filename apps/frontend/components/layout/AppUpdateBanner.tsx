'use client';

/**
 * AppUpdateBanner — surfaces a waiting service-worker update inside the actual
 * dashboard shell (the SW registration in app/layout.tsx dispatches
 * `sw-update-available`, but nothing previously listened for it here, so a
 * stale worker could keep controlling a tab indefinitely and users had no way
 * to know a refresh would fix things). Tapping it activates the new worker,
 * clears Cache Storage, and reloads — auth cookies/tokens are untouched.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';
import { hardRefresh } from '@/lib/hard-refresh';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    __swUpdateAvailable?: boolean;
  }
}

export default function AppUpdateBanner() {
  const { t } = useTranslation('common');
  const [available, setAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.__swUpdateAvailable) setAvailable(true);
    const handler = () => setAvailable(true);
    window.addEventListener('sw-update-available', handler);
    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!available) return null;

  const onUpdate = () => {
    if (updating) return;
    setUpdating(true);
    void hardRefresh();
  };

  return (
    <div className="px-4 pt-3 sm:px-6 sm:pt-4">
      <button
        type="button"
        onClick={onUpdate}
        disabled={updating}
        className={cn(
          'group flex w-full items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-start transition-colors',
          'border-[#25D366]/40 bg-[#25D366]/[0.08] hover:bg-[#25D366]/[0.14]',
          'dark:border-[#25D366]/25 dark:bg-[#25D366]/[0.08] dark:hover:bg-[#25D366]/[0.14]',
          updating && 'cursor-wait opacity-80',
        )}
      >
        <RefreshCw className={cn('h-4 w-4 shrink-0 text-[#128C7E] dark:text-[#25D366]', updating && 'animate-spin')} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-[#0b6b3f] dark:text-[#25D366]">
            {updating ? t('appUpdate.updating') : t('appUpdate.title')}
          </span>
          {!updating && (
            <span className="block truncate text-[11px] text-[#128C7E]/80 dark:text-[#25D366]/70">
              {t('appUpdate.body')}
            </span>
          )}
        </span>
        {!updating && (
          <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-[#075E54] shadow-sm dark:bg-white/90">
            {t('appUpdate.action')}
          </span>
        )}
      </button>
    </div>
  );
}

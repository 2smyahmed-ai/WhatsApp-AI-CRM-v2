'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { MessageSquareReply } from 'lucide-react';
import { useLanguage } from '../../providers/I18nProvider';

export default function Reminders({ openCount }: { openCount: number }) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';

  const caughtUp = openCount === 0;

  return (
    <section className="flex h-full flex-col rounded-[20px] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.05)] p-5 dark:bg-[#111B21]/90 dark:border-white/8 dark:shadow-[0_2px_20px_rgba(0,0,0,0.35)]">
      <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('reminders.title')}</h2>

      <div className="mt-3 flex-1">
        <p className="text-[19px] font-bold leading-snug text-gray-900 dark:text-white">
          {caughtUp
            ? t('reminders.caughtUp')
            : t('reminders.headline', { count: openCount.toLocaleString(locale) })}
        </p>
        <p className="mt-2 text-xs text-gray-500 dark:text-[#8696A0]">
          {caughtUp ? t('reminders.caughtUpSub') : t('reminders.sub')}
        </p>
      </div>

      <Link
        href="/conversations"
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#15803D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/40 dark:bg-[#25D366] dark:text-[#0B141A] dark:hover:bg-[#1fbd5b]"
      >
        <MessageSquareReply className="h-4 w-4" aria-hidden="true" />
        {t('reminders.action')}
      </Link>
    </section>
  );
}

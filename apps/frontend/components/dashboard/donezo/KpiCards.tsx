'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Users, MessageSquare, MessageCircle, Flame, ArrowUpRight, TrendingUp, type LucideIcon } from 'lucide-react';
import { useLanguage } from '../../providers/I18nProvider';

interface KpiData {
  totalContacts: number;
  openConversations: number;
  todayMessages: number;
  hotLeads: number;
}

interface CardDef {
  key: keyof KpiData;
  labelKey: string;
  captionKey: string;
  href: string;
  Icon: LucideIcon;
  accentGradient: string;
  iconBg: string;
  iconColor: string;
  glowColor: string;
  trendColor: string;
}

const CARDS: CardDef[] = [
  {
    key: 'totalContacts',
    labelKey: 'kpi.totalContacts',
    captionKey: 'kpi.totalContactsCaption',
    href: '/contacts',
    Icon: Users,
    accentGradient: 'from-blue-500 to-blue-400',
    iconBg: 'bg-blue-50 border-blue-200/60 dark:bg-blue-400/10 dark:border-blue-400/20',
    iconColor: 'text-blue-600 dark:text-blue-400',
    glowColor: 'bg-blue-400/10 dark:bg-blue-400/8',
    trendColor: 'text-blue-500 dark:text-blue-400',
  },
  {
    key: 'openConversations',
    labelKey: 'kpi.openConversations',
    captionKey: 'kpi.openConversationsCaption',
    href: '/conversations',
    Icon: MessageSquare,
    accentGradient: 'from-[#25D366] to-[#1FAA5C]',
    iconBg: 'bg-[#25D366]/10 border-[#25D366]/25',
    iconColor: 'text-[#16A34A] dark:text-[#25D366]',
    glowColor: 'bg-[#25D366]/10 dark:bg-[#25D366]/8',
    trendColor: 'text-[#16A34A] dark:text-[#25D366]',
  },
  {
    key: 'todayMessages',
    labelKey: 'kpi.todayMessages',
    captionKey: 'kpi.todayMessagesCaption',
    href: '/conversations',
    Icon: MessageCircle,
    accentGradient: 'from-violet-500 to-violet-400',
    iconBg: 'bg-violet-50 border-violet-200/60 dark:bg-violet-400/10 dark:border-violet-400/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    glowColor: 'bg-violet-400/10 dark:bg-violet-400/8',
    trendColor: 'text-violet-500 dark:text-violet-400',
  },
  {
    key: 'hotLeads',
    labelKey: 'kpi.hotLeads',
    captionKey: 'kpi.hotLeadsCaption',
    href: '/leads',
    Icon: Flame,
    accentGradient: 'from-red-500 to-orange-400',
    iconBg: 'bg-red-50 border-red-200/60 dark:bg-red-400/10 dark:border-red-400/20',
    iconColor: 'text-red-600 dark:text-red-400',
    glowColor: 'bg-red-400/10 dark:bg-red-400/8',
    trendColor: 'text-red-500 dark:text-red-400',
  },
];

export default function KpiCards({ data }: { data: KpiData }) {
  const { t } = useTranslation('dashboard');
  const { language } = useLanguage();
  const locale = language === 'ar' ? 'ar-EG' : 'en-US';

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {CARDS.map((card) => {
        const value = data[card.key].toLocaleString(locale);
        const Icon = card.Icon;

        return (
          <Link
            key={card.key}
            href={card.href}
            className="group relative flex flex-col overflow-hidden rounded-[20px] bg-white/80 backdrop-blur-xl border border-gray-100 shadow-[0_2px_20px_rgba(0,0,0,0.05)] p-4 sm:p-5 transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.10)] hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#16A34A]/40 dark:bg-[#182229] dark:border-transparent dark:shadow-[0_4px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)] dark:hover:shadow-[0_8px_32px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.05)]"
          >
            {/* Top gradient accent bar */}
            <div className={`absolute inset-x-0 top-0 h-[3px] rounded-t-[20px] bg-gradient-to-r ${card.accentGradient}`} />

            {/* Ambient glow */}
            <div className={`pointer-events-none absolute -bottom-8 -end-8 h-28 w-28 rounded-full blur-2xl ${card.glowColor}`} />

            {/* Label row */}
            <div className="relative flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500 dark:text-[#8696A0]">
                {t(card.labelKey)}
              </p>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-400 transition-all group-hover:scale-110 dark:border-white/10 dark:text-[#8696A0]"
                aria-hidden="true"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </span>
            </div>

            {/* Number + icon */}
            <div className="relative mt-3 flex items-end justify-between gap-3">
              <p className="text-[32px] sm:text-[42px] font-bold leading-none tabular-nums tracking-tight text-gray-900 dark:text-white">
                {value}
              </p>
              <div className={`mb-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${card.iconBg}`}>
                <Icon className={`h-5 w-5 ${card.iconColor}`} aria-hidden="true" />
              </div>
            </div>

            {/* Caption */}
            <div className="relative mt-3 flex items-center gap-1.5">
              <TrendingUp className={`h-3.5 w-3.5 shrink-0 ${card.trendColor}`} aria-hidden="true" />
              <p className="text-[11px] font-medium text-gray-400 dark:text-[#8696A0]">
                {t(card.captionKey)}
              </p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

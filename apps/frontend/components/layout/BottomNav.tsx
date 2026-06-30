'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, MessageSquare, Users, Send, Grid3X3, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useLiveCounts } from '@/hooks/useLiveCounts';
import { useChatOpen } from '@/stores/chat-open-store';
import MobileDrawer from './MobileDrawer';

// Reversed order — Dashboard is the last item (rightmost) in both LTR and RTL
// because the pill forces dir="ltr" to keep layout consistent across languages.
type Tab = {
  key: string;
  href: string;
  icon: LucideIcon;
  liveKey?: 'openConversations';
};

const TABS: readonly Tab[] = [
  { key: 'broadcasts',    href: '/broadcasts',    icon: Send },
  { key: 'contacts',      href: '/contacts',      icon: Users },
  { key: 'conversations', href: '/conversations', icon: MessageSquare, liveKey: 'openConversations' },
  { key: 'dashboard',     href: '/dashboard',     icon: BarChart3 },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { openConversations } = useLiveCounts();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useTranslation('sidebar');
  const chatWindowOpen = useChatOpen((s) => s.isOpen);

  const count = { openConversations: openConversations ?? 0 };

  // Hide only when a chat window is open — the conversation list still shows the nav
  if (chatWindowOpen) return null;

  return (
    <>
      <nav
        className="fixed bottom-0 inset-x-0 z-30 block sm:hidden pb-safe"
        aria-label="Mobile navigation"
      >
        {/* Floating pill — forced LTR so layout is identical in EN and AR */}
        <div
          dir="ltr"
          className="mx-3 mb-2.5 flex items-stretch rounded-2xl border border-gray-200/70 bg-white/92 backdrop-blur-xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.15),0_2px_8px_-2px_rgba(0,0,0,0.08)] dark:border-transparent dark:bg-[#182229]/98 dark:shadow-[0_8px_40px_-4px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.05)]"
        >

          {/* More – leftmost, opens drawer */}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open all navigation"
            className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 select-none"
          >
            <span className="flex h-[36px] w-[36px] items-center justify-center rounded-[12px]">
              <Grid3X3 className="h-[18px] w-[18px] text-gray-400 dark:text-[#8696A0]" />
            </span>
            <span className="text-[9px] font-semibold leading-none text-gray-400 dark:text-[#8696A0]">
              {t('nav.more')}
            </span>
          </button>

          {/* Main tabs: Broadcasts → Contacts → Conversations → Dashboard (rightmost) */}
          {TABS.map(({ key, href, icon: Icon, liveKey }) => {
            const active = !!pathname?.startsWith(href);
            const badge  = liveKey ? count[liveKey] : 0;

            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? 'page' : undefined}
                className="relative flex flex-1 flex-col items-center justify-center gap-1 py-2 select-none"
              >
                {/* Icon bubble */}
                <span className={cn(
                  'relative flex h-[36px] w-[36px] items-center justify-center rounded-[12px] transition-all duration-200',
                  active
                    ? 'bg-[#16A34A]/12 dark:bg-[#25D366]/15 scale-[1.06]'
                    : 'scale-100',
                )}>
                  <Icon className={cn(
                    'transition-all duration-200',
                    active
                      ? 'h-[19px] w-[19px] text-[#16A34A] dark:text-[#25D366] stroke-[2.4]'
                      : 'h-[18px] w-[18px] text-gray-400 dark:text-[#8696A0]',
                  )} />
                  {badge > 0 && (
                    <span className="absolute -end-1 -top-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold leading-none text-white">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  )}
                </span>
                {/* Label */}
                <span className={cn(
                  'text-[9px] font-semibold leading-none transition-colors duration-200',
                  active
                    ? 'text-[#16A34A] dark:text-[#25D366]'
                    : 'text-gray-400 dark:text-[#8696A0]',
                )}>
                  {t(`nav.${key}`)}
                </span>
              </Link>
            );
          })}

        </div>
      </nav>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

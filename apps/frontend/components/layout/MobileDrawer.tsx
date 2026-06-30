'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTranslation } from 'react-i18next';
import {
  X, BarChart3, MessageSquare, Users, Send, Zap, Settings,
  Tags, MessageSquareReply, BriefcaseBusiness, CheckSquare,
  ShieldCheck, UserCog, UsersRound, FileText, Bot, Target,
  LogOut, Sun, Moon, Globe, RefreshCw, MessageCircle, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLiveCounts } from '@/hooks/useLiveCounts';
import { useLeadAlerts } from '@/hooks/useLeadAlerts';
import { useTheme } from '@/components/providers/ThemeProvider';
import { useLanguage } from '@/components/providers/I18nProvider';
import { useSyncStatus } from '@/hooks/useSyncStatus';
import { isManager, toSimpleRole, SIMPLE_ROLE_LABEL, SIMPLE_ROLE_BADGE } from '@/lib/roles';

type NavItem = {
  key: string;
  href: string;
  icon: LucideIcon;
  liveKey?: string;
};

const MAIN_NAV: readonly NavItem[] = [
  { key: 'dashboard',    href: '/dashboard',    icon: BarChart3 },
  { key: 'conversations',href: '/conversations', icon: MessageSquare, liveKey: 'openConversations' },
  { key: 'contacts',     href: '/contacts',      icon: Users },
  { key: 'broadcasts',   href: '/broadcasts',    icon: Send },
  { key: 'templates',    href: '/templates',     icon: FileText },
  { key: 'interactive',  href: '/interactive',   icon: Zap },
  { key: 'deals',        href: '/deals',         icon: BriefcaseBusiness },
  { key: 'tasks',        href: '/tasks',          icon: CheckSquare },
  { key: 'tags',         href: '/tags',           icon: Tags },
  { key: 'savedReplies', href: '/saved-replies',  icon: MessageSquareReply },
  { key: 'leads',        href: '/leads',          icon: Target, liveKey: 'leadsNeedsAttention' },
  { key: 'settings',     href: '/settings',       icon: Settings },
];

const ADMIN_NAV = [
  { key: 'users',      href: '/admin/users',       icon: UserCog },
  { key: 'teams',      href: '/admin/teams',        icon: UsersRound },
  { key: 'customerAi', href: '/admin/customer-ai', icon: Bot },
  { key: 'chatbot',    href: '/admin/chatbot',      icon: Sparkles },
] as const;

export default function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname  = usePathname();
  const { data: session } = useSession();
  const { t }       = useTranslation('sidebar');
  const { t: tCommon } = useTranslation('common');
  const { t: tAuth }   = useTranslation('auth');
  const { theme, toggle } = useTheme();
  const { language, setLanguage } = useLanguage();
  const { syncing, connection, sync } = useSyncStatus();
  const { openConversations } = useLiveCounts();
  const { needsAttention }    = useLeadAlerts();

  const user     = session?.user as any;
  const name     = user?.name  || user?.email || '?';
  const email    = user?.email || '';
  const role     = user?.role  || '';
  const initials = name.charAt(0).toUpperCase();
  const isAdmin  = isManager(role);
  const simpleRole = toSimpleRole(role);

  const liveCounts: Record<string, number> = {
    openConversations: openConversations ?? 0,
    leadsNeedsAttention: needsAttention ?? 0,
  };

  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Auto-close when route changes
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col rounded-t-3xl bg-white dark:bg-[#111B21] shadow-[0_-24px_60px_-12px_rgba(0,0,0,0.45)]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-gray-200 dark:bg-white/15" />
        </div>

        {/* Sheet header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1f9255] to-[#0c3a27] shadow-[0_4px_12px_-4px_rgba(13,77,46,0.5)]">
              <MessageCircle className="h-4 w-4 text-white" fill="white" strokeWidth={0} />
            </div>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white">{t('appName')}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">

          {/* Main nav grid – 4 columns */}
          <div className="grid grid-cols-4 gap-2">
            {MAIN_NAV.map(({ key, href, icon: Icon, liveKey }) => {
              const active = !!pathname?.startsWith(href);
              const count  = liveKey ? liveCounts[liveKey] : 0;
              return (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 rounded-2xl p-2.5 transition-all active:scale-95 select-none',
                    active
                      ? 'bg-[#16A34A]/10 dark:bg-[#25D366]/12'
                      : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8',
                  )}
                >
                  {count > 0 && (
                    <span className="absolute end-2 top-2 flex h-4 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                  <span className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    active ? 'bg-[#16A34A]/15 dark:bg-[#25D366]/20' : '',
                  )}>
                    <Icon className={cn(
                      'h-[18px] w-[18px]',
                      active ? 'text-[#16A34A] dark:text-[#25D366] stroke-[2.5]' : 'text-gray-500 dark:text-[#8696A0]',
                    )} />
                  </span>
                  <span className={cn(
                    'text-center text-[10px] font-semibold leading-tight',
                    active ? 'text-[#16A34A] dark:text-[#25D366]' : 'text-gray-600 dark:text-[#8696A0]',
                  )}>
                    {t(`nav.${key}`)}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Admin section */}
          {isAdmin && (
            <>
              <div className="mt-4 mb-2 flex items-center gap-2 px-1">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {t('admin')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {ADMIN_NAV.map(({ key, href, icon: Icon }) => {
                  const active = !!pathname?.startsWith(href);
                  return (
                    <Link
                      key={key}
                      href={href}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-all active:scale-95 select-none',
                        active
                          ? 'bg-amber-50 dark:bg-amber-400/10'
                          : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/8',
                      )}
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl">
                        <Icon className={cn('h-[18px] w-[18px]', active ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-[#8696A0]')} />
                      </span>
                      <span className={cn('text-center text-[10px] font-semibold leading-tight', active ? 'text-amber-600 dark:text-amber-400' : 'text-gray-600 dark:text-[#8696A0]')}>
                        {t(`nav.${key}`)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </>
          )}

          {/* Quick-action strip */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={toggle}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 p-3 transition-all active:scale-95"
            >
              {theme === 'dark'
                ? <Sun className="h-5 w-5 text-gray-500 dark:text-[#8696A0]" />
                : <Moon className="h-5 w-5 text-gray-500 dark:text-[#8696A0]" />}
              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8696A0]">
                {theme === 'dark' ? tCommon('theme.light', { defaultValue: 'Light' }) : tCommon('theme.dark', { defaultValue: 'Dark' })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 p-3 transition-all active:scale-95"
            >
              <Globe className="h-5 w-5 text-gray-500 dark:text-[#8696A0]" />
              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8696A0]">
                {language === 'en' ? 'العربية' : 'English'}
              </span>
            </button>
            <button
              type="button"
              onClick={sync}
              disabled={syncing}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-gray-50 dark:bg-white/5 p-3 transition-all active:scale-95 disabled:opacity-50"
            >
              <span className="relative">
                <RefreshCw className={cn('h-5 w-5 text-gray-500 dark:text-[#8696A0]', syncing && 'animate-spin')} />
                <span className={cn(
                  'absolute -end-1 -top-1 h-2 w-2 rounded-full border-2 border-white dark:border-[#111B21]',
                  connection === 'connected' ? 'bg-[#25D366]' : connection === 'connecting' ? 'bg-amber-400' : 'bg-red-500',
                )} />
              </span>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8696A0]">
                {tCommon('header.sync', { defaultValue: 'Sync' })}
              </span>
            </button>
          </div>
        </div>

        {/* User footer */}
        <div className="shrink-0 border-t border-gray-100 dark:border-white/8 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#1f9255] to-[#0c3a27] text-sm font-bold text-white">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{name}</p>
                {email && (
                  <p className="truncate text-[11px] text-gray-400 dark:text-[#8696A0]">{email}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {role && (
                <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', SIMPLE_ROLE_BADGE[simpleRole])}>
                  {SIMPLE_ROLE_LABEL[simpleRole]}
                </span>
              )}
              <button
                type="button"
                onClick={() => signOut()}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500 transition-colors hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20"
                aria-label={tAuth('logout.button', { defaultValue: 'Logout' })}
                title={tAuth('logout.button', { defaultValue: 'Logout' })}
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* iOS safe-area spacer */}
        <div className="shrink-0 pb-safe" />
      </div>
    </>
  );
}

'use client';

import { Bell, LogOut, Sun, Moon } from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/components/providers/ThemeProvider';
import { cn } from '@/lib/utils';

const ROLE_STYLES: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-400/15 dark:text-purple-300',
  ADMIN:       'bg-amber-100  text-amber-700  dark:bg-amber-400/15  dark:text-amber-300',
  TEAM_LEAD:   'bg-blue-100   text-blue-700   dark:bg-blue-400/15   dark:text-blue-300',
  AGENT:       'bg-gray-100   text-gray-600   dark:bg-white/10      dark:text-[#8696A0]',
  ANALYST:     'bg-teal-100   text-teal-700   dark:bg-teal-400/15   dark:text-teal-300',
  VIEWER:      'bg-gray-100   text-gray-500   dark:bg-white/5       dark:text-[#8696A0]',
};

export default function Header() {
  const { data: session } = useSession();
  const { theme, toggle } = useTheme();

  const user  = session?.user as any;
  const name  = user?.name  || user?.email || '?';
  const role  = user?.role  || '';
  const initials = name.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-white/5 bg-white/80 dark:bg-[#111B21]/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">

        {/* Left — Live badge */}
        <div className="flex items-center gap-2.5">
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className={cn(
              'rounded-lg border p-2 transition-colors duration-150',
              'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900',
              'dark:border-white/5 dark:bg-transparent dark:text-[#8696A0] dark:hover:bg-white/8 dark:hover:text-white',
            )}
          >
            <Bell className="h-4 w-4" />
          </button>

          {/* Dark / Light toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className={cn(
              'rounded-lg border p-2 transition-colors duration-150',
              'border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900',
              'dark:border-white/5 dark:bg-transparent dark:text-[#8696A0] dark:hover:bg-white/8 dark:hover:text-white',
            )}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* User pill */}
          {session?.user && (
            <div className={cn(
              'hidden items-center gap-2 rounded-lg border px-3 py-1.5 md:flex',
              'border-gray-200 bg-white dark:border-white/5 dark:bg-white/5',
            )}>
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-xs font-bold text-white">
                {initials}
              </div>
              <span className="max-w-[140px] truncate text-xs font-medium text-gray-700 dark:text-white">
                {name}
              </span>
              {role && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  ROLE_STYLES[role] ?? ROLE_STYLES['AGENT'],
                )}>
                  {role.replace('_', ' ')}
                </span>
              )}
            </div>
          )}

          {/* Logout */}
          <button
            type="button"
            onClick={() => signOut()}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors duration-150',
              'border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600',
              'dark:border-white/5 dark:bg-white/5 dark:text-[#8696A0] dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400',
            )}
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

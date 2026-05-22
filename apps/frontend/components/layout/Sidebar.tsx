'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BarChart3,
  MessageSquare,
  Users,
  Send,
  Zap,
  Settings,
  Tags,
  MessageSquareReply,
  BriefcaseBusiness,
  CheckSquare,
  MessageCircle,
  ShieldCheck,
  UserCog,
  UsersRound,
  FileText,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const mainNav = [
  { name: 'Dashboard',     href: '/dashboard',    icon: BarChart3 },
  { name: 'Conversations', href: '/conversations', icon: MessageSquare },
  { name: 'Contacts',      href: '/contacts',      icon: Users },
  { name: 'Tags',          href: '/tags',          icon: Tags },
  { name: 'Saved Replies', href: '/saved-replies', icon: MessageSquareReply },
  { name: 'Templates',    href: '/templates',     icon: FileText },
  { name: 'Deals',         href: '/deals',         icon: BriefcaseBusiness },
  { name: 'Tasks',         href: '/tasks',         icon: CheckSquare },
  { name: 'Broadcasts',    href: '/broadcasts',    icon: Send },
  { name: 'Settings',      href: '/settings',      icon: Settings },
];

const adminNav = [
  { name: 'Users',       href: '/admin/users',  icon: UserCog },
  { name: 'Teams',       href: '/admin/teams',  icon: UsersRound },
  { name: 'Automations', href: '/automations',  icon: Zap },
];

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'];

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? 'AGENT';
  const isAdmin = ADMIN_ROLES.includes(role);

  function NavItem({ item }: { item: { name: string; href: string; icon: React.ElementType } }) {
    const active = !!pathname?.startsWith(item.href);
    return (
      <li>
        <Link
          href={item.href}
          className={cn(
            'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
            active
              ? 'bg-[#25D366]/10 text-[#25D366] dark:bg-[#25D366]/15 dark:text-[#25D366]'
              : 'text-gray-600 dark:text-[#8696A0] hover:bg-gray-100 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white',
          )}
        >
          <item.icon
            className={cn(
              'h-4 w-4 shrink-0 transition-colors duration-150',
              active
                ? 'text-[#25D366]'
                : 'text-gray-400 dark:text-[#8696A0] group-hover:text-gray-600 dark:group-hover:text-white',
            )}
          />
          <span className="flex-1 truncate">{item.name}</span>
          {active && <span className="h-2 w-2 rounded-full bg-[#25D366]" />}
        </Link>
      </li>
    );
  }
  // Reusable inner content so we can render it for desktop and mobile
  const inner = (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-white/5 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_4px_20px_rgba(37,211,102,0.25)]">
          <MessageCircle className="h-5 w-5 text-white" fill="white" strokeWidth={0} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-white">
            WhatsApp CRM
          </p>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
            Business Suite
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">

        {/* Main menu */}
        <div>
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-[#8696A0]">
            Menu
          </p>
          <ul className="space-y-1">
            {mainNav.map((item) => <NavItem key={item.name} item={item} />)}
          </ul>
        </div>

        {/* Admin-only section */}
        {isAdmin && (
          <div>
            <div className="mb-2 flex items-center gap-2 px-2">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Admin
              </p>
            </div>
            <ul className="space-y-1">
              {adminNav.map((item) => <NavItem key={item.name} item={item} />)}
            </ul>
          </div>
        )}
      </nav>

      {/* Connection status + role badge */}
      <div className="border-t border-gray-200 dark:border-white/5 px-5 py-4 space-y-2">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#25D366] opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#25D366]" />
          </span>
          <span className="text-xs font-medium text-gray-500 dark:text-[#8696A0]">
            WhatsApp connected
          </span>
        </div>
        {role && (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                isAdmin
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-400'
                  : 'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-[#8696A0]',
              )}
            >
              {role.replace('_', ' ')}
            </span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile: hamburger toggle */}
      {!open && (
        <button
          aria-label="Open sidebar"
          onClick={() => setOpen(true)}
          className="fixed top-4 left-4 z-50 inline-flex items-center justify-center rounded-md p-2 text-gray-700 bg-white shadow-md lg:hidden dark:bg-[#111B21] dark:text-white"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile sliding panel */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-hidden={!open}
      >
        <div className="relative h-full border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#111B21]">
          <button
            aria-label="Close sidebar"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 inline-flex items-center justify-center rounded-md p-1 text-gray-600 hover:bg-gray-100 dark:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          {inner}
        </div>
      </div>

      {/* Desktop sidebar (unchanged) */}
      <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col border-r border-gray-200 dark:border-white/5 bg-white dark:bg-[#111B21]">
        {inner}
      </aside>
    </>
  );
}

import Link from 'next/link';
import { Home, MessageCircle } from 'lucide-react';

/**
 * Renders for any unknown route. Kept i18n-free so it works
 * even before the language provider mounts.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-[#0B141A]">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#111B21]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_4px_20px_rgba(37,211,102,0.25)]">
          <MessageCircle className="h-7 w-7 text-white" fill="white" strokeWidth={0} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-[#8696A0]">
          404
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-[#8696A0]">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#25D366]/90 focus:outline-none focus:ring-4 focus:ring-[#25D366]/25"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

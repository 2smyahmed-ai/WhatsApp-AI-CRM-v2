'use client';

import { useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', { email, password, redirect: false });

      if (result?.error) {
        setError('Invalid email or password');
      } else {
        const session = await getSession();
        if (session?.accessToken && typeof window !== 'undefined') {
          window.localStorage.setItem('accessToken', session.accessToken);
        }
        if (session?.refreshToken && typeof window !== 'undefined') {
          window.localStorage.setItem('refreshToken', session.refreshToken);
        }
        router.push('/dashboard');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0B141A] dark:to-[#111B21]">
      <div className="w-full max-w-md rounded-2xl border border-white/60 dark:border-white/10 bg-white dark:bg-[#111B21] p-8 shadow-lift dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">

        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-[#25D366] to-[#128C7E] shadow-[0_4px_20px_rgba(37,211,102,0.25)]">
            <MessageCircle className="h-7 w-7 text-white" fill="white" strokeWidth={0} />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
            Sign in to WhatsApp CRM
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-[#8696A0]">
            Contact your administrator if you need access.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-[#E9EDEF]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-4 py-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/20 dark:focus:ring-[#25D366]/25"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-[#E9EDEF]">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-4 py-3 text-sm text-gray-900 dark:text-white outline-none transition focus:border-[#25D366] focus:ring-4 focus:ring-[#25D366]/20 dark:focus:ring-[#25D366]/25"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#25D366]/90 focus:outline-none focus:ring-4 focus:ring-[#25D366]/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

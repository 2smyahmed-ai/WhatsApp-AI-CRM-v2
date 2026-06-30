'use client';

import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import socket from '../../lib/socket';

/**
 * Public, unauthenticated routes where the realtime socket must NOT connect.
 * These pages (landing, auth) don't need realtime, and connecting there only
 * produces failed-handshake console noise + infinite reconnect attempts when
 * a stale session is present but the backend is unreachable.
 */
function isPublicRoute(pathname: string): boolean {
  return pathname === '/' || pathname.startsWith('/login');
}

function TokenSyncer() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'loading') return;

    // On public routes (landing, login) we never want a live realtime socket.
    // Still keep the access token synced below so API calls work post-login.
    const onPublicRoute = isPublicRoute(pathname);
    if (onPublicRoute && socket.connected) socket.disconnect();

    // Refresh token expired / revoked: the access token can no longer be
    // renewed, so force a clean re-login instead of looping 401s.
    if (session?.error === 'RefreshAccessTokenError') {
      if (socket.connected) socket.disconnect();
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('refreshToken');
      }
      void signOut({ callbackUrl: '/login' });
      return;
    }

    if (status === 'unauthenticated') {
      if (socket.connected) socket.disconnect();
      if (typeof window !== 'undefined') window.localStorage.removeItem('accessToken');
      return;
    }

    const token = session?.accessToken;
    if (!token) return;

    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null;

    // Always keep the stored access token in sync so authenticated API calls work
    // on every route, including the landing page after a fresh login.
    if (stored !== token && typeof window !== 'undefined') {
      window.localStorage.setItem('accessToken', token);
    }

    // Only the realtime socket is route-gated: it lives on authenticated app routes.
    if (onPublicRoute) {
      if (socket.connected) socket.disconnect();
      return;
    }

    if (stored !== token) {
      // Token changed or missing — (re)connect with the fresh token
      if (socket.connected) socket.disconnect();
      socket.connect();
    } else if (socket.disconnected) {
      // Same token already stored but socket isn't connected yet (e.g. autoConnect:false on first load)
      socket.connect();
    }
  }, [session?.accessToken, session?.error, status, pathname]);

  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <TokenSyncer />
      {children}
    </SessionProvider>
  );
}

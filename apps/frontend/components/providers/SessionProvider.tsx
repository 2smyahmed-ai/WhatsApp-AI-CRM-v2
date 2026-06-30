'use client';

import { SessionProvider, signOut, useSession } from 'next-auth/react';
import { useEffect } from 'react';
import socket from '../../lib/socket';

function TokenSyncer() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'loading') return;

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

    if (stored !== token) {
      // Token changed or missing — write it and (re)connect with the fresh token
      if (typeof window !== 'undefined') window.localStorage.setItem('accessToken', token);
      if (socket.connected) socket.disconnect();
      socket.connect();
    } else if (socket.disconnected) {
      // Same token already stored but socket isn't connected yet (e.g. autoConnect:false on first load)
      socket.connect();
    }
  }, [session?.accessToken, session?.error, status]);

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

import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

// These calls run server-side (inside the frontend container), so prefer an
// internal backend URL (e.g. http://backend:4000) to avoid hairpinning out
// through the public reverse proxy. Falls back to the public URL for local dev.
const API_BASE_URL = process.env.BACKEND_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || '';

declare module 'next-auth' {
  interface User {
    id: string;
    token: string;
    refreshToken: string;
    role: string;
    teamId: string | null;
  }
  interface Session {
    accessToken: string;
    refreshToken: string;
    error?: string;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      role: string;
      teamId: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    userId: string;
    role: string;
    teamId: string | null;
    error?: string;
  }
}

// Read the `exp` claim (ms) out of a backend JWT without verifying it — we only
// need to know when to proactively refresh. Returns 0 if it can't be parsed.
function getTokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    return typeof payload.exp === 'number' ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// Exchange the (long-lived) refresh token for a fresh access token via the
// backend. Runs server-side inside the jwt() callback, so it has access to the
// refresh token stored in the NextAuth JWT.
async function refreshAccessToken(token: import('next-auth/jwt').JWT) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: token.refreshToken ? { Authorization: `Bearer ${token.refreshToken}` } : {},
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.token) throw new Error('Refresh failed');

    return {
      ...token,
      accessToken: data.token,
      accessTokenExpires: getTokenExpiry(data.token),
      role: data.user?.role ?? token.role,
      teamId: data.user?.teamId ?? token.teamId,
      error: undefined,
    };
  } catch {
    // Surface the failure so the UI can force a re-login instead of looping 401s.
    return { ...token, accessToken: '', error: 'RefreshAccessTokenError' };
  }
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email: credentials.email, password: credentials.password }),
          });

          const data = await res.json();

          if (res.ok && data.token) {
            return {
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              token: data.token,
              refreshToken: data.refreshToken,
              role: data.user.role,
              teamId: data.user.teamId ?? null,
            };
          }

          return null;
        } catch {
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, user }) {
      // Initial sign-in: persist the tokens minted by the backend.
      if (user) {
        token.accessToken        = user.token;
        token.refreshToken       = user.refreshToken;
        token.accessTokenExpires = getTokenExpiry(user.token);
        token.userId             = user.id;
        token.role               = user.role;
        token.teamId             = user.teamId;
        return token;
      }

      // Subsequent calls: reuse the access token while it's still valid
      // (30s leeway), otherwise refresh it using the stored refresh token.
      if (
        token.accessToken &&
        token.accessTokenExpires &&
        Date.now() < token.accessTokenExpires - 30_000
      ) {
        return token;
      }

      return await refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken  = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
      session.error        = token.error;
      session.user = {
        ...session.user,
        id:     token.userId as string,
        role:   (token.role as string) ?? 'AGENT',
        teamId: (token.teamId as string | null) ?? null,
      };
      return session;
    },
  },
  pages: { signIn: '/login' },
  events: {
    async signOut() {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
    },
  },
});

export { handler as GET, handler as POST };

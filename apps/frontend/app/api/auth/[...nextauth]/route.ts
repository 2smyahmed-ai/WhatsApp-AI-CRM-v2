import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
    userId: string;
    role: string;
    teamId: string | null;
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
      if (user) {
        token.accessToken  = user.token;
        token.refreshToken = user.refreshToken;
        token.userId       = user.id;
        token.role         = user.role;
        token.teamId       = user.teamId;
        return token;
      }

      if (token.accessToken) return token;

      try {
        const refresh = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        const data = await refresh.json();
        if (refresh.ok && data.token) {
          token.accessToken = data.token;
          if (data.user) {
            token.role   = data.user.role   ?? token.role;
            token.teamId = data.user.teamId ?? token.teamId;
          }
        }
      } catch {
        token.accessToken = '';
      }

      return token;
    },
    async session({ session, token }) {
      session.accessToken  = token.accessToken as string;
      session.refreshToken = token.refreshToken as string;
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

import { withAuth } from 'next-auth/middleware';

// Server-side route guard (Next.js 16 "proxy", formerly "middleware").
// Without full coverage, unauthenticated users can land on a dashboard page,
// every component mounts, and they fire a storm of authenticated API calls +
// a socket connection — all failing with 401 / connection errors. withAuth
// checks the NextAuth session cookie and redirects to /login first.
export default withAuth(
  function proxy() {
    // Reserved for future request gating or rewrites.
  },
  {
    pages: { signIn: '/login' },
    callbacks: {
      authorized: ({ token, req }) => {
        // Public marketing routes render without a session; everything else
        // (the dashboard) requires a valid NextAuth token.
        const { pathname } = req.nextUrl;
        if (pathname === '/' || pathname.startsWith('/login')) return true;
        return !!token;
      },
    },
  },
);

export const config = {
  // Protect every app route except: the login page, NextAuth & other API
  // routes, Next internals, the bootstrap scripts, and any static file
  // (anything containing a "."). Covers all dashboard pages, including ones
  // an explicit allow-list would miss (deals, templates, tasks, tags,
  // saved-replies, admin, ...).
  matcher: ['/((?!login|api|_next/static|_next/image|favicon.ico|scripts|.*\\..*).*)'],
};

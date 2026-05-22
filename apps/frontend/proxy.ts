import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function proxy(req) {
    // Reserved for future request gating or rewrites.
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ['/dashboard/:path*', '/conversations/:path*', '/contacts/:path*', '/automations/:path*', '/broadcasts/:path*', '/settings/:path*'],
};

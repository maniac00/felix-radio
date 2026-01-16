/**
 * NextAuth.js Edge-compatible configuration
 * This file is used by middleware for authentication checks
 */

import type { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      const isOnRoot = nextUrl.pathname === '/';
      const isOnLogin = nextUrl.pathname === '/login';
      const isOnSignup = nextUrl.pathname === '/signup';

      if (isOnDashboard) {
        return isLoggedIn; // Redirect to login if not authenticated
      }

      // Redirect authenticated users from login/signup to dashboard
      if (isLoggedIn && (isOnLogin || isOnSignup)) {
        return Response.redirect(new URL('/dashboard', nextUrl));
      }

      // Redirect root to appropriate page
      if (isOnRoot) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        } else {
          return Response.redirect(new URL('/login', nextUrl));
        }
      }

      return true;
    },
  },
};

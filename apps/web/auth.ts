/**
 * NextAuth.js main configuration
 * Google OAuth + JWT session strategy
 */

import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user, account }) {
      // Initial sign in - add user info to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      // Pass token info to session
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});

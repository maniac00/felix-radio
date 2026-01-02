/**
 * Clerk Authentication Middleware
 * Validates JWT tokens from Clerk and extracts user information
 */

import { verifyToken } from '@clerk/backend';
import type { Context, Next } from 'hono';
import type { Bindings } from '../types';

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Clerk JWT authentication middleware
 * Validates the token and attaches userId to context
 */
export async function clerkAuth(
  c: Context<{ Bindings: Bindings }>,
  next: Next
) {
  const authHeader = c.req.header('Authorization');
  console.log('[Auth Middleware] Authorization header:', authHeader ? 'EXISTS' : 'MISSING');

  // Try to get token from header first, then query parameter
  let token = extractToken(authHeader);

  if (!token) {
    // Check query parameter for download endpoints
    const queryToken = c.req.query('token');
    if (queryToken) {
      token = queryToken;
      console.log('[Auth Middleware] Using query parameter token');
    }
  }

  console.log('[Auth Middleware] Extracted token:', token ? 'YES (length: ' + token.length + ')' : 'NO');

  if (!token) {
    return c.json(
      {
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header or token parameter',
      },
      401
    );
  }

  try {
    const secretKey = c.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      console.error('CLERK_SECRET_KEY is not configured');
      return c.json(
        {
          error: 'Internal Server Error',
          message: 'Authentication is not properly configured',
        },
        500
      );
    }

    // Verify the Clerk JWT token
    const payload = await verifyToken(token, {
      secretKey,
    });

    // Extract user ID and email from the token payload
    const userId = payload.sub;

    // Clerk stores email in different fields depending on the token type
    // Try primary_email_address_id, email, or email_addresses
    let email = payload.email as string | undefined;

    // If email is not directly available, try to get it from email_addresses
    if (!email && payload.email_addresses) {
      const emailAddresses = payload.email_addresses as any[];
      if (emailAddresses && emailAddresses.length > 0) {
        email = emailAddresses[0].email_address;
      }
    }

    console.log('[Auth Middleware] User ID:', userId);
    console.log('[Auth Middleware] Email:', email || 'NOT FOUND');

    if (!userId) {
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid token: missing user ID',
        },
        401
      );
    }

    if (!email) {
      console.error('[Auth Middleware] No email found in token payload:', JSON.stringify(payload, null, 2));
      return c.json(
        {
          error: 'Unauthorized',
          message: 'Invalid token: missing email',
        },
        401
      );
    }

    // Attach userId and email to context for downstream handlers
    c.set('userId', userId);
    c.set('userEmail', email);

    await next();
  } catch (error) {
    console.error('Token verification failed:', error);

    return c.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      },
      401
    );
  }
}

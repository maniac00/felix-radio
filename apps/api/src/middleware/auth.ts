/**
 * JWT Authentication Middleware
 * Validates JWT tokens using jose and extracts user information
 */

import { jwtVerify } from 'jose';
import type { Context, Next } from 'hono';
import type { Bindings, Variables } from '../types';

/**
 * Extract token from Authorization header
 */
function extractToken(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * JWT authentication middleware
 * Validates the token and attaches userId and email to context
 */
export async function jwtAuth(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
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
    const jwtSecret = c.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('JWT_SECRET is not configured');
      return c.json(
        {
          error: 'Internal Server Error',
          message: 'Authentication is not properly configured',
        },
        500
      );
    }

    // Verify the JWT token using jose
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(token, secret);

    // Extract user ID and email from the token payload
    const userId = payload.sub as string;
    const email = payload.email as string;

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

// Export with the old name for backward compatibility during migration
export const clerkAuth = jwtAuth;

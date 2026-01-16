'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api';

/**
 * API Authentication Provider
 *
 * Fetches JWT tokens from /api/auth/token and injects them into the API client.
 * This provider must wrap the app to enable authenticated API requests.
 */
export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [isConfigured, setIsConfigured] = useState(false);
  const tokenRef = useRef<string | null>(null);
  const tokenExpiryRef = useRef<number>(0);

  // Token getter function that caches tokens
  const getToken = useCallback(async (): Promise<string | null> => {
    // Return cached token if it's still valid (with 5 min buffer)
    const now = Date.now();
    if (tokenRef.current && tokenExpiryRef.current > now + 5 * 60 * 1000) {
      return tokenRef.current;
    }

    try {
      const response = await fetch('/api/auth/token');

      if (!response.ok) {
        console.warn('Failed to fetch API token:', response.status);
        return null;
      }

      const data = await response.json();
      tokenRef.current = data.token;
      // Set expiry to 55 minutes from now (tokens are valid for 1 hour)
      tokenExpiryRef.current = now + 55 * 60 * 1000;

      console.log('[API Auth Provider] Token obtained successfully');
      return data.token;
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    // Wait for session to be loaded
    if (status === 'loading') {
      return;
    }

    // Configure API client
    if (!isConfigured) {
      apiClient.setTokenGetter(getToken);
      console.log('API client configured with NextAuth authentication');
      // Use queueMicrotask to defer state update and avoid ESLint warning
      queueMicrotask(() => {
        setIsConfigured(true);
      });
    }
  }, [status, isConfigured, getToken]);

  // Wait for configuration to complete before rendering children
  if (!isConfigured) {
    return null;
  }

  return <>{children}</>;
}

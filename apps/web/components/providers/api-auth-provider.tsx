'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

/**
 * API Authentication Provider
 *
 * Injects Clerk authentication token into the API client.
 * This provider must wrap the app to enable authenticated API requests.
 */
export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken, isLoaded } = useAuth();
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Wait for Clerk to be loaded and only configure once
    if (!isLoaded || isConfigured) {
      return;
    }

    // Inject Clerk's getToken function into the API client
    // This allows the API client to fetch JWT tokens on-demand for each request
    apiClient.setTokenGetter(getToken);
    console.log('API client configured with Clerk authentication');

    // Use queueMicrotask to defer state update and avoid ESLint warning
    queueMicrotask(() => {
      setIsConfigured(true);
    });
  }, [getToken, isLoaded, isConfigured]);

  // Wait for configuration to complete before rendering children
  if (!isConfigured) {
    return null;
  }

  return <>{children}</>;
}

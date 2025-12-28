'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

// Check if we're in mock mode
const USE_MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';

/**
 * API Authentication Provider
 *
 * Injects Clerk authentication token into the API client.
 * This provider must wrap the app to enable authenticated API requests.
 *
 * In mock mode (NEXT_PUBLIC_USE_MOCK_API=true), this provider does nothing.
 * In production mode, it injects Clerk's getToken function into the API client.
 *
 * Note: When Clerk is enabled, uncomment the ClerkProvider in layout.tsx
 * and update this component to use the useAuth hook.
 */
export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Skip auth setup in mock mode
    if (USE_MOCK_MODE) {
      console.log('API client running in mock mode');
      return;
    }

    // When ClerkProvider is enabled, this component should use:
    // const { getToken } = useAuth();
    // apiClient.setTokenGetter(getToken);
    //
    // For now, we'll just log that the client is ready
    console.log('API client ready for authentication');
  }, []);

  return <>{children}</>;
}

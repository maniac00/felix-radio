# Enabling Clerk Authentication

This guide shows how to enable Clerk authentication in the Felix Radio frontend.

## Current State

The app is currently running in **demo mode** with:
- Mock API data (`NEXT_PUBLIC_USE_MOCK_API=true`)
- Clerk authentication disabled
- No real API calls

## Steps to Enable Production Mode

### 1. Update Environment Variables

Edit `apps/web/.env.local`:

```bash
# Remove or set to false to disable mock mode
NEXT_PUBLIC_USE_MOCK_API=false

# Add your Clerk keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Set your Workers API URL
NEXT_PUBLIC_API_URL=http://localhost:8787  # Development
# NEXT_PUBLIC_API_URL=https://your-api.workers.dev  # Production
```

### 2. Enable ClerkProvider

Edit `apps/web/app/layout.tsx`:

```typescript
// Uncomment this line:
import { ClerkProvider } from "@clerk/nextjs";

// Wrap the body content with ClerkProvider:
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ApiAuthProvider>
            {children}
          </ApiAuthProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

### 3. Update ApiAuthProvider

Edit `apps/web/components/providers/api-auth-provider.tsx`:

```typescript
'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { apiClient } from '@/lib/api';

export function ApiAuthProvider({ children }: { children: React.ReactNode }) {
  const { getToken } = useAuth();

  useEffect(() => {
    apiClient.setTokenGetter(getToken);
  }, [getToken]);

  return <>{children}</>;
}
```

### 4. Restart Development Server

```bash
cd apps/web
npm run dev
```

## Testing Authentication

1. **Sign Up**: Visit `/sign-up` to create an account
2. **Sign In**: Visit `/sign-in` to log in
3. **Protected Routes**: All `/dashboard/*` routes require authentication
4. **API Calls**: All API calls will now include the Clerk JWT token

## Troubleshooting

### "Token getter not set" Warning

If you see this warning in the console:
- Ensure ClerkProvider wraps the entire app
- Verify ApiAuthProvider is inside ClerkProvider
- Check that useAuth() is being called

### API 401 Unauthorized

If API calls fail with 401:
- Verify CLERK_SECRET_KEY is set in Workers API (.dev.vars)
- Check that the same Clerk application is used for both frontend and backend
- Ensure the JWT is being included in Authorization header

### Mock Data Still Showing

If you still see mock data:
- Verify `NEXT_PUBLIC_USE_MOCK_API=false` in .env.local
- Restart the development server (environment variables are loaded at startup)
- Check the browser console for "API client ready for authentication" message

## Reverting to Demo Mode

To go back to demo mode:

```bash
# In apps/web/.env.local
NEXT_PUBLIC_USE_MOCK_API=true

# Comment out ClerkProvider in layout.tsx
# Restart dev server
```

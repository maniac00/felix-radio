import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define protected routes that require authentication
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  // Redirect root to dashboard
  if (req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  // Protect dashboard routes
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
}, {
  // Security: Restrict allowed request origins in production
  // This prevents subdomain cookie leaking attacks
  authorizedParties: process.env.NODE_ENV === 'production'
    ? [process.env.NEXT_PUBLIC_APP_URL || 'https://felix-radio.pages.dev']
    : undefined,
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};

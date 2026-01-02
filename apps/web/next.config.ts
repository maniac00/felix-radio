import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages configuration with @cloudflare/next-on-pages

  // Disable image optimization (Cloudflare has its own)
  images: {
    unoptimized: true,
  },

  // Skip trailing slash to avoid issues
  skipTrailingSlashRedirect: true,

  // Force all routes to use edge runtime
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;

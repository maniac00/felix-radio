import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages configuration with @cloudflare/next-on-pages

  // Disable image optimization (Cloudflare has its own)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

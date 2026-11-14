/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // plain static files: same hosting model as the current site (Cloudflare Pages)
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Preview-only helpers (frame-rate readout, slow-frame simulation) are compiled out of production builds
  env: { NEXT_PUBLIC_PREVIEW: process.env.SITE_ENV === 'production' ? '' : '1' },
};
export default nextConfig;

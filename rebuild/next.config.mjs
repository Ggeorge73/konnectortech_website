/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // plain static files: same hosting model as the current site (Cloudflare Pages)
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || '.next',
};
export default nextConfig;

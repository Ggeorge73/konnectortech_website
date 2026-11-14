// Runs after every build: writes Cloudflare Pages headers into the export folder.
import fs from 'node:fs';
import path from 'node:path';

const production = process.env.SITE_ENV === 'production';
const out = path.join(process.cwd(), 'out');
// Next.js writes small inline scripts into each page, so script-src needs 'unsafe-inline' (see README, "Security headers").
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://plausible.io https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://plausible.io https://cloudflareinsights.com",
  'frame-src https://challenges.cloudflare.com',
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');
const headers = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: ${csp}
${production ? '' : '  X-Robots-Tag: noindex, nofollow\n'}
/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
`;
fs.writeFileSync(path.join(out, '_headers'), headers);
// Delivery records switched off (see `show` in src/lib/site.ts): remove the /proof/ pages, so those addresses
// answer with the 404 page instead of an empty page. Nothing on the site links to them while the switch is off.
const showProof = ['1', 'true'].includes(process.env.NEXT_PUBLIC_SHOW_PROOF);
if (!showProof) {
  fs.rmSync(path.join(out, 'proof'), { recursive: true, force: true });
  fs.rmSync(path.join(out, 'proof.txt'), { force: true });
}
// Old section links on other pages of the previous single-page site keep working: /#services etc. are ids on the home page.
console.log(`Wrote out/_headers (${production ? 'production' : 'preview, noindex'}).`);

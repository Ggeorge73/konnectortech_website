# Konnector Tech website

Static "coming soon" page for konnectortech.com, hosted on **Cloudflare Pages** (moved from Vercel, Oct 2026).

- `index.html` — the page (no build step; Pages build output directory is `/`)
- `_headers` — security headers (Cloudflare Pages format)
- `functions/api/notify.js` — "Notify Me" sign-ups (Cloudflare Pages Function at `/api/notify`).
  Set `RESEND_API_KEY` (secret) and `NOTIFY_TO` (comma-separated) under Pages → Settings → Variables and Secrets
  to get each sign-up by email; optional `NOTIFY_FROM`. Without them, sign-ups still appear in the function's real-time logs.

Preview locally: `npx wrangler pages dev .`

DNS lives in Cloudflare. Email stays on Microsoft 365 via GoDaddy — keep all MX, autodiscover, DKIM, SPF and DMARC
records set to **DNS only** (grey cloud).

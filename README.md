# Konnector Tech website

Static "coming soon" page for konnectortech.com, hosted on Vercel.

- `index.html` — the page (no build step)
- `api/notify.js` — "Notify Me" sign-ups. Set `RESEND_API_KEY` and `NOTIFY_TO` (comma-separated) in Vercel to get each
  sign-up by email; optional `NOTIFY_FROM`. Without them, sign-ups are still visible in Vercel → Logs.

Preview locally: `npx serve .` (or `vercel dev` to include the API).

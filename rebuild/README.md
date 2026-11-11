# Konnector Tech website rebuild (preview)

This folder holds the **new** konnectortech.com, built from the "Website Rebuild: Creative and Build Script"
(10 Nov 2026). It is a separate build. **Nothing outside `rebuild/` was changed, so the live site is untouched.**
When the design is approved, this build replaces the old site (see "Going live").

Think of it as a show home built next to the house people still live in: you can walk through it, but nobody
moves until you say so.

## What is here

| Part | Where | Notes |
| --- | --- | --- |
| Home page, seven scenes | `src/app/page.tsx` | One markup, two modes: **story** (3D, pinned, scroll-played) and **brief** (stills, normal scrolling). |
| Brief mode | same page, `html[data-mode="brief"]` | The default without scripts, with reduced motion, data saver, no 3D or software graphics. Built first. |
| 3D story | `src/story/` | React Three Fiber + GSAP ScrollTrigger. `Story.tsx` (canvas and scene components), `director.ts` (story time → state of every part), `scrollTime.ts` (one ScrollTrigger per scene), `overlay.ts` (HUD and text reveals), `world.ts` (corridor, track, skyline), `sphere.ts` (36 plates → the mark), `sound.ts`. Loaded after first paint. |
| Supporting pages | `src/app/*` | Services (index + 4), How we deliver, Public sector, Private sector, Proof (index + records), About, Contact, Privacy notice. |
| Content | `content/` | Markdown for services and delivery records, `company.json` for credentials, registrations and people. |
| Names, links, copy | `src/lib/site.ts` | Headlines, buttons, reply promise, booking link, capability statement link. |
| Form route | `functions/api/contact.js` | Cloudflare Pages Function: rate limit, validation, bot check, lead store (KV), emails, optional lead push. |
| Tests | `tests/` | 10 unit tests for the form route, 16 end-to-end tests (form, brief mode, story mode, keyboard, axe). |

## Commands

```bash
npm install
```

```bash
npm run dev
```

```bash
npm run build && npm run serve
```

- `npm run build` makes a **preview** build in `out/`: draft content is stamped, and the site is `noindex`.
- `npm run serve` serves `out/` on http://localhost:4173 with the real form route (enquiries kept in memory).
- `npm run verify` runs typecheck, unit tests, build, budgets and end-to-end tests.
- `npm run stills -- --video` re-renders the scene stills, share image and the 8-second logo reveal from the live 3D scene.
- `npm run build:production` is the **launch gate**: it fails while proof, capability statement, booking link or bot-check key are missing.
- Add `?mode=story` or `?mode=brief` to the home page address to force a mode; `?sector=public` or `?sector=private` to preselect a door.

## How to preview it online (without touching the live site)

Create a **second** Cloudflare Pages project pointed at this repository and branch:

- Root directory: `rebuild`
- Build command: `npm run build`
- Build output directory: `out`

It gets its own `*.pages.dev` address. The existing project (root `/`, no build) keeps serving the live site.

## Going live (only after approval)

1. Supply the items under "What Konnector still needs to supply" and remove the `draft: true` flags.
2. In the Pages project: root directory `rebuild`, build command `npm run build:production`, output `out`.
3. Bind the `ENQUIRIES` KV namespace and set the variables below.
4. Move the custom domain to that project. The old section links (`#services`, `#how`, `#sectors`, `#about`, `#contact`) keep working.

| Variable | Kind | Purpose |
| --- | --- | --- |
| `ENQUIRIES` | KV binding | Stores every enquiry and the rate-limit counters (same namespace the current site uses). |
| `RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM` | server | Email to Konnector and the confirmation to the visitor. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | server / build | Invisible bot check. |
| `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_SECRET` | server | Optional signed push of each lead (stage "signal") for Konnector CRM. |
| `NEXT_PUBLIC_BOOKING_URL` | build | Calendar link for "Book a 30-minute call". Until set, the button opens the contact form. |
| `NEXT_PUBLIC_CAPABILITY_STATEMENT_URL` | build | PDF for "Download capability statement". Until set, the button reads "Request capability statement". |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | build | Turns on privacy-friendly analytics. Events are always recorded in `window.__ktEvents`. |
| `NEXT_PUBLIC_HERO` | build | `A` (default) or `B` hero headline, for the post-launch headline test. |

## What Konnector still needs to supply

Nothing here is invented. Each missing item shows as a stamped **DRAFT** in preview builds and is left out of production builds.

- **Proof:** at least two delivery records, one public and one private (`content/proof/*.md`).
- **Credentials, registrations, NAICS codes, contract routes, people:** `content/company.json`.
- **Capability statement PDF** and the **calendar booking link**.
- **Reply promise:** the site says "one business day" (the script's recommendation). Confirm or change it in `src/lib/site.ts` and `functions/api/contact.js`.
- **Sign-off on the copy**, including the service pages, "How we deliver" and the privacy notice.

## Where this build differs from the script, and why

- **Hosting:** Next.js is exported as static files so it runs on the current Cloudflare Pages setup; the form's server side is a Pages Function (the pattern the live site already uses) instead of a Next.js server route.
- **3D art:** the corridor, sphere, mark and skyline are built in code, not modelled in Blender. Download size for 3D assets is zero. A 3D artist can later replace `world.ts` and `sphere.ts` with glTF models without touching the timeline.
- **Screen effects:** film grain and darkened edges are CSS overlays; cyan glow is three sprites on the mark's nodes. There is no bloom pass.
- **Lead store:** Cloudflare KV (already in use) instead of a database table. Konnector CRM's API needs fields a web enquiry cannot supply, so the CRM push is a signed webhook waiting for an inbound-lead endpoint on the CRM side.
- **Security headers:** Next.js writes small inline scripts, so `script-src` allows `'unsafe-inline'`. The other directives match the live site.
- **Not yet done:** testing on real phones and in Safari/Firefox (only headless Chromium was available), Lighthouse timing on a real mid-range phone, and the A/B headline split (one headline is set per build).

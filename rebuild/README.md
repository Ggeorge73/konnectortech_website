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
| Brief mode | same page, `html[data-mode="brief"]` | Used without scripts, and only for reduced motion, data saver, a slow connection, no 3D, or by choice. The full story is the default. Tier matrix: `docs/phase-2-gate.md`. |
| 3D story | `src/story/` | React Three Fiber + GSAP ScrollTrigger. `Story.tsx` (canvas and scene components), `director.ts` (story time → state of every part), `scrollTime.ts` (one ScrollTrigger per scene), `overlay.ts` (HUD and text reveals), `world.ts` (corridor, track, skyline), `sphere.ts` (36 plates → the mark), `sound.ts`. Loaded after first paint. |
| Supporting pages | `src/app/*` | Services (index + 4), How we deliver, Public sector, Private sector, Proof (index + records), About, Contact, Privacy notice. |
| Content | `content/` | Markdown for services and delivery records, `company.json` for credentials, registrations and people. |
| Names, links, copy | `src/lib/site.ts` | Headlines, buttons, reply promise, booking link, capability statement link. |
| Form route | `functions/api/contact.js` | Cloudflare Pages Function: rate limit, validation, bot check, lead store (KV), emails, optional lead push. |
| Tests | `tests/` | 10 unit tests for the form route, 57 end-to-end tests (form, brief mode, device tiers, story acceptance, keyboard, axe on 13 pages and 6 story states). Firefox and WebKit run the cross-browser set in CI. |

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
- Add `?mode=story` or `?mode=brief` to the home page address to force a mode, `?tier=full` or `?tier=light` to force a tier, and `?sector=public` or `?sector=private` to preselect a door.

## How to preview it online (without touching the live site)

The live Pages project (`konnector-website`) serves the repository root with no build step, so a branch preview of
this pull request shows the **old** site. The rebuild is previewed from the branch `preview-rebuild`, which holds
only the **built** files (`out/` plus `functions/`). Pages publishes it like any branch, at
`https://preview-rebuild.konnector-website.pages.dev`. To refresh it after a change:

```bash
PREVIEW_CONTENT=launch npm run build   # preview build (noindex, ?fps=1 readout) with exactly the launch content
```

then replace the contents of `preview-rebuild` with `out/`, `functions/` and its README, and push that branch.
`PREVIEW_CONTENT=launch` drops draft items, as a production build does; leave it off to see drafts stamped.

A second Pages project pointed at `rebuild` (build `npm run build`, output `out`) would also work, but needs a change in Cloudflare.

## Keeping the source off the live site before launch

Until the project's root directory is changed to `rebuild`, everything in the repository root is published, which
would include this folder. `functions/rebuild/[[path]].js` at the repository root answers every `/rebuild/...` address
with 404, so none of these source files can be downloaded from konnectortech.com, before or after the merge.

## Going live (only after approval)

1. In `konnector-website` → Settings → Variables and secrets (Production), set the variables below. `ENQUIRIES` is
   already bound for the current site; check it is still listed under Bindings.
2. In `konnector-website` → Settings → Build: root directory `rebuild`, build command `npm run build:production`,
   build output directory `out`. Node comes from `rebuild/.node-version` (22).
3. Merge the pull request. Pages builds `main` with the new settings and publishes the new site on the same domain.
   The old section links (`#services`, `#how`, `#sectors`, `#about`, `#contact`) keep working.
4. Rolling back: Pages → Deployments → the last old-site deployment → "Rollback to this deployment", then put the
   build settings back (root `/`, no build command).

The launch gate (`npm run build:production`) fails if the bot-check site key is missing, and, for any section switched
back on, if its content is still draft.

### Sections switched off for launch (owner decision, 14 Nov 2026)

Delivery records, the credentials strip and procurement facts, the capability statement buttons and the people
profiles are hidden until the content exists. While a section is off, its nav and footer links, buttons, launch checks
and pages go with it (the frontier section stands in as scene 6, and `/proof/` answers 404). To bring one back, set its
variable to `1` in the build settings and redeploy:

| Variable | Brings back |
| --- | --- |
| `NEXT_PUBLIC_SHOW_PROOF` | Delivery records: home scene 6, `/proof/` pages, nav and footer links |
| `NEXT_PUBLIC_SHOW_CREDENTIALS` | Credentials strip and the public-sector procurement facts table |
| `NEXT_PUBLIC_SHOW_CAPABILITY_STATEMENT` | "Download / Request capability statement" buttons (needs `NEXT_PUBLIC_CAPABILITY_STATEMENT_URL` to download) |
| `NEXT_PUBLIC_SHOW_PEOPLE` | "The people" on the About page |

| Variable | Kind | Purpose |
| --- | --- | --- |
| `ENQUIRIES` | KV binding | Stores every enquiry and the rate-limit counters (same namespace the current site uses). |
| `RESEND_API_KEY`, `NOTIFY_TO`, `NOTIFY_FROM` | server | Email to Konnector and the confirmation to the visitor. |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | server / build | Invisible bot check. |
| `LEAD_WEBHOOK_URL`, `LEAD_WEBHOOK_SECRET` | server | Optional signed push of each lead (stage "signal") for Konnector CRM. |
| `NEXT_PUBLIC_BOOKING_URL` | build | Optional calendar link for "Book a 30-minute call". Not used at launch: the button opens the contact form, which asks for times. |
| `NEXT_PUBLIC_CAPABILITY_STATEMENT_URL` | build | PDF for "Download capability statement". Until set, the button reads "Request capability statement". |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | build | Turns on privacy-friendly analytics. Events are always recorded in `window.__ktEvents`. |
| `NEXT_PUBLIC_HERO` | build | `A` (default) or `B` hero headline, for the post-launch headline test. |

## What Konnector still needs to supply

Nothing here is invented. Each missing item shows as a stamped **DRAFT** in preview builds and is left out of production builds.

Not needed for launch (switched off, see above), wanted later:

- **Proof:** at least two delivery records, one public and one private (`content/proof/*.md`).
- **Credentials, registrations, NAICS codes, contract routes, people:** `content/company.json`.
- **Capability statement PDF**, and optionally a **calendar booking link**.

Settled:

- **Frontier technology cards** (`content/frontier.json`): Koniku, QVITI and RSQ HOLO. Konnector is shown as the integrator, not the inventor. Wording checked and cleared by Gbenga on 12 Nov 2026. Text names only: no logos and no "partner" wording.
- **Reply promise:** "one business day", confirmed by the owner on 14 Nov 2026 (`src/lib/site.ts`, `functions/api/contact.js`).
- **Privacy notice:** draft approved on 14 Nov 2026, with a line naming Cloudflare Turnstile (invisible mode) and linking its Privacy Addendum.
- **Contact form email:** `NOTIFY_TO` and `NOTIFY_FROM` are george@konnectortech.com; Resend sends from the konnectortech.com domain.

## Where this build differs from the script, and why

- **Hosting:** Next.js is exported as static files so it runs on the current Cloudflare Pages setup; the form's server side is a Pages Function (the pattern the live site already uses) instead of a Next.js server route.
- **3D art:** the corridor and the sphere's transformation are modelled and animated in Blender by script (`art/`), with plain shapes: racks, trays, shelves and a terminal as clean boxes. A 3D artist can replace the model files without code changes. If a model fails to load, a stand-in built in code takes its place.
- **Screen effects:** the cyan glow is a real selective bloom pass on the Full tier; the Light tier uses soft sprites instead. Film grain and darkened edges are CSS overlays on the Full tier.
- **Lead store:** Cloudflare KV (already in use) instead of a database table. Konnector CRM's API needs fields a web enquiry cannot supply, so the CRM push is a signed webhook waiting for an inbound-lead endpoint on the CRM side.
- **Security headers:** Next.js writes small inline scripts, so `script-src` allows `'unsafe-inline'`. The other directives match the live site.
- **Not yet done:** Safari on a real iPhone or Mac, Firefox with 3D on a real laptop, an older phone, a session with a screen reader, real email sending, and the A/B headline split (one headline is set per build). See `docs/phase-5-gate.md`.

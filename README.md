# Konnector Tech website

The public website for **Konnector LLC** (Georgia), served at **konnectortech.com**.
Right now it is a single "coming soon" page. This README is the plan for the full site — read it before building anything.

---

## 1. What Konnector is

Konnector LLC is a **technology implementation firm**. Public and private sector organizations bring us a project or program;
we deliver it on time, on budget, and to agreed acceptance criteria, while keeping their staffing costs down.

Think of us as a **general contractor for technology projects**: the client owns the vision, we bring the crew,
the plan, the tools and the materials, and we hand over a finished, working result.

### Positioning statement (use this wording as the source of truth)

> Konnector LLC is a technology implementation firm that helps public and private sector organizations deliver critical
> projects and programs on time, on budget, and to agreed acceptance criteria. We bring the delivery leadership, skilled
> talent, and integration expertise to take an initiative from plan to working result. Where needed, we also source and
> integrate the technology itself, so clients deal with one accountable partner instead of juggling vendors. Our flexible
> staffing model lets clients scale expert capacity up or down without the cost of permanent headcount. Whatever the
> sector, our promise is the same: we deliver.

### What we offer

| Offer | What it means on the site |
| --- | --- |
| **Project & program delivery** (the core) | Delivery leadership — project/program management, Agile/SAFe delivery, PMO support. This is what we sell. |
| **Systems implementation & integration** | Part of delivery: configuring, connecting and rolling out systems so they work together. |
| **Flexible expert staffing** | Skilled consultants added to a client team, scaled up or down as the project needs. |
| **Technology sourcing** | We buy and integrate the hardware/software a project needs. Mention only *inside* delivery — never as a standalone "reseller" offer. |

Restaurant analogy for the hierarchy: delivery is the **meal** we sell, integration is the **cooking**, and sourcing
technology is **buying the groceries** — we only do it to serve the meal.

### Who the site is for

1. **Public sector buyers** — state agencies, cities, counties, schools, authorities. First target: the **State of Georgia**.
2. **Private sector organizations** — mid-size and enterprise teams running technology projects.
3. **Prime contractors / partners** looking for a reliable delivery or staffing sub.
4. **Consultants** who may want to join our bench (later phase).

Reference models for tone and structure: Capgemini and Infosys (scale and credibility), CSI Companies (staffing + IT consulting mix).

### Tagline

**Technology delivered. End2End**

- Use **"End2End"** only in the tagline, logo lockups and headlines.
- In body text and formal documents (bids, capability statements), write **"end-to-end"**.

### Logo story

The mark is three points joined into one unbroken triangle. Use this story on the About page and in brand materials:

> The Konnector mark is three points joined into one unbroken triangle. Each line runs from end to end. Some run
> straight, like the plan. Some bend, like the real world, with its turns and surprises. Every one still reaches its
> point. That is how we work: we take ownership from first plan to final handover, connect the people and technology
> in between, and deliver, end to end.

- **Three nodes** = plan, build, handover (also: people, technology, plans).
- **Straight line** = the plan. **Bent line and the bump in the base** = real-world change, absorbed on the way.
- **Every line reaches its node** = nothing is left half-done.

The logo artwork stays as designed (`favicon.svg`) — do not redraw it.

The coming-soon page shows a 3D **logo reveal animation** (8 s, plays once, holds on the finished logo; people with
reduced motion turned on see the still final frame). The web copy (1280×720 MP4, ~0.7 MB, no audio) and its still frame
are currently hosted on Higgsfield's CDN — URLs are in `index.html`. Move both into Cloudflare R2 when convenient.

---

## 2. Messaging rules (must follow)

- Say **"public and private sector"** — do **not** say "government" on its own.
- **Sector-agnostic.** Do not lead with any one industry.
- **No "Africa" anywhere.** This site is not connected to the earlier Konnector Africa LLC; do not reference it, link to it, or reuse its content.
- Lead with **outcomes** (on time, on budget, meets acceptance criteria), not with lists of tools.
- One coherent offer. Avoid pages that make us look like a scattered list of unrelated services.
- Brand name on the site: **Konnector Tech** (legal entity in the footer: Konnector LLC, Georgia).
- Contact email: `george@konnectortech.com` (Microsoft 365).
- Plain, confident, short sentences. No hype words ("revolutionary", "world-class").

---

## 3. Site plan

### Phase 0 — Coming soon (live now)
- `index.html` — holding page with a "Notify Me" email sign-up.
- Update the lede to match the positioning statement above when convenient.

### Phase 1 — Launch site
| Page | Purpose / key content |
| --- | --- |
| **Home** | Positioning headline, the "we deliver" promise, 3–4 offer cards, how we work, public/private sector split, call to action. |
| **Services** | The four offers above, with delivery as the hero and the other three framed as part of it. |
| **How we work** | Delivery approach: discovery → plan → build/integrate → test against acceptance criteria → handover. Flexible staffing model. |
| **Sectors** | Public sector and private sector sections (kept general — sector-agnostic). |
| **About** | Who we are, leadership, certifications (e.g. SAFe RTE, AI Product/Project Management). |
| **Contact** | Contact form (reuse the Pages Function pattern in `functions/`), email, Atlanta, GA. |

### Phase 2 — Public sector readiness
- **Capability statement** page + downloadable PDF (core competencies, differentiators, company data, NAICS codes, contact) — needed for State of Georgia bids.
- Company data block (UEI/CAGE and any Georgia vendor registration) once those are in place — do not invent numbers.
- Case studies / project examples as they come in.

### Phase 3 — Later
- Careers / join our bench.
- Insights or news.
- Client links into Konnector's own platforms (Konnect Hub for project delivery, Konnector CRM) — not public-facing yet.

---

## 4. Tech & hosting

Static site, hosted on **Cloudflare Pages** (moved from Vercel, Oct 2026). No build step; build output directory is `/`.

- `index.html` — the page
- `_headers` — security headers (Cloudflare Pages format)
- `functions/api/notify.js` — "Notify Me" sign-ups (Cloudflare Pages Function at `/api/notify`).
  Set `RESEND_API_KEY` (secret) and `NOTIFY_TO` (comma-separated) under Pages → Settings → Variables and Secrets
  to get each sign-up by email; optional `NOTIFY_FROM`. Without them, sign-ups still appear in the function's real-time logs.
- Images and larger site files go in **Cloudflare R2**.

Preview locally: `npx wrangler pages dev .`

Guidelines for developers:
- Keep it fast and simple: plain HTML/CSS/JS unless a page genuinely needs more. If a framework is introduced, document the build step here.
- Mobile-first, accessible (WCAG 2.1 AA), light and dark mode.
- Every page needs a unique `<title>` and meta description.

### DNS & email
DNS lives in Cloudflare; the domain is registered at GoDaddy. Email stays on Microsoft 365 via GoDaddy — keep all MX,
autodiscover, DKIM, SPF and DMARC records set to **DNS only** (grey cloud).

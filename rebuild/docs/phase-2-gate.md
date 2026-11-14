# Phase 2 gate: brief mode and pages

**Gate:** brief mode passes the budgets and the form test, and could go live by itself.
**Result:** every check below passes on the PR branch. Nothing is merged or deployed to production.

Run it all with `npm run verify` (typecheck, 10 unit tests, build, budgets, 35 browser tests).

## 1. Tier matrix: the full story is the default

Brief mode is chosen only for reduced motion, no 3D, data saver, a slow connection, or the visitor's choice.
Each row is an automated test (`tests/e2e/phase2.spec.ts`) that imitates the device.

| Device or setting | Gets | Why |
| --- | --- | --- |
| Desktop, capable graphics chip | Story, Full | default |
| Apple silicon laptop | Story, Full | default |
| Laptop with integrated graphics (Intel UHD) | Story, Light | integrated graphics |
| Office PC with software graphics only | Story, Light | steps down further by itself if too slow |
| Capable chip but 4 cores, or 4 GB memory | Story, Light | modest hardware |
| Phone (touch, narrow screen) | Story, Light | phone |
| Reduced motion on | Brief | reduced motion |
| Data saver on | Brief | data saver |
| Slow connection (2G) | Brief | slow connection |
| 3D unavailable | Brief, and "Play the story" is not offered | no 3D |
| Visitor chose "Skip the story" | Brief, remembered | choice |
| Visitor chose "Play the story" (even with reduced motion on) | Story, remembered | choice |

**Step-down before fallback:** while playing, the story measures its frame rate and steps down one rung at a time:
Full → Light → Light at lower resolution → brief mode. This logic is in place but is **not exercised by a test**:
it needs a real slow device.

Testers can force a state from the address: `?mode=story`, `?mode=brief`, `?tier=full`, `?tier=light`.

## 2. Brief mode stands on its own

| Check | Result |
| --- | --- |
| Scripts turned off: all seven scene headings, four service links (Technology sourcing included), the form and the stills are present | Pass |
| Scripts turned off: all 10 supporting pages return and have one main heading | Pass |
| Brief mode requests no 3D code, models or textures | Pass |
| Headline paint on a throttled phone (slow 4G, 4× slower processor) | 1.8 s (limit 2.5 s) |
| Layout shift on the same phone | 0.000 (limit 0.1) |
| First-load script + page, compressed | 171 KB (limit 200 KB) |
| Accessibility scan (WCAG 2.2 AA) on 7 pages | No serious or critical issues |

Interaction delay (limit 200 ms) is not measured: it needs real visitors or a real device.

## 3. Form and lead handling

| Check | Result |
| --- | --- |
| Problems explained beside each field in plain words | Pass |
| A test enquiry is stored and confirmed in the same frame, with the reply promise, capability statement and call offers | Pass |
| A failed send keeps what the visitor typed | Pass |
| Server route: validation, spam trap, bot check, rate limit, lead store, notify email, visitor confirmation, signed lead push | 10 unit tests pass |

Not tested end to end: a real email leaving through Resend, and the Cloudflare bot check, because no keys are set in the preview.

## 4. Truthful buttons

- No booking link is set, so every call button reads **"Request a call"** and opens the form with a note. With `NEXT_PUBLIC_BOOKING_URL` set it reads "Book a 30-minute call" and opens the calendar.
- No PDF is set, so the statement button reads **"Request capability statement"**. With `NEXT_PUBLIC_CAPABILITY_STATEMENT_URL` set it reads "Download capability statement" and is a real download.

## 5. Production build check

`npm run build:production` now fails on **any** draft item, on fewer than two real records, on a missing public or
private record, on a missing capability statement (or a path that is not in `/public`), on a missing booking link and
on a missing bot-check key. Today it fails with 18 reasons, which is correct: no proof, credentials or codes have been supplied, and none were invented.

## 6. Analytics event list

One test walks the page and confirms: scene reached (1 to 7), sector chosen, button pressed with its position, form started, form sent, brief mode opened (with the reason). "Story skipped" is confirmed in the story-mode test.

## 7. Gate 1 changes carried in

| Change | Status |
| --- | --- |
| Scene 3 panel 1 uses the current site's sentence word for word | Done |
| Hero launches with headline A; "one business day" kept | Done |
| Confirmation offers the capability statement and the call (or their "Request" fallbacks) | Done, tested |
| Scene 5: "Request a call" with no booking link | Done, tested |
| Scene 6: each record opens its full case study | Done (each card links to its own page) |
| Scene 4: skyline not drawn before scene 5; block in frame at the bend; gate labels show the stage name | Done |
| Scene 3: all four panels dock **onto the line** | Not done. Panels are joined to the line by leaders but still sit in the side card. Phase 3. |
| Scene 7: the ring frames the form with the form in view; call and email offered there | Partly. Call and email sit under the form. Framing with the form in view is Phase 3. |
| Sound, off by default | In place |
| Transformation: 4 s, scroll-driven on desktop, self-playing on phones, 8-second video | In place; the video will be re-exported from final art in Phase 4 |

## 8. Supporting-page copy review and sign-off

Reviewed on 11 Nov 2026 against the script's page table, its voice rules and the site's messaging rules, at the
owner's request ("if it fits the script and overall plan, go ahead with the sign-off").

| Check | Result |
| --- | --- |
| Every page in the script's table exists and does its stated job (services ×4, public sector, private sector, how we deliver, proof, about, contact) | Yes |
| Blueprint style, no heavy 3D, a small still of the sphere | Yes |
| Plain words, short sentences, "you" at least as often as "we" on service and sector pages | Yes (About says "we" more, which suits it) |
| Four signature phrases exact; no filler or hype words | Yes |
| "Public and private sector", never "government" alone; "End2End" only in the tagline; no numbers | Yes |
| Sourcing shown only as part of delivery | Yes |
| Nothing claimed that the script or the current site does not support | **No, at first.** Fixed, see below. |

**What was changed before signing off.** I had written service details that neither the script nor the current
site states. They were removed or reduced to the current site's own words:

- Integration: "data migration and cutover", "a named owner, a test and a fallback" for every handoff.
- Staffing: a list of specific roles (delivery leads, analysts, technical specialists).
- Sourcing: "vendor selection support".
- How we deliver: "a list of risks, each with an owner", "regular reports", "handover documents".
- Contact: a description of what the capability statement contains, before the document exists.
- Privacy notice: promises about business conduct (not selling details, no mailing list). It now states only what the site itself does.

**Signed off** with those changes. One item stays with the owner: the privacy notice is a public legal statement,
so it should be read by the owner before launch even though its claims match the site's code.

**Phase 2 gate: signed off.** Phase 3 (grey-box story timing) starts from here.


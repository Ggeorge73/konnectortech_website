# Higgsfield assets: room textures and recorded sound (scenes 4 and 5 backdrop tried and removed)

Branch `claude/project-thread-bcekqg`, pull request #7. Nothing new was generated for this work: the assets below
were already made and paid for, and were only downloaded.

## What was generated, and what it cost

21 pieces were made on 14 Nov 2026: 18 images (GPT Image 2.6) and 3 sounds (Mirelo). 11 were picked.
Credits spent: **40.5** (6 images at 2.75, 12 at 1.5, sounds at 5 + 0.5 + 0.5). Balance after: **1028.39**,
checked again for this report and unchanged (no spend since 21:36 UTC on 14 Nov).

| Pick | Job id | Download | Used for |
| --- | --- | --- | --- |
| t01 floor | 8edabd61-9022-4cda-9e06-5292f01b168b | 1953 KB, 1024 px PNG | Floor detail |
| t03 rack front | e50a5705-41f2-4d5d-9ecf-676a441ef116 | 1543 KB, 1024 px PNG | Rack front units |
| t10 rack body | 717468e7-4c41-42b2-885e-2a1c9d6049ea | 2052 KB, 1024 px PNG | Rack bodies (louvred sides) |
| t04 wall | 5bbb4ac3-96bb-43a5-b1bc-d35ae135ee43 | 1331 KB, 1024 px PNG | Walls |
| t07 ceiling | 7cc7ba02-a70d-4334-8a44-6f4952a0d09e | 1922 KB, 1024 px PNG | Ceiling |
| t08 cable tray | cdbba354-9a2e-4586-9532-4bce33a2a280 | 1636 KB, 1024 px PNG | Cable trays |
| b20 scene 4 backdrop | 5d760e62-5c1b-4237-bed5-5781c5682d72 | 2030 KB, 2688 x 1152 PNG | **Removed** (frame rate, see below) |
| b25 scene 5 backdrop | 926c2478-2958-4699-b9a8-7593dd0d47de | 2578 KB, 2688 x 1152 PNG | **Removed** (frame rate, see below) |
| a30 hum loop | e908a38d-f83e-4786-ba01-4ed473377f89 | 292 KB, 20 s MP3 | Room hum |
| a31 click | e804c365-5192-47ed-953f-bcc9fb975b40 | 42 KB, 2 s MP3 | **Not used** (see below) |
| a32 tick | 3fadbe1d-642b-45e3-9d24-bcc79749ea8f | 43 KB, 2 s MP3 | Ring-lock tick |

The originals are kept in `art/src/` and are never served.

**a31 is close to silent.** Its loudest moment is -42 dBFS and it has no click in it, only background noise, so it
is not shipped. The moment it was meant for (the mark forming) keeps the synthesised click.

## What the site now ships

| File | Size | Notes |
| --- | --- | --- |
| `models/room_dim.full.ktx2`, `room_lit.full.ktx2` | 459 KB, 500 KB | Rebaked with texture (+1 KB each), same size and format as before |
| `models/room_dim.light.jpg`, `room_lit.light.jpg` | 58 KB, 73 KB | Rebaked with texture (under +1 KB each), same size and format as before |
| `audio/hum.mp3` | 48 KB | 12 s seamless loop, fetched only when sound is turned on |
| `audio/tick.mp3` | 1.4 KB | Fetched only when sound is turned on |

| Budget | Before | After | Limit |
| --- | --- | --- | --- |
| First load | 173.0 KB | 173.0 KB | 200 KB |
| Light tier | 1118.5 KB | 1119.5 KB | 1536 KB |
| Full tier | 2201.8 KB | 2204.5 KB | 3072 KB |

## What changed in each scene

| Scene | Change |
| --- | --- |
| 1 Arrival (dim room) | Floor tiles, wall panels, ceiling grid, server faces and louvres now show faintly in the baked light. Same room, same greys. |
| 2 The scan | Same surface detail wherever the real room still shows (through the lens, before the sweep). |
| 3 The line | No change (the room is in its blueprint look by then). |
| 4 The run | With sound on, each ring lock plays the recorded tick. |
| 5 Two doors | No change. |
| 6 Frontier tech | No change (the 3D rests). |
| 7 Transformation | The lit room shows the same surface detail. The mark-forming click stays synthesised. |
| Throughout | With sound on: the recorded room hum. Any recording that fails to load falls back to the synthesised sound. |

## Frame rate

**First reading, with the backdrop (15 Nov 2026, Samsung foldable, `?fps=1`):** about 35 fps average unfolded and
47 folded, against a 1% low of 49 unfolded for the live site before this work. The agreed rule was to remove the
backdrop if the unfolded 1% low fell under 45, so **the scenes 4 and 5 backdrop is removed** (component, shader and
the four JPGs). The originals stay in `art/src/`.

**What is left, checked against the live site's code (main).** This environment has no graphics chip, so these are
software-renderer timings: good for comparing two builds, not real frame rates. Light tier, unfolded-foldable screen
(760 x 880 at 2.5x, drawn at 0.8), four alternating runs per build:

| Scene | Main, ms per frame | This branch | Difference | Draw calls |
| --- | --- | --- | --- | --- |
| 1 Arrival | 74.9 | 76.7 | +2.4% | 67 / 67 |
| 2 The scan | 80.1 | 78.2 | -2.4% | 89 / 89 |
| 3 The line | 71.4 | 72.3 | +1.3% | 94 / 94 |
| 4 The run | 49.1 | 50.1 | +2.0% | 131 / 131 |
| 5 Two doors | 50.4 | 50.8 | +0.7% | 123 / 123 |
| 7 Transformation | 78.2 | 77.3 | -1.2% | 79 / 79 |

Every scene is within the spread between runs of the same build (about 5%), and the draw calls are identical. The
room textures are the same size and format as before, so the graphics chip does the same work for them; only the
picture inside them changed. They were **kept**: cutting them would not be expected to win back frame rate.

With the backdrop gone, this branch draws what the live site draws. If the foldable still reads well below the live
site, the next step is a back-to-back reading of both on the same phone in the same state (cool, battery saver off,
unfolded, the whole story played once).

**Needed:** play the whole story on the foldable, unfolded, with `?fps=1`, and read the 1% low.

Preview: https://claude-project-thread-bcekqg.konnector-website.pages.dev
With the readout: https://claude-project-thread-bcekqg.konnector-website.pages.dev/?fps=1

## Partner cards

The frontier technology cards (Koniku, QVITI, RSQ HOLO) need official product photos, used with each company's
permission. No AI images of their products were made.

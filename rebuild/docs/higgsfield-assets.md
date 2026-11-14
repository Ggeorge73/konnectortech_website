# Higgsfield assets: textures, scenes 4 and 5 backdrop, recorded sound

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
| b20 scene 4 backdrop | 5d760e62-5c1b-4237-bed5-5781c5682d72 | 2030 KB, 2688 x 1152 PNG | Scene 4 horizon |
| b25 scene 5 backdrop | 926c2478-2958-4699-b9a8-7593dd0d47de | 2578 KB, 2688 x 1152 PNG | Scene 5 city horizon |
| a30 hum loop | e908a38d-f83e-4786-ba01-4ed473377f89 | 292 KB, 20 s MP3 | Room hum |
| a31 click | e804c365-5192-47ed-953f-bcc9fb975b40 | 42 KB, 2 s MP3 | **Not used** (see below) |
| a32 tick | 3fadbe1d-642b-45e3-9d24-bcc79749ea8f | 43 KB, 2 s MP3 | Ring-lock tick |

The originals are kept in `art/src/` and are never served.

**a31 is close to silent.** Its loudest moment is -42 dBFS and it has no click in it, only background noise, so it
is not shipped. The moment it was meant for (the mark forming) keeps the synthesised click.

## What the site now ships

| File | Size | Notes |
| --- | --- | --- |
| `models/backdrop_4.light.jpg` | 30 KB | 1280 px wide |
| `models/backdrop_5.light.jpg` | 59 KB | 1280 px wide |
| `models/backdrop_4.full.jpg` | 69 KB | 2048 px wide |
| `models/backdrop_5.full.jpg` | 129 KB | 2048 px wide |
| `models/room_dim.full.ktx2`, `room_lit.full.ktx2` | 459 KB, 500 KB | Rebaked with texture (+1 KB each) |
| `models/room_dim.light.jpg`, `room_lit.light.jpg` | 58 KB, 73 KB | Rebaked with texture (under +1 KB each) |
| `audio/hum.mp3` | 48 KB | 12 s seamless loop, fetched only when sound is turned on |
| `audio/tick.mp3` | 1.4 KB | Fetched only when sound is turned on |

The Light backdrops came in under the 60 to 80 KB aim at a high JPG quality (92, full colour detail): the pictures
are mostly dark sky, which compresses very well.

| Budget | Before | After | Limit |
| --- | --- | --- | --- |
| First load | 173.0 KB | 173.0 KB | 200 KB |
| Light tier | 1118.5 KB | 1209.2 KB | 1536 KB |
| Full tier | 2201.8 KB | 2402.9 KB | 3072 KB |

## What changed in each scene

| Scene | Change |
| --- | --- |
| 1 Arrival (dim room) | Floor tiles, wall panels, ceiling grid, server faces and louvres now show faintly in the baked light. Same room, same greys. |
| 2 The scan | Same surface detail wherever the real room still shows (through the lens, before the sweep). |
| 3 The line | No change (the room is in its blueprint look by then). |
| 4 The run | A far horizon with power lines and low buildings fades in behind the grid as the camera moves out beside the track. With sound on, each ring lock plays the recorded tick. |
| 5 Two doors | The horizon crossfades to a lit city as the blueprint skyline appears; the skyline stands in front of it. |
| 6 Frontier tech | No change (the 3D rests). |
| 7 Transformation | The lit room shows the same surface detail. The mark-forming click stays synthesised. |
| Throughout | With sound on: the recorded room hum. Any recording that fails to load falls back to the synthesised sound. |

The backdrop is story mode only: brief mode (reduced motion, data saver, no 3D) never downloads or shows it.

## Frame rate

This environment has no graphics chip, so real frame rates cannot be measured here. What can be measured:

- **Draw calls:** the backdrop adds one in scenes 4 and 5 (131 to 132, 123 to 124 on Light). It is left out of the
  sphere's reflections and of the bloom pass.
- **Software renderer, Light tier, foldable-sized screen (690 x 830):** scene 4 costs the same with or without the
  backdrop (48 ms a frame either way); scene 5 costs about 4 ms more (50 to 54 ms, 8%). A software renderer
  exaggerates the cost of filling the screen, so a phone's graphics chip should see less than this, but only a real
  reading counts.

**Needed:** play the whole story on the Samsung foldable, opened unfolded, with `?fps=1`, and read the 1% low.
If it is under 45, the backdrop comes out. The Light tier's 1% low must stay at 30 or more.

Preview: https://claude-project-thread-bcekqg.konnector-website.pages.dev
With the readout: https://claude-project-thread-bcekqg.konnector-website.pages.dev/?fps=1

## Partner cards

The frontier technology cards (Koniku, QVITI, RSQ HOLO) need official product photos, used with each company's
permission. No AI images of their products were made.

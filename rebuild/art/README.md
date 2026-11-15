# Art pipeline: Blender to the web

The story's 3D scene is modelled, lit and animated in Blender, then compressed for the browser. Everything is
scripted, so the assets can be rebuilt from this folder with no manual steps.

Think of it as a bakery: the recipe lives here, the bread is delivered to `public/models/`.

| Step | File | What it does |
| --- | --- | --- |
| 1. Model and bake the room | `build_room.py` | Builds the equipment corridor, bakes its lighting with Cycles into two textures (dim for scene 1, lit with cyan status lights for scene 7), exports the mesh and the blueprint line set. Floor, walls, ceiling, rack fronts, rack bodies and cable trays multiply their grey by a box-mapped photo texture from `src/` before the bake (each texture scaled to average 1, about half its contrast kept), so the bake carries real surface detail. |
| 2. Sphere and mark | `build_sphere.py` | Builds the 36 plates, hub and pistons, and animates the transformation as one 4-second clip. |
| 3. Preview | `render_preview.py` | Ray-traced stills of scenes 1 and 7 to judge the look outside the browser. |
| 4. Compress | `compress.mjs` | Meshopt geometry, KTX2 (Basis ETC1S) textures in Full and Light sizes, one merged animation clip. Prints sizes against the budgets. |
| 5. Sound | `build_audio.py` | The recorded hum (levelled, 12 s seamless loop) and the ring-lock tick, as small MP3s in `public/audio/`. Needs ffmpeg. Run on its own: `.venv/bin/python build_audio.py`. |

## Run it

Blender runs headless as a Python module (`bpy`, Blender 5.3). One-time set-up:

```bash
python3 -m venv .venv && .venv/bin/pip install bpy
```

```bash
npm install
```

Build everything (from `rebuild/art`):

```bash
mkdir -p out && .venv/bin/python build_room.py -- out 96 && .venv/bin/python build_sphere.py -- out && node compress.mjs
```

The number after `out` is the bake's sample count: 8 for a quick check (about 90 seconds on 4 cores), 96 or more for delivery.

## Source art (`src/`)

Generated with Higgsfield on 14 Nov 2026 and kept here as the originals (never served: only the processed files in
`public/` are). Images by gpt_image_2_6, sounds by mirelo_text_to_audio.

| File | Job id | Use |
| --- | --- | --- |
| `t01_floor.png` | 8edabd61-9022-4cda-9e06-5292f01b168b | Floor (raised-floor tiles), 2.4 m tile |
| `t03_rack_front.png` | e50a5705-41f2-4d5d-9ecf-676a441ef116 | Rack front units (server faces), 0.8 m tile |
| `t10_rack_body.png` | 717468e7-4c41-42b2-885e-2a1c9d6049ea | Rack bodies (louvred sides), 0.9 m tile |
| `t04_wall.png` | 5bbb4ac3-96bb-43a5-b1bc-d35ae135ee43 | Walls (panels), 3 m tile |
| `t07_ceiling.png` | 7cc7ba02-a70d-4334-8a44-6f4952a0d09e | Ceiling (grid), 2.4 m tile |
| `t08_cable_tray.png` | cdbba354-9a2e-4586-9532-4bce33a2a280 | Cable trays, 0.6 m tile, turned to run along the room |
| `b20_scene4_backdrop.png` | 5d760e62-5c1b-4237-bed5-5781c5682d72 | Not used: the scenes 4 and 5 backdrop was taken out on 15 Nov 2026 (it cost too much frame time on a foldable's large screen). Kept here as the original. |
| `b25_scene5_backdrop.png` | 926c2478-2958-4699-b9a8-7593dd0d47de | Not used (see b20). |
| `audio/a30_hum_loop.mp3` | e908a38d-f83e-4786-ba01-4ed473377f89 | Room hum |
| `audio/a31_click.mp3` | e804c365-5192-47ed-953f-bcc9fb975b40 | Not used: near silent (peak -42 dBFS, background noise only) |
| `audio/a32_tick.mp3` | 3fadbe1d-642b-45e3-9d24-bcc79749ea8f | Ring-lock tick (the clean transient at 0.64 s) |

## What the site receives (`public/models/`)

| File | Contents |
| --- | --- |
| `room.glb` | Corridor mesh, Meshopt. Vertex attributes `_sys` (0 = unnamed, 1 to 5 = the five systems) and `_glow` (1 = status light, 2 = strip light). |
| `room_dim.{full,light}.ktx2` | Baked lighting for scene 1 (2048 px for Full, 640 px for Light). |
| `room_lit.{full,light}.ktx2` | Baked lighting for scene 7: steady lights, cyan status lights. |
| `room_lines.glb` | Blueprint line set: every feature edge of the same model, with `_sys`. |
| `sphere.glb` | Nodes `plate_00` to `plate_35` (each with a `piece` morph target), `hub`, `piston_0..2`; animation `Transform`. |

The room's layout matches `src/story/world.ts`, so the line, the labels and the camera path need no change.

## Status

Pipeline set-up. The modelling, light levels and the plate design are a first pass and are **not locked**: they
go to sign-off at the art gate.

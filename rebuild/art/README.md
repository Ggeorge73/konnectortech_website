# Art pipeline: Blender to the web

The story's 3D scene is modelled, lit and animated in Blender, then compressed for the browser. Everything is
scripted, so the assets can be rebuilt from this folder with no manual steps.

Think of it as a bakery: the recipe lives here, the bread is delivered to `public/models/`.

| Step | File | What it does |
| --- | --- | --- |
| 1. Model and bake the room | `build_room.py` | Builds the equipment corridor, bakes its lighting with Cycles into two textures (dim for scene 1, lit with cyan status lights for scene 7), exports the mesh and the blueprint line set. |
| 2. Sphere and mark | `build_sphere.py` | Builds the 36 plates, hub and pistons, and animates the transformation as one 4-second clip. |
| 3. Preview | `render_preview.py` | Ray-traced stills of scenes 1 and 7 to judge the look outside the browser. |
| 4. Compress | `compress.mjs` | Meshopt geometry, KTX2 (Basis ETC1S) textures in Full and Light sizes, one merged animation clip. Prints sizes against the budgets. |

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

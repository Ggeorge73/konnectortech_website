# Phase 4 gate: final art

**Gate:** the frame-rate budgets hold on the Full and Light tiers (60 frames per second on Full, never under 30 on Light).
**Status: not signed off. Two things only the owner can settle are listed at the end.**

The art in this phase follows my recommendations where the owner had not chosen. It is not locked.

## What changed

| Script item | Result |
| --- | --- |
| Corridor modelled in Blender with lighting baked into textures | Done. Two bakes: dim (scene 1) and lit with cyan status lights (scene 7). The wider room and brighter scene 1 are approved and locked. |
| glTF with Meshopt compression and KTX2 textures | Done on Full (2048 px KTX2). **Light tier uses 640 px JPG textures instead**, so phones skip the 256 KB KTX2 decoder. |
| Same model drawn with two materials, chosen per pixel by a mask of lens, sweep and blend | Done. The baked mesh is the real look; a Blender-exported line set is the blueprint. |
| Mirror-chrome sphere reflecting an environment rendered from the room; three seams tracing the triangle | Done. The seams glow cyan on the sphere's face. |
| Transformation: 30 to 40 rigid plates that slide, rotate and unfold to show pistons and cylinders, then lock as the mark | Done as decided: **36 rigid plates, no bending.** Each plate is one rigid part: a patch of the sphere's shell with one piece of the mark fixed under it. It lifts off, turns over, travels and clamps onto an inner frame pushed out by three pistons. The locked plates form the mark; the shell patches sit edge-on behind it like fins. One clip, 4 seconds, scroll-driven on desktop, self-playing on phones. |
| Bloom on cyan, Full only | Done as decided: **selective bloom** on the line, the triangle seams, locked rings and the mark's three nodes only. The white strip lights are not bloomed. The Light tier keeps the soft halo and node glow as its stand-in. |
| Grain and darkened edges on Full only | Done (as overlays). |
| Sound, off by default | In place: room hum, click when rings lock, rising tone for the transformation. |
| One still per scene for brief mode, and the share image | Re-rendered from this art. |
| 8-second logo reveal video | Re-exporting with the rigid plates (`public/media/logo-reveal.mp4`). |

## Review fixes (11 Nov 2026)

| Asked | Result |
| --- | --- |
| Scene 2: all five system labels separate | Done. Labels are kept apart on screen and clear of the text panel. |
| Scene 2: all three gap labels show in the card | Done. They now appear earlier, while the card is pinned. |
| A test that exercises the step-down ladder | Done. It simulates slow frames and checks Full, then Light, then Light at lower resolution, then brief mode. |
| Light 1.5 MB budget as a CI check, with headroom | Done. CI runs the budget check on every push. Light is now 1.12 MB (was 1.495 MB). |
| Frame-rate readout on the preview only | Done. `?fps=1` and the slow-frame simulation are compiled out of production builds. |

## Frames (desktop, Full tier)

| Scene | Frame |
| --- | --- |
| 1 Arrival | ![1](phase-4/scene-1.jpg) |
| 2 The scan: five labels, three gap labels | ![2](phase-4/scene-2.jpg) |
| 3 The line, with bloom on the line | ![3](phase-4/scene-3.jpg) |
| 4 The run | ![4](phase-4/scene-4.jpg) |
| 5 Two doors | ![5](phase-4/scene-5.jpg) |
| 6 Proof | ![6](phase-4/scene-6.jpg) |
| 7 Plates opening | ![7a](phase-4/plates-1-opening.jpg) |
| 7 Plates clamping onto the frame | ![7b](phase-4/plates-2-clamping.jpg) |
| 7 Plates locked as the mark | ![7c](phase-4/plates-3-locked.jpg) |
| 7 The mark lit, with bloom on the nodes and the arriving line | ![7d](phase-4/scene-7.jpg) |

The plate sequence rendered in Blender itself (six moments, sphere to mark):

![Blender plates](phase-4/blender-plates.jpg)

Blender's ray-traced preview of scene 1, for comparison with the browser:

![Blender preview](phase-4/blender-scene1.jpg)

## Budgets

| Budget | Measured | Limit |
| --- | --- | --- |
| First load (page + script, compressed) | 171 KB | 200 KB |
| Full tier: 3D code + KTX2 decoder + models | 2.2 MB | 3 MB |
| Light tier: 3D code + models | 1.12 MB | 1.5 MB |
| Frame rate, Full | **Not measured** | 60 |
| Frame rate, Light | **Not measured** | never under 30 |

All 36 browser tests and 10 form tests pass.

## Why the gate is not signed off

**Frame rate cannot be measured here.** This environment has no graphics card and draws in software, so any number
from it would be meaningless. The owner will check the preview on real devices: add `?fps=1` to the address and a
small readout shows the tier, the current frame rate and the lowest seen. A desktop should hold about 60; a phone
should never drop under 30. Bloom adds an extra half-resolution pass on Full, so that tier is the one to watch.

## Also open

- The modelling is scripted and plain: racks, trays, shelves and a terminal as clean boxes. A 3D artist can replace the model files without code changes.
- If the Blender clip fails to load, the fallback is the earlier coded transformation, in which plates roll into shape. It is a safety net only.
- Recordings of all seven scenes are not yet re-made with this art.
- Real phones, Safari and Firefox are untested.

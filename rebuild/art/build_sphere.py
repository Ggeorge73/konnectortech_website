"""Builds the chrome sphere and its transformation into the Konnector mark, as one animation clip.

36 rigid plates. Nothing bends: every plate only moves and turns.
Each plate is one rigid part made of two things welded together:
  - a patch of the sphere's shell (what you see while it is a sphere), and
  - one piece of the mark (an arc of a ring node, or a length of a bar), tucked under the shell, inside the sphere.
The clip: each plate lifts off, turns over (unfolds) so its piece of the mark faces out, travels, and clamps onto an
inner frame. The locked plates form the mark; their shell patches end up edge-on behind it, like fins.
Inside sit a hub, three pistons that push out toward the three nodes, and the thin frame the plates clamp onto.

Output: art/out/sphere.glb. Nodes plate_00..plate_35, hub, piston_0..2 (barrel_*, rod_*), frame_*.
One animation per object in Blender; compress.mjs merges them into one clip named "Transform" (4 s at 24 fps).
"""
import math
import sys

import bpy  # must come first
import bmesh
from mathutils import Matrix, Quaternion, Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "out"
R = 0.3
S = 0.0195  # site units per unit of the logo's 70 x 62 drawing
NU, NV = 8, 6
TUBE, RING = 2.5 * S, 6.5 * S
FPS, FRAMES = 24, 96
TUCK = TUBE + 0.03  # how far under the shell each piece of the mark sits

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, FRAMES


def logo(x, y):  # logo drawing -> site space (x right, y up), centred
    return Vector(((x - 35) * S, (31 - y) * S, 0.0))


NODES = [logo(35, 9), logo(10, 51), logo(60, 51)]
BARS = [
    [logo(31.5, 14.5), logo(13.5, 45.5)],  # straight, like the plan
    [logo(38.5, 14.5), logo(43, 22), logo(37, 33), logo(56.5, 45.5)],  # bent, like the real world
    [logo(16.5, 51), logo(28, 51), logo(31, 47), logo(35, 51), logo(53.5, 51)],  # the bump in the base
]
Z = Vector((0, 0, 1))


def site(v):  # site space (x right, y up, z toward the camera) -> Blender space
    return Vector((v.x, -v.z, v.y))


def site_matrix(t, b, n, origin):
    """Object matrix whose local X, Y, Z are the site-space axes t, b, n (a rotation: n = t x b)."""
    m = Matrix((site(t), site(b), site(n))).transposed().to_4x4()
    m.translation = site(origin)
    return m


smooth = lambda x: (lambda t: t * t * (3 - 2 * t))(min(1, max(0, x)))
in_out = lambda x: (lambda t: 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2)(min(1, max(0, x)))

# ── The 36 shell patches of the sphere ──
patches = []
counts, lat, gap = [4, 8, 12, 8, 4], [math.radians(d) for d in (-90, -54, -18, 18, 54, 90)], 0.014
for band, count in enumerate(counts):
    for i in range(count):
        lon0 = (i + (band % 2) * 0.5) / count * math.tau + gap
        lon1 = (i + 1 + (band % 2) * 0.5) / count * math.tau - gap
        la0 = lat[band] + (0 if band == 0 else gap)
        la1 = lat[band + 1] - (0 if band == len(counts) - 1 else gap)
        pts = []
        for j in range(NV + 1):
            for k in range(NU + 1):
                lo, la = lon0 + (lon1 - lon0) * k / NU, la0 + (la1 - la0) * j / NV
                pts.append(Vector((R * math.cos(la) * math.sin(lo), R * math.sin(la), R * math.cos(la) * math.cos(lo))))
        c = sum(pts, Vector()) / len(pts)
        n = c.normalized()
        t = Vector((0, 1, 0)).cross(n)
        t = t.normalized() if t.length > 1e-3 else Vector((1, 0, 0))
        b = n.cross(t)
        local = [Vector(((p - c).dot(t), (p - c).dot(b), (p - c).dot(n))) for p in pts]
        patches.append({"c": c, "t": t, "b": b, "n": n, "local": local, "bmax": max(v.y for v in local)})

# ── The 36 pieces of the mark: 24 ring arcs and 12 bar lengths ──
pieces = []
for node in NODES:
    for i in range(8):
        mid = (i + 0.5) / 8 * math.tau
        r = Vector((math.cos(mid), math.sin(mid), 0))
        pieces.append({"kind": "arc", "mid": node + r * RING, "t": Z.cross(r), "half": math.pi / 8})
for pts in BARS:
    for j in range(len(pts) - 1):
        a, b = pts[j], pts[j + 1]
        length = (b - a).length
        parts = 3 if length > 30 * S else 2 if length > 15 * S else 1
        for k in range(parts):
            p0, p1 = a.lerp(b, k / parts), a.lerp(b, (k + 1) / parts)
            pieces.append({"kind": "bar", "mid": (p0 + p1) / 2, "t": (p1 - p0).normalized(), "half": (p1 - p0).length / 2})

# Pair shell patches with pieces by angle around the centre, so plates sweep outward instead of crossing
ang = lambda v: math.atan2(v.y, v.x)
pi_ = sorted(range(36), key=lambda i: (round(ang(patches[i]["c"]), 6), patches[i]["c"].z))
qi_ = sorted(range(36), key=lambda i: ang(pieces[i]["mid"]))

chrome = bpy.data.materials.new("chrome")
chrome.use_nodes = True
chrome.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
chrome.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.04
dark = bpy.data.materials.new("mechanism")
dark.use_nodes = True
dark.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
dark.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.4
dark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.11, 0.13, 1)


def tube(bm, centres, tangents, radius, segs=12):
    """A tube through `centres` in plate-local space; cross-sections are perpendicular to each tangent."""
    rings = []
    for c, tan in zip(centres, tangents):
        u = Vector((0, 1, 0))
        w = tan.cross(u).normalized()
        rings.append([bm.verts.new(c + (u * math.cos(f) + w * math.sin(f)) * radius) for f in (k / segs * math.tau for k in range(segs))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(segs):
            bm.faces.new((r0[k], r0[(k + 1) % segs], r1[(k + 1) % segs], r1[k]))


for n, (pa, qa) in enumerate(zip(pi_, qi_)):
    patch, piece = patches[pa], pieces[qa]
    bm = bmesh.new()
    # shell patch
    verts = [bm.verts.new(v) for v in patch["local"]]
    for j in range(NV):
        for k in range(NU):
            i0 = j * (NU + 1) + k
            bm.faces.new((verts[i0], verts[i0 + 1], verts[i0 + NU + 2], verts[i0 + NU + 1]))
    # its piece of the mark, tucked under one edge of the shell (local axes: x along the piece, y across the shell, z outward)
    b_s, n_s = patch["bmax"] - TUBE - 0.004, -TUCK
    if piece["kind"] == "arc":
        thetas = [-piece["half"] + 2 * piece["half"] * k / 6 for k in range(7)]
        centres = [Vector((RING * math.sin(th), b_s, n_s - RING + RING * math.cos(th))) for th in thetas]
        tangents = [Vector((math.cos(th), 0, -math.sin(th))) for th in thetas]
    else:
        centres = [Vector((-piece["half"], b_s, n_s)), Vector((piece["half"], b_s, n_s))]
        tangents = [Vector((1, 0, 0))] * 2
        for end in centres:  # round ends, so the bends between bar lengths close cleanly
            cap = bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=TUBE)
            bmesh.ops.translate(bm, verts=cap["verts"], vec=end)
    tube(bm, centres, tangents, TUBE)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new(f"plate_{n:02d}")
    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(chrome)
    obj = bpy.data.objects.new(f"plate_{n:02d}", mesh)
    scene.collection.objects.link(obj)

    # Rest pose: on the sphere. Final pose: the piece sits on the mark facing the camera, the shell edge-on behind it.
    rest = site_matrix(patch["t"], patch["b"], patch["n"], patch["c"])
    t1, b1 = piece["t"], Z
    n1 = t1.cross(b1)
    final = site_matrix(t1, b1, n1, piece["mid"] - n1 * n_s - b1 * b_s)
    p0, q0 = rest.translation.copy(), rest.to_quaternion()
    p1, q1 = final.translation.copy(), final.to_quaternion()
    if q0.dot(q1) < 0:
        q1.negate()
    lift_dir = site(patch["n"])
    order = (patch["c"].y / R + 1) / 2
    obj.rotation_mode = "QUATERNION"
    for f in range(FRAMES + 1):
        tau = f / FRAMES
        e = min(1, max(0, (tau - (1 - order) * 0.42) / 0.55))  # the top of the sphere goes first
        k1 = smooth(e / 0.35)  # lift off the sphere
        k2 = in_out((e - 0.3) / 0.7)  # turn over, travel, clamp
        x = (k2 - 0.8) / 0.2
        over = k2 + (0.05 * math.sin(math.pi * x) if 0 < x < 1 else 0)  # clamps about 5% past, then settles
        obj.location = (p0 + lift_dir * 0.17 * k1).lerp(p1, over)
        obj.rotation_quaternion = q0.slerp(q1, min(1, k2))
        obj.keyframe_insert("location", frame=f)
        obj.keyframe_insert("rotation_quaternion", frame=f)


# ── Mechanism: hub, three pistons, and the thin frame the plates clamp onto ──
def primitive(name, mat, make):
    make()
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


def key_scale(o, f, s):
    o.scale = (s, s, s)
    o.keyframe_insert("scale", frame=f)


hub = primitive("hub", dark, lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.075, depth=0.09))
hub.rotation_euler = (math.pi / 2, 0, 0)
pistons = []
for i, node in enumerate(NODES):
    length = node.length - RING
    arm = bpy.data.objects.new(f"piston_{i}", None)
    scene.collection.objects.link(arm)
    arm.rotation_euler = (0, -(math.atan2(node.y, node.x) - math.pi / 2), 0)
    barrel = primitive(f"barrel_{i}", dark, lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.03, depth=length * 0.5))
    barrel.parent = arm
    barrel.location = (0, 0, length * 0.25 + 0.03)
    rod = primitive(f"rod_{i}", chrome, lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.014, depth=1.0))
    rod.parent = arm
    pistons.append((arm, rod, length))
frame = []
for i, node in enumerate(NODES):
    ring = primitive(f"frame_ring_{i}", dark, lambda: bpy.ops.mesh.primitive_torus_add(major_radius=RING, minor_radius=0.018, major_segments=32, minor_segments=8))
    ring.rotation_euler = (math.pi / 2, 0, 0)
    ring.location = site(node)
    frame.append(ring)
k = 0
for pts in BARS:
    for a, b in zip(pts, pts[1:]):
        bar = primitive(f"frame_bar_{k}", dark, lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.016, depth=(b - a).length))
        bar.rotation_mode = "QUATERNION"
        bar.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(site(b - a).normalized())
        bar.location = site((a + b) / 2)
        frame.append(bar)
        k += 1
for f in range(FRAMES + 1):
    tau = f / FRAMES
    show = max(0.001, smooth((tau - 0.04) / 0.14) * (1 - smooth((tau - 0.82) / 0.14)))  # hub and pistons retract once the mark has locked
    ext = smooth((tau - 0.12) / 0.38) * (1 - smooth((tau - 0.74) / 0.2))
    key_scale(hub, f, show)
    for arm, rod, length in pistons:
        key_scale(arm, f, show)
        l = max(0.001, length * (0.45 + 0.55 * ext))
        rod.scale = (1, 1, l)
        rod.location = (0, 0, l / 2 + 0.03)
        rod.keyframe_insert("scale", frame=f)
        rod.keyframe_insert("location", frame=f)
    for part in frame:  # the frame is pushed out by the pistons and stays: the plates clamp onto it
        key_scale(part, f, max(0.001, smooth((tau - 0.3) / 0.3)))

bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/sphere.blend")
bpy.ops.export_scene.gltf(filepath=f"{OUT}/sphere.glb", export_format="GLB", export_yup=True, export_animations=True, export_frame_range=True, export_materials="EXPORT")
print("exported sphere.glb")

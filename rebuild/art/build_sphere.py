"""Builds the chrome sphere and its transformation into the Konnector mark, as one animation clip.

36 plates. Each plate starts as a patch of the sphere and ends as one piece of the mark (an arc of a ring node
or a length of a bar). Per plate, the clip keys: lift off and quarter-turn as a rigid plate, travel, roll into
the piece (a shape key), and lock with a small overshoot. Inside sit a hub and three pistons that push out
toward the three nodes. The site sets the clip's time from the scroll.

Output: art/out/sphere.glb (nodes plate_00..plate_35, hub, piston_0..2; animation "Transform", 4 s at 24 fps).
First pass for the pipeline: timing and plate design are not locked until the art gate.
"""
import math
import sys

import bpy  # must come first
from mathutils import Quaternion, Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "out"
R = 0.3
S = 0.0195  # site units per unit of the logo's 70 x 62 drawing
NU, NV = 10, 6
TUBE, RING = 2.5 * S, 6.5 * S
FPS, FRAMES = 24, 96

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS
scene.frame_start, scene.frame_end = 0, FRAMES


def logo(x, y):  # logo drawing -> site space (x right, y up), centred
    return ((x - 35) * S, (31 - y) * S)


NODES = [logo(35, 9), logo(10, 51), logo(60, 51)]
BARS = [
    [logo(31.5, 14.5), logo(13.5, 45.5)],
    [logo(38.5, 14.5), logo(43, 22), logo(37, 33), logo(56.5, 45.5)],
    [logo(16.5, 51), logo(28, 51), logo(31, 47), logo(35, 51), logo(53.5, 51)],
]


def site(x, y, z):  # site space -> Blender space
    return Vector((x, -z, y))


def sphere_plates():
    counts, lat, gap, out = [4, 8, 12, 8, 4], [math.radians(d) for d in (-90, -54, -18, 18, 54, 90)], 0.014, []
    for b, count in enumerate(counts):
        for i in range(count):
            lon0 = (i + (b % 2) * 0.5) / count * math.tau + gap
            lon1 = (i + 1 + (b % 2) * 0.5) / count * math.tau - gap
            la0 = lat[b] + (0 if b == 0 else gap)
            la1 = lat[b + 1] - (0 if b == len(counts) - 1 else gap)
            out.append(lambda u, v, lon0=lon0, lon1=lon1, la0=la0, la1=la1: (
                R * math.cos(la0 + (la1 - la0) * v) * math.sin(lon0 + (lon1 - lon0) * u),
                R * math.sin(la0 + (la1 - la0) * v),
                R * math.cos(la0 + (la1 - la0) * v) * math.cos(lon0 + (lon1 - lon0) * u)))
    return out


def mark_pieces():
    out = []
    phi = lambda v: -math.pi / 2 + v * math.tau  # seam at the back
    for cx, cy in NODES:
        for i in range(8):
            t0, t1 = i / 8 * math.tau, (i + 1) / 8 * math.tau
            out.append(lambda u, v, cx=cx, cy=cy, t0=t0, t1=t1: (
                cx + (RING + TUBE * math.cos(phi(v))) * math.cos(t0 + (t1 - t0) * u),
                cy + (RING + TUBE * math.cos(phi(v))) * math.sin(t0 + (t1 - t0) * u),
                TUBE * math.sin(phi(v))))
    for pts in BARS:
        P = [Vector(p) for p in pts]
        perp = lambda d: Vector((-d.y, d.x))
        miters = []
        for j in range(len(P)):
            d_in = (P[j] - P[j - 1]).normalized() if j > 0 else None
            d_out = (P[j + 1] - P[j]).normalized() if j < len(P) - 1 else None
            if d_in is None:
                miters.append(perp(d_out))
            elif d_out is None:
                miters.append(perp(d_in))
            else:
                m = (perp(d_in) + perp(d_out)).normalized()
                miters.append(m / max(0.35, m.dot(perp(d_in))))
        for j in range(len(P) - 1):
            length = (P[j + 1] - P[j]).length
            parts = 3 if length > 30 * S else 2 if length > 15 * S else 1
            for k in range(parts):
                s0, s1 = k / parts, (k + 1) / parts
                a, b, ma, mb = P[j], P[j + 1], miters[j], miters[j + 1]
                out.append(lambda u, v, a=a, b=b, ma=ma, mb=mb, s0=s0, s1=s1: (
                    a.x + (b.x - a.x) * (s0 + (s1 - s0) * u) + (ma.x + (mb.x - ma.x) * (s0 + (s1 - s0) * u)) * TUBE * math.cos(phi(v)),
                    a.y + (b.y - a.y) * (s0 + (s1 - s0) * u) + (ma.y + (mb.y - ma.y) * (s0 + (s1 - s0) * u)) * TUBE * math.cos(phi(v)),
                    TUBE * math.sin(phi(v))))
    return out


def sample(shape):
    pts = [Vector(shape(i / NU, j / NV)) for j in range(NV + 1) for i in range(NU + 1)]
    return pts, sum(pts, Vector()) / len(pts)


smooth = lambda x: (lambda t: t * t * (3 - 2 * t))(min(1, max(0, x)))
in_out = lambda x: (lambda t: 4 * t ** 3 if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2)(min(1, max(0, x)))

A = [sample(s) for s in sphere_plates()]
B = [sample(s) for s in mark_pieces()]
ang = lambda c: math.atan2(c.y, c.x)
ai = sorted(range(len(A)), key=lambda i: (round(ang(A[i][1]), 6), A[i][1].z))
bi = sorted(range(len(B)), key=lambda i: ang(B[i][1]))
faces = [(j * (NU + 1) + i, j * (NU + 1) + i + 1, (j + 1) * (NU + 1) + i + 1, (j + 1) * (NU + 1) + i) for j in range(NV) for i in range(NU)]

chrome = bpy.data.materials.new("chrome")
chrome.use_nodes = True
bsdf = chrome.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Metallic"].default_value = 1.0
bsdf.inputs["Roughness"].default_value = 0.04
dark = bpy.data.materials.new("mechanism")
dark.use_nodes = True
dark.node_tree.nodes["Principled BSDF"].inputs["Metallic"].default_value = 1.0
dark.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.4
dark.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.11, 0.13, 1)

for n, (pa, pb) in enumerate(zip(ai, bi)):
    (a_pts, ca), (b_pts, cb) = A[pa], B[pb]
    mesh = bpy.data.meshes.new(f"plate_{n:02d}")
    mesh.from_pydata([site(*(p - ca)) for p in a_pts], [], faces)
    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(chrome)
    obj = bpy.data.objects.new(f"plate_{n:02d}", mesh)
    scene.collection.objects.link(obj)
    obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name="piece")
    for v, p in zip(key.data, b_pts):
        v.co = site(*(p - cb))
    obj.rotation_mode = "QUATERNION"
    axis = site(*ca).normalized()
    order, spin = (ca.y / R + 1) / 2, 1 if n % 2 else -1
    for f in range(FRAMES + 1):
        tau = f / FRAMES
        e = min(1, max(0, (tau - (1 - order) * 0.42) / 0.55))  # top of the sphere goes first
        k1 = smooth(e / 0.4)  # lift off and turn, rigid
        k2 = in_out((e - 0.4) / 0.6)  # travel, roll into the piece, lock
        x = (k2 - 0.8) / 0.2
        over = 1 + 0.05 * math.sin(math.pi * x) if 0 < x < 1 else 1  # about 5% overshoot, then settle
        start = site(*ca) + axis * (0.17 * k1 * (1 - k2))
        obj.location = start.lerp(site(*cb), k2)
        obj.rotation_quaternion = Quaternion(axis, k1 * (math.pi / 2) * spin * (1 - k2))
        obj.scale = (over, over, over)
        key.value = k2
        for path in ("location", "rotation_quaternion", "scale"):
            obj.keyframe_insert(path, frame=f)
        key.keyframe_insert("value", frame=f)

# Mechanism: a hub and three pistons that extend toward the nodes, then retract as the mark locks
def cylinder(name, radius, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=depth)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return o


hub = cylinder("hub", 0.075, 0.09, dark)
hub.rotation_euler = (math.pi / 2, 0, 0)
pistons = []
for i, (nx, ny) in enumerate(NODES):
    length = math.hypot(nx, ny) - RING
    arm = bpy.data.objects.new(f"piston_{i}", None)
    scene.collection.objects.link(arm)
    arm.rotation_euler = (0, -(math.atan2(ny, nx) - math.pi / 2), 0)  # aim along the node direction (Blender XZ plane)
    barrel = cylinder(f"barrel_{i}", 0.03, length * 0.5, dark)
    barrel.parent = arm
    barrel.location = (0, 0, length * 0.25 + 0.03)
    rod = cylinder(f"rod_{i}", 0.014, 1.0, chrome)
    rod.parent = arm
    pistons.append((arm, rod, length))
for f in range(FRAMES + 1):
    tau = f / FRAMES
    show = max(0.001, smooth((tau - 0.04) / 0.14) * (1 - smooth((tau - 0.8) / 0.16)))
    ext = smooth((tau - 0.12) / 0.38) * (1 - smooth((tau - 0.72) / 0.2))
    hub.scale = (show, show, show)
    hub.keyframe_insert("scale", frame=f)
    for arm, rod, length in pistons:
        arm.scale = (show, show, show)
        arm.keyframe_insert("scale", frame=f)
        l = max(0.001, length * (0.45 + 0.55 * ext))
        rod.scale = (1, 1, l)
        rod.location = (0, 0, l / 2 + 0.03)
        rod.keyframe_insert("scale", frame=f)
        rod.keyframe_insert("location", frame=f)

bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/sphere.blend")
bpy.ops.export_scene.gltf(filepath=f"{OUT}/sphere.glb", export_format="GLB", export_yup=True, export_animations=True, export_animation_mode="SCENE", export_morph=True, export_morph_normal=True, export_frame_range=True, export_materials="EXPORT")
print("exported sphere.glb")

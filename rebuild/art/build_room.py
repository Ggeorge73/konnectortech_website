"""Builds the equipment corridor in Blender (headless), bakes its lighting, and exports glTF.

Run through `npm run art` (see art/README.md). Outputs, in art/out/:
  room.glb        the corridor mesh, unlit, with baked lighting in its base-colour texture
  room_lit.png    second bake: the same room with steady lights and cyan status lights (scene 7)
  room_lines.glb  the blueprint line set (feature edges) for the same geometry
Both meshes carry a per-vertex `_sys` attribute: 0 = unnamed equipment, 1..5 = the five systems.

Layout matches src/story/world.ts so the line, labels and camera need no change.
Coordinates below are written in the site's space (x right, y up, corridor along -z) and converted.
"""
import math
import sys

import bpy  # must come first: it makes bmesh and mathutils importable
import bmesh
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "out"
SAMPLES = int(sys.argv[sys.argv.index("--") + 2]) if "--" in sys.argv and len(sys.argv) > sys.argv.index("--") + 2 else 96
TEX = 2048
LIGHT_Z = [-1, -5, -9, -13, -17]
END = -20

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bm = bmesh.new()
shade_layer = bm.loops.layers.color.new("Col")
sys_layer = bm.verts.layers.float.new("_sys")
kind_layer = bm.faces.layers.int.new("kind")  # 0 surface, 1 strip light, 2 status light


def rnd(i):
    x = math.sin(i * 127.1 + 311.7) * 43758.5453
    return x - math.floor(x)


def box(cx, cy, cz, sx, sy, sz, shade=0.3, system=0, kind=0, bevel=0.0):
    """Axis-aligned box given in site space; converted to Blender space (x, -z, y)."""
    c = Vector((cx, -cz, cy))
    h = Vector((sx / 2, sz / 2, sy / 2))
    verts = [bm.verts.new(c + Vector((dx * h.x, dy * h.y, dz * h.z))) for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    for v in verts:
        v[sys_layer] = system
    quads = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    faces = []
    for q in quads:
        f = bm.faces.new([verts[i] for i in q])
        f[kind_layer] = kind
        for loop in f.loops:
            loop[shade_layer] = (shade, shade, shade, 1.0)
        faces.append(f)
    if bevel > 0:
        edges = list({e for f in faces for e in f.edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect="EDGES")
    return faces


def rack(side, z, system, seed):
    x = side * 1.6
    box(x, 1.05, z, 0.7, 2.1, 0.9, shade=0.11, system=system, bevel=0.012)
    box(x, 0.03, z, 0.74, 0.06, 0.94, shade=0.07, system=system)  # plinth
    fx = side * 1.24
    for i in range(8):
        y = 0.22 + i * 0.235
        s = 0.16 + rnd(seed + i) * 0.16
        box(fx, y, z, 0.03, 0.19, 0.8, shade=s, system=system, bevel=0.004)
        box(fx - side * 0.018, y - 0.05, z - 0.1, 0.012, 0.03, 0.42, shade=s * 0.6, system=system)  # vent slot
        box(fx - side * 0.02, y + 0.04, z + 0.32, 0.02, 0.028, 0.05, system=system, kind=2)  # status light
    for dz in (-0.42, 0.42):  # door handles
        box(fx - side * 0.03, 1.1, z + dz * 0.9, 0.03, 0.5, 0.025, shade=0.3, system=system)


# Shell in 2 m bays, with skirting and a ceiling grid
for z in range(3, END, -2):
    zc = z - 1
    box(0, -0.05, zc, 4.4, 0.1, 2, shade=0.24)
    box(0, 3.05, zc, 4.4, 0.1, 2, shade=0.14)
    for side in (-1, 1):
        box(side * 2.15, 1.5, zc, 0.1, 3, 2, shade=0.2)
        box(side * 2.08, 0.06, zc, 0.04, 0.12, 2, shade=0.1)
        box(side * 2.08, 1.5, z, 0.05, 3, 0.08, shade=0.16)  # wall rib between bays
    box(0, 2.98, z, 4.2, 0.05, 0.06, shade=0.1)  # ceiling beam
# End frame of the corridor (an open doorway into the dark)
box(-1.6, 1.5, END, 1.1, 3, 0.12, shade=0.16)
box(1.6, 1.5, END, 1.1, 3, 0.12, shade=0.16)
box(0, 2.75, END, 2.1, 0.5, 0.12, shade=0.16)

# Strip lights down the centre of the ceiling
for z in LIGHT_Z:
    box(0, 2.95, z, 0.2, 0.06, 1.56, shade=0.12)
    box(0, 2.915, z, 0.14, 0.015, 1.46, kind=1)

# Cable trays, cables and droppers
for side in (-1, 1):
    for z in range(3, END, -2):
        box(side * 1.45, 2.55, z - 1, 0.6, 0.03, 1.96, shade=0.22)
        for edge in (-0.3, 0.3):
            box(side * 1.45 + edge, 2.59, z - 1, 0.02, 0.08, 1.96, shade=0.2)
        box(side * 1.45, 2.8, z - 0.2, 0.03, 0.5, 0.03, shade=0.12)  # hanger
    for c in range(5):
        box(side * (1.22 + c * 0.11), 2.6, (3 + END) / 2, 0.035, 0.035, 3 - END, shade=0.04 + c * 0.02)
    for z in range(-1, -19, -1):
        if rnd(z + side * 7) > 0.45:
            box(side * 1.5, 2.33, z + 0.3, 0.03, 0.45, 0.03, shade=0.05)

# Racks. Three groups on the left are named systems; the rest is unnamed equipment.
left_sys = {-4: 1, -5: 1, -6: 1, -9: 3, -10: 3, -11: 3, -14: 5, -15: 5, -16: 5}
for z in range(-1, -19, -1):
    if z in (-8, -12):
        continue
    rack(-1, z, left_sys.get(z, 0), 100 + z)
for z in (-1, -2, -3, -4, -10, -15.5, -16.5, -17.5):
    rack(1, z, 0, 300 + z)

# Shelf of records (right): the Records system
z0, system = -7.5, 2
for y in (0.3, 0.9, 1.5, 2.1):
    box(1.72, y, z0, 0.5, 0.04, 2.6, shade=0.22, system=system)
for dz in (-1.3, 0, 1.3):
    box(1.72, 1.15, z0 + dz, 0.5, 2.3, 0.05, shade=0.17, system=system)
n = 0
for y in (0.3, 0.9, 1.5):
    z = z0 - 1.2
    while z < z0 + 1.15:
        w = 0.07 + rnd(n) * 0.13
        hgt = 0.34 + rnd(n + 50) * 0.16
        if rnd(n + 90) > 0.12:
            box(1.72, y + 0.02 + hgt / 2, z + w / 2, 0.38, hgt, w * 0.9, shade=0.18 + rnd(n + 7) * 0.34, system=system, bevel=0.004)
            box(1.52, y + 0.12, z + w / 2, 0.01, 0.1, w * 0.5, shade=0.6, system=system)  # spine label
        z += w + 0.012
        n += 1

# Old terminal on a desk (right): the Legacy system
z0, system = -12.5, 4
box(1.7, 0.72, z0, 0.7, 0.06, 1.5, shade=0.24, system=system, bevel=0.008)
for dz in (-0.7, 0.7):
    box(1.7, 0.36, z0 + dz, 0.66, 0.7, 0.05, shade=0.16, system=system)
box(1.74, 1.0, z0 + 0.15, 0.46, 0.44, 0.52, shade=0.34, system=system, bevel=0.03)  # CRT body
box(1.5, 1.01, z0 + 0.15, 0.02, 0.32, 0.4, shade=0.03, system=system)  # dark screen
box(1.52, 0.77, z0 + 0.15, 0.2, 0.03, 0.46, shade=0.3, system=system, bevel=0.006)  # keyboard
box(1.75, 0.95, z0 - 0.45, 0.42, 0.4, 0.18, shade=0.26, system=system, bevel=0.01)  # tower
box(1.72, 0.2, z0 - 0.3, 0.4, 0.4, 0.4, shade=0.2, system=system)  # box of tapes
box(1.2, 0.45, z0 + 0.2, 0.42, 0.06, 0.42, shade=0.14, system=system)  # stool seat
box(1.2, 0.22, z0 + 0.2, 0.05, 0.44, 0.05, shade=0.1, system=system)

bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)

# ── Blueprint line set: every feature edge of the model, as loose edges ──
line_bm = bmesh.new()
line_sys = line_bm.verts.layers.float.new("_sys")
for e in bm.edges:
    if len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal, 0) < 0.35:
        continue
    if any(f[kind_layer] == 2 for f in e.link_faces):
        continue  # status lights are too small to outline
    a, b = (line_bm.verts.new(v.co) for v in e.verts)
    a[line_sys] = b[line_sys] = max(v[sys_layer] for v in e.verts)
    line_bm.edges.new((a, b))
bmesh.ops.remove_doubles(line_bm, verts=line_bm.verts, dist=1e-5)
line_mesh = bpy.data.meshes.new("room_lines")
line_bm.to_mesh(line_mesh)
lines = bpy.data.objects.new("room_lines", line_mesh)
print(f"geometry: {len(bm.faces)} faces, {len(line_bm.edges)} blueprint edges")

# ── Materials: surfaces take their grey from vertex colour; lights are emitters ──
mesh = bpy.data.meshes.new("room")
kinds = [f[kind_layer] for f in bm.faces]
bm.to_mesh(mesh)
room = bpy.data.objects.new("room", mesh)
scene.collection.objects.link(room)
image = bpy.data.images.new("bake", TEX, TEX, alpha=False, float_buffer=True)


def material(name, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.7
    if emission is None:
        col = nt.nodes.new("ShaderNodeVertexColor")
        col.layer_name = "Col"
        nt.links.new(col.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (0.02, 0.02, 0.02, 1)
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = strength
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    nt.nodes.active = tex  # the bake target
    return m


m_surface = material("surface")
m_strip = material("strip", (0.86, 0.93, 1.0), 9.0)
m_led = material("led", (0.0, 0.76, 1.0), 0.0)
for m in (m_surface, m_strip, m_led):
    mesh.materials.append(m)
for poly, k in zip(mesh.polygons, kinds):
    poly.material_index = k

# ── Lightmap UVs ──
bpy.context.view_layer.objects.active = room
room.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0015, area_weight=0.0)
bpy.ops.object.mode_set(mode="OBJECT")

# ── Bake lighting with Cycles (CPU) ──
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 5
scene.render.bake.margin = 3
world = bpy.data.worlds.new("dark")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.0
scene.world = world


def bake(path, strip_strengths, led_strength):
    # One emitter material per call: strips are dim and uneven for scene 1, steady and bright for scene 7.
    m_strip.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = strip_strengths
    m_led.node_tree.nodes["Principled BSDF"].inputs["Emission Strength"].default_value = led_strength
    bpy.ops.object.bake(type="COMBINED")
    image.filepath_raw = path
    image.file_format = "PNG"
    # Display transform by hand: a filmic-ish curve keeps the near black-and-white look without blown strips
    px = list(image.pixels)
    for i in range(0, len(px), 4):
        for c in range(3):
            v = px[i + c]
            px[i + c] = (v / (v + 0.55)) ** (1 / 2.2) if v > 0 else 0.0
    out = bpy.data.images.new("out", TEX, TEX, alpha=False)
    out.pixels = px
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()
    bpy.data.images.remove(out)
    print("baked", path)


bake(f"{OUT}/room_dim.png", 11.0, 0.0)
bake(f"{OUT}/room_lit.png", 18.0, 14.0)

# ── Export: unlit material with the dim bake; attributes kept for the shader ──
flat = bpy.data.materials.new("room_baked")
flat.use_nodes = True
nt = flat.node_tree
nt.nodes.clear()
out_node = nt.nodes.new("ShaderNodeOutputMaterial")
emit = nt.nodes.new("ShaderNodeEmission")  # exported as KHR_materials_unlit
tex = nt.nodes.new("ShaderNodeTexImage")
tex.image = bpy.data.images.load(f"{OUT}/room_dim.png")
nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
nt.links.new(emit.outputs["Emission"], out_node.inputs["Surface"])
glow = mesh.attributes.new("_glow", "FLOAT", "POINT")  # 1 = status light, 2 = strip light
for poly, k in zip(mesh.polygons, kinds):
    for vi in poly.vertices:
        glow.data[vi].value = max(glow.data[vi].value, {0: 0.0, 2: 1.0, 1: 2.0}[k])
mesh.materials.clear()
mesh.materials.append(flat)
bpy.ops.wm.save_as_mainfile(filepath=f"{OUT}/room.blend")


def export(obj, path, **kw):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.export_scene.gltf(filepath=path, use_selection=True, export_format="GLB", export_attributes=True, export_yup=True, export_apply=True, export_animations=False, **kw)
    print("exported", path)


export(room, f"{OUT}/room.glb", export_image_format="AUTO", export_vertex_color="NONE")
scene.collection.objects.link(lines)
export(lines, f"{OUT}/room_lines.glb", use_mesh_edges=True)

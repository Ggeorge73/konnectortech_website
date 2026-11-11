"""Ray-traced stills of the plate transformation at several moments, to judge the rigid design.
Usage: python render_plates.py -- out   (writes out/plates_XX.png)"""
import math
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=f"{OUT}/sphere.blend")
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x, scene.render.resolution_y = 720, 720
world = bpy.data.worlds.new("studio")
world.use_nodes = True
nt = world.node_tree
bg = nt.nodes["Background"]
grad = nt.nodes.new("ShaderNodeTexGradient")
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.004, 0.006, 0.01, 1)
ramp.color_ramp.elements[1].color = (0.5, 0.56, 0.62, 1)
coord = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(coord.outputs["Generated"], grad.inputs["Vector"])
nt.links.new(grad.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
scene.world = world
for x, z, e in ((-1.2, 1.4, 60), (1.4, 0.2, 25)):
    light = bpy.data.lights.new("key", "AREA")
    light.energy, light.size = e, 1.2
    o = bpy.data.objects.new("key", light)
    o.location = (x, -1.6, z)
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(o.location)).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(o)
cam_data = bpy.data.cameras.new("cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(22)
cam = bpy.data.objects.new("cam", cam_data)
cam.location = (0.25, -4.2, 0.2)
cam.rotation_euler = (Vector((0, 0, 0.02)) - Vector(cam.location)).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(cam)
scene.camera = cam
for f in (0, 30, 48, 64, 80, 96):
    scene.frame_set(f)
    scene.render.filepath = f"{OUT}/plates_{f:02d}.png"
    bpy.ops.render.render(write_still=True)
    print("rendered", f)

"""Ray-traced preview stills of the baked room with the chrome sphere, to judge the look outside the browser.
Usage: python render_preview.py -- out   (writes out/preview_scene1.png and out/preview_scene7.png)"""
import math
import sys

import bpy
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.open_mainfile(filepath=f"{OUT}/room.blend")
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "Standard"  # the bake is already display-referred
scene.render.resolution_x, scene.render.resolution_y = 1280, 720


def site(x, y, z):
    return Vector((x, -z, y))


cam_data = bpy.data.cameras.new("cam")
cam_data.sensor_fit = "VERTICAL"
cam_data.angle_y = math.radians(40)
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam


def look(pos, target):
    cam.location = pos
    cam.rotation_euler = (target - pos).to_track_quat("-Z", "Y").to_euler()


bpy.ops.mesh.primitive_uv_sphere_add(segments=96, ring_count=48, radius=0.3)
ball = bpy.context.object
bpy.ops.object.shade_smooth()
chrome = bpy.data.materials.new("chrome")
chrome.use_nodes = True
b = chrome.node_tree.nodes["Principled BSDF"]
b.inputs["Metallic"].default_value = 1.0
b.inputs["Roughness"].default_value = 0.03
b.inputs["Base Color"].default_value = (0.92, 0.93, 0.95, 1)
ball.data.materials.append(chrome)

tex = bpy.data.materials["room_baked"].node_tree.nodes["Image Texture"]
for name, image, ball_at in (("scene1", "room_dim.png", site(0.75, 1.45, -3)), ("scene7", "room_lit.png", site(0, 1.55, -3))):
    tex.image = bpy.data.images.load(f"{OUT}/{image}")
    ball.location = ball_at
    look(site(0, 1.55, 2.2), site(0.35 if name == "scene1" else 0, 1.4, -6))
    scene.render.filepath = f"{OUT}/preview_{name}.png"
    bpy.ops.render.render(write_still=True)
    print("rendered", scene.render.filepath)

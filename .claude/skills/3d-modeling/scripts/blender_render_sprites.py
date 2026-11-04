"""Render a rigged fighter (GLB or .blend) to side-view sprite frames for Cartoon Clash.

Headless usage (Blender 4.2+):
  blender -b -P blender_render_sprites.py -- --blend build/3d/goku.blend --out build/sprites/goku \
      --height 160 --res 2 --actions idle,walk,jab --step 2 --engine eevee
  blender -b -P blender_render_sprites.py -- --model build/3d/goku.glb --out build/sprites/goku --height 160

Output: <out>/<action>/NNN.png (RGBA, transparent) and <out>/manifest.json with frame size, pivot and action lists.
--height is the engine body.h in world px (feet to head); frames are framed with padding for jumps and raised arms.
Syntax-checked only in this repo; run once against Blender and adjust if an operator keyword changed.
"""
import argparse
import json
import math
import os
import sys

import bpy  # noqa: E402  (only available inside Blender)

SCALE = 0.01  # 1 world px = 1 cm
OUTLINE_RGB = (0.043, 0.059, 0.118)  # #0b0f1e


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(description='Render Cartoon Clash sprite frames from a 3D fighter.')
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument('--blend', help='.blend file to open')
    src.add_argument('--model', help='GLB/GLTF file to import into an empty scene')
    p.add_argument('--out', required=True, help='output directory')
    p.add_argument('--height', type=float, required=True, help='standing height in world px (engine body.h)')
    p.add_argument('--res', type=float, default=2.0, help='device pixel ratio to render for (1 or 2)')
    p.add_argument('--pad-w', type=float, default=1.4, help='frame width as a multiple of height')
    p.add_argument('--pad-h', type=float, default=1.6, help='frame height as a multiple of height')
    p.add_argument('--bottom', type=float, default=0.08, help='bottom margin below the feet as a fraction of frame height')
    p.add_argument('--actions', default='', help='comma-separated action names (default: every action in the file, or a single still)')
    p.add_argument('--step', type=int, default=2, help='render every Nth frame of each action')
    p.add_argument('--engine', choices=['eevee', 'workbench', 'cycles'], default='eevee')
    p.add_argument('--outline', type=float, default=3.0, help='outline thickness in world px (0 disables Freestyle)')
    p.add_argument('--samples', type=int, default=16)
    return p.parse_args(argv)


def load_source(args):
    if args.blend:
        bpy.ops.wm.open_mainfile(filepath=os.path.abspath(args.blend))
    else:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(args.model))


def find_armature():
    for ob in bpy.data.objects:
        if ob.type == 'ARMATURE':
            return ob
    return None


def set_engine(scene, args):
    if args.engine == 'cycles':
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = args.samples
    elif args.engine == 'workbench':
        scene.render.engine = 'BLENDER_WORKBENCH'
        sh = scene.display.shading
        sh.light = 'FLAT'
        sh.color_type = 'MATERIAL'
        sh.show_object_outline = True
        sh.object_outline_color = OUTLINE_RGB
    else:
        # Blender 4.2+ renamed EEVEE; fall back for 4.0/4.1
        try:
            scene.render.engine = 'BLENDER_EEVEE_NEXT'
        except TypeError:
            scene.render.engine = 'BLENDER_EEVEE'
        try:
            scene.eevee.taa_render_samples = args.samples
        except AttributeError:
            pass


def setup_freestyle(scene, args, frame_h_px, world_h):
    if args.outline <= 0 or args.engine == 'workbench':
        scene.render.use_freestyle = False
        return
    scene.render.use_freestyle = True
    scene.render.line_thickness_mode = 'ABSOLUTE'
    # outline px = world px * (frame px / world px covered)
    scene.render.line_thickness = args.outline * (frame_h_px / (world_h / SCALE))
    vl = bpy.context.view_layer
    fs = vl.freestyle_settings
    fs.use_culling = False
    for ls in list(fs.linesets):
        fs.linesets.remove(ls)
    ls = fs.linesets.new('outline')
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = True
    ls.select_edge_mark = True
    style = ls.linestyle
    style.color = OUTLINE_RGB
    style.thickness = scene.render.line_thickness
    style.caps = 'ROUND'


def setup_camera_and_light(scene, args):
    world_h = args.height * args.pad_h * SCALE
    world_w = args.height * args.pad_w * SCALE
    frame_h_px = int(round(args.height * args.pad_h * args.res))
    frame_w_px = int(round(args.height * args.pad_w * args.res))
    bottom = args.bottom * world_h

    cam_data = bpy.data.cameras.new('SpriteCam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = max(world_h, world_w)
    cam = bpy.data.objects.new('SpriteCam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = (0.0, -10.0, world_h / 2 - bottom)
    cam.rotation_euler = (math.radians(90), 0.0, 0.0)  # look toward +Y: +X is screen-right, +Z up
    scene.camera = cam

    sun_data = bpy.data.lights.new('SpriteSun', 'SUN')
    sun_data.energy = 4.0
    sun = bpy.data.objects.new('SpriteSun', sun_data)
    scene.collection.objects.link(sun)
    sun.rotation_euler = (math.radians(55), math.radians(-15), math.radians(20))

    scene.render.resolution_x = frame_w_px
    scene.render.resolution_y = frame_h_px
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    if scene.world is None:
        scene.world = bpy.data.worlds.new('SpriteWorld')
    pivot_y = 1.0 - bottom / world_h
    return frame_w_px, frame_h_px, world_h, pivot_y


def action_list(args, arm):
    wanted = [a.strip() for a in args.actions.split(',') if a.strip()]
    actions = {a.name: a for a in bpy.data.actions}
    if wanted:
        missing = [w for w in wanted if w not in actions]
        if missing:
            print('WARNING: actions not found:', ', '.join(missing))
        return [(w, actions[w]) for w in wanted if w in actions]
    if actions and arm is not None:
        return sorted(actions.items())
    return [('idle', None)]  # single still


def render_action(scene, arm, name, action, step, out_dir):
    folder = os.path.join(out_dir, name)
    os.makedirs(folder, exist_ok=True)
    files = []
    if action is None or arm is None:
        scene.render.filepath = os.path.join(folder, '000.png')
        bpy.ops.render.render(write_still=True)
        return ['000.png']
    if arm.animation_data is None:
        arm.animation_data_create()
    arm.animation_data.action = action
    start, end = (int(round(v)) for v in action.frame_range)
    idx = 0
    for frame in range(start, end + 1, max(1, step)):
        scene.frame_set(frame)
        fname = f'{idx:03d}.png'
        scene.render.filepath = os.path.join(folder, fname)
        bpy.ops.render.render(write_still=True)
        files.append(fname)
        idx += 1
    return files


def main():
    args = parse_args()
    load_source(args)
    scene = bpy.context.scene
    arm = find_armature()
    set_engine(scene, args)
    frame_w, frame_h, world_h, pivot_y = setup_camera_and_light(scene, args)
    setup_freestyle(scene, args, frame_h, world_h)
    out_dir = os.path.abspath(args.out)
    os.makedirs(out_dir, exist_ok=True)

    manifest = {
        'source': args.blend or args.model,
        'heightPx': args.height,
        'res': args.res,
        'frame': {'w': frame_w, 'h': frame_h},
        'pivot': {'x': 0.5, 'y': round(pivot_y, 5)},
        'step': args.step,
        'engine': args.engine,
        'actions': {},
    }
    for name, action in action_list(args, arm):
        print(f'rendering {name} ...')
        manifest['actions'][name] = render_action(scene, arm, name, action, args.step, out_dir)
    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as fh:
        json.dump(manifest, fh, indent=2)
    print('done:', out_dir)


if __name__ == '__main__':
    main()

"""Build a stylized, rig-ready 3D fighter from primitives in Blender (4.2+) using Cartoon Clash proportions.

Headless usage:
  blender -b -P blender_build_fighter.py -- --char goku --out build/3d/goku.glb [--blend build/3d/goku.blend]

What it does
  * uses the same body proportions as client/src/game/art/chars.js (mk() values) scaled so the standing
    height equals the engine hurtbox height (shared/fighters/<id>.js body.h), 1 world px = 1 cm
  * builds head, torso, limbs, hands, feet and optional tail from spheres and cylinders with flat toon materials
    in the fighter's palette (primary, secondary, accent, skin)
  * adds an armature whose bones mirror the 2D rig (hip, torso, head, arm_upper/lower, hand, leg_upper/lower,
    foot per side, tail) and rigid-parents each part to its bone, plus a tiny looping 'idle' action
  * exports GLB (and optionally saves the .blend for hand modelling and animation)
Character faces +X, feet on z = 0, camera side is -Y (so .L limbs are the "front" limbs of the 2D rig).
Syntax-checked only in this repo; run once against Blender and adjust if an operator keyword changed.
"""
import argparse
import math
import os
import sys

import bpy  # noqa: E402  (only available inside Blender)
from mathutils import Vector  # noqa: E402

SCALE = 0.01  # 1 world px = 1 cm

# Proportions in art px, copied from the mk() calls in client/src/game/art/chars/<id>.js (re-sync after art changes).
PROPS = {
    'shinchan': dict(headW=70, headH=57, neck=-3, torsoLen=38, torsoW=42, pelvisDrop=9, uArm=15, lArm=14, armR=5.8,
                    handR=6.2, uLeg=19, lLeg=17, legR=7.2, footL=19, footH=8, shY=33),
    'doraemon': dict(headW=96, headH=90, neck=-6, torsoLen=58, torsoW=72, pelvisDrop=8, uArm=13, lArm=12, armR=8,
                    handR=10.5, uLeg=6, lLeg=5, legR=11, footL=31, footH=10, shY=27, tail=dict(x=-33, y=-6, base=-72)),
    'hattori': dict(headW=60, headH=58, neck=0, torsoLen=46, torsoW=38, pelvisDrop=10, uArm=21, lArm=20, armR=6,
                   handR=6, uLeg=22, lLeg=22, legR=7.8, footL=19, footH=9, shY=41),
    'pikachu': dict(headW=72, headH=60, neck=-8, torsoLen=40, torsoW=56, pelvisDrop=8, uArm=10, lArm=9, armR=5.8,
                   handR=5.4, uLeg=9, lLeg=8, legR=9, footL=24, footH=9, shY=30, tail=dict(x=-22, y=4, base=-42)),
    'ben10': dict(headW=46, headH=47, neck=3, torsoLen=50, torsoW=38, pelvisDrop=10, uArm=24, lArm=22, armR=5.8,
                 handR=6.2, uLeg=29, lLeg=28, legR=8.2, footL=21, footH=9, shY=44),
    'fourarms': dict(headW=42, headH=42, neck=-6, torsoLen=92, torsoW=88, pelvisDrop=12, uArm=32, lArm=30, armR=13.5,
                    handR=13, uLeg=34, lLeg=32, legR=15, footL=30, footH=12, shY=76, shY2=52, fourArms=True),
    'xlr8': dict(headW=44, headH=40, neck=4, torsoLen=48, torsoW=36, pelvisDrop=8, uArm=25, lArm=23, armR=5.8,
                handR=6, uLeg=31, lLeg=31, legR=8.4, footL=13, footH=10, shY=42, tail=dict(x=-15, y=4, base=-95)),
    'heatblast': dict(headW=42, headH=44, neck=4, torsoLen=56, torsoW=42, pelvisDrop=9, uArm=26, lArm=24, armR=7.2,
                     handR=7.6, uLeg=32, lLeg=31, legR=9.4, footL=20, footH=9, shY=49),
    'nobita': dict(headW=56, headH=55, neck=3, torsoLen=45, torsoW=32, pelvisDrop=10, uArm=21, lArm=19, armR=4.6,
                  handR=5.6, uLeg=26, lLeg=25, legR=5.8, footL=20, footH=9, shY=40),
    'goku': dict(headW=50, headH=48, neck=1, torsoLen=38, torsoW=38, pelvisDrop=10, uArm=18, lArm=17, armR=6.2,
                handR=6.4, uLeg=20, lLeg=20, legR=8.2, footL=20, footH=9, shY=33, tail=dict(x=-18, y=4, base=-70)),
    'bheem': dict(headW=50, headH=50, neck=1, torsoLen=52, torsoW=58, pelvisDrop=14, uArm=23, lArm=21, armR=9.4,
                 handR=8.8, uLeg=24, lLeg=23, legR=10.8, footL=21, footH=9, shY=46),
}
DEFAULTS = dict(neck=0, pelvisDrop=8, shY2=0, fourArms=False, tail=None)

# Effective in-game palettes (engine fighter palette merged over chars.js fallbacks, as paletteFor() does).
PALETTE = {
    'shinchan': dict(primary='#e8322f', secondary='#ffd23f', accent='#22e4ff', skin='#ffd2a8'),
    'doraemon': dict(primary='#1f8fe0', secondary='#ffffff', accent='#e8322f', skin='#ffffff'),
    'hattori': dict(primary='#2f5fd0', secondary='#ffcc33', accent='#ffd43b', skin='#ffd2a8'),
    'pikachu': dict(primary='#ffd43b', secondary='#ff4b3a', accent='#e8322f', skin='#ffd83a'),
    'ben10': dict(primary='#2fbf4a', secondary='#16181f', accent='#9cff3a', skin='#ffd2a8'),
    'fourarms': dict(primary='#d8392b', secondary='#1b1d26', accent='#ff5a3a', skin='#d8392b'),
    'xlr8': dict(primary='#2f6bff', secondary='#14161f', accent='#22e4ff', skin='#2f6bff'),
    'heatblast': dict(primary='#8a2a14', secondary='#ffb02e', accent='#ff8a1f', skin='#8a2a14'),
    'nobita': dict(primary='#f6c445', secondary='#2d5dbf', accent='#ff8a1f', skin='#ffd2a8'),
    'goku': dict(primary='#ff8a1f', secondary='#2550c8', accent='#e8322f', skin='#ffd2a8'),
    'bheem': dict(primary='#ff8a1f', secondary='#ffcc33', accent='#ffd43b', skin='#c98a5a'),
}

# Engine hurtbox heights (shared/fighters/*.js body.h, forms from ben10.js).
BODY_H = {
    'shinchan': 138, 'doraemon': 158, 'hattori': 166, 'pikachu': 120, 'ben10': 166, 'fourarms': 210, 'xlr8': 164,
    'heatblast': 178, 'nobita': 168, 'goku': 146, 'bheem': 160,
}
OUTLINE = '#0b0f1e'


def parse_args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser(description='Build a Cartoon Clash fighter from primitives.')
    p.add_argument('--char', required=True, choices=sorted(PROPS.keys()))
    p.add_argument('--out', required=True, help='GLB output path')
    p.add_argument('--blend', default=None, help='also save a .blend here')
    p.add_argument('--no-idle', action='store_true', help='skip the sample idle action')
    return p.parse_args(argv)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color):
    h = hex_color.lstrip('#')
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), 1.0)


def material(name, hex_color):
    mat = bpy.data.materials.get(name)
    if mat:
        return mat
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = hex_rgba(hex_color)
        bsdf.inputs['Roughness'].default_value = 1.0
    mat.diffuse_color = hex_rgba(hex_color)  # Workbench / solid view
    return mat


def finish(ob, name, mat):
    ob.name = name
    ob.data.name = name
    ob.data.materials.append(mat)
    try:
        bpy.ops.object.shade_smooth()
    except RuntimeError:
        pass
    return ob


def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=1.0, location=loc)
    ob = bpy.context.active_object
    ob.scale = scale
    return finish(ob, name, mat)


def capsule(name, start, end, radius, mat):
    """Cylinder from start to end plus a ball at the end (the joint ball of the next segment)."""
    start, end = Vector(start), Vector(end)
    d = end - start
    length = d.length
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=1.0, depth=1.0, location=(start + end) / 2)
    ob = bpy.context.active_object
    ob.scale = (radius, radius, length)
    ob.rotation_mode = 'QUATERNION'
    ob.rotation_quaternion = d.normalized().to_track_quat('Z', 'Y')
    finish(ob, name, mat)
    ball = sphere(name + '.ball', end, (radius, radius, radius), mat)
    return [ob, ball]


def build_meshes(char):
    p = dict(DEFAULTS)
    p.update(PROPS[char])
    pal = PALETTE[char]
    hipH = p['uLeg'] + p['lLeg'] + p['footH']
    H = hipH + p['torsoLen'] + p['neck'] + p['headH']
    u = (BODY_H[char] / H) * SCALE  # art px -> metres, scaled to the engine height
    m_primary = material(f'{char}_primary', pal['primary'])
    m_secondary = material(f'{char}_secondary', pal['secondary'])
    m_skin = material(f'{char}_skin', pal['skin'])
    m_dark = material('cc_outline', OUTLINE)

    z_hip = hipH * u
    z_sh = (hipH + p['shY']) * u
    z_neck = (hipH + p['torsoLen'] + p['neck']) * u
    depth = p['torsoW'] * 0.6 * u  # body thickness along Y
    parts = {}  # bone name -> [objects]

    # head
    parts['head'] = [sphere('head', (0, 0, z_neck + p['headH'] * 0.5 * u),
                            (p['headW'] * 0.5 * u, p['headW'] * 0.42 * u, p['headH'] * 0.5 * u), m_skin)]
    # torso + pelvis
    torso_bottom = z_hip - p['pelvisDrop'] * u
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=1.0, depth=1.0, location=(0, 0, (torso_bottom + z_neck) / 2))
    torso = bpy.context.active_object
    torso.scale = (p['torsoW'] * 0.5 * u, depth * 0.5, (z_neck - torso_bottom))
    finish(torso, 'torso', m_primary)
    pelvis = sphere('pelvis', (0, 0, z_hip), (p['torsoW'] * 0.45 * u, depth * 0.5, p['pelvisDrop'] * 1.2 * u), m_secondary)
    parts['torso'] = [torso]
    parts['hip'] = [pelvis]

    # arms (L = front / camera side at -Y, R = back)
    arm_sets = [('', z_sh)]
    if p['fourArms']:
        arm_sets.append(('2', (hipH + p['shY2']) * u))
    for suffix, z_shoulder in arm_sets:
        for side, sy in (('L', -1), ('R', 1)):
            y = sy * (depth * 0.5 + p['armR'] * 0.9 * u)
            shoulder = Vector((0, y, z_shoulder))
            elbow = shoulder + Vector((0, 0, -p['uArm'] * u))
            wrist = elbow + Vector((0, 0, -p['lArm'] * u))
            r = p['armR'] * u
            parts[f'arm_upper{suffix}.{side}'] = [sphere(f'shoulder{suffix}.{side}', shoulder, (r, r, r), m_primary)] + \
                capsule(f'arm_upper{suffix}.{side}', shoulder, elbow, r, m_primary)
            parts[f'arm_lower{suffix}.{side}'] = capsule(f'arm_lower{suffix}.{side}', elbow, wrist, r * 0.9, m_skin)
            hr = p['handR'] * u
            parts[f'hand{suffix}.{side}'] = [sphere(f'hand{suffix}.{side}', wrist + Vector((0, 0, -hr * 0.6)), (hr, hr, hr * 1.1), m_skin)]

    # legs
    for side, sy in (('L', -1), ('R', 1)):
        y = sy * p['legR'] * 1.05 * u
        hip = Vector((0, y, z_hip))
        knee = hip + Vector((0, 0, -p['uLeg'] * u))
        ankle = Vector((0, y, p['footH'] * u))
        r = p['legR'] * u
        parts[f'leg_upper.{side}'] = capsule(f'leg_upper.{side}', hip, knee, r, m_secondary)
        parts[f'leg_lower.{side}'] = capsule(f'leg_lower.{side}', knee, ankle, r * 0.85, m_secondary)
        parts[f'foot.{side}'] = [sphere(f'foot.{side}', (p['footL'] * 0.25 * u, y, p['footH'] * 0.5 * u),
                                        (p['footL'] * 0.6 * u, r * 0.95, p['footH'] * 0.5 * u), m_dark)]

    # tail
    tail_def = p['tail']
    if tail_def:
        base = Vector((tail_def['x'] * u, 0, z_hip - tail_def['y'] * u))
        a = math.radians(tail_def['base'])
        length = p['headW'] * 0.6 * u
        tip = base + Vector((math.sin(a) * length, 0, math.cos(a) * length))
        parts['tail'] = capsule('tail', base, tip, p['armR'] * 0.8 * u, m_primary)

    layout = dict(u=u, z_hip=z_hip, z_sh=z_sh, z_neck=z_neck, depth=depth, p=p, torso_bottom=torso_bottom)
    return parts, layout


def build_armature(char, layout):
    p, u = layout['p'], layout['u']
    z_hip, z_sh, z_neck, depth = layout['z_hip'], layout['z_sh'], layout['z_neck'], layout['depth']
    arm_data = bpy.data.armatures.new(f'{char}_rig')
    arm = bpy.data.objects.new(f'{char}_rig', arm_data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def bone(name, head, tail, parent=None, connect=False):
        b = eb.new(name)
        b.head, b.tail = Vector(head), Vector(tail)
        if parent is not None:
            b.parent = parent
            b.use_connect = connect
        return b

    hip = bone('hip', (0, 0, layout['torso_bottom']), (0, 0, z_hip))
    torso = bone('torso', (0, 0, z_hip), (0, 0, z_neck), hip, True)
    bone('head', (0, 0, z_neck), (0, 0, z_neck + p['headH'] * u), torso, True)
    arm_sets = [('', z_sh)]
    if p['fourArms']:
        arm_sets.append(('2', (p['uLeg'] + p['lLeg'] + p['footH'] + p['shY2']) * u))
    for suffix, z_shoulder in arm_sets:
        for side, sy in (('L', -1), ('R', 1)):
            y = sy * (depth * 0.5 + p['armR'] * 0.9 * u)
            sh = (0, y, z_shoulder)
            el = (0, y, z_shoulder - p['uArm'] * u)
            wr = (0, y, z_shoulder - (p['uArm'] + p['lArm']) * u)
            ua = bone(f'arm_upper{suffix}.{side}', sh, el, torso)
            la = bone(f'arm_lower{suffix}.{side}', el, wr, ua, True)
            bone(f'hand{suffix}.{side}', wr, (0, y, wr[2] - p['handR'] * 1.6 * u), la, True)
    for side, sy in (('L', -1), ('R', 1)):
        y = sy * p['legR'] * 1.05 * u
        hj = (0, y, z_hip)
        kn = (0, y, z_hip - p['uLeg'] * u)
        an = (0, y, p['footH'] * u)
        ul = bone(f'leg_upper.{side}', hj, kn, hip)
        ll = bone(f'leg_lower.{side}', kn, an, ul, True)
        bone(f'foot.{side}', an, (p['footL'] * 0.7 * u, y, 0), ll, True)
    if p['tail']:
        t = p['tail']
        base = Vector((t['x'] * u, 0, z_hip - t['y'] * u))
        a = math.radians(t['base'])
        length = p['headW'] * 0.6 * u
        bone('tail', base, base + Vector((math.sin(a) * length, 0, math.cos(a) * length)), hip)
    bpy.ops.object.mode_set(mode='OBJECT')
    return arm


def rigid_parent(arm, parts):
    """Parent every mesh to its bone without deformation weights (robust in background mode)."""
    bpy.ops.object.select_all(action='DESELECT')
    for bone_name, objs in parts.items():
        if bone_name not in arm.data.bones:
            print('WARNING: no bone for', bone_name)
            continue
        for ob in objs:
            bpy.ops.object.select_all(action='DESELECT')
            ob.select_set(True)
            arm.select_set(True)
            bpy.context.view_layer.objects.active = arm
            arm.data.bones.active = arm.data.bones[bone_name]
            try:
                bpy.ops.object.parent_set(type='BONE', keep_transform=True)
            except RuntimeError as err:
                print('WARNING: parent_set failed for', ob.name, err)
    bpy.ops.object.select_all(action='DESELECT')


def add_idle_action(arm):
    """Two-keyframe breathing loop on the torso and head so the render script has something to sample."""
    scene = bpy.context.scene
    scene.frame_start, scene.frame_end = 1, 24
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    torso = arm.pose.bones.get('torso')
    head = arm.pose.bones.get('head')
    for pb in (torso, head):
        if pb is None:
            continue
        pb.rotation_mode = 'XYZ'
    for frame, amt in ((1, 0.0), (12, 1.0), (24, 0.0)):
        scene.frame_set(frame)
        if torso:
            torso.rotation_euler = (0, math.radians(2.0 * amt), 0)
            torso.scale = (1, 1 + 0.015 * amt, 1)
            torso.keyframe_insert('rotation_euler', frame=frame)
            torso.keyframe_insert('scale', frame=frame)
        if head:
            head.rotation_euler = (0, math.radians(-1.5 * amt), 0)
            head.keyframe_insert('rotation_euler', frame=frame)
    bpy.ops.object.mode_set(mode='OBJECT')
    if arm.animation_data and arm.animation_data.action:
        arm.animation_data.action.name = 'idle'
    scene.frame_set(1)


def export(args, arm):
    out = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out) or '.', exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB')
    print('wrote', out)
    if args.blend:
        blend = os.path.abspath(args.blend)
        os.makedirs(os.path.dirname(blend) or '.', exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=blend)
        print('wrote', blend)


def main():
    args = parse_args()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    parts, layout = build_meshes(args.char)
    arm = build_armature(args.char, layout)
    rigid_parent(arm, parts)
    if not args.no_idle:
        add_idle_action(arm)
    export(args, arm)


if __name__ == '__main__':
    main()

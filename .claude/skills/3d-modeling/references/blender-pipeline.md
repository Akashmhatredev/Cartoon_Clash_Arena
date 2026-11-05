# Blender pipeline notes (bpy, Blender 4.2+)

## Running headless

`blender -b [file.blend] -P script.py -- <script args>`. Everything after `--` is yours (`sys.argv[sys.argv.index('--') + 1:]`). Start from a clean file with `bpy.ops.wm.read_factory_settings(use_empty=True)` when building from scratch. Import GLB with `bpy.ops.import_scene.gltf(filepath=...)`, export with `bpy.ops.export_scene.gltf(filepath=..., export_format='GLB')`. Keep export kwargs minimal; names change between versions.

## Units and axes

Blender is Z-up, metres. Cartoon Clash is Y-down px. The scripts use 1 px = 1 cm (`SCALE = 0.01`), feet at z = 0, character facing +X. The side-view camera sits at negative Y looking toward +Y (rotation Euler X = 90°), so +X is screen-right and +Z is screen-up, matching Phaser after the y flip.

## Toon look

- Materials: Principled BSDF with `Roughness = 1` and low specular reads flat under a single sun. For true cel bands, chain `Diffuse BSDF → Shader to RGB → ColorRamp (Constant, 2-3 stops) → Emission` in EEVEE, or use Workbench with `shading.light = 'FLAT'` and `color_type = 'MATERIAL'` for a quick flat preview.
- Outline: enable Freestyle (`scene.render.use_freestyle = True`), one lineset with silhouette + crease + border edges, line colour `#0b0f1e` (0.043, 0.059, 0.118 linear-ish), thickness in absolute pixels = `3 * res * (frame_px / world_px)` so it matches the 2D rig's 3 world px. Freestyle works with EEVEE and Cycles; for Workbench use `shading.show_object_outline` (thin) or an inverted-hull solidify modifier with flipped normals and a black emission material.
- Lighting: one Sun from the camera side slightly above (strength 3-5), world background grey-blue at low strength; flat shading hides most of it anyway. Film transparent for alpha.

## Rig conventions used by `blender_build_fighter.py`

Bones: `hip` (root at pelvis), `torso`, `head`, `arm_upper.L/.R`, `arm_lower.L/.R`, `hand.L/.R`, `leg_upper.L/.R`, `leg_lower.L/.R`, `foot.L/.R`, optional `tail`. `.R` is the character's right side, which is the back side when facing +X and the camera is at -Y (the 2D rig's "front" limbs are the ones nearer the camera: `.L`). Meshes are rigid-parented to bones (no weights), which suits blocky toon figures and never fails in background mode; convert to armature-deform with automatic weights once you sculpt a continuous body.

## Actions and sampling

Name actions after the game's anim keys (`idle`, `walk`, `jab`, `punch`, ...). Attack actions should have three marked ranges: wind-up (startup), strike (active), recovery. A simple convention the render script understands: frame markers `w`, `s`, `r` in the action's frame range, or three actions `jab_w`, `jab_s`, `jab_r`. Sample at 12 fps (`--step 2` at 24 fps) for normals, 24 fps for ultimates. Loop `idle` and `walk` (8-12 frames); `hitstun`, `block`, `knockdown`, `getup`, `win`, `lose`, `intro` can be 1-6 frames.

## Camera framing math (what the render script does)

```
frame_h_px = round(height_px * pad_h * res)      # pad_h ~1.6 leaves room for jumps and raised arms
frame_w_px = round(height_px * pad_w * res)      # pad_w ~1.4
world_h    = height_px * pad_h * SCALE           # metres covered vertically
cam.ortho_scale = max(world_h, world_w)          # ortho_scale is the larger side
cam z       = (world_h / 2) - bottom_margin      # bottom_margin ~0.08 * world_h keeps feet above the edge
pivot_y     = 1 - bottom_margin / world_h        # fraction from the top where feet sit
```

The manifest stores `pivot: { x: 0.5, y: pivot_y }` and the packer writes it into each frame so Phaser's `setOrigin` is not needed (`frame.customPivot`).

## Exporting for the web

GLB with embedded textures; apply modifiers on export; strip cameras and lights; keep under ~1-2 MB per character if used in Three.js. For pre-rendered sprites the GLB never ships, only the PNG/WebP atlas does. Convert PNG atlases to WebP with Pillow (`img.save('x.webp', quality=90)`) when size matters; Phaser loads WebP where supported.

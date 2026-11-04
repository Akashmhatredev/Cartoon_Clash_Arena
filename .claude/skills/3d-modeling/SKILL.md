---
name: 3d-modeling
description: 3D asset work for Cartoon Clash: modeling stylized fighters, props or stages in Blender (bpy scripts, procedural primitives, rigs), exporting glTF/GLB, pre-rendering 3D characters or scenery into 2D sprite atlases that the Phaser fight scene can use instead of the procedural vector rig, and optional Three.js showcases (3D character select turntable, intro). Use this whenever a task mentions 3D, Blender, bpy, glTF/GLB/FBX/OBJ, meshes, rigging, armatures, toon/cel shading, turntables, sprite sheets rendered from 3D, "make the characters 3D", "pre-rendered sprites", Three.js, or replacing placeholder art with modeled assets. The game is 2D today; this skill explains how 3D fits without breaking the engine, the bundle budget or the art style.
---

# 3D modeling and the 3D-to-2D pipeline

Cartoon Clash is a 2D side-view fighter with a deterministic engine. 3D never touches gameplay: hurtboxes, hitboxes and positions come from `shared/fighters/<id>.js`, and the renderer only needs something to draw at a feet position with a facing. The realistic, performant way to use 3D here is **pre-rendering**: model and animate in Blender, render frames to transparent PNGs with a bold outline and flat toon shading, pack them into an atlas, and swap the per-character view. Real-time 3D (Three.js) is reserved for menus and showcases because the fight loop's bundle, battery and determinism budgets are tight. Nothing in the repo uses 3D yet; everything below is the supported path to add it.

Read `references/blender-pipeline.md` for Blender/bpy specifics and `references/phaser-sprite-integration.md` for the `SpriteFighterView` that plugs pre-rendered frames into `FightScene`.

## Why character fidelity work stayed 2D

The roster (Shinchan, Doraemon, Ninja Hattori, Pikachu, Ben 10, Nobita, Kid Goku, Chhota Bheem) comes from 2D cartoons. Their on-model look lives in flat-colour shapes drawn for one viewing angle: Shinchan's cheek bulge, Doraemon's face mask and whiskers, Goku's hair spikes, Nobita's glasses. A side-view fighter only ever shows that angle, so a 3D model adds cost (modelling, rigging, toon shaders, outline tuning, pre-rendering every animation) without adding fidelity, and toon-shaded 3D tends to drift off-model at exactly those features. When the request was "make the characters look and move exactly like the real ones", the work therefore went into the procedural 2D pipeline instead: canon-relative heights and head-to-body ratios, per-fighter art files with expression frames, and a spring-driven animator with per-character motion personality (`character-art-rig` skill). That keeps the bundle small, keeps every pose and expression available at any frame rate, and needs no new tools.

3D makes sense when:
- a character is designed in 3D (a CG-era design or a game model), so the 3D asset is the canon reference;
- the camera must rotate around fighters (a 3D select turntable, an intro or promo shot);
- the art team works in Blender and wants hand-keyed animation, pre-rendered to sprites (workflows A to C below);
- a stage wants painterly depth that is easier to model than to paint procedurally.

## Constraints that shape every 3D decision

- **Sizes come from the engine.** A fighter's standing height in world px is `body.h` (120 Pikachu … 210 Four Arms, canon-relative heights compressed into a playable range), feet anchored at `y`, facing `+x` when `facing === 1`. Rendered frames must put the feet on a known pixel row (the pivot) and face right; the view flips with `scaleX = facing`.
- **Resolution.** The canvas renders at `res = min(2, devicePixelRatio)`. Render frames at 2x (frame height about `2 * 1.6 * body.h` px, so ~512 px for a 160 px fighter) and let linear filtering downscale. No nearest-neighbour, no pixel art.
- **Style.** Flat cel shading (2-3 tone bands), bold outline `#0b0f1e` about 3 world px thick, saturated palette from the fighter's `palette` (`primary`, `secondary`, `accent`, `skin`), navy-friendly contrast. The existing vector rig sets the bar: match its silhouette weight and outline width or the roster will look mismatched.
- **Budget.** Fighter art is lazy-loaded per character; keep each character's atlas set under ~2 MB (PNG, trimmed frames, or WebP) and under two 2048² textures at 1x. The menu bundle must stay under 3 MB gzipped, which rules out a 3D engine in the menu path unless it is lazy-loaded and the user agreed to add the dependency (CLAUDE.md allowed-deps rule).
- **Animation set.** The renderer distinguishes `BASE_ANIMS` (`idle walk crouch jump fall dash backdash block crouchBlock hitstun launched knockdown getup grabbed ko win lose intro`) and `ATTACK_ANIMS` (`jab punch kick lowKick sweep uppercut airPunch airKick slam throw taunt spin cast beam dashStrike glide teleport buff flurry ultimate`), each attack having wind-up, strike and recovery phases driven by `movePhase`. Plan Blender actions with those names so mapping stays mechanical.
- **Determinism is untouched.** The view reads state; it never writes it. Frame selection must be a pure function of `action`, `moveId`, `movePhase`, `moveFrame`, `actionFrame` and local time.

## Tooling on this machine

Blender is not installed (`brew install --cask blender`, 4.2 LTS or newer; the scripts call `blender -b` headless). Python 3.9 is present without Pillow; the atlas packer needs `pip3 install pillow`. Node 24 is available through nvm. Scripts here were syntax-checked but could not be executed against Blender in this environment: run them once, read the error if any, and fix the bpy call before relying on them.

## Workflows

### A. Model a fighter procedurally (fast, consistent with the roster)

```bash
blender -b -P .claude/skills/3d-modeling/scripts/blender_build_fighter.py -- --char goku --out build/3d/goku.glb --blend build/3d/goku.blend
```

Builds a blocky toon figure from primitives using the same proportions as the 2D art (`mk()` values in `client/src/game/art/chars/<id>.js`) and the fighter palette, adds an armature whose bones mirror the 2D rig (hip, torso, head, upper/lower arms, hands, upper/lower legs, feet, optional tail), rigid-parents each part to its bone, and exports GLB. Open the `.blend` to sculpt, add clothes and animate; keep bone names so the renderer mapping stays valid.

### B. Render animations to sprite frames

```bash
blender -b -P .claude/skills/3d-modeling/scripts/blender_render_sprites.py -- \
  --blend build/3d/goku.blend --out build/sprites/goku --height 160 --res 2 \
  --actions idle,walk,jab,punch,kick --step 2 --engine eevee
```

Side-view orthographic camera, transparent background, Freestyle outline, EEVEE (or Workbench flat preview), one PNG per sampled frame under `out/<action>/NNN.png`, plus `manifest.json` with frame size, pivot row and action frame lists. `--height` is the engine `body.h` so the character fills the right number of world px; `--step 2` samples every second Blender frame (24 fps action → 12 fps sprites, a good cartoon cadence).

### C. Pack an atlas and load it in Phaser

```bash
pip3 install pillow
python3 .claude/skills/3d-modeling/scripts/pack_spritesheet.py build/sprites/goku client/public/sprites/goku --max 4096 --trim
```

Produces `goku.png` + `goku.json` (Phaser JSON-hash with trimmed frames and `pivot`), then `SpriteFighterView` (reference doc) loads it with `scene.load.atlas` and implements the same `sync(f, x, y, dtMs, perf)` contract as `FighterView`. Keep `FighterView` as the fallback for characters without sprites so the roster never breaks.

### D. Optional real-time 3D in menus (Three.js)

Only after the user agrees to add `three` (about 150 kB gzipped, lazy-loaded chunk). Use it for a character-select turntable or results screen: load the GLB with `GLTFLoader`, `MeshToonMaterial` with a 3-step gradient map, an `OutlinePass` or inverted-hull outline, orthographic or long-lens camera, pause rendering when the tab is hidden, dispose geometries/materials/textures on unmount (same discipline as `createGame().destroy`). Never render Three.js and Phaser on the same screen at once.

## Decision guide

| Want | Do |
| --- | --- |
| Better-looking, more on-model 2D cartoon fighters | Stay in 2D: `character-art-rig` skill (likeness, expressions, motion) |
| Fighters with a genuinely 3D design, without touching gameplay | Workflow A → B → C, swap view per character |
| A single hero shot or promo image | Workflow A, then a high-res Cycles render; not shipped in the bundle |
| 3D stage backdrops | Model in Blender, render parallax layers as wide PNGs (1400 px per layer at 2x) and paint them in a stage `draw()` through `drawImage`, keeping `stage-design` rules |
| Animated 3D in the fight | Not recommended: bundle, battery and consistency costs; pre-render instead |
| 3D select screen | Workflow D after approval |

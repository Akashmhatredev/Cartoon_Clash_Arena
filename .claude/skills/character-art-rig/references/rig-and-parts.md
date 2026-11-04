# Rig, poses, parts and drawing helpers

## Joints (`J`, pose array indices, 18 floats)

| Index | Key | Meaning |
| --- | --- | --- |
| 0, 1 | `rx`, `ry` | whole-body offset (ry negative = lift) |
| 2 | `rot` | hip/body rotation (negative = lean back, -90 lying down) |
| 3 | `tor` | torso bend relative to hips |
| 4 | `head` | head tilt relative to torso |
| 5, 6 | `auf`, `alf` | front upper and lower arm |
| 7, 8 | `aub`, `alb` | back upper and lower arm |
| 9, 10 | `luf`, `llf` | front upper and lower leg |
| 11, 12 | `lub`, `llb` | back upper and lower leg |
| 13, 14 | `ftf`, `ftb` | front and back foot |
| 15 | `tail` | tail swing |
| 16, 17 | `sx`, `sy` | body scale (squash and stretch) |

Degrees, forward-positive. Limbs hang down at 0; torso, head and tail point up at 0. `makePose(obj, base)` fills a Float32Array from a partial object (keys from `JOINT_KEYS`); `lerpPose(dst, a, b, t)`, `copyPose`, `overlayLegs(dst, src, keepSy)` are the blend helpers. The second arm pair (Four Arms) has no joints of its own: `solveRig` derives it from the main arm angles with fixed offsets.

## Bones (`B`, 22 bones, each `x, y, rotation` in `Float32Array(NB * 3)`)

`HIP TORSO HEAD AUF ALF HF AUB ALB HB LUF LLF FF LUB LLB FB TAIL AUF2 ALF2 HF2 AUB2 ALB2 HB2`. `solveRig(spec, pose, out)` writes body-space bones with the hip at `(0, -hipH)`. `lowestY` returns the lowest contact point for ground snapping, `highestY` the head top.

## File layout

```
client/src/game/art/chars.js        registry: imports every chars/<id>.js, builds BODY/PALETTE/BUILDERS, getSpec, bodyFor, paletteFor, FORMS, EXPRS, HUMAN
client/src/game/art/chars/kit.js    shared drawing kit and assemble()
client/src/game/art/chars/<id>.js   one fighter (ben10.js also holds fourarms, xlr8, heatblast)
```

A fighter file looks like this:

```js
// Fighter art: <Name>. Owns proportions, palette fallback and Canvas2D part drawings.
import * as D from '../draw.js';
import { B } from '../rig.js';
import { LW, OUT, assemble, brows, fist, grit, mk, openMouth, part, shoe, smile, whiteEyes } from './kit.js';

const PAL_X = { primary: '#...', secondary: '#...', accent: '#...', skin: '#...' };

// <canon design cues in one or two lines: age/height, head ratio, hair, face, outfit>
function x(c) {
  const s = mk({ headW: 46, headH: 46, neck: 2, torsoLen: 50, torsoW: 38, pelvisDrop: 10,
    uArm: 24, lArm: 22, armR: 5.8, armR2: 5, handR: 6.2, uLeg: 29, lLeg: 28, legR: 7.8, legR2: 6, footL: 21, footH: 9, shY: 44 });
  const d = {
    head(ctx, e) { /* hair, face, ears; eyes/brows/mouth depend on e */ },
    headBox: [-34, -62, 36, 8],
    torso(ctx) { /* hips to shoulders */ },
    torsoBox: [-28, -60, 28, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.96, [[0, c.primary], [0.42, c.skin]], dim, true, { bulge: 0.14 }),
    lArm: (ctx, dim, front) => D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, c.skin]], dim, true, { bulge: 0.12 }),
    hand: (ctx, dim) => fist(ctx, s.handR, c.skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.94, [[0, '#...']], dim, true, { bulge: 0.14 }),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.92, s.legR2, [[0, '#...']], dim, true, { bulge: 0.08 }),
    foot: (ctx, dim) => shoe(ctx, s, '#...', '#f0f0f0', dim),
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  x: { body: { w: 70, h: 166, crouchH: 108 }, palette: PAL_X, build: x },
};
```

`body` here is only a fallback; the engine's `shared/fighters/<id>.js` body wins (`bodyFor`). Keep them equal so tools that run without the engine agree.

## Spec proportions (`mk({...})` in chars/kit.js)

| Field | Meaning | Roster range |
| --- | --- | --- |
| `headW`, `headH` | head size used by portraits, silhouettes and `H` | 42-92 / 42-88 |
| `neck` | gap between torso top and head pivot (negative tucks big heads into the body) | -8..6 |
| `torsoLen`, `torsoW` | torso height and width | 36-88 / 34-84 |
| `pelvisDrop` | how far the pelvis extends below the hip pivot | 6-14 |
| `uArm`, `lArm`, `armR`, `armR2`, `handR` | arm segment lengths, radius at shoulder and wrist (`armR2` defaults to `armR * 0.86`), hand radius | 10-32 / 5-13 / 5.6-12.5 |
| `uLeg`, `lLeg`, `legR`, `legR2`, `footL`, `footH` | leg segments, radius at hip and ankle (`legR2` defaults to `legR * 0.82`), foot length and height | 9-34 / 6.6-14.5 / 18-30 / 8-12 |
| `shY`, `shXF`, `shXB`, `shY2` | shoulder height above hip, front/back x offsets (defaults 3 / -7), `shY2` for the lower arm pair | 31-76 |
| `hipXF`, `hipXB`, `hipDrop` | hip joint offsets (defaults 7 / -6 / 2) | |
| `tail` | `{ x, y, base }` pivot offset and base angle, or null | |
| `fourArms` | adds the second arm pair (bones AUF2..HB2) | |

Derived: `hipH = uLeg + lLeg + footH`, `H = hipH + torsoLen + neck + headH`. `getSpec` then sets `k = body.h / H`. `H / headH` is the head-to-body ratio the eye reads: about 2.2 for Shinchan and Pikachu, 1.75 for Doraemon, 3.2-3.6 for Goku, Nobita, Hattori, Ben and Bheem, 5 for Four Arms.

## Part object

```js
{ name, bone: B.X, draw(ctx, e?), box: [x0, y0, x1, y1], ox: 0, oy: 0, rot: 0, dyn: null, variants?: ['blink', 'hurt', 'shout'] }
```

`ox`/`oy` offset the part from its bone pivot (rotated with the bone), `rot` is a fixed extra rotation in degrees. `variants` lists the expression frames the atlas bakes as `"<name>@<expr>"`; the drawer is then called as `draw(ctx, expr)` for each, and as `draw(ctx)` for the normal frame. `part(name, bone, draw, box, extra)` builds one; `assemble(s, d)` builds the standard set.

## Drawer object `d` for `assemble`

| Key | Signature | Notes |
| --- | --- | --- |
| `head(ctx, e)`, `headBox` | pivot at the neck, draw upward (negative y) | `e` = `normal`, `blink`, `hurt`, `shout`; the box must hold every variant |
| `torso(ctx)`, `torsoBox` | pivot at the hip, draw upward | shoulders should sit near `(shXF, -shY)` / `(shXB, -shY)` |
| `uArm(ctx, dim)`, `lArm(ctx, dim, front)` | pivot at shoulder / elbow, draw along +y | `front` is true only for the near forearm |
| `hand(ctx, dim)` | pivot at the wrist | `fist()` or `ball()` |
| `uLeg(ctx, dim)`, `lLeg(ctx, dim)` | pivot at hip / knee, draw along +y | |
| `foot(ctx, dim)` | pivot at the ankle | `shoe`, `ovalFoot` or `bareFoot` |
| `tail` | a full `part(...)` | drawn after the back leg, before the torso |
| `behind` | parts drawn first | capes, scarves, Goku's pole on the back |
| `torsoFront` | parts after the front leg | belts or sashes over the hips |
| `headBack`, `headFront` | parts just before / after the head | ears, flames, hats, Doraemon's Bamboo Copter |
| `beforeHandF` | parts between the front forearm and the front hand | held props (Goku's pole in hand) |
| `front` | parts drawn last | anything in front of the whole figure |

Draw order from `assemble`: `behind`, (back second-arm pair), back arm, back leg, `tail`, torso, front leg, `torsoFront`, `headBack`, head, `headFront`, (front second-arm pair), front arm, `beforeHandF`, front hand, `front`. Back limbs get `dim` 0.22-0.24, the second pair 0.36 behind and 0.1 in front. `limbBox(len, r)` and the hand and foot boxes are generated.

## Kit helpers (`chars/kit.js`)

Constants: `LW`, `OUT` (outline colour), `DARK` (`#1c1c26` hair/black), `EXPRS`, `BLUSH`.
Bodies: `mk(o)`, `tunicPath(k, top, wTop, wBot, bot)`, `ribbon(ctx, len, w, color, sway)` (cloth hanging along +y), `cracks(ctx, len, color)` (Heatblast glow lines), `omnitrix(ctx, x, y, r)`, `staffDraw(from, to)` (Power Pole).
Hands and feet: `fist(ctx, r, color, dim)` (mitten fist with thumb), `ball(ctx, r, color, dim)` (round paw or glove), `shoe(ctx, s, color, sole, dim, stripe)`, `ovalFoot(ctx, s, color, dim, stripe)`, `bareFoot(ctx, s, skin, dim)`, `dimFill(k, dim, x, y, w, h)`.
Faces: `dotEyes(ctx, e, [[x, y, rx, ry], ...], lidW)` (solid eyes), `whiteEyes(ctx, e, list, iris, pupil, lidW)` (sclera, iris, pupil), `squeeze(ctx, x, y, rx, ry, near, lw)` (`>` / `<` hurt eyes), `brows(ctx, e, [[x1, y1, x2, y2, w], ...], color)` (tilt angry on shout, worried on hurt), `openMouth(ctx, x, y, w, h, tongue)`, `grit(ctx, x, y, w, h)`, `smile(ctx, x1, y1, x2, y2, depth, lw)`, `ear(ctx, x, y, skin, rx, ry)`. Eye and brow lists are near side first.
Assembly: `assemble(s, d)`, `part(name, bone, draw, box, extra)`, `limbBox(len, r)`.

## draw.js helpers

Colour: `hexToRgb`, `mix(a, b, t)`, `shade(hex, f)` (f < 1 darkens toward navy, > 1 lightens), `rgba(hex, a)`, `hexNum`, `isHex`.
Paths: `taperPath`, `ellipsePath`, `roundRectPath`, `polyPath(pts, close)`, `blobPath(pts)` (smooth closed blob through points), `limbPath(ctx, len, r1, r2, bulge)`.
Fill/stroke: `fillStroke(ctx, fill, lw, stroke)`, `line`, `curve`, `circle`, `dot`, `shaded(ctx, pathFn, base, inner, lw)` (fill, clip, inner shading, stroke), `sideShade`, `dimOver`, `eye(ctx, x, y, rx, ry, pupil, pr, pdx, iris)`, `dotEye`, `radialGlow`, `rng(seed)` (tiny deterministic PRNG), `makeCanvas(w, h)`.
Limb: `limb(ctx, len, r1, r2, bands, dim = 0, seams = true, { bulge = 0.12, open = true })`. Fill and bands are clipped to the bulging limb path; the stroke leaves out the cap at the pivot, so the child segment drawn on top joins its parent without a ring.
Constants: `OUTLINE = '#0b0f1e'`, `LW = 3`.

## Pose library (`poses.js`)

`POSES`: `idle walk crouch jump tuck fall dash dash2 backdash backdash2 block crouchBlock hitstun hitGut crouchHit launched knockdown sitUp getup grabbed win lose intro` (`ko` aliases `knockdown`; `walk` is only the base, the animator builds the gait; `jump`/`tuck`/`fall` are the push-off, apex and landing-reach keys of the jump arc; `dash`/`dash2` and `backdash`/`backdash2` are start and end keys; `hitstun` and `hitGut` alternate on consecutive hits; `knockdown` → `sitUp` → crouch → stance is the get-up). `IDLE` is the generic stance; each character's `motion.js` stance is merged over it. `ATTACKS[anim] = { w, s, r, alt, limb, ov }`, built with `A(w, s, r, alt, { limb, ov })`: `limb` (`arm` default, `leg`, `body`) picks which joints lead the snap, `ov` (default 0.1) the overshoot. `OWN_LEGS` lists anims whose legs are not overridden. `guessAnim(moveId)` maps slots to defaults when a move has no known anim. `CROUCH` and `AIR_LEG_POSE` are the leg overlays. Timing and blending live in the animator (`references/animator.md`).

## Atlas and textures

`buildAtlas(scene, spec)` returns `{ key: 'ccf:<id>:<form>:<S>', S, frames: { [frameName]: { ox, oy } } }`, row-packed with 2 px padding. Frame names are part names plus `"<part>@<expr>"` for variants. `buildBodyTexture(scene, spec)` returns the idle silhouette `ccb:...`. `fx/textures.js` owns `canvasTexture(scene, key, w, h, draw, scale)`, `invScale(scene, key)` and the shared `TEX` set (`soft streak star ring smoke shadow bolt dot hex flame white`).

`drawFigure(ctx, spec, pose, { show: { prop, staffHand }, skip(part), expr })` draws the whole figure with feet at the origin, using the variant drawing when `expr` is set. Portraits and lab tools use it; scale the context by `spec.k` first to get world size.

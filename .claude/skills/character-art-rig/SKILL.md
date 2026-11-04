---
name: character-art-rig
description: Draw, fix or extend Cartoon Clash's procedural 2D fighter art and animation in client/src/game/art. Use this whenever a task mentions a fighter's look, likeness, "make X look like the real character", outfit, head, face, eyes, expressions, blinking, limbs, proportions, height, poses, animation keys, motion that looks stiff, robotic or floaty, springs, idle bounce, walk cycle, victory pose, portraits, the atlas, FighterView, the Animator, motion.js, chars/<id>.js, "the arm looks wrong", "feet float", "add art for a new character", Ben 10 form variants, or screenshotting fighters to check them. Also use it when a new move anim name is needed, because the renderer only knows the ATTACK_ANIMS keys.
---

# Character art and rig

Fighters are vector puppets. A shared forward-kinematics skeleton (`rig.js`) is dressed with Canvas2D part drawers that live in one file per fighter (`chars/<id>.js`), built from a shared kit (`chars/kit.js`) and looked up through the registry (`chars.js`). A rasterizer bakes every part, plus one frame per facial expression, into a high-res atlas (`atlas.js`). Each frame an `Animator` (`animator.js`) turns the fighter state into a pose with per-joint damped springs and procedural layers, flavoured by the character's motion personality (`motion.js`), and `FighterView.js` places the atlas images on the solved bones. Portraits (`portrait.js`) and tools draw the same parts with `drawFigure` (`figure.js`) and no Phaser. `draw.js` holds the Canvas2D vocabulary.

References:
- `references/rig-and-parts.md`: joints, bones, `mk()` proportions, the part object, the `assemble` drawer slots, kit and `draw.js` helpers, atlas frames.
- `references/animator.md`: keyed motion versus springs (feed-forward profiles, inertialized blending), the attack timeline, gait, jumps and flips, hit reactions, impulses, joint limits, base frequencies per state, how to tune omega and zeta, expressions, every `motion.js` field.
- `references/visual-verification.md`: the scratch art-lab page and driving the real game in headless Chrome over CDP.

## Files

| File | Role |
| --- | --- |
| `client/src/game/art/chars.js` | Registry: merges the per-fighter exports, `getSpec(charId, form)`, `bodyFor`, `paletteFor`, `FORMS`, `EXPRS`, the `HUMAN` skin-override set |
| `client/src/game/art/chars/kit.js` | `mk()` proportions, `fist`, `ball`, `shoe`, `ovalFoot`, `bareFoot`, `tunicPath`, `ribbon`, `ear`, `omnitrix`, `cracks`, `staffDraw`, face helpers (`dotEyes`, `whiteEyes`, `squeeze`, `brows`, `openMouth`, `grit`, `smile`, `BLUSH`), `limbBox`, `assemble`, `part` |
| `client/src/game/art/chars/<id>.js` | One fighter: palette fallback, fallback `body`, the builder `function <id>(c)`; default export `{ <id>: { body, palette, build } }`. `ben10.js` also exports `fourarms`, `xlr8`, `heatblast` |
| `client/src/game/art/animator.js` | `Animator`: attack timelines keyed to frame data, planted-foot gait, jump arcs and flips, hit reactions, per-joint springs with feed-forward, impulses, joint limits, expressions. Phaser-free, render-only |
| `client/src/game/art/motion.js` | Per-character and per-form personality (`motionFor`) |
| `client/src/game/art/rig.js`, `poses.js` | Skeleton and FK solver; shared `POSES` (incl. `tuck`, `dash2`, `backdash2`, `hitGut`, `sitUp`), `ATTACKS` (key poses plus `limb` and `ov`), `OWN_LEGS`, `guessAnim`, blend helpers |
| `client/src/game/art/atlas.js`, `figure.js` | `buildAtlas` (parts plus `"<part>@<expr>"` frames), `buildBodyTexture` (idle silhouette for shadow clones), `drawFigure(ctx, spec, pose, { show, skip, expr })` |
| `client/src/game/art/FighterView.js` | Phaser puppet: images on bones, `dyn` part behaviours, expression frame swaps, turnaround, tints, auras, charge orb, form ring, shadow |
| `client/src/game/art/portrait.js` | Menu busts (`renderPortrait`, `portraitURL`), `EXTRA_TOP` head-room per character |

## How a fighter gets on screen

1. `getSpec(charId, form)` runs the builder with its palette (`paletteFor`: the engine fighter's `primary`, `accent` and, for `HUMAN` ids, `skin` override the file's fallback). The result is `spec = { headW, headH, torsoLen, uArm, ..., parts[], H, k }`. `H` is the drawn standing height from `mk()`; `k = body.h / H`, so **the engine's `body.h` sets the size on screen, not the drawing**.
2. `preloadFighterArt(scene, charId)` bakes each part's `box` into one canvas atlas at scale `res * k` and registers a frame per part name. Parts with `variants` (every head) get extra frames `head@blink`, `head@hurt`, `head@shout` with the same box and pivot. It also bakes the idle silhouette used for Hattori's shadow clones.
3. `FighterView.sync(f, x, y, dtMs, perf)` calls `animator.update(f, dt, legLen)`, swaps head frames when `animator.expr` changes, solves the rig from `animator.cur`, snaps the lowest point to the ground (airborne, blended by `animator.air`, it anchors the hip at standing height instead so flips turn around the body, never dipping below the floor), places every image, then applies root scale `(face * sx * spin, sy)`, invuln flicker, tints (hit flash white, armor gold, slowed purple), buff auras, the charge orb, the form-swap ring and the ground shadow. The displayed facing eases through zero when the fighter turns around.
4. `renderPortrait(charId, size, { form, flip, frame, background })` draws a framed bust; `portraitURL` returns a cached PNG data URL.

## Conventions you must keep

- Units are world px at `k = 1`; each part is drawn around its pivot. Limbs hang along +y from the joint; torso and head extend up along -y. Pose angles are degrees, forward-positive.
- Facing +x in a three-quarter view: the near eye is drawn first and larger, the far eye smaller and closer to the face edge.
- Outline `#0b0f1e`, `LW = 3`. Use `D.fillStroke`, `D.shaded`, `D.limb` and the kit so every part shares the look. Flat cel shading (one back-side wash, a highlight strip), no gradients on bodies, no pixel art.
- Keep `mk()`'s `H` within about 10% of the engine `body.h` (`k` 0.9-1.1) so outline weight matches across the roster.
- Every part's `box: [x0, y0, x1, y1]` must contain everything it draws, including outline and every expression variant. The atlas clips outside it.
- Keep part names, bones and `dyn` tags; `FighterView` and the lab tools depend on them: `trail` (cloth sway with velocity), `ear` (wobble, droop in hitstun), `flame` (flicker scale), `prop` (visible only while gliding, spins), `staffHand` / `staffBack` (Goku's pole swaps to the hand on moves whose name contains "pole"), `tailBob` (tag only today).
- Head drawers are `head(ctx, e)`; torso drawers take `ctx`; limb drawers take `(ctx, dim)` where `dim` darkens back limbs (0.22-0.36); `lArm(ctx, dim, front)` knows whether it is the near arm (wrist props such as the Omnitrix go only on the front arm).
- Likeness: work from text descriptions of the canon design (head-to-body ratio, build, hair shape, face, outfit colours). Never download, trace or embed official artwork. When unsure about a detail, keep what exists rather than inventing.
- Render code is allocation-free per frame. Drawers run only at bake time, so they may allocate; `Animator.update` and `FighterView.sync` may not.

## Faces and expressions

Every head drawer must render four expressions, because the atlas bakes all of them and the animator picks one per frame:

| `e` | When the animator shows it | Typical drawing |
| --- | --- | --- |
| `normal` | default | open eyes, character's resting mouth |
| `blink` | every 2-5 s for 0.11 s (sometimes a double blink), and in blockstun | eyelid curves (`dotEyes`/`whiteEyes` do it) |
| `hurt` | hitstun, launched, grabbed, knockdown, KO, lose | `>` `<` squeezed eyes (`squeeze`), worried brows, `grit` teeth |
| `shout` | active attack frames, charging, ultimates (winners keep `normal`, since shout brows read as angry) | angry brows, smaller pupils, `openMouth` |

Pass `e` straight into the kit helpers (`dotEyes(ctx, e, list)`, `whiteEyes(ctx, e, list, iris, pupil)`, `brows(ctx, e, list, color)`) and switch the mouth yourself. `assemble` gives the head part `variants: EXPRS`; any other part can opt in by drawing `(ctx, e)` and carrying `variants` too (FighterView swaps every part with variants). Check all four with the lab's face view before shipping.

## Limbs

`D.limb(ctx, len, r1, r2, bands, dim, seams, { bulge, open })` draws an organic limb from the pivot along +y: rounded caps joined by gently bulging sides (`bulge` 0.06-0.2; 0 is a straight taper), colour `bands` as `[[fromFraction, colour], ...]`, optional seam lines between bands, and flat cel shading. The outline is open at the pivot cap (`open` defaults to true), so a lower segment drawn over its parent hides the joint seam and elbows and knees read as one continuous limb instead of doll joints. Pass `{ open: false }` only for deliberately segmented limbs. Higher `bulge` reads as muscle or chubbiness (Goku's arms 0.2, Doraemon's legs 0.06); widen the part box if you push past about 0.25.

## Motion in one paragraph

Keyed motion is a function of the engine's frame counters, so it is exact at any frame rate: attacks run a timeline built from the move's frame data (wind-up from the current pose, a snap where hips and legs lead and the striking limb arrives last, fully out on the first active frame, a small overshoot, a follow-through hold, then recovery to the stance), the walk plants each foot and slides it back at ground speed (Pikachu bounds), jumps push off, tuck at the apex and reach for the floor (Hattori, Goku, Pikachu and XLR8 front-flip on forward jumps), dashes lunge or hop, and get-ups are timed. Each joint follows its keyed curve through a feed-forward weight; the head, forearms and tail only partly follow, and their damped springs make them drag and overshoot. State changes hand the current momentum to the springs instead of snapping. Hits alternate two reaction poses (`hitstun`, `hitGut`) scaled by knockback; launches tumble along the arc into a knockdown. Joint limits, a velocity cap and a NaN guard (falls back to the stance) keep poses sane. `motion.js` makes each character move like themselves: stance, bounce, gait, weight, snap, head behaviour, flips, dash guard, idle fidgets, and win, lose and intro loops. Tune personality in `motion.js` and timing through frame data first; change spring tables or feed-forward profiles only for roster-wide feel. Details and numbers: `references/animator.md`.

## Checklist: art for a new fighter

1. Create `client/src/game/art/chars/<id>.js` from the closest existing file (Nobita, Ben 10 and Hattori are slim kids; Bheem stocky; Goku small and spiky; Shinchan and Pikachu big-headed; Doraemon round). Header comment with the canon design cues, a `PAL_<ID>` fallback, `function <id>(c)` starting with `mk({...})`, a drawer object `d` (see the reference for slots), `s.parts = assemble(s, d); return s;`, and `export default { <id>: { body: { w, h, crouchH }, palette: PAL_<ID>, build: <id> } }`. Keep `body` equal to the engine's.
2. Register it in `client/src/game/art/chars.js`: import it and spread it into `ART`; add the id to `HUMAN` if the engine palette's `skin` should apply.
3. Head: `head(ctx, e)` covering all four expressions; `headBox` containing hair, ears and every variant.
4. Proportions: aim for the canon head-to-body ratio (`H / headH`: chibi kids about 2.2-2.5, mascots 1.7-2.2, older kids 3.2-3.6, Four Arms about 5) and keep `H` within 10% of `body.h`.
5. Motion: add an entry to `M` in `client/src/game/art/motion.js`: `stance`, `bounce`, `walk` (`swing`, `duty`, `lift`, `absorb`, `skate`, ...), `weight`, `snap`, `headK`/`headLim` for big heads, `flip`, `dashGuard`, `fidget`, `win`/`winMove`, `lose`/`loseMove`, `intro`. Without it the fighter uses the generic `BASE` motion.
6. Portrait: add the id to `EXTRA_TOP` in `client/src/game/art/portrait.js` (head-room in art units above the head; tall hair, ears and flames need more: Pikachu 44, Heatblast 42, Goku 36, Bheem 18) and check the menu busts so nothing is cut off.
7. Verify visually (lineup, face, sheet, film views, then the real game) and check the browser console for `[art] part` warnings.

## Checklist: a new Ben 10 style form

1. Add a builder and an entry keyed by the form id to the owning fighter's art file (`chars/ben10.js` holds `fourarms`, `xlr8`, `heatblast`). Use `fourArms: true` and `shY2` in `mk()` for a second arm pair.
2. Add the form to `FORMS[charId]` in `chars.js`; the engine form needs its own `body` in `shared/fighters/<id>.js` (`forms.<form>.body`).
3. Add a `motion.js` entry keyed by the form id (forms with an entry override the base character's motion; the animator switches when `f.form` changes).
4. Add `EXTRA_TOP[form]` in `portrait.js` if needed, then verify with `chars=ben10:<form>` in the lab.

## Checklist: new attack animation key

1. Add the key to `ATTACKS` in `poses.js` with `A(w, s, r, alt, { limb, ov })`: `w` wind-up, `s` strike, optional `r` follow-through (generated when null), optional `alt` (alternating strike for flurries, swapped every `hitInterval` frames), `limb` (`arm`, `leg` or `body`: which joints lead the snap) and `ov` (overshoot past the strike as a share of the wind-up-to-strike swing, 0-0.12 in the current set).
2. Add it to `OWN_LEGS` if the pose defines its own legs (kicks, sweeps, aerials); otherwise the animator overlays crouch legs for crouch moves and air legs in the air.
3. Extend `guessAnim` if a default mapping makes sense, add any special per-anim motion in `Animator._attack` (spin, taunt turn-around and glide hover live there), update the ATTACK_ANIMS list in CONTRACT.md section 5, and use the key in a move's `anim`.
4. Check it in the lab's `big` view (pose) and `film` view (timing).

## Debugging

- Looks robotic: every joint moving in lockstep means the soft joints lost their lag (feed-forward profile too close to 1 for head, forearms, tail) or a state skips its keyed curve. Check the `FF_*` profiles and the `MUL`/`ZETA` spread in `references/animator.md`.
- Wobbly or jittery: zeta too low on a joint whose target moves every frame (walk, bounce). Raise that group's `ZETA`, or lower the layer amplitude in `motion.js`.
- Strike looks late or mushy: the timeline puts the strike on the first active frame, so check the move's `startup` and that its `anim` exists in `ATTACKS`; for more punch raise `snap` or the anim's `ov`.
- Feet sliding in the walk: `walk.skate` too high, or `legLen` wrong (FighterView passes `(uLeg + lLeg) * k`).
- A pose pops when changing state: the change was not marked as a cut, or the new state sets `ff` high on a joint far from its target. Cuts are automatic on action, move, form and anim changes.
- Fighter vanishes or freezes in the stance: the NaN guard fired; look for a division by zero or an undefined field in a new keyed curve.
- Arms or legs detached: the part pivot is wrong, or `shY`/`shXF`/`hipXF` in `mk()` do not match where the torso drawer placed shoulders and hips.
- Visible ring at elbows or knees: the limb was drawn with `{ open: false }` or a custom path; use `D.limb`.
- Feet floating or sinking: `lowestY` snaps the lowest point (feet, knees, hands, head) to the ground; a foot `box` or `footH` mismatch moves the contact point.
- Face never changes: the head part lost `variants` (built without `assemble`), or the drawer ignores `e`.
- Atlas clipping (flat edges on hair or a hand): enlarge the part's `box`. Drawer exceptions print `[art] part <id> <name>` in the console.
- Blurry at 2x: confirm `scene.registry.get('res')` is 2 and `buildAtlas` ran after the registry was set (FightScene sets it in `init`).

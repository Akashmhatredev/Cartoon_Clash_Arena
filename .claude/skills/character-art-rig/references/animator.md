# Animator and motion personality

`client/src/game/art/animator.js` turns engine state into a pose every render frame. It is Phaser-free and render-only: it reads the fighter object and never writes it, and its random noise (blinks, hit flails, fidget timing) comes from its own xorshift seed per side and character, never `state.rng`. Determinism and online play are untouched by anything in this file. It allocates nothing per frame after warm-up (move plans are built once per form and move, then cached). `FighterView` owns one `Animator` per fighter; the art lab's film view uses the same class on engine states.

```js
const a = new Animator(charId, side);
a.update(f, dtSeconds, legLen);   // legLen = (uLeg + lLeg) * k, hip-to-ankle, used to plant the feet
a.cur      // Float32Array(18) pose to solve the rig with
a.anim     // resolved anim name (idle, walk, jump, fall, glide, block, crouchBlock, hitstun, launched, ..., or an ATTACKS key)
a.phase    // movePhase while attacking, else null
a.pole     // Goku: show the pole in his hand
a.expr     // 'normal' | 'blink' | 'hurt' | 'shout'
a.sx, a.sy // root scale (squash and stretch times the pose's sx/sy)
a.spin     // extra x scale for turning on the spot (spin anim, taunt, Shinchan's victory); |spin| >= 0.15
a.air      // 0 = feet snapped to the floor, 1 = airborne hip anchor (eased)
a.impulse(j, v)            // add velocity to joint j (deg/s, or px/s for rx/ry), for one-off kicks
a.keyPoses(moveId, form)   // tool helper (allocates): the stance-adjusted w/s/r/alt/base poses of a move
```

## Two kinds of motion, one spring per joint

Every joint mixes two things through a per-joint feed-forward weight `ff` (0..1):

- **Keyed motion** (attacks, gait, jump arcs, dashes, get-ups) is a deterministic function of the engine's frame counters (`moveFrame`, `actionFrame`, `vy`, `dashT`, `stun`) plus a sub-tick fraction. With `ff = 1` the joint follows the keyed curve exactly (`cur += ff * (tgt - prevTgt)` each frame), so a strike is fully out on the first active frame at any render rate.
- **Soft motion** keeps part of its spring lag: head, forearms and tail have low `ff`, so they drag behind, overlap and follow through instead of moving in lockstep with the body.

Whatever the keyed curve does not carry, a damped spring per joint absorbs: the leftover offset after a state change, impulses, and the lag of soft joints. On a **cut** (new action, new move instance, form change, guard high/low swap) the animator does not snap: it hands the current motion to the springs (inertialized blending). Velocity carried over is `ffPrev * targetVelocity * 0.4`, capped at ±600 per joint, and `rot` is unwrapped the short way round so flips and tumbles never spin back.

Feed-forward profiles (`FF_*` at the top of animator.js):

| Profile | Used by | ff |
| --- | --- | --- |
| `FF_KEY` | attacks, dash, backdash, getup | 1; head 0.55, tail 0.25 |
| `FF_GAIT` | walk | 1; torso 0.6, upper arms 0.5, forearms 0.3, head 0.35, tail 0.2 |
| `FF_IDLE` | idle, crouch | 0.75; upper arms 0.5, forearms 0.35, head 0.35, tail 0.2 |
| `FF_AIR` | jump, fall | 0.55; root (`rx ry rot`) 1, torso 0.6, upper arms 0.4, forearms 0.25, head 0.3, tail 0.15 |
| `FF_SOFT` | hitstun, block, blockstun, knockdown, grabbed, win, lose, intro, glide | 0.45; head 0.2, forearms 0.2, tail 0.1 |
| `FF_TUMBLE` | launched (and airborne KO) | 0.2; `rx ry rot` 1, tail 0.05 |
| `FF_NONE` | grounded KO | 0 (pure spring, goes limp) |

## One update, in order

1. Clamp `dt` to 0.1 s and advance local time (half speed while the `slowed` buff is on). For `ben10`, switch motion personality when `f.form` changes (a cut).
2. On an action change run `_enter` (impulses, cut). Track `actionFrame` plus a sub-tick fraction.
3. Detect take-off (arc start speed `vy0`, flip decision, stretch), landing (landing strength from the fastest fall speed, squash, knee impulse), a fresh hit (`hitFlash` rose: `_hitReact`, or a small flinch if armored through an attack) and each new blocked hit (`stun` rose in blockstun).
4. `_target(f, dt, legLen)` fills `tgt`, sets `ff`, and returns the base frequency `omega` (rad/s) for the state. It then applies the landing knee-bend, `headK`, and the joint limits to the target.
5. `_expression` picks the face.
6. Feed-forward (or, on a cut, momentum hand-off), then integrate the springs: sub-steps of at most 1/240 s; per joint `w = omega * MUL[j] * (1.12 - 0.24 * weight)` and damping ratio `ZETA[j]`, implicit (backward) Euler, unconditionally stable.
7. Safety: a NaN or infinite value anywhere resets the pose to the stance (zero velocity, cut) instead of hiding the fighter; joint limits clamp the pose and zero velocity pushing past them; every joint speed is capped at `VMAX` = 2400 deg/s (or px/s).
8. Ease `air` toward 1 when airborne (rate 12/s) or 0 when grounded (20/s); publish `sx`, `sy`.

`FighterView` then solves the rig from `cur`. Grounded, the lowest point (`lowestY`: feet, knees, hands, head, torso and pelvis; when `rot` is beyond ±30° also the drawn boxes of the head, tail, ears, trails and back staff) snaps to the floor. Airborne, blended by `air`, the hip keeps its standing height above the feet instead, so flips and tumbles rotate around the body, clamped so nothing dips below the floor. Root scale is `(face * sx * spin, sy)`; `face` eases toward the engine facing at rate 28/s and never gets narrower than 0.12, so a turnaround reads as a quick pivot. Cloth (`trail`) and ears use `sin(rot)` for their tilt so a full flip never pops them.

## Joint groups (`MUL`, `ZETA`)

| Group | Joints | MUL | ZETA | Overshoot (analytic) | Feel |
| --- | --- | --- | --- | --- | --- |
| root offset | `rx`, `ry` | 1.0 | 0.9 | ~0% | steady body travel |
| hips | `rot` | 1.0 | 0.78 | ~2% | leads the motion |
| torso | `tor` | 0.86 | 0.66 | ~6% | follows the hips |
| head | `head` | 0.62 | 0.5 | ~16% | trails and nods |
| upper arms | `auf`, `aub` | 0.92 | 0.62 | ~8% | |
| forearms | `alf`, `alb` | 0.74 | 0.52 | ~15% | whip after the upper arm |
| legs | `luf`, `llf`, `lub`, `llb` | 1.2 | 0.86 | ~0.5% | planted, no wobble |
| feet | `ftf`, `ftb` | 1.05 | 0.9 | ~0% | |
| tail | `tail` | 0.42 | 0.3 | ~37% | floppy follow-through |
| scale | `sx`, `sy` | 1.1 | 0.45 | ~21% | |

With feed-forward these springs only shape blends and the lag of soft joints; on joints with `ff = 1` they never slow keyed motion down.

## Base frequency per state (before the weight scale `1.12 - 0.24 * weight`)

| State | omega | Motion |
| --- | --- | --- |
| idle | 20 | stance, bounce with upper-body lag, breathing, sway, fidgets |
| walk | 30 | planted-foot gait |
| jump / airborne fall | 22 | arc keyed to vertical speed, optional front flip |
| crouch | 30 | `CROUCH`, breathing, small knee bounce |
| dash, backdash | 40 | keyed lunge or hop |
| block, blockstun | 34 | guard high or low; blockstun pushes back and braces |
| hitstun | 46 for 0.12 s, then 20 | alternating hit poses scaled by knockback, relaxing over the stun timer |
| launched (and airborne KO) | 16 | tumble keyed to the arc |
| knockdown | 16 | breathing on the floor, hands plant for the last 8 frames |
| getup | 30 | timed: knockdown → `sitUp` → `CROUCH` → stance over 14 engine frames |
| ko (grounded) | 10 | limp |
| grabbed | 22 | struggle |
| win | 12 | win pose + `winMove` loop |
| lose | 7 | lose pose + `loseMove` |
| intro | 14 | intro pose + fist into palm |
| attack, startup | `clamp(230 / (startup + 1), 30, 90)` | keyed timeline; the spring only absorbs the blend in, faster for short startups |
| attack, active and recovery | 42 | keyed timeline |

## Attack timeline (`_makePlan`, `_attack`)

A plan is built once per move and form and cached:
- `anim` from `move.anim` if it is an `ATTACKS` key, else `guessAnim(slot)`, else `punch`.
- `base`: `CROUCH` for crouch moves, an air base (between `jump` and `fall` with air legs) for `air` moves, else the character's stance.
- Key poses `w`, `s`, `r`, `alt` from `ATTACKS[anim]`, adjusted by `ADD`: the character's stance offset is carried into the keys at 100% for legs and feet (unless the anim owns its legs), 50% for torso, head and hips, 30% for the back arm and 0% for the striking arm, which stays absolute. Crouch moves get crouch legs and air moves air legs unless the anim is in `OWN_LEGS`.
- If the anim has no `r`, a follow-through is generated: the body keeps travelling 8% further, the arms start 30% of the way home.
- `lead` from the anim's `limb` (`arm`, `leg` or `body`): the share of the snap each joint fires early. Hips and legs go first, the torso next, the striking hand or foot last, like a whip.
- Overshoot per joint: `(s - w) * anim.ov * motion.snap * OVR`, capped at ±11° (±3 px for `rx`/`ry`).

The timeline runs on `u = moveFrame + subTickFraction` (engine frames), with `hit = startup + 1` the first active frame:
1. **Wind-up**: from the pose captured when the move instance started to `w`, ease-out, reached by 80% of the wind-up; wind-ups of 4 frames or more coil 8% past `w` near the end.
2. **Snap**: `snapLen = min(hit * 0.5, 2 + min(startup, 20) * 0.08 + 0.6 * weight)` frames. Each joint snaps from `windEnd - 0.5 * lead * snapLen` to `hit - 0.3 * lead * snapLen` with a cubic ease-out, so every joint is at the strike pose by the first active frame.
3. **Overshoot**: a bump of `amp * 6.75 * x(1 - x)^2` over `2.5 + 2 * weight` frames after each joint lands.
4. **Hold and recovery**: recovery starts at `startup + active + 1` and lasts the engine's recovery (`whiffRecovery` when the move missed, x0.65 with `fastRecover`). The strike holds for `min(0.35, 2 / span)` of it, blends to the follow-through `r` by 42%, then to `base`.
5. **Whiff**: a missed arm or leg move overbalances forward a little during recovery.

Extras: `alt` strikes alternate on the active clock every `hitInterval` frames (so held chains keep punching); charging holds the coil and shakes with effort; `spin` flips `spin` (`cos`) `round(active / 7)` times during active frames; `taunt` turns the fighter's back to the opponent, wiggles and turns back; `glide` hovers. A new move instance (different `moveId`, `moveFrame` going backwards, or jumping ahead more than one render frame plus 2.5) is a cut: the wind-up starts from the current pose.

## Gait, jumps and dashes

- **Walk** (`_walk`, `_leg`): each leg spends `duty` of the cycle in stance, where the ankle slides back in a straight line at ground speed (planted foot; the thigh angle is `asin`-based and a bent knee pushes the thigh forward to keep the ankle on its line), with a mid-stance knee bend (`absorb`) and the heel peeling off late. In swing the knee folds by `lift` and the foot comes through toe-down, then toe-up for the heel strike. Cadence is `speed * duty / (2 * L * sin(swing))` cycles per second, with `speed` reduced by `skate` (feet allowed to slide) and halved when slowed. The back leg runs half a cycle later. Walking backwards uses 80% of the swing, `backLean` and a raised guard. On top: `bob` at the passing position, a heavy footfall dip (`3 * weight^2`), arms counter-swinging with forearms dragging, `waddle`, tail swing. `duty < 0.5` makes a bounding gait where both feet leave the floor between steps by `hop` px (Pikachu).
- **Jump** (`_airborne`): arc progress is `(vy - vy0) / (-2 * vy0)` from the take-off speed. Push-off (`POSES.jump`) blends to the apex `tuck`, then to `fall` reaching for the floor; the body leans with horizontal speed and the tail lags. Characters with `flip: true` (Hattori, Pikachu, XLR8, Goku) front-flip on forward jumps (a full 360° keyed to the arc with knees pulled to the chest); being launched again cancels the flip. The `glide` buff shows the glide pose with a hover.
- **Landing**: strength `clamp(fallVy / 14, 0.3, 1.1)` drives a squash, a knee impulse and, for 0.3 s in grounded free states (idle, walk, crouch, block), a knee bend that soaks up the fall.
- **Dash**: one lunging stride from `dash` to `dash2` keyed to dash progress (`actionFrame` against `dashT`), leaning in from the stance and settling back before control returns; `dashGuard` keeps the arms up (0 sweeps them back like a ninja run). **Backdash** hops from `backdash` to `backdash2` with the guard up.

## Hit reactions

- A fresh hit alternates two poses, `hitstun` (head snapped back) and `hitGut` (doubled over), so combos never repeat a frame. Hit strength `clamp(0.55 + 0.09 * |kbx| + 0.03 * upward speed, 0.55, 1.3)` scales the pose depth and the impulses. The pose relaxes back toward the stance over the last 55% of the stun timer; airborne hitstun gets fall legs.
- `launched` tumbles with rotation keyed to the arc (back-tilt of 25-97°, plus an extra full turn for a KO) while the limbs trail and flail.
- `knockdown` after a launch bounces (impulses), breathes on the floor and plants the hands in its last 8 frames; `getup` is timed over the engine's 14 frames. Tails curl up while lying or tumbling so they never cut into the floor.
- Blockstun pushes the fighter back into the guard (decaying at `exp(-9t)`) and re-kicks on every blocked hit.

## Impulses

From `_hitReact` (a new hit), with `k = hitStr * (1 - 0.45 * weight)`: torso +380k (gut) or -520k (head), head +420k or -700k, hips -140k, upper arms a random flail from -240k to +560k, forearms ±300k, `rx` -70k, squash -2.5k. An armored hit during an attack only flinches (torso -160, head -200).

From `_enter` (action change), with `heavy = 1 - 0.5 * weight`:

| Entering | Kick |
| --- | --- |
| dash | torso +300·heavy, head -180, squash -3 |
| backdash | torso -260·heavy, squash +2 |
| knockdown after launched | torso +260, head +380, `ry` -160, arms +400 / +300, squash -5 |
| ko after launched | torso +200, head +300, `ry` -120, squash -4 |
| crouch (not from an attack) | squash -2 |
| idle from crouch | squash +1.5 |
| attack | head -80 (anticipation nod) |
| blockstun | push-back timer reset |

Take-off with upward speed adds +6 to the squash velocity; landing adds `-8 * (1.2 - 0.4 * weight) * landStrength` and -260 × strength to both knees. The squash spring runs at omega 26, zeta 0.35, clamped to 0.8-1.2, with `sy = sq * pose.sy` and `sx = (1 + (1 - sq) * 0.7) * pose.sx`.

## Joint limits

Applied to the target and to the result (velocity into a limit is zeroed): head within `±headLim` of the stance head angle; forearms -8..168; lower legs -170..6 (no hyper-extended elbows or knees); torso -75..100; `ry` -80..0. `headK` scales head motion around the stance angle (big heads tilt less so necks never look broken).

## Tuning

- `omega` is the natural frequency in rad/s: a critically damped spring covers about 63% of a step in `1 / omega` s and 90% in `3.9 / omega` s. `zeta` below 1 overshoots by `exp(-pi * zeta / sqrt(1 - zeta^2))` (0.9: 0.2%, 0.7: 5%, 0.5: 16%, 0.3: 37%) and settles in about `4 / (zeta * omega)` s. The implicit integrator damps a little more than the analytic figure.
- Keyed timing (how fast a strike, step or get-up happens) comes from engine frame data and the timeline constants, not from omega. To make a move feel snappier or heavier, change `snap`/`weight` in motion.js or the anim's `ov`/`limb`, or the move's startup in the fighter data.
- Drag and overlap come from low `ff` plus low `MUL`/`ZETA` on soft joints. More drag: lower that joint's `ff` in the profile. Less wobble: raise its `ZETA`.
- Blends between states take roughly `3.9 / (omega * MUL)` s; raise a state's omega if transitions into it feel late.
- Personality belongs in `motion.js`, not in the global tables. `weight` scales every frequency by `1.12 - 0.24 * weight`, hit impulses by `1 - 0.45 * weight`, dash lean by `1 - 0.5 * weight` and landing squash by `1.2 - 0.4 * weight`; it also lengthens the snap (+0.6 frames) and the overshoot (+2 frames) and deepens the walk footfall.
- Symptoms: feet sliding means `skate` too high or the wrong `legLen`; a buzzing joint means low `ZETA` with a target that moves every frame; a limb flung through the body means an impulse too big for the joint (the velocity cap and limits are the backstop, not the fix).
- Always check changes in the lab's `film` view (real engine timing) and in the real game; a still pose cannot show spring behaviour.

## Expressions (`_expression`)

Priority: `hurt` for hitstun, launched, grabbed, knockdown, ko and lose; `shout` for active attack frames, any attack while `f.charge > 0`, and ultimates; `blink` in blockstun; otherwise `normal` with a 0.11 s blink every 2-5 s (18% chance of a quick double blink). Winners keep the normal smiling face and keep blinking (shout brows read as angry). The two sides start their blink timers out of phase.

## motion.js fields

`motionFor(charId, form = null)` merges `BASE` with the entry for the form (if it has one) or the character, merging `bounce` and `walk` field by field, and caches the result. Stance, win, lose and intro are partial poses merged over `IDLE`/`POSES.*`; fidget poses are deltas added to the idle.

| Field | Default | Meaning |
| --- | --- | --- |
| `stance` | `{}` | partial pose merged over `IDLE`: the fighting stance (also the base attacks return to) |
| `bounce` | `{ amp: 3, hz: 1.4 }` | idle knee flex (deg) and frequency |
| `breathe` | 1.6 | breathing amplitude (deg) |
| `sway` | 0.8 | idle weight shift (px) |
| `wiggle` | 0 | idle hip wiggle (deg) |
| `tremble` | 0 | nervous shake (px), also in the forearms |
| `walk.swing` | 26 | hip-to-ankle half-step angle (deg) |
| `walk.duty` | 0.58 | stance share of the cycle; below 0.5 the gait bounds |
| `walk.lift` | 46 | swing knee fold (deg) |
| `walk.absorb` | 10 | mid-stance knee bend (deg) |
| `walk.arm` | 12 | arm counter-swing (deg) |
| `walk.lean`, `walk.backLean` | 4, 5 | torso pitch walking forward / backing off (deg) |
| `walk.bob` | 1 | rise at the passing position (px) |
| `walk.waddle` | 0 | side roll (deg) |
| `walk.skate` | 0 | share of ground speed the feet may slide (0 planted, 1 gliding; XLR8's wheels 0.6) |
| `walk.hop` | 0 | flight height between steps when `duty < 0.5` (px) |
| `weight` | 0.5 | 0 light and bouncy, 1 heavy and planted |
| `snap` | 1 | strike overshoot scale |
| `headK` | 1 | how much the head follows pose head angles (big heads 0.4-0.8) |
| `headLim` | 38 | max head tilt away from the stance (deg) |
| `flip` | false | front flip on forward jumps |
| `dashGuard` | 0.3 | 0 arms swept back while dashing, 1 guard kept up |
| `fidget` | null | `{ every: s, dur: s, pose: deltas }` idle habit, after 1.2 s of idle, timing randomized ±30% |
| `win`, `winMove` | null, `'pump'` | victory pose and loop: `pump` (fist pump), `buri` (turn around, bend over, butt wiggle), `wiggle`, `hop`, `wave`, `flex`, `proud`, `bow`, `blaze` |
| `lose`, `loseMove` | null, `'slump'` | defeat pose and loop: `slump` or `sob` (shoulders shaking, hand to the eyes) |
| `intro` | null | round-intro pose (merged over `POSES.intro`) |

Current personalities: Shinchan cheeky (loose knees, wiggle, waddle, buri victory, sobs when he loses); Doraemon calm waddle with paw resting low so bell and pocket show, wave victory; Hattori low ninja stance, ninja-run dash, front flips, bow victory and hand-sign intro; Pikachu springy bounding hop gait, front flips, hop victory; Ben 10 scrappy brawler; Four Arms slow and planted (weight 1), proud victory; XLR8 low sprinter gliding on wheels, front flips; Heatblast upright, blaze victory; Nobita timid (tremble, hands up, backs off leaning), hop victory, sobs when he loses; Goku Turtle-school stance, front flips; Bheem broad and planted (weight 0.85), hands-on-hips proud victory.

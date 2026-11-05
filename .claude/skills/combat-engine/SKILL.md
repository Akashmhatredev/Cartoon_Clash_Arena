---
name: combat-engine
description: Work on Cartoon Clash's deterministic 60 Hz combat engine in shared/engine/engine.js. Use this whenever a task touches hit detection, hurtboxes, frame data resolution, combos, damage scaling, hitstop, knockback, throws, blocking, meter, rounds, timers, projectiles, entities, training mode, or the engine state/event shapes, and whenever someone reports "the hit didn't register", "infinite combo", "desync", "the round never ends" or asks how step() works. Also use it before adding any new mechanic or state field, because engine changes affect online snapshots and replays.
---

# Combat engine

`shared/engine/engine.js` is the single simulation for offline play, the authoritative server and client prediction. It is pure data in, pure data out. Read `references/state-and-events.md` for the full state shape, action list and event catalogue (it mirrors CONTRACT.md section 4 plus engine internals).

## Non-negotiables

- **Determinism.** Same `createMatch(opts)` + same input sequence must give byte-identical state on every platform. No `Math.random`, `Date`, `performance`, trig or floating-point-order-dependent tricks; the only randomness is `state.rng` (uint32). Avoid `Object.keys` ordering assumptions on objects that differ between client and server (they don't today; keep it that way).
- **Plain JSON state.** No classes, Maps, Sets or functions. `cloneState` uses `structuredClone`; `protocol.packState` serializes every top-level field except `config` and `events`. A new state field is therefore automatically sent in snapshots; add it to `LONG_KEYS` in `shared/protocol.js` if it is a long name on a hot object, and bump `PROTOCOL_VERSION` if old clients would misinterpret it.
- **No allocation per tick.** Pools are fixed: 16 projectiles, 12 entities. Reuse objects (`state.projectiles.find(q => !q.active)`), never push new ones. Events are the one exception: they are plain object literals pushed into the reused `state.events` array.
- **Shared code is environment-free.** No `window`, `document`, Node built-ins or Phaser imports anywhere under `shared/`.

## Tick order (`step`)

1. `state.events.length = 0`, `frame++`. Read both masks through `readInput` (press timestamps for LIGHT/HEAVY/SPECIAL/THROW/ULT/UP, double-tap dash detection within 12 frames). Inputs are ignored unless `phase === 'fight'`.
2. If `hitstop > 0`: decrement, decay shake, return. Everything freezes except counters.
3. `phaseFrame++`. Intro phase: `roundStart` event on frame 1, fighters go idle at frame 70, `fight` event at frame 100.
4. `updateFighter` for both sides (action state machine: control, attacks, cancels, move advancement), then `physics` (gravity 0.9 default, wall clamp at `STAGE.left/right` minus half body width), `separate` (push overlapping bodies apart), auto-facing for grounded actors, `updateGrab` for both.
5. In `fight` phase: `resolveMelee` (hitbox vs hurtbox, counter hits, armor, block), `updateProjectiles`, `updateEntities`. Otherwise projectiles just expire.
6. `timers` (invuln, cooldowns with gadget-haste doubling, buffs, form timeout at 900 frames, heatblast ammo refill every 150 frames, combo bookkeeping on the victim, training refills), then `roundLogic`, then shake decay.

## Key rules encoded in the engine

- Frame model: frames `1..startup` are startup, next `active` frames can hit, then `recovery` (or `whiffRecovery` when nothing connected). Hattori's reflex buff multiplies recovery by 0.65.
- Normals cancel into their `cancel` list and into any special or ultimate once they connected (`tryCancel`); throws and ultimates never cancel. `noCancel` moves cannot be cancelled into.
- Blocking: hold BLOCK standing guards `mid` and `high`, DOWN+BLOCK guards `mid` and `low`. Chip damage comes from `chip` (null means default behaviour in `applyHit`). Throws beat guard; tech window is 8 frames after the grab, hold is 12 frames.
- Damage: `base * attacker.dmgMult * arcadeMod * moveBonus`, x1.25 with superStrength, x defender `defMult`, x0.85 for Nobita under 30 % HP, x1.15 on counter, then combo scaling: hits 1 = 100 %, hit 2 = 85 %, then -10 % per hit, floor 30 % (ultimates floor at 50 %), times the move's own `scaling`. Minimum 1.
- Hitstun shrinks by 2 frames per combo hit beyond 4 (min 6). `stunCap` caps hitstun when the victim is already in a combo (Thunder Wave). Juggle limit 6 and `MAX_COMBO_FRAMES = 150` guard against infinites: a combo can never keep someone helpless more than 2.5 s.
- Hitstop by strength: `[0, 5, 8, 11]` frames (+3 on counter), KO = 24. Shake: `0.12 * strength`, KO 0.6, ultimate start 0.25.
- Meter: attacker gains `meterGain` (default `5 + 2 * strength`), defender gains half the damage taken. Ultimates cost `meterCost` (100).
- Round: KO or timer. Time-out compares HP ratios. Round end lasts 150 frames (win/lose poses at frame 70). Match ends at `roundsToWin`. Draw rounds count for both sides.
- Entities: `slowField` sets `slowed`, `trap` lands a hit once, `stormWarning` spawns `lightning` on its last frame (2 hits, 7-frame gap), `door`, `quake`, `shadowClone` are visual or handled elsewhere.

## Adding a mechanic safely

1. Prefer expressing it as move data (see the `fighter-design` skill) so the AI and renderer pick it up for free.
2. If it needs code: add the field to `makeFighter`, reset it in `resetRound`, advance it in `timers`, and read it where it applies. Keep the new field a number or boolean.
3. New `behavior` values go in `runBehavior`; new entity kinds need `ProjectileLayer._setupE` and `updateEntities` cases; new projectile kinds need `ProjectileLayer._setupP`. New event types need handlers in `fx/index.js` and `audio/sfx.js`.
4. Think about the AI: `shared/ai/moves.js` derives reach, travel and safety from move fields (`dash`, `teleport`, `projectile`, `blockstun - recovery`). New movement fields may need `travel()` updated.
5. Run the headless smoke (`node .claude/skills/engine-testing/scripts/smoke.mjs`) to confirm the match still resolves and that two identical runs stay identical.
6. Bump `PROTOCOL_VERSION` in `shared/protocol.js` when an old client would simulate differently from the new server.

## Debugging recipes

- Reproduce a bug headlessly: create a match with a fixed seed, drive both masks from a script, and print the relevant fighter fields each frame. `BTN` bits: LEFT 1, RIGHT 2, UP 4, DOWN 8, LIGHT 16, HEAVY 32, SPECIAL 64, BLOCK 128, THROW 256, ULT 512.
- Hitbox coordinates are feet-relative: `x` forward (mirrored by `facing`), `y` is the top edge and negative means up, `h` grows downward. Standing normals should cover feet offsets -60 to -110 so they reach Pikachu (hurt height 120, crouching 84).
- In the browser, `F3` shows FPS, ping and tick drift; the training mode HUD shows damage, combo count and the current move name.
- Snapshot size matters online: `JSON.stringify(packState(state)).length` is about 2.3 kB today. Keep new per-fighter fields few.

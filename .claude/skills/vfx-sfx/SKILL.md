---
name: vfx-sfx
description: Visual effects and sound for Cartoon Clash fights: hit sparks, particles, dust, KO flash, super flash dim, combo and announcer text, projectile and entity visuals (ProjectileLayer), shared generated textures, and the synthesized Web Audio sound effects in client/src/game/audio/sfx.js. Use this whenever a task mentions particles, sparks, glow, screen flash, "juice", feedback on hit, a new projectile or entity look, a new sound, volume, mute, audio unlock, "no sound on iPhone", or performance mode effects budgets.
---

# VFX and SFX

Everything visual outside the fighters and stage lives in `client/src/game/fx/` and `client/src/game/art/ProjectileLayer.js`; all audio is synthesized in `client/src/game/audio/sfx.js` (no audio files, Phaser audio is disabled). Both consume the same engine events each tick (`FightScene.tick` → `fx.handleEvents(events, state)` and `sfx.handleEvents(events)`), so new gameplay feedback starts from an event or an `effect` name.

## Effects (`fx/index.js`)

- Pool of 260 images with struct-of-arrays physics (position, velocity, life, scale, alpha, spin, gravity, drag, stretch). `_p(tex, x, y, vx, vy, life, s0, s1, a0, tint, additive, rot, spin, grav, drag, orient, ks)` emits one particle; `_sparks(...)` emits streaks; `_n(k)` scales counts down in perf mode. Never allocate per particle: reuse the cursor.
- `burst(type, x, y, dir, power)` is the effect vocabulary keyed by `effect` names: `hit heavyHit electric fire wind gadget energy dust slash sparkle block`. Each is a few `_p` calls with side-appropriate tints (P1 cyan `0x22e4ff`, P2 magenta `0xff2fa6`, orange `0xff8a1f`, gold `0xffe94a`).
- `handleEvents` maps events to feedback: `hit` (burst by `effect`, combo counter text from 3 hits, COUNTER text), `block`, `jump`/`land`/`dash` (dust), `throw`, `tech` (ring), `projectile`, `teleport`, `form`, `buff` (sparkle), `armor` (gold ring), `superFlash` (dim overlay + streak), `ko` (white flash, slow ring), `roundStart` ("ROUND n"), `fight` ("FIGHT!"), `timeUp` ("TIME"), `roundEnd` draw ("DRAW").
- Overlays: `dim` (depth 12, under fighters), `streak` (13), `flash` (depth 42), announcer text depth 45 in Bungee at the current `res`.
- `setPerf(true)` cuts particle counts and glows; FightScene calls it when auto performance mode kicks in.

## Textures

`fx/textures.js` creates shared canvas textures once per texture manager through `canvasTexture(scene, key, w, h, draw, scale)` at the registry `res`; `invScale(scene, key)` returns the scale that displays them at world size. Keys in `TEX`: `soft streak star ring smoke shadow bolt dot hex flame white`. `art/projectileArt.js` adds projectile and entity textures in `PT`: `shuriken beam pellet missile wave dome hand trap warn lightning door cracks`.

## ProjectileLayer

Pooled slots (one per engine projectile and entity index), each with three images `a`, `b`, `e`. `_setupP(slot, kind)` and `_setupE(slot, kind, state, entity)` choose textures and tints per kind; `sync(state, alpha, dtMs, perf)` positions them with interpolation and animates per kind (spin, flicker, trails). Depth 30 for projectiles, 15 for entities, warnings and lightning at FX depth.

Add a projectile kind: engine `proj({ kind })` → `_setupP` case (textures and tints) → per-kind animation case in `sync` → optional new texture in `projectileArt.js`. Add an entity kind: engine `spawnEntity` + `updateEntities` → `_setupE` case → animation case.

## Sounds (`audio/sfx.js`)

- `SOUNDS[name] = [duration, gain, (v, t0, params) => { ... }]` built from primitives: `osc(v, type, f0, f1, t0, dur, peak, opts)`, `filt(...)`, `env(...)`, and a shared seeded noise buffer. Voices are capped at 12 (`MAX_VOICES`) and identical sounds are throttled to one per 30 ms.
- Names: `hit heavyHit block whiff jump land dash throw ko roundStart fight select confirm back special ultimate electric fire projectile win lose tick teleport charge`. `SFX_NAMES` exports the list.
- Public API `sfx = { unlock(), play(name, gain), handleEvents(events), setVolume(v), setMuted(b) }`. Everything is a safe no-op before `unlock()` or without `AudioContext`. `App.vue` unlocks on the first pointerdown/keydown/touchend and plays menu sounds by delegation: `.btn` → confirm, `.back-btn` → back, other buttons → select, override with `data-sfx="name"` or `data-sfx="none"`.
- Master chain: voices → compressor → master gain (`volume * 0.75`, 0 when muted). Volume and mute come from the settings store (`watch` in App.vue).

Add a sound: write a `SOUNDS` entry (keep it under ~0.4 s unless it is a jingle), map an event to it in `handleEvents` or call `sfx.play('name')` from UI, then test on iOS Safari where the context starts suspended (unlock resumes it).

## Design guidance

- Feedback should scale with `strength` (1 light, 2 heavy, 3 ultimate): bigger spark, more hitstop (engine), louder thump. Keep lights crisp so combos read.
- Keep the fighter band readable: bursts are brief (0.12-0.3 s), additive, and never cover faces for long. Dim overlays are reserved for ultimates and KO.
- Respect `perf`: halve counts, skip glows, no additive blending on large sprites.
- Every effect must be side-neutral except tint; the same code runs for both players and for online opponents.

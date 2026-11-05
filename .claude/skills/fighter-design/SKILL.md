---
name: fighter-design
description: Add, rework or balance a Cartoon Clash fighter. Use this for anything about shared/fighters/*.js, move frame data (startup/active/recovery), hitboxes, damage, knockback, cooldowns, meter, specials, ultimates, passives, Ben 10 style forms, roster changes, "make X faster/stronger/safer", "nerf", "buff", "add a new character", or questions like "why does this move whiff on Pikachu". Covers the full checklist (data file, registry, art spec, AI style, arcade names, protocol version) so nothing is forgotten.
---

# Fighter design

Fighters are pure data in `shared/fighters/<id>.js`, built with the helpers in `shared/fighters/kit.js`. The engine, renderer, AI, HUD and select screen all read the same object, so most design work is editing numbers in one file. `references/move-fields.md` lists every field the engine reads, with semantics; read it before inventing a field.

## Anatomy of a fighter file

```js
export default fighter({
  id, name, title, bio,                     // bio is one line, shown on select
  hp, stats: { speed, power, defense },     // stats are 1-5 bars for the UI only
  walkSpeed, backSpeed, jumpVel, jumpSpeedX, gravity, dashSpeed, dashFrames, dmgMult, defMult,
  body: { w, h, crouchH },                  // hurtbox, feet anchored; art scales to h
  palette: { primary, secondary, accent, skin, outline: '#0b0f1e' },
  homeStage,                                // stage id used by arcade and online stage picking
  passive: { name, desc },                  // text only; behaviour lives in engine.js if needed
  moves: { light, heavy, crouchLight, crouchHeavy, airLight, airHeavy, throw, special1, special2, special3, ultimate },
  forms: { ... }                            // optional, ben10 only today
});
```

Builders and their defaults (override only what differs):

| Builder | startup/active/recovery | dmg | hitstun/blockstun | notes |
| --- | --- | --- | --- | --- |
| `light` | 5/3/9 | 5 | 15/10 | cancels into light, crouchLight, heavy, crouchHeavy; hitbox x8 y-120 w64 h60 |
| `heavy` | 10/4/16 | 10 | 20/14 | strength 2, effect heavyHit |
| `crouchLight` | 5/3/9 | 4 | 14/9 | guard low |
| `crouchHeavy` | 11/4/20 | 9 | 22/12 | guard low, knockdown, effect dust |
| `airLight` | 5/6/6 | 5 | 14/9 | guard high, `air: true` |
| `airHeavy` | 8/6/10 | 9 | 18/12 | guard high, strength 2 |
| `throwMove` | 4/2/24 | 11 | 30/0 | kind throw, knockdown, breaks guard |
| `special` | 12/4/18 | 10 | 20/14 | kind special, hitbox null (set one or a projectile), scaling 0.9 |
| `ultimate` | 14/6/30 | 12 | 30/18 | meterCost 100, invuln frames 1-6, knockdown, strength 3 |
| `proj` | - | 8 | 18/12 | projectile defaults: vx 8, w40 h30, offX 50, offY -95, life 90 |

Input display strings used by the move list: `L`, `H`, `↓+L`, `↓+H`, `Air L`, `Air H`, `Throw`, `Sp`, `→+Sp`, `↓+Sp`, `Ult`, and `Sp (hold)` for charge moves.

## Design rules the engine enforces or expects

- Every fighter needs all 11 slots. `special1` is plain SPECIAL, `special2` is forward/back + SPECIAL, `special3` is DOWN + SPECIAL.
- Standing `light`/`heavy` hitboxes must span feet offsets -60 to -110 vertically or they whiff on Pikachu (body h 120, crouch 84).
- Body heights are coupled to art (`getSpec` in `client/src/game/art/chars.js` scales the rig by `k = body.h / spec.H`). Changing `h` changes the drawn size. See "Body sizes" below before touching `body`.
- No infinites: the engine already limits combos (150 frames, juggle 6, hitstun decay). Still avoid lights that are plus on block with fast startup; check `blockstun - recovery` (frame advantage) with the script below.
- Specials carry a `cooldown` (frames). Ultimates cost the full meter. Projectiles are one volley per kind at a time, so spam is bounded by `life` and `cooldown`.
- `anim` must be one of `jab punch kick lowKick sweep uppercut airPunch airKick slam throw taunt spin cast beam dashStrike glide teleport buff flurry ultimate`. The renderer blends wind-up, strike and recovery poses from it.
- `effect` picks the hit spark and sound: `hit heavyHit electric fire wind gadget energy dust slash sparkle`.
- Passives that need logic are hard-coded by `charId` in `engine.js` (`landHit`, `computeDamage`, `startMove`, `timers`). A new passive either reuses an existing hook (armor frames, invuln windows, cooldowns, `meterOnUse`, `whiffRecovery`) or needs a small engine edit plus the `combat-engine` skill's checklist.

## Body sizes

`body: { w, h, crouchH }` is more than a hurtbox. `h` and `crouchH` are the standing and crouching hurtbox heights and the drawn height; `w` is the hurtbox width, the push box (`separate`), the wall clamp and throw spacing. Heights follow canon but are compressed into a playable range, so the roster reads correctly side by side without anyone becoming a target that normals miss:

| Fighter | w | h | crouchH | Canon reference |
| --- | --- | --- | --- | --- |
| nobita | 64 | 168 | 108 | 10 y/o, ~140 cm |
| hattori | 66 | 166 | 108 | 11 y/o, ~140 cm |
| ben10 | 70 | 166 | 108 | 10 y/o |
| bheem | 90 | 160 | 106 | 9 y/o, stocky |
| doraemon | 104 | 158 | 112 | 129.3 cm, 129.3 kg, round |
| goku | 70 | 146 | 98 | Kid Goku, ~100-124 cm |
| shinchan | 72 | 138 | 94 | 5 y/o |
| pikachu | 74 | 120 | 84 | 40 cm, scaled up for gameplay |
| fourarms / xlr8 / heatblast | 118 / 70 / 78 | 210 / 164 / 178 | 138 / 102 / 116 | Ben 10 forms |

Placing a new fighter:
- Pick `h` from the fighter's canon height relative to the table (a ~140 cm kid is about 166-168, ~130 cm about 158, ~100-120 cm about 138-146). Creatures and mascots far below that floor out near 120, as Pikachu does, the way crossover fighting games scale small characters up. Giants can go to about 210.
- Keep `h >= 120` and `crouchH >= 84`. Anything smaller means re-checking every fighter's standing normals against the -60 to -110 rule above.
- `crouchH` is about 0.62-0.71 of `h`. `w` follows build: slim 64-70, average 70-78, stocky or round 90-104, giant 118.
- A smaller or narrower body is a smaller target and wins more neutral; pay for it elsewhere (HP, defense, reach). After any size change run `ai-arena.mjs` from the `ai-opponent` skill and compare with the previous matrix.
- Size changes alter the simulation, so they need a `PROTOCOL_VERSION` bump, and the art must match: keep the art file's fallback `body` equal and its `mk()` height `H` within about 10% of `h` (`character-art-rig` skill).

## Frame data audit

`scripts/frame-data.mjs` prints every move of one or all fighters with startup, active, recovery, damage, on-block advantage, cooldown, reach and flags:

```bash
export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH
node .claude/skills/fighter-design/scripts/frame-data.mjs            # all fighters
node .claude/skills/fighter-design/scripts/frame-data.mjs pikachu    # one fighter (forms included for ben10)
```

Use it before and after a balance pass. Typical healthy ranges in this game: lights 4-7 startup and -2 to +1 on block, heavies 9-15 startup and -4 to -8 on block, specials -2 to -12 on block with a cooldown, ultimates 10-30 startup with clear counterplay (block, jump, or interrupt during charge).

## Checklist: add a fighter

1. Create `shared/fighters/<id>.js` from the closest existing kit. Keep `id` lowercase, no spaces.
2. Register it: `FIGHTERS` in `shared/fighters/index.js` and `FIGHTER_IDS` in `shared/constants.js` (order = roster order on the select screen).
3. Art (see the `character-art-rig` skill): create `client/src/game/art/chars/<id>.js` (builder with a `head(ctx, e)` that draws all four expressions, fallback `body` equal to the engine's, fallback palette), import and spread it into `ART` in `client/src/game/art/chars.js` (plus `HUMAN` if the engine `skin` should apply), and add a motion personality entry to `M` in `client/src/game/art/motion.js`. Without the art file `getSpec` falls back to Ben 10's rig; without the motion entry the fighter moves with the generic stance.
4. AI: add a style in `shared/ai/styles.js` (routes, specials usage, preferred range). Without it the AI uses `DEFAULT_STYLE`.
5. Arcade: add `NAMES`, `HOME` and `BOUT` entries in `shared/arcade.js`; add `HOME_FALLBACK` in `server/src/room.js`.
6. Protocol: `FIGHTER_IDS` validates lobby picks, so client and server must ship together. Bump `PROTOCOL_VERSION` in `shared/protocol.js`.
7. Docs: roster table in `README.md` (HP, height with canon reference), body table in `CONTRACT.md` section 5.
8. Verify: `node .claude/skills/fighter-design/scripts/frame-data.mjs <id>`, the smoke script, screenshots of the lineup and a real match (visual workflow in the `character-art-rig` skill), then play Training against the new fighter and as the new fighter.

## Checklist: balance pass

1. Run the frame-data script and note outliers (plus-on-block normals, specials with no cooldown, ultimates without counterplay).
2. Change numbers, not structure, unless a move is fundamentally broken.
3. Re-run the frame-data script and `ai-arena.mjs` from the `ai-opponent` skill (AI vs AI win rates across seeds) to catch runaway matchups.
4. Update `desc` strings when behaviour changes; they are shown in the move list.

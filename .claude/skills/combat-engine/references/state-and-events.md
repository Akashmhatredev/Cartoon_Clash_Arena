# Engine state and events reference

Source of truth: `shared/engine/engine.js` and CONTRACT.md section 4. Consumers may rely only on the documented fields; the engine may add internal ones.

## createMatch(opts)

```js
opts = {
  p1, p2,                  // fighter ids (invalid ids fall back to shinchan / goku)
  stage,                   // stage id (defaults to p1's homeStage)
  roundsToWin = 2, roundFrames = 99 * 60, seed = 1,
  mods = [{ hpMult, dmgMult }, { hpMult, dmgMult }],   // arcade boss buffs, multiplicative
  training = null | { dummyInvincible, infiniteMeter },
}
```

Training: phase starts at `fight`, timer frozen, rounds never end, dummy (side 1) refills HP when a combo ends, side 0 never KO's, meter pinned when `infiniteMeter`.

## Top-level state

| Field | Meaning |
| --- | --- |
| `v` | state format version (1) |
| `frame` | ticks since creation |
| `rng` | uint32 seed state |
| `phase` | `intro` (100 f) → `fight` → `roundEnd` (150 f) → `matchEnd` |
| `phaseFrame` | frames since the phase began |
| `round`, `timer`, `roundFrames`, `roundsToWin`, `wins[2]` | round bookkeeping, timer in frames |
| `roundWinner`, `matchWinner` | `null`, `0`, `1` or `'draw'` |
| `hitstop` | frames the simulation stays frozen |
| `shake` | 0..1 camera shake, decays x0.88 per tick |
| `slow` | reserved, unused |
| `nextId` | id counter for projectiles and entities |
| `config` | `{ p1, p2, stage, roundsToWin, training, mods }`, not sent in snapshots |
| `fighters[2]` | see below |
| `projectiles[16]`, `entities[12]` | fixed pools, inactive entries have `active:false` |
| `events` | this tick's events, cleared at the start of `step` |
| `stats` | `{ maxCombo: [a, b], damage: [a, b] }` |

## Fighter (public fields)

`side, charId, x, y, vx, vy, facing (1 right, -1 left), hp, maxHp, meter, action, actionFrame, moveId, moveFrame, movePhase (null | startup | active | recovery), grounded, crouching, blocking (null | high | low), invuln, armor, comboHits, comboDamage, lastMoveName, cooldowns{slot}, form (ben10: null | fourarms | xlr8 | heatblast), ammo, buffs{ superStrength, staticCharge, gadgetHaste, reflex, slowed, glide, survival, formTime }, charge, hitFlash`.

Internal fields you will meet while debugging: `mask, prevMask, press[6], tapDir, tapFrame, dashReq, stun, lag, kbx, dashT, dmgMod, moveHits, moveConnected, hitTimer, chainCount, chainLeft, chainTimer, moveBonus, fastRecover, passThrough, counterOn, juggle, comboTime, grabbedBy, grabT, grabStart, ko, momentum, ammoT`.

Actions: `intro idle walk crouch jump dash backdash attack block hitstun blockstun launched knockdown getup grabbed ko win lose`.

Start positions: x 440 and 840 on `groundY` 640. Default movement (kit.js `fighter()`): walk 4, back 3.2, jumpVel -17, jumpSpeedX 4, gravity 0.9, dash 10 for 12 frames (px per tick).

## Projectile

`active, id, owner, kind, x, y (centre), vx, vy, w, h, facing, life, hitsLeft, gravity, damage, chip, hitstun, blockstun, kbx, kby, guard, effect, strength, knockdown, juggle, interval, cd, moveId, moveName, bonus`.

Kinds in use: `shuriken thunderJolt kamehameha pellet fireball gadgetMissile spark shockwave`. One volley of a given kind per owner at a time. Charge moves scale size by `1 + 0.6c` and damage by `1 + 0.8c` where `c = charge / max`.

## Entity

`active, id, owner, kind, x, y, w, h, facing, life, maxLife, damage, hitsLeft, cd, moveName`.

Kinds: `shadowClone slowField trap stormWarning lightning door quake`. `unique` entity defs replace the owner's previous entity of that kind. Ground entities sit at `groundY - h/2`.

## Events

```
roundStart{round}  fight  timeUp  roundEnd{winner, reason: ko|time|draw}  matchEnd{winner}
moveStart{side, moveId, moveName, kind}   whiff{side, moveId}
hit{side, target, x, y, damage, moveId, moveName, effect, strength 1-3, comboHits, counter}
block{side, target, x, y, damage}   throw{side, target}   tech{side}
projectile{side, kind}   jump{side}   land{side}   dash{side}
superFlash{side}   form{side, form}   teleport{side, fromX, toX}
buff{side, buff}   armor{side}   charge{side}   ko{side}
```

`effect` values: `hit heavyHit electric fire wind gadget energy dust slash sparkle`.

## Constants (shared/constants.js and engine.js)

`TICK_RATE 60`, `DT_MS 16.67`, `VIEW 1280x720`, `STAGE { left 60, right 1220, groundY 640 }`, `ROUND_FRAMES 5940`, `ROUNDS_TO_WIN 2`, `METER_MAX 100`, `INPUT_BUFFER_FRAMES 8`, `INTRO_FRAMES 100`, `ROUND_END_FRAMES 150`, `POSE_FRAME 70`, `DASH_WINDOW 12`, `TECH_WINDOW 8`, `GRAB_HOLD 12`, `MAX_COMBO_FRAMES 150`, `JUGGLE_LIMIT 6`, `KNOCKDOWN_FRAMES 32`, `GETUP_FRAMES 14`, `HITSTOP [0,5,8,11]`.

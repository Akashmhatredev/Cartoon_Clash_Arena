# Move data fields read by the engine

All frame values are 60 Hz ticks. Positions are px, feet-relative, `x` forward (mirrored by facing), `y` negative = up and is the box's top edge, `h` grows downward. Fields marked (AI) are also used by `shared/ai/moves.js` to estimate reach and safety.

## Identity and presentation

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | slot name, filled in by the registry |
| `name`, `desc` | string | shown in move list, training HUD and `moveStart`/`hit` events |
| `input` | string | display string for the command |
| `kind` | `normal` `special` `ultimate` `throw` | affects cancels, scaling floor, superFlash, AI classification (AI) |
| `anim` | ATTACK_ANIMS key | renderer pose set |
| `effect` | effect name | FX burst and SFX flavour; `electric`/`fire` add a layered sound |
| `strength` | 1-3 | hitstop, shake, default meter gain, spark size |

## Timing and hit data

| Field | Meaning |
| --- | --- |
| `startup`, `active`, `recovery` | frame model; total = sum (+ `hitInterval * (hits-1)` for multi-hit) (AI) |
| `whiffRecovery` | recovery used when nothing connected (Bheem's Power Charge) |
| `hitbox` `{x,y,w,h}` or `null` | melee box during active frames; null for projectile/utility moves (AI reach) |
| `damage`, `chip` | base damage; chip on block (`null` = engine default) |
| `hitstun`, `blockstun` | victim stun frames; `blockstun - recovery` is on-block advantage (AI) |
| `knockback` `{x, y}` | victim velocity; negative `y` launches |
| `knockdown` | force a knockdown even when not launched |
| `juggle` | juggle points added per hit (limit 6 per combo) |
| `guard` | `mid` (blockable both ways), `low` (crouch block only), `high` (stand block only) |
| `hits`, `hitInterval` | multi-hit count and frames between hits (`moveHits` tracks progress) |
| `stunCap` | cap hitstun when the victim is already in a combo (no stun chains) |
| `scaling` | extra multiplier applied from the second combo hit on |
| `cancel` | array of slots a connected normal may cancel into (default light chain); `null` = none |
| `noCancel` | this move cannot be cancelled into from a normal |
| `air` | aerial normal |

## Resources

| Field | Meaning |
| --- | --- |
| `cooldown` | frames before the slot can be used again (gadget haste halves the wait) |
| `meterGain` | meter on hit (default `5 + 2 * strength`) |
| `meterCost` | meter required and spent on start (ultimates 100) |
| `meterOnUse` | meter granted when the move starts (Shinchan's taunt) |
| `ammo` | consumes one ammo per use (Heatblast fireball, 3 max, refill every 150 frames) |
| `electric` | consumes Pikachu's static charges for +15 % damage each |

## Windows (arrays `[fromFrame, toFrame]` inclusive)

| Field | Meaning |
| --- | --- |
| `invuln` | fully invulnerable frames |
| `armor` | absorbs light hits (strength 1 melee), never throws, heavies or projectiles |
| `passThrough` | can cross through the opponent (Hattori's Wind Dash) |
| `counter` | counter stance frames; a melee attack into it triggers `counterDamage` and a hard knockdown (Nobita) |

## Movement during the move

| Field | Meaning |
| --- | --- |
| `dash` `{ speed, frames, from, stopOnHit }` | horizontal velocity `speed * facing` from frame `from` for `frames`; negative speed = backstep (AI travel) |
| `hop` `{ at, vy, vx }` | become airborne at frame `at` |
| `teleport` `{ dist, back }` | used by `behavior: 'teleport'`; back is used when holding away |

## Spawns and behaviours

| Field | Meaning |
| --- | --- |
| `projectile` | projectile definition (`proj()` helper): `kind vx vy gravity w h offX offY life damage chip hitstun blockstun hits interval knockback guard effect strength knockdown juggle spread[] frame`. Spawns at `frame` (default `startup + 1`). `spread` spawns one projectile per vy value. |
| `charge` `{ at, max }` | hold SPECIAL at frame `at` to charge up to `max` frames; scales the projectile |
| `entity` `{ kind, offX, w, h, life, ground, unique, damage, hits, frame }` | spawns an entity at `frame` (default `startup + 1`) |
| `behavior` | `teleport` `clone` `formShift` `buff` `glide` `storm`; runs at `behaviorFrame` (default `startup + 1`) |
| `buff` `{ name, frames }` | with `behavior: 'buff'`; names: `superStrength` (x1.25 damage, slower walk handled in control), others are engine-known |
| `stormDamage` | lightning damage for `behavior: 'storm'` |
| `formShift` | marker for the AI that this cycles Ben's forms |
| `reflex` | Hattori: grants 60 frames of 35 % faster recovery after the move |
| `trap` | marker for the AI that this places a trap entity |
| `chainHits`, `chainInterval`, `chainDamage`, `chainFinal { damage, knockback }` | ultimate strike chains that run after the opening hit connects (Shinchan, Hattori, Ben) |
| `counterDamage` | damage of a successful counter (Nobita) |

## Ben 10 forms

`forms.<form> = { walkSpeed, backSpeed, jumpVel, dashSpeed, dmgMult, defMult, body, moves: { slot: move } }`. Stats override the base per form (`getStats(charId, form)`), moves override per slot (`getMove(charId, slot, form)` falls back to base). `FORM_CYCLE` in `engine.js` is `null → fourarms → xlr8 → heatblast → null`; forms last 900 frames. Art needs a builder per form in the fighter's art file (`client/src/game/art/chars/ben10.js` holds all three), the form list in `FORMS` in `chars.js`, and a `motion.js` entry keyed by the form id.

---
name: ai-opponent
description: Tune or extend Cartoon Clash's CPU opponents in shared/ai (brain.js state machine, styles.js difficulty profiles and per-fighter styles, moves.js digested frame data) and the arcade ladder in shared/arcade.js. Use this for "the AI is too hard/easy/passive/spammy", "the AI never blocks lows", "add an AI style for a new fighter", difficulty presets, boss tuning, fairness concerns (reaction time, input reading), training-dummy AI, AI-vs-AI balance runs, or arcade progression changes.
---

# AI opponent

`createAI({ charId, difficulty, seed })` returns `{ think(state, side) -> mask, reset() }`. `FightScene` calls `think` exactly once per tick before `step`. The brain is deterministic for a seed and state sequence (mulberry32 PRNG), allocation-free per tick, and only sees the opponent through a reaction-delay buffer, so it is fair by construction.

## How the brain works (`shared/ai/brain.js`)

- **Perception**: observations of the opponent (position, action, move id/phase, guard, reach, projectiles, traps) are written into a 64-entry ring and read back `D.reaction + jitter` frames late. The AI never reads the current opponent input and never reads future inputs.
- **States** (`AI_STATES`): `idle approach retreat attack block jump dodge recover special ultimate`. Neutral decisions happen every `D.decide` frames; threats (an attack in startup, a projectile, a jump-in) trigger a response roll once per threat serial (`block`, `antiAir`, `punish`, `jumpDodge`), gated by `mistake`.
- **Offence**: picks a weighted combo route from the style (`routes`), confirms hits before continuing unless a `chain` roll says go blind, uses specials by `use` role (`zone approach close escape buff trap charge punish`) within `min..max` gap, respects `projGap` to avoid projectile spam, and forces offence after `stall` frames without attacking.
- **Defence**: blocks high or low from the perceived move's `guard`, techs throws with probability `tech`, blocks on wake-up with `wake`, dodges projectiles with `jumpDodge`.
- **Ben 10**: `forms` in the style picks a form by gap (`far`, `mid`, `close` with `farGap`/`closeGap`) using `shiftSlot`.
- Move knowledge comes from `shared/ai/moves.js` (`moveTable(charId, form)`): reach (hitbox front + travel), startup, total frames, on-block advantage (`blockstun - recovery`), guard, projectile flag, cooldown and meter cost. It is built once per fighter and form, never per tick.

## Difficulty profiles (`DIFFICULTY` in styles.js)

| Field | easy | normal | hard | boss | Meaning |
| --- | --- | --- | --- | --- | --- |
| `reaction` / `jitter` | 24 / 6 | 14 / 4 | 9 / 3 | 8 / 2 | perception delay frames, plus random extra |
| `decide` | 24 | 12 | 7 | 6 | frames between neutral decisions |
| `block` / `antiAir` / `punish` | .2/.05/0 | .5/.3/.3 | .75/.65/.8 | .8/.75/.9 | response chances |
| `throwBlk` | .04 | .18 | .45 | .5 | throw a blocking opponent at close range |
| `combo` / `chain` | 1/.12 | 3/.4 | 4/.5 | 4/.55 | max route length, blind-continue chance |
| `special` / `ult` | .18/no | .65/yes | 1/yes | 1/yes | special usage multiplier, uses ultimates |
| `mistake` | .25 | .15 | .1 | .07 | chance to fumble a correct response |
| `aggression` | .6 | .85 | 1 | 1.1 | multiplier on the style's aggression |
| `wake` / `tech` | .1/0 | .4/.25 | .7/.5 | .8/.6 | wake-up block, throw tech chance |
| `jumpDodge` / `spacing` | .05/.25 | .25/.75 | .45/1 | .5/1 | projectile dodge, how strictly range is kept |
| `projGap` / `stall` | 220/150 | 140/130 | 110/110 | 100/100 | min frames between own projectiles, frames before forced offence |

Keep reactions human: never below 8 frames, and keep `mistake` above 0 so even the boss drops inputs.

## Style fields (`STYLES[charId]`)

`range` (preferred gap in px, `null` = derive from best poke), `keepAway` (zoner retreat), `aggression` 0-1, `jump`, `dash`, `antiAir` (slot), `routes: [{ s: [slots], w }]` (first move must reach), `specials: [{ slot, use, min, max, w, dir, hold, buff, entity }]`, optional `forms`. Unknown fighters use `DEFAULT_STYLE`.

## Arcade ladder (`shared/arcade.js`)

`buildLadder(playerCharId, difficulty, seed)` shuffles the other seven fighters with a seeded PRNG, assigns per-bout AI difficulty from `LADDERS[difficulty]` (`easy`: 4 easy, 2 normal, boss; `normal`: easy, 4 normal, hard, boss; `hard`: normal, 5 hard, boss), uses each opponent's home stage, and makes the last bout the boss on `final` with `{ hpMult: 1.3, dmgMult: 1.15 }` and `aiDifficulty: 'boss'`. Titles come from `BOUT` and `ORDINAL`. A new fighter needs `NAMES`, `HOME` and `BOUT` entries.

## Balance runs

`scripts/ai-arena.mjs` plays headless AI-vs-AI matches and prints win rates, average match length and damage:

```bash
export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH
node .claude/skills/ai-opponent/scripts/ai-arena.mjs goku bheem --n 10 --diff hard   # one matchup, 10 seeds
node .claude/skills/ai-opponent/scripts/ai-arena.mjs --all --n 4 --diff normal         # full 8x8 win-rate matrix
```

Read the matrix as a smell test, not truth: a fighter above ~65 % against most of the cast, or below ~35 %, deserves a look at either its kit (`fighter-design` skill) or its AI style. Matches that often hit the 99 s timer suggest a too-passive style (`aggression`, `stall`, `range`).

## Checklist: tune or add a style

1. Watch the AI in Training (dummy mode "basic AI" uses `easy`) and in Arcade at the target difficulty; write down the concrete failure ("never anti-airs", "spams Thunder Jolt", "stands in traps").
2. Map it to a knob: routes and specials in the style for character behaviour, `DIFFICULTY` for cross-cast feel. Only touch `brain.js` for a missing capability (new `use` role, new threat type).
3. If a move's data changed shape (new travel or spawn field), update `travel()` / `isProjectile()` in `moves.js` so reach and spam limits stay right.
4. Re-run `ai-arena.mjs` for the affected fighter against the cast and compare with the previous numbers.
5. Keep `think` allocation-free: no closures or arrays created per call, reuse typed arrays and module-level scratch.

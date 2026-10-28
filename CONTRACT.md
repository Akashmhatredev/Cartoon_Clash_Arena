# Cartoon Clash: Integration Contract

This is the single source of truth for all parallel workstreams. The product requirements are in
`Cartoon Clash - Lean Build Prompt + Supabase Setup.md`. If they conflict with this file, this file wins.

## Ground rules

- Node 24: run `export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH` before any `node`/`npm`/`npx` command. The default node (16) is too old.
- Plain JavaScript ES modules (no TypeScript). Allowed deps only: vue, pinia, phaser@3, vite, @vitejs/plugin-vue, vitest, wrangler, @supabase/supabase-js. They are already installed (root `node_modules`, npm workspace `client`).
- Client imports shared code as `@shared/...` (Vite alias to `/shared`) and client code as `@/...` (alias to `client/src`). The server imports with relative paths (`../../shared/index.js`).
- No pixel art, no nearest-neighbour filtering, no bitmap fonts. Fonts are self-hosted at `/fonts/Bungee-Regular.woff2` (display, family `Bungee`) and `/fonts/Inter.woff2` (body, family `Inter`, variable weights 400-800).
- Palette: navy/black base `#070b1a` / `#0d1530`, cyan `#22e4ff`, electric blue `#2f6bff`, orange `#ff8a1f`, magenta `#ff2fa6`, text `#eaf2ff`.
- Write files only inside your own area (see Ownership). If you need something from another area, code against this contract and list the request in your final report. Do not create stubs in another workstream's paths.
- **No test files and no vitest yet.** A quick `node -e` / `node --check` smoke run of your own code is fine. Do not start `npm run dev` or `wrangler dev` long-running servers. A one-shot `npx vite build` from `client/` is fine, but errors in files you don't own are expected while others are still writing, so ignore them.
- Determinism in `shared/`: no `Math.random`, no `Date`, no trig in the combat simulation (AI may use the seeded RNG from the state or its own seed). The state is plain JSON data (no classes, Maps, Sets, functions).
- Hot paths (per tick or per frame) must avoid allocations: reuse pooled objects and arrays.

## Ownership

| WS | Owns |
| --- | --- |
| A Engine | `shared/constants.js`, `shared/input.js`, `shared/stages.js`, `shared/index.js`, `shared/engine/**`, `shared/fighters/**` |
| B Client | `client/index.html`, `client/src/**` except the C and E paths below |
| C Content | `client/src/game/art/**`, `client/src/game/stages/**`, `client/src/game/fx/**`, `client/src/game/audio/**` |
| D AI | `shared/ai/**`, `shared/arcade.js` |
| E Server | `server/**`, `supabase/**`, `shared/protocol.js`, `client/src/net/**`, `client/src/screens/OnlineLobby.vue`, `client/src/screens/Account.vue`, `client/src/screens/Leaderboard.vue` |
| Integrator | root files, `CONTRACT.md`, `README.md`, `tests/**` |

---

## 1. shared/constants.js (A)

```js
export const TICK_RATE = 60;
export const DT_MS = 1000 / 60;
export const VIEW = { w: 1280, h: 720 };                     // logical 16:9 world = screen, no camera scrolling
export const STAGE = { left: 60, right: 1220, groundY: 640 }; // px, y grows downward, feet sit on groundY
export const ROUND_FRAMES = 99 * 60;
export const ROUNDS_TO_WIN = 2;
export const METER_MAX = 100;
export const INPUT_BUFFER_FRAMES = 8;
export const FIGHTER_IDS = ['shinchan','doraemon','hattori','pikachu','ben10','nobita','goku','bheem'];
```

## 2. shared/input.js (A)

```js
export const BTN = { LEFT:1, RIGHT:2, UP:4, DOWN:8, LIGHT:16, HEAVY:32, SPECIAL:64, BLOCK:128, THROW:256, ULT:512 };
export const BTN_NAMES = ['left','right','up','down','light','heavy','special','block','throw','ult']; // bit i = 1 << i
export const INPUT_MASK_ALL = 1023;
export function isValidMask(m) { return Number.isInteger(m) && m >= 0 && m <= 1023; }
```

Directions are absolute screen directions. The engine converts them to forward/back using `facing`. Commands:

- UP jumps (UP+fwd/back for a directional jump). DOWN crouches.
- Double-tap forward or back within 12 frames to dash or backdash.
- Holding BLOCK guards high (standing). DOWN+BLOCK guards low (crouching).
- LIGHT/HEAVY give `light`/`heavy` standing, `crouchLight`/`crouchHeavy` with DOWN, and `airLight`/`airHeavy` in the air.
- SPECIAL alone gives `special1`. SPECIAL+fwd or back gives `special2`. SPECIAL+DOWN gives `special3`.
- ULT gives `ultimate` (needs `meter >= move.meterCost`, usually 100). THROW gives `throw`.
- Presses are buffered for `INPUT_BUFFER_FRAMES`. An input applies on the next tick.

## 3. shared/stages.js (A)

```js
export const STAGES = [
  { id: 'neon_city', name: 'Neon City Rooftop' },
  { id: 'suburb',    name: 'Sunset Suburb' },
  { id: 'dojo',      name: 'Moonlit Dojo' },
  { id: 'forest',    name: 'Thunder Forest' },
  { id: 'village',   name: 'Village Square' },
  { id: 'island',    name: 'Tournament Island' },
  { id: 'final',     name: 'Clash Colosseum' },   // arcade final boss
];
export const STAGE_IDS = STAGES.map(s => s.id);
```

Home stages: shinchan suburb, doraemon suburb, nobita suburb, hattori dojo, pikachu forest, ben10 neon_city, goku island, bheem village.

## 4. shared/index.js: public engine API (A)

```js
export * from './constants.js';
export * from './input.js';
export * from './stages.js';
export { createMatch, step, cloneState } from './engine/engine.js';
export { FIGHTERS, getFighter, getMove } from './fighters/index.js';
```

- `createMatch(opts) -> state`
  ```js
  opts = {
    p1, p2,                 // fighter ids
    stage,                  // stage id
    roundsToWin = 2,
    roundFrames = 99*60,
    seed = 1,
    mods = [{ hpMult:1, dmgMult:1 }, { hpMult:1, dmgMult:1 }],  // arcade boss buffs
    training = null,        // or { dummyInvincible: bool, infiniteMeter: bool }
  }
  ```
  In training mode the timer is frozen and rounds never end. The side-1 dummy's HP refills when a combo ends (or never drops if `dummyInvincible`), and side 0 never gets KO'd. With `infiniteMeter` both meters stay full.
- `step(state, inputs /* [mask0, mask1] */)` mutates the state by one 60 Hz tick. It clears `state.events.length = 0` at the start, then pushes this tick's events.
- `cloneState(state)` returns a deep copy (`structuredClone` is fine).
- `getFighter(id)` returns the fighter data. `getMove(charId, slot, form = null)` returns the move object (form-specific for ben10).

### State shape (consumers rely only on these fields; A may add more)

```js
state = {
  v: 1, frame, rng,                         // rng: uint32 seed state
  phase: 'intro' | 'fight' | 'roundEnd' | 'matchEnd',
  phaseFrame,                               // frames since phase began (intro ~100f, roundEnd ~150f)
  round, timer /* frames left */, roundsToWin, wins: [0, 0],
  roundWinner: null | 0 | 1 | 'draw', matchWinner: null | 0 | 1 | 'draw',
  hitstop,                                  // global hit-pause frames remaining (sim frozen except counters)
  shake,                                    // 0..1 screen shake intensity, decays
  slow: 0,                                  // unused, reserved
  config: { p1, p2, stage, roundsToWin, training, mods },
  fighters: [F, F],
  projectiles: [P x16],                     // fixed pool, inactive entries have active:false
  entities:    [E x12],                     // fixed pool
  events: [],                               // this tick's events
  stats: { maxCombo: [0,0], damage: [0,0] },
}

F = {
  side, charId, x, y, vx, vy, facing /* 1 = facing right, -1 = left */,
  hp, maxHp, meter,
  action,          // see ACTIONS
  actionFrame,     // frames since entering action
  moveId,          // null | move slot ('light', 'special2', ...)
  moveFrame, movePhase /* null | 'startup' | 'active' | 'recovery' */,
  grounded, crouching, blocking /* null | 'high' | 'low' */,
  invuln,          // frames left
  armor,           // bool, true on frames with armor active
  comboHits, comboDamage,   // the combo this fighter is currently landing on the opponent
  lastMoveName,    // display name of last started move (training HUD)
  cooldowns: { [slot]: framesLeft },
  form,            // null | 'fourarms' | 'xlr8' | 'heatblast'   (ben10 only, null = base Ben)
  ammo,            // heatblast shots left, etc. (0 if unused)
  buffs: { },      // e.g. superStrength, staticCharge, gadgetHaste, momentum, survival, slowed  (frames or counts)
  charge,          // frames charged (kamehameha, power charge)
  hitFlash,        // frames of white flash for render
}

ACTIONS = ['intro','idle','walk','crouch','jump','dash','backdash','attack','block','hitstun','blockstun',
           'launched','knockdown','getup','grabbed','ko','win','lose']

P = { active, id, owner, kind, x, y, vx, vy, w, h, facing, life, hitsLeft }
P.kind ∈ 'shuriken' | 'thunderJolt' | 'kamehameha' | 'pellet' | 'fireball' | 'gadgetMissile' | 'spark' | 'shockwave'

E = { active, id, owner, kind, x, y, w, h, facing, life, maxLife }
E.kind ∈ 'shadowClone' | 'slowField' | 'trap' | 'stormWarning' | 'lightning' | 'door' | 'quake'
```

### Events (`state.events`)

```
{ type:'roundStart', round }            { type:'fight' }
{ type:'moveStart', side, moveId, moveName, kind }          // kind: normal|special|ultimate|throw
{ type:'hit', side /*attacker*/, target, x, y, damage, moveId, moveName, effect, strength /*1-3*/, comboHits, counter }
{ type:'block', side, target, x, y, damage /*chip*/ }
{ type:'whiff', side, moveId }
{ type:'throw', side, target }          { type:'tech', side }
{ type:'projectile', side, kind }       { type:'jump', side }   { type:'land', side }   { type:'dash', side }
{ type:'superFlash', side }             // ultimate started: render darkens the screen briefly
{ type:'form', side, form }             { type:'teleport', side, fromX, toX }
{ type:'buff', side, buff }             { type:'armor', side }   { type:'charge', side }
{ type:'ko', side /*KO'd fighter*/ }    { type:'timeUp' }
{ type:'roundEnd', winner, reason /*'ko'|'time'|'draw'*/ }
{ type:'matchEnd', winner }
```

`effect` values for the FX layer: `'hit','heavyHit','electric','fire','wind','gadget','energy','dust','slash','sparkle'`.

## 5. Fighter data (A): `shared/fighters/<id>.js` default export, registry in `shared/fighters/index.js`

```js
{
  id, name, title, bio,                       // bio: one line
  hp,                                         // base max HP (spec table)
  stats: { speed, power, defense },           // 1-5 for the select-screen bars
  walkSpeed, backSpeed, jumpVel, jumpSpeedX, gravity, dashSpeed, dashFrames,
  dmgMult, defMult,                           // power and defense applied to damage
  body: { w, h, crouchH },                    // hurtbox, feet-anchored (see table)
  palette: { primary, secondary, accent, skin, outline: '#0b0f1e' },
  homeStage,
  passive: { name, desc },
  moves: { light, heavy, crouchLight, crouchHeavy, airLight, airHeavy, throw, special1, special2, special3, ultimate },
  forms: { fourarms: {...overrides}, xlr8: {...}, heatblast: {...} }   // ben10 only
}
move = {
  id /* slot */, name, input /* display e.g. 'L', '↓+L', 'Air H', 'Sp', '→+Sp', '↓+Sp', 'Ult', 'Throw' */, desc,
  kind: 'normal' | 'special' | 'ultimate' | 'throw',
  anim,                                       // one of ATTACK_ANIMS below
  startup, active, recovery,
  damage, chip, hitstun, blockstun, knockback: { x, y },
  hitbox: { x, y, w, h },                     // relative to feet; x is forward (mirrored by facing), y negative = up
  guard: 'mid' | 'low' | 'high',              // low must be blocked crouching, high (overheads/air) standing
  hits, hitInterval,                          // multi-hit
  cooldown, meterGain, meterCost, scaling, effect, ...behaviour fields A defines
}
```

Body sizes (art must match these heights):

| id | w | h | crouchH |
| --- | --- | --- | --- |
| shinchan | 70 | 150 | 100 |
| doraemon | 95 | 165 | 115 |
| hattori | 70 | 180 | 115 |
| pikachu | 72 | 135 | 95 |
| ben10 | 80 | 175 | 115 (fourarms 110 x 205) |
| nobita | 75 | 170 | 112 |
| goku | 75 | 160 | 108 |
| bheem | 95 | 175 | 118 |

Standing light and heavy hitboxes must vertically cover feet-offsets -60 to -110 so they hit every fighter, including Pikachu.

### Anim keys

The renderer must support all of these. `move.anim` must use only `ATTACK_ANIMS`.

```
BASE_ANIMS   (from F.action): idle walk crouch jump fall dash backdash block crouchBlock hitstun launched knockdown getup grabbed ko win lose intro
ATTACK_ANIMS (from move.anim): jab punch kick lowKick sweep uppercut airPunch airKick slam throw taunt spin cast beam dashStrike glide teleport buff flurry ultimate
```

For an attack the renderer uses `movePhase` (startup = wind-up, active = strike, recovery = return) plus `moveFrame` to blend.

## 6. AI and arcade (D)

`shared/ai/index.js`:
```js
export function createAI({ charId, difficulty /* 'easy'|'normal'|'hard'|'boss' */, seed = 1 }) -> {
  think(state, side) -> inputMask,   // call exactly once per tick before step()
  reset(),
}
```
The training dummy's "basic AI" uses `'easy'`. The AI may read only the current state (including the opponent's visible action/move/phase) through a reaction-delay buffer. It must never read future inputs.

`shared/arcade.js`:
```js
export const ARCADE_LENGTH = 7;
export function buildLadder(playerCharId, difficulty /* 'easy'|'normal'|'hard' */, seed) ->
  [{ opponent, stage, aiDifficulty, mods: { hpMult, dmgMult }, boss: bool, title }]  // last entry is the boss, stage 'final'
```

## 7. Client (B)

- Pinia stores in `client/src/stores/`:
  - `ui.js`: `useUi()`, state `{ screen, params }`, actions `go(screen, params = {})` and `back()`. Screens: `'menu','select','ladder','fight','results','settings','online','account','leaderboard'`.
  - `match.js`: `useMatch()`, state `{ config, result }`, `start(config)` sets config and goes to `'fight'`, `finish(result)` goes to `'results'`.
  - `settings.js`: `useSettings()`, persisted to localStorage `cc.settings.v1`. Holds volume, muted, cleanMode, perfMode (`'auto'|'on'|'off'`), showDebug, keymaps, touch, gamepad, and playerName.
  - `progress.js`: `useProgress()`, persisted to `cc.progress.v1` (arcade clears and run in progress).
- Match config passed to `useMatch().start()`:
  ```js
  { mode: 'training'|'arcade'|'versus'|'online', p1, p2, stage, roundsToWin,
    controllers: [c0, c1],   // each 'p1'|'p2'|'ai'|'dummy'|'net'. 'p1' = P1 keys + touch + pad 0; 'p2' = P2 keys + pad 1
    aiDifficulty, mods, training: {...}, arcade: { index, ladder },
    online: { localSide, startInfo } }
  ```
- Global CSS classes defined by B in `client/src/styles/base.css` (E's screens use these): `.screen`, `.panel`, `.title`, `.subtitle`, `.btn`, `.btn.primary`, `.btn:disabled`, `.btn-row`, `.input`, `.muted`, `.grid`, `.list`, `.badge`, `.back-btn`.
- `client/src/game/createGame.js` builds the Phaser game. Phaser config: `pixelArt:false, antialias:true, roundPixels:false`. Canvas size is 1280x720 times `res`, where `res = min(2, devicePixelRatio)` (1 in perf mode), with `Scale.FIT`, `CENTER_BOTH`, and main camera `setZoom(res)` + `centerOn(640,360)`. Store `res` in `scene.registry.set('res', res)`. Phaser's own audio and keyboard are disabled (B reads `window` keys and `navigator.getGamepads()` directly).
- Depths: stage `0-9`, entities `15`, fighters `20/21`, projectiles `30`, fx `40`.
- **Driver interface.** The scene runs a fixed 60 Hz accumulator and renders interpolated positions.
  ```js
  driver.state      // engine state to render
  driver.localSide  // 0|1 online, null offline
  driver.tick(inputs /*[m0,m1]*/) -> events[]   // exactly once per fixed tick
  driver.stats      // { ping, drift } (offline: { ping:0, drift:0 })
  driver.destroy()
  ```
  B writes `client/src/game/drivers/LocalDriver.js`. E writes `client/src/net/OnlineDriver.js` (`new OnlineDriver(session, startInfo)`).

## 8. Content (C) APIs consumed by B's FightScene and menus

```js
// client/src/game/art/index.js
export async function preloadFighterArt(scene, charId)  // rasterize vector parts to high-res canvas atlases (scale = registry 'res'), idempotent; also builds ben10 form variants
export class FighterView {
  constructor(scene, charId, side)
  sync(f, x, y, dtMs, perf)   // f = fighter state; x,y = interpolated feet position; perf = boolean
  destroy()
}
export function preloadProjectileArt(scene)
export class ProjectileLayer {           // projectiles + entities, pooled by index
  constructor(scene)
  sync(state, alpha, dtMs, perf)
  destroy()
}
// client/src/game/art/portrait.js  (no Phaser; used by Vue screens)
export function renderPortrait(charId, size = 256, opts = {}) -> HTMLCanvasElement   // cached, synchronous
export function portraitURL(charId, size = 256) -> string (dataURL, cached)

// client/src/game/stages/index.js
export function buildStage(scene, stageId, { perf }) -> { update(dtMs), destroy() }   // layered parallax with ambient motion

// client/src/game/fx/index.js
export class Effects {
  constructor(scene, { perf })
  handleEvents(events, state)   // hit sparks, block sparks, dust, KO flash, combo/COUNTER text, superFlash dim
  update(dtMs)
  setPerf(b)
  destroy()
}

// client/src/game/audio/sfx.js  (Web Audio, synthesized, no files; every call is a safe no-op before unlock)
export const sfx = { unlock(), play(name), handleEvents(events), setVolume(v /*0..1*/), setMuted(b) }
// names: hit heavyHit block whiff jump land dash throw ko roundStart fight select confirm back special
//        ultimate electric fire projectile win lose tick teleport charge
```

Screen shake is applied by B's scene from `state.shake`. Fighters render their own glow/outline. `perf` disables glow and reduces particles.

## 9. Net and online (E)

- `client/src/net/config.js`: `onlineConfigured` (VITE_WS_URL set), `supabaseConfigured` (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY), `onlineDisabledReason`, `accountsDisabledReason`.
- `client/src/net/session.js`: `getSession()` singleton `OnlineSession` (event emitter): `create()`, `join(code)`, `selectCharacter(id)`, `setReady(bool)`, `requestRematch()`, `leave()`, `on(evt, cb) -> off`. Events: `lobby`, `start`, `end`, `ping`, `error`, `close`.
- `client/src/net/OnlineDriver.js`: the Driver interface above. The server is authoritative (it runs `shared` `step()`). The client predicts with local inputs and reconciles to server snapshots.
- `client/src/net/supabase.js`: lazy-imports `@supabase/supabase-js` only when configured. Provides auth, profile, leaderboard, and match history helpers.
- Screens `OnlineLobby.vue` (`'online'`), `Account.vue` (`'account'`), and `Leaderboard.vue` (`'leaderboard'`) use B's stores and CSS classes. When the server sends `start`, the lobby calls `useMatch().start({ mode:'online', ..., controllers: localSide === 0 ? ['p1','net'] : ['net','p1'], online: { localSide, startInfo } })`. After an online match, B's Results screen offers "Back to Lobby", which calls `useUi().go('online')`. The lobby must handle returning to an existing session.

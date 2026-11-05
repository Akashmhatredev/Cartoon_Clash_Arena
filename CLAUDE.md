# Cartoon Clash: Legends of Childhood

A browser 2D 1v1 arcade fighting game. Vue 3 + Pinia run the menus and HUD, Phaser 3 runs the fight loop, and one deterministic 60 Hz combat engine in `shared/` is executed by both the browser (offline modes, client prediction) and a Cloudflare Worker Durable Object (authoritative online rooms). Offline play needs zero configuration. Online rooms and Supabase accounts are optional add-ons.

Read this file first. The deep dives live in the project skills under `.claude/skills/` (indexed at the bottom) and in `CONTRACT.md`, which is the cross-module API contract and wins over any other document when they disagree. `Cartoon Clash - Lean Build Prompt + Supabase Setup.md` is the original product brief; `README.md` is the public-facing overview; `docs/DEPLOY.md` is the hosting guide with free-tier limits.

## Environment

- **Node 20.19+ is required** (`.nvmrc` pins 24). The default `node` on this machine is v16 and fails on Vite 8 and Vitest 5. Before any `node`, `npm` or `npx` command run `export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH` (or `nvm use`).
- Plain JavaScript ES modules everywhere. No TypeScript, no decorators, no extra transpilers.
- Allowed dependencies only: `vue`, `pinia`, `phaser`, `@supabase/supabase-js` (client); `wrangler` (server tooling); `vite`, `@vitejs/plugin-vue`, `vitest` (tooling). Adding anything else (for example `three`) is a product decision to raise with the user before installing.
- Client imports shared code as `@shared/...` (Vite alias to `/shared`) and client code as `@/...` (alias to `client/src`). The server imports shared code by relative path (`../../shared/index.js`). Shared code must therefore stay free of browser and Node-only globals.
- Secrets never go in `VITE_` variables; those ship to the browser. The Supabase service-role key exists only as a Worker secret or in the git-ignored `server/.dev.vars`.

### Commands (run from the repo root)

| Command | What it does |
| --- | --- |
| `npm install` | installs root tooling and the `client` workspace |
| `npm run dev` | Vite dev server at http://localhost:5173, also exposed on the LAN |
| `npm run build` | production build to `client/dist` (Phaser fight chunk is lazy-loaded, about 360 kB gzipped) |
| `npm run preview` | serves the production build |
| `npm test` | `vitest run` over `tests/**` (engine, frame data, hitbox coverage, determinism, protocol, art specs, animator). Config: `vitest.config.js` (adds the `@` and `@shared` aliases). |
| `npm run server:install` | installs `server/` deps (`server/` is not an npm workspace) |
| `npm run server:dev` | `wrangler dev` on port 8787 |
| `npm run server:deploy` | `wrangler deploy` |

Fast validation without a browser: `node --check <file>` for syntax, a one-shot `npx vite build` inside `client/` for bundling, and `node .claude/skills/engine-testing/scripts/smoke.mjs` to run the engine, AI, arcade ladder and protocol packing headlessly and confirm determinism. For art and motion, screenshot a scratch art-lab page or the real game in headless Chrome (workflow in the `character-art-rig` skill). Dev servers run until killed: start them in the background and stop them when done.

## Repository layout

```
shared/                 Deterministic game logic shared by client and server (no DOM, no Node APIs)
  constants.js          TICK_RATE 60, VIEW 1280x720, STAGE bounds (left 60, right 1220, groundY 640), FIGHTER_IDS
  input.js              BTN bitmask (10 bits, LEFT=1 .. ULT=512), isValidMask
  stages.js             STAGES list (7 ids: neon_city suburb dojo forest village island final)
  engine/engine.js      createMatch / step / cloneState: the whole combat simulation (~1100 lines)
  fighters/             kit.js move builders, <id>.js pure-data fighter files, index.js registry (getFighter, getMove, getStats)
  ai/                   brain.js state machine, styles.js difficulty + per-fighter styles, moves.js digested frame data
  arcade.js             buildLadder(): seeded 7-bout ladder, boss on 'final' with +30% HP / +15% damage
  protocol.js           Versioned online protocol: message types, limits, validation, snapshot packing
client/                 Vue 3 + Vite app (npm workspace)
  src/main.js, App.vue  App shell, screen switcher, toasts, scanlines, audio unlock, delegated button sfx
  src/screens/          MainMenu CharacterSelect Ladder Fight Results Settings OnlineLobby Account Leaderboard
  src/components/       HUD, MoveList, FighterDetail, TouchControls
  src/stores/           Pinia: ui (navigation), match (config/result), settings (cc.settings.v1), progress (cc.progress.v1)
  src/lib/              fighters.js (roster helpers, STAGE_SWATCH), matchConfig.js (config builders), keys.js, storage.js, menuNav.js, portraits.js
  src/game/createGame.js  Phaser.Game factory (pixelArt:false, antialias, FIT, res = min(2, DPR), audio/input disabled)
  src/game/FightScene.js  Fixed 60 Hz accumulator, render interpolation, driver + AI wiring, perf auto-mode, teardown
  src/game/drivers/LocalDriver.js  Offline driver: steps the engine directly
  src/game/input/       keyboard (event.code), gamepad (standard mapping), touch, index.js merges into masks with SOCD cleaning
  src/game/art/         Procedural vector fighters (only FighterView, ProjectileLayer, projectileArt, atlas and index.js touch Phaser):
    chars.js            Art registry: getSpec (rig spec scaled to the engine body), bodyFor, paletteFor, FORMS, EXPRS
    chars/              kit.js (mk proportions, hands, feet, cloth, expression-aware face helpers, assemble) + one art file per fighter (ben10.js also holds fourarms, xlr8, heatblast)
    animator.js         Render-only pose animator: attack timelines keyed to frame data, planted-foot gait, jump arcs and flips, hit reactions, per-joint springs, expressions
    motion.js           Per-character motion personality: stance, idle bounce and fidgets, gait, weight, snap, flips, win/lose/intro loops
    rig.js, poses.js    FK skeleton (18 joints, 22 bones) and the shared pose library (POSES, ATTACKS, OWN_LEGS)
    atlas.js, figure.js Atlas baking (one frame per part plus "<part>@<expr>" expression frames); drawFigure() for Canvas2D renders
    FighterView.js      Phaser puppet: atlas images on bones, expression frame swaps, turnaround, tints, auras, charge orb, shadow
    draw.js             Canvas2D vocabulary (outline, shading, organic open-cap limb(), eyes); portrait.js menu busts; ProjectileLayer.js, projectileArt.js
  src/game/stages/      defs.js (7 stage definitions), paint.js (Canvas2D helpers), sprites.js, ambient.js, index.js buildStage()
  src/game/fx/          Effects (pooled particles, announcer text), textures.js (shared generated textures)
  src/game/audio/sfx.js Synthesized Web Audio sound effects, no audio files
  src/net/              config.js (env flags), session.js (OnlineSession), OnlineDriver.js (prediction + reconciliation), supabase.js
  public/fonts/         Self-hosted Bungee (display) and Inter (body), OFL licensed
server/                 Cloudflare Worker: src/index.js (HTTP + WS upgrade), src/room.js (Room Durable Object), src/supabase.js, wrangler.jsonc
supabase/schema.sql     cc_profiles, cc_matches, cc_leaderboard view, cc_record_match() (SECURITY DEFINER, service_role only). Safe to re-run.
docs/DEPLOY.md          Deployment steps, verification, free-tier limits (checked 2026-10-27)
CONTRACT.md             Integration contract: state shape, events, fighter data format, module interfaces, workstream ownership
```

## Architecture in one page

**One engine, everywhere.** `createMatch(opts)` returns a plain JSON state. `step(state, [mask0, mask1])` advances exactly one 60 Hz tick, clears `state.events` and pushes this tick's events. The same function runs offline in the browser, inside the Room Durable Object, and in the client's prediction loop. Determinism is the foundation of online play: the simulation uses no `Math.random`, `Date`, trig, classes, Maps, Sets or functions in state. Only the seeded `state.rng` may introduce variation. Hot paths (per tick, per frame) must not allocate: pools are fixed (16 projectiles, 12 entities, 260 particles) and arrays are reused.

**Driver interface.** `FightScene` owns the fixed-step accumulator and talks to a driver: `driver.state`, `driver.localSide` (0 or 1 online, null offline), `driver.tick(inputs) -> events[]`, `driver.stats { ping, drift }`, `driver.destroy()`. `LocalDriver` steps the engine. `OnlineDriver` predicts locally, stores inputs in a ring buffer and re-simulates from each server snapshot. Rollback could replace it later without touching the scene.

**Server authority.** Clients send only input bitmasks (`{ s: seq, f: frame, m: mask }`). The Room runs the engine at 60 Hz, broadcasts packed snapshots every 3 ticks (20 Hz) and sends authoritative `roundEnd` / `matchEnd` events. Rank points are written only by the Worker through `cc_record_match()` using the service key.

**Data-driven fighters.** `shared/fighters/<id>.js` holds stats, body hurtbox, palette, passive text and all moves (frame data, hitboxes, damage, knockback, cooldown, meter, behaviour flags). The renderer reads `move.anim`, the AI reads the same data through `shared/ai/moves.js`, and the select screen reads `stats`, `bio` and `input` strings. Passives that cannot be expressed as move data are implemented in `engine.js` keyed by `charId` (Pikachu static charge, Goku momentum, Doraemon gadget haste, Nobita survival, Hattori reflex). Ben 10's forms are special-cased (`FORM_CYCLE`).

**Procedural vector art.** Every fighter is a skeleton (`rig.js`, 18 joints, 22 bones) dressed by Canvas2D part drawers in its own file, `art/chars/<id>.js`, built from the shared helpers in `art/chars/kit.js` and registered in `art/chars.js`. The art is a fan-art likeness drawn in code from each character's design cues (head-to-body ratio, build, hair, face, outfit colours); no official artwork is copied or embedded. Parts are rasterized once per match into a high-resolution atlas (`atlas.js`, scale = `res * spec.k`, with `k = body.h / spec.H` so the engine hurtbox sets the drawn height). Every head drawer is `head(ctx, e)` with `e` in `normal | blink | hurt | shout`, and the atlas bakes one extra frame per expression (`head@blink`, `head@hurt`, `head@shout`) that `FighterView` swaps in. Portraits reuse the same drawers without Phaser. Stages are layered parallax canvases painted at load (`stages/defs.js`). Nothing is pixel art; filtering is linear and the canvas is DPR-aware up to 2x.

**Organic motion.** `FighterView` owns an `Animator` (`animator.js`, Phaser-free and render-only: it reads fighter state and never writes it, and its random noise uses its own seed, never `state.rng`). Keyed motion is a function of the engine's frame counters, so it is exact at any frame rate: attacks run a timeline built from the move's frame data (wind-up, a snap where the hips lead and the striking limb arrives last, fully out on the first active frame, overshoot, follow-through, recovery), the walk plants each foot (Pikachu hops), jumps push off, tuck and land (Hattori, Goku, Pikachu and XLR8 front-flip forward), dashes lunge, and get-ups are timed. Joints follow keyed motion exactly; the head, forearms and tail follow only partly, and per-joint damped springs make them drag and overshoot. State changes blend with the current momentum carried over instead of popping. Hit reactions are keyed to the hit timer or the launch arc, alternate two hit poses scaled by knockback, and tumble into knockdown. Joint limits, a velocity cap and a NaN guard (falls back to the stance) keep poses sane, and airborne fighters are anchored at the hip with a floor clamp so flips turn around the body. `motion.js` gives each character and Ben 10 form a personality: stance, bounce, gait, weight, strike snap, head behaviour, flips, idle fidgets, and win, lose and intro loops. The displayed facing eases through zero when a fighter turns around.

**Body sizes.** `body: { w, h, crouchH }` in `shared/fighters/<id>.js` is the hurtbox (`h`/`crouchH`), the push box and wall clamp (`w`), and the drawn size. Heights follow canon but are compressed into a playable range: Nobita (~140 cm) 168, Hattori (~140 cm) 166, Ben 10 166, Bheem 160, Doraemon (129.3 cm) 158, Kid Goku (~100-124 cm) 146, Shinchan (5 y/o) 138, Four Arms 210. Pikachu (40 cm) is scaled up to 120, as crossover fighting games do, because true scale would make it a target that standing normals sail over. Widths follow build (Doraemon 104, Bheem 90, Nobita 64). Body changes alter the simulation, so they need a `PROTOCOL_VERSION` bump.

**Screens and state.** `useUi().go(screen, params)` switches the active screen component in `App.vue`; `fight` and `results` are transient and never pushed on the back stack. `useMatch().start(config)` navigates to the fight; `FightScene` reports `onMatchEnd(result)` through hooks and `useMatch().finish(result)` records progress and navigates to results. Settings and arcade progress persist to `localStorage` through `persistStore` (debounced, guarded).

Render depths: stage 0-9, entities 15, fighters 20/21 (shadow 19), projectiles 30, fx 40. Logical world is 1280x720 with no camera scroll; the camera zooms by `res` and centres on (640, 360); screen shake offsets the camera from `state.shake`.

## Match configuration

`useMatch().start()` receives (see `client/src/lib/matchConfig.js`):

```js
{ mode: 'training'|'arcade'|'versus'|'online', p1, p2, stage, roundsToWin, seed,
  controllers: [c0, c1],          // 'p1' | 'p2' | 'ai' | 'dummy' | 'net'
  aiDifficulty: 'easy'|'normal'|'hard'|'boss', mods: [{hpMult,dmgMult},{...}],
  training: { dummyMode, dummyInvincible, infiniteMeter } | null,
  arcade: { index, ladder, difficulty, boss, title }, online: { localSide, startInfo } }
```

Controller `'p1'` merges P1 keys, touch and gamepad 0 (plus P2 keys and pad 1 when no human P2 exists). Input is buffered 8 frames and applies on the next tick. Training mode freezes the timer, never ends rounds, refills the dummy after each combo and optionally pins meter at 100.

Persistence keys: `cc.settings.v1` (settings store), `cc.progress.v1` (arcade clears, current run, lifetime stats, last picks), `cc.net.v1` in `sessionStorage` (room code + reconnect token).

## Configuration and deployment

All optional. Client: `client/.env.local` with `VITE_WS_URL` (enables Online; must be `wss://` on https pages), `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (enable Account and Leaderboard, make online matches between two signed-in users ranked). Server: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as Wrangler secrets or in `server/.dev.vars`; `ALLOWED_ORIGINS` in `wrangler.jsonc` (comma-separated, `*` wildcards allowed, empty = any origin). Hosting targets: Vercel Hobby for `client/` (root directory `client`, keep "include files outside root" on because of `../shared`), Cloudflare Workers Free for `server/` (SQLite-backed Durable Objects are mandatory on the free plan), Supabase Free for `schema.sql` (all objects prefixed `cc_`).

## Visual and UX rules

- Retro arcade feel from colour, type and motion. **No pixel art, no nearest-neighbour filtering, no bitmap fonts.** Bold outlines (`#0b0f1e`, width 3 world units), flat shading, neon glows.
- Palette: base `#070b1a` / `#0d1530`, cyan `#22e4ff`, electric blue `#2f6bff`, orange `#ff8a1f`, magenta `#ff2fa6`, text `#eaf2ff`. Side colours: P1 cyan, P2 magenta. CSS variables live in `client/src/styles/base.css`.
- Fonts: Bungee for display, Inter for body, both self-hosted from `/fonts/`.
- Phone portrait for menus, landscape for gameplay. Touch targets at least 48 px, `touch-action: none` during play, safe-area insets respected, no zoom.
- Performance mode (fewer particles, no glow, 1x resolution) toggles automatically after 3 seconds under 45 FPS and latches for the session.
- Every Phaser object, listener, timer and socket is cleaned up on unmount (`FightScene.teardown`, `createGame().destroy`).

## Conventions

- Commit messages follow `type(scope): summary` as in the history (`feat(engine): ...`, `feat(client): ...`, `docs: ...`, `chore: ...`). Do not add AI co-author or "generated with" trailers to commits or PRs; the author wants commits attributed only to themselves.
- Keep `shared/` pure and allocation-free on hot paths. If you add a state field, remember it travels in every snapshot (`protocol.js` packs all state fields generically). Bump `PROTOCOL_VERSION` when client and server can no longer interoperate (new fighter or stage ids, changed message fields, changed state semantics, changed fighter data such as `body` sizes or frame data). It is 2 since the canon-height body change.
- New fighter, stage, projectile kind or entity kind touches several registries. Follow the checklists in the matching skill rather than guessing.
- Match the existing style: 2-space indent, single quotes, semicolons, trailing commas in multi-line literals, short comment headers (`// ---- section`), terse but descriptive names. No lint config exists, so consistency with neighbouring code is the rule.
- Guard every browser API that can be missing or throw (localStorage, AudioContext, fullscreen, matchMedia) the way `storage.js` and `sfx.js` do. Art and audio failures must never break menus or a match.
- Character names and designs belong to their owners; this is a non-commercial fan project. The fighters are procedural fan-art likenesses drawn in code: describe designs in words and draw them yourself, never download, trace or embed official artwork. Keep names, moves and art data-driven so they can be swapped.

## Known gaps

No automated tests exist (Vitest is wired up). Netcode is prediction + reconciliation, not rollback. Private rooms only, no matchmaking or spectating. A Worker deploy mid-match loses that match. Combat balance has only been play-tested.

## Project skills (`.claude/skills/`)

| Skill | Use it when |
| --- | --- |
| `combat-engine` | changing `shared/engine`, adding mechanics, debugging hits/combos/rounds, determinism questions |
| `fighter-design` | adding or balancing a fighter, editing move frame data, hitboxes, specials, ultimates, passives, forms |
| `character-art-rig` | drawing or fixing fighter art, faces and expressions, the spring animator and motion personality, rigs, poses, portraits, atlases, animation keys, visual checks in headless Chrome |
| `stage-design` | adding or editing a stage, parallax layers, ambient motion, stage palette |
| `vfx-sfx` | hit sparks, particles, announcer text, projectile visuals, synthesized sounds |
| `ai-opponent` | AI behaviour, difficulty tuning, per-fighter styles, fairness, AI-vs-AI balance runs |
| `online-netcode` | protocol, Room Durable Object, session, OnlineDriver, reconnects, abuse limits, local two-browser tests |
| `ui-screens` | Vue screens, Pinia stores, HUD, settings, controls, touch, CSS system, navigation |
| `engine-testing` | writing Vitest tests, headless smoke runs, deterministic replay checks |
| `deploy-release` | building, env vars, Vercel/Cloudflare/Supabase deploys, release checklist |
| `3d-modeling` | Blender/glTF asset work, pre-rendering 3D fighters or stages to sprite atlases, optional Three.js showcases |

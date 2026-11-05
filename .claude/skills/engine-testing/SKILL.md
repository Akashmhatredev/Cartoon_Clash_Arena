---
name: engine-testing
description: Write and run tests for Cartoon Clash. Use this whenever a task says test, Vitest, spec, regression, smoke test, "verify the engine still works", "check determinism", "replay", CI, or before merging any change to shared/ (engine, fighters, AI, arcade, protocol) or server/src. Covers where tests live, the Node 24 requirement, deterministic input-scripting helpers, protocol validation tests, the headless smoke script, and what not to test with Vitest (Phaser and Vue rendering).
---

# Engine testing

Vitest 5 runs from the root (`npm test` = `vitest run`). `vitest.config.js` limits it to `tests/**` and adds the same `@` (client/src) and `@shared` aliases as Vite, so Phaser-free client modules (art specs, the Animator) are testable. Existing suites cover engine frame data, determinism, hitbox coverage for every body size, protocol validation, art specs and the Animator; extend them rather than starting new files for the same topic. Node 20.19+ is mandatory (`export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH`).

## What to test, and how

Testable without a browser: everything in `shared/` (engine, fighters, AI, arcade, protocol) and the pure parts of `server/src` (`originAllowed`, `randomCode` shape, Supabase arg building). Phaser scenes, Vue screens and Web Audio are verified by playing, not by Vitest; wrapping them in jsdom buys little and costs a lot.

Patterns (full examples in `references/test-patterns.md`):

- **Script a match.** `createMatch({ p1, p2, stage, seed })`, then drive `step(state, [m0, m1])` with masks from `BTN`. Helper: `press(state, side, bits, frames)` holds a mask for n ticks, `run(state, frames)` idles. Skip the 100-frame intro with `run(state, 100)` or create the match in training mode (`training: {}` puts the phase straight into `fight`).
- **Assert on events, not internals.** Collect `state.events` after each step into an array and assert types, `moveId`, `damage`, `comboHits`. Internals (`stun`, `kbx`) are fair game only for engine-internal tests.
- **Frame data.** Start a move, step until `movePhase` changes, and compare frame counts with the fighter data; that pins startup/active/recovery resolution.
- **Determinism.** Run the same input script twice (or once on a `cloneState`) and compare `JSON.stringify(packState(a)) === JSON.stringify(packState(b))`. Also feed an AI on both sides with fixed seeds for a long match: AI plus engine must be reproducible.
- **Protocol.** `parseClientMessage(JSON.stringify({ v: PROTOCOL_VERSION, t: 'in', s: 1, f: 0, m: 1023 }))` is `ok`; wrong `v` is fatal; oversized hello is `too_big`; `packState` then `applyPackedState` round-trips a mid-match state.
- **AI fairness.** For `difficulty: 'hard'`, assert the brain never reacts to an opponent move before `reaction` frames (compare the frame of `moveStart` and the first frame the AI mask contains BLOCK).
- **Arcade.** `buildLadder` returns 7 unique opponents excluding the player, last is the boss on `final` with the boss mods, and is stable per seed.

## Headless smoke run

`scripts/smoke.mjs` runs an AI match, checks determinism, packs a snapshot, builds a ladder and validates a protocol message. Run it after any change to `shared/`:

```bash
export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH
node .claude/skills/engine-testing/scripts/smoke.mjs
```

It exits non-zero on the first failure and prints a one-line summary otherwise. It is fast (under a second), so run it before claiming engine work is done.

## Conventions

- Put shared tests under `tests/` (CONTRACT.md reserves `tests/**` for the integrator) mirroring the source path: `tests/engine/*.test.js`, `tests/fighters/*.test.js`, `tests/ai/*.test.js`, `tests/protocol/*.test.js`, `tests/server/*.test.js`.
- Import shared code with relative paths (`../../shared/index.js`) or the `@shared` alias; client art modules via `@/game/art/...`.
- Use fixed seeds and explicit frame counts; never `Math.random` or wall-clock time in a test.
- Prefer one behaviour per test with a descriptive name ("light cancels into heavy on hit", "throw tech within 8 frames escapes"). Balance numbers change often, so assert relations (startup < heavy startup, damage > 0, within a range) rather than exact tuned values unless the test documents a deliberate constraint.
- Server integration (two WebSocket clients against `wrangler dev`) is a manual checklist for now; see the `online-netcode` skill. If you automate it, keep it out of the default `npm test` run.

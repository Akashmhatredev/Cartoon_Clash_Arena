# Test patterns for Cartoon Clash

## Helpers (copy into `tests/helpers.js`)

```js
import { createMatch, step, BTN, cloneState } from '../shared/index.js';

export function newFight(opts = {}) {
  // training: {} skips the intro and never ends rounds; pass training: null for real rounds (then run(state, 100) first)
  return createMatch({ p1: 'goku', p2: 'bheem', stage: 'island', seed: 1, training: {}, ...opts });
}

/** Hold `mask` for `side` during `frames` ticks; the other side idles. Returns all events seen. */
export function press(state, side, mask, frames = 1, otherMask = 0) {
  const out = [];
  const inputs = [0, 0];
  for (let i = 0; i < frames; i++) {
    inputs[side] = mask; inputs[1 - side] = otherMask;
    step(state, inputs);
    out.push(...state.events);
  }
  return out;
}

export const run = (state, frames) => press(state, 0, 0, frames);
export const fwd = (f) => (f.facing === 1 ? BTN.RIGHT : BTN.LEFT);
export const back = (f) => (f.facing === 1 ? BTN.LEFT : BTN.RIGHT);
export { BTN, step, cloneState };
```

## Frame data resolution

```js
import { describe, it, expect } from 'vitest';
import { getMove } from '../../shared/index.js';
import { newFight, press, run } from '../helpers.js';

describe('frame data', () => {
  it('light attack follows startup/active/recovery', () => {
    const s = newFight({ p1: 'pikachu' });
    const mv = getMove('pikachu', 'light');
    press(s, 0, 16 /* LIGHT */, 1);
    const f = s.fighters[0];
    expect(f.action).toBe('attack');
    expect(f.moveId).toBe('light');
    const phases = [];
    while (f.action === 'attack') { phases.push(f.movePhase); run(s, 1); }
    expect(phases.filter((p) => p === 'startup').length).toBe(mv.startup);
    expect(phases.filter((p) => p === 'active').length).toBe(mv.active);
    expect(phases.filter((p) => p === 'recovery').length).toBe(mv.recovery);
  });
});
```

## Hit, block and chip

```js
it('a light hit deals base damage on the first combo hit', () => {
  const s = newFight({ p1: 'goku', p2: 'bheem' });
  // walk into range first
  const f = s.fighters[0];
  for (let i = 0; i < 90 && Math.abs(s.fighters[1].x - f.x) > 110; i++) press(s, 0, fwd(f), 1);
  const ev = press(s, 0, 16, 12);
  const hit = ev.find((e) => e.type === 'hit');
  expect(hit).toBeDefined();
  expect(hit.comboHits).toBe(1);
  expect(hit.damage).toBeGreaterThan(0);
});

it('standing block stops a mid attack', () => {
  const s = newFight({ p1: 'goku', p2: 'bheem' });
  const f = s.fighters[0];
  for (let i = 0; i < 90 && Math.abs(s.fighters[1].x - f.x) > 110; i++) press(s, 0, fwd(f), 1);
  const ev = press(s, 0, 16, 12, 128 /* BLOCK */);
  expect(ev.some((e) => e.type === 'block')).toBe(true);
  expect(ev.some((e) => e.type === 'hit')).toBe(false);
});
```

## Determinism

```js
import { packState } from '../../shared/protocol.js';
import { createAI } from '../../shared/ai/index.js';

it('AI vs AI replays are identical', () => {
  const play = () => {
    const s = createMatch({ p1: 'hattori', p2: 'doraemon', stage: 'dojo', seed: 42 });
    const a = createAI({ charId: 'hattori', difficulty: 'hard', seed: 5 });
    const b = createAI({ charId: 'doraemon', difficulty: 'hard', seed: 6 });
    const inputs = [0, 0];
    for (let i = 0; i < 60 * 60; i++) { inputs[0] = a.think(s, 0); inputs[1] = b.think(s, 1); step(s, inputs); }
    return JSON.stringify(packState(s));
  };
  expect(play()).toBe(play());
});
```

## Protocol

```js
import { parseClientMessage, encode, packState, applyPackedState, PROTOCOL_VERSION } from '../../shared/protocol.js';

it('rejects wrong versions as fatal', () => {
  const r = parseClientMessage(JSON.stringify({ v: PROTOCOL_VERSION + 1, t: 'ready', on: true }));
  expect(r.ok).toBe(false); expect(r.fatal).toBe(true);
});
it('validates input fields', () => {
  expect(parseClientMessage(encode('in', { s: 1, f: 0, m: 1023 })).ok).toBe(true);
  expect(parseClientMessage(encode('in', { s: 1, f: 0, m: 1024 })).ok).toBe(false);
});
it('snapshot round-trips', () => {
  const s = newFight(); run(s, 200);
  const copy = createMatch({ p1: 'goku', p2: 'bheem', stage: 'island', seed: 1, training: {} });
  applyPackedState(copy, JSON.parse(JSON.stringify(packState(s))));
  expect(JSON.stringify(packState(copy))).toBe(JSON.stringify(packState(s)));
});
```

## AI fairness

```js
it('hard AI does not react faster than its reaction delay', () => {
  const s = newFight({ p1: 'goku', p2: 'bheem' });
  const ai = createAI({ charId: 'bheem', difficulty: 'hard', seed: 1 });
  const f = s.fighters[0];
  for (let i = 0; i < 90 && Math.abs(s.fighters[1].x - f.x) > 120; i++) { step(s, [fwd(f), ai.think(s, 1)]); }
  const startFrame = s.frame + 1;
  let blockedAt = -1;
  for (let i = 0; i < 30; i++) {
    const m = ai.think(s, 1);
    step(s, [i === 0 ? 32 /* HEAVY */ : 0, m]);
    if (blockedAt < 0 && (m & 128)) blockedAt = s.frame;
  }
  if (blockedAt >= 0) expect(blockedAt - startFrame).toBeGreaterThanOrEqual(9);
});
```

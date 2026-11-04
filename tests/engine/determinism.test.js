import { describe, it, expect } from 'vitest';
import { createMatch, step, cloneState, BTN } from '../../shared/index.js';
import { createAI } from '../../shared/ai/index.js';
import { packState, applyPackedState } from '../../shared/protocol.js';

const snap = (s) => JSON.stringify(packState(s));

function aiMatch(p1, p2, seed, frames = 60 * 60) {
  const s = createMatch({ p1, p2, stage: 'dojo', seed });
  const a = createAI({ charId: p1, difficulty: 'hard', seed: seed * 31 + 1 });
  const b = createAI({ charId: p2, difficulty: 'hard', seed: seed * 31 + 2 });
  const inputs = [0, 0];
  const trail = [];
  for (let i = 0; i < frames && s.phase !== 'matchEnd'; i++) {
    inputs[0] = a.think(s, 0) | 0; inputs[1] = b.think(s, 1) | 0;
    step(s, inputs);
    if (i % 600 === 0) trail.push(snap(s));
  }
  trail.push(snap(s));
  return { s, trail };
}

/** A fixed, busy input script (walks, attacks, specials, blocks, jumps) for both sides. */
const scripted = (i, side) => {
  const k = (i + side * 13) % 97;
  if (k < 20) return side ? BTN.LEFT : BTN.RIGHT;
  if (k < 23) return BTN.LIGHT;
  if (k < 30) return BTN.DOWN | BTN.HEAVY;
  if (k < 34) return BTN.SPECIAL | (k & 1 ? BTN.DOWN : 0);
  if (k < 50) return BTN.BLOCK | (k & 1 ? BTN.DOWN : 0);
  if (k < 53) return BTN.UP | BTN.RIGHT;
  if (k < 56) return BTN.HEAVY;
  if (k < 58) return BTN.THROW;
  return 0;
};

describe('determinism', () => {
  for (const [p1, p2, seed] of [['hattori', 'doraemon', 42], ['ben10', 'pikachu', 7], ['shinchan', 'nobita', 3]]) {
    it(`AI vs AI replays are identical: ${p1} vs ${p2}`, () => {
      const a = aiMatch(p1, p2, seed);
      const b = aiMatch(p1, p2, seed);
      expect(a.s.frame).toBeGreaterThan(600);
      expect(a.trail).toEqual(b.trail);
    });
  }

  it('cloneState continues identically to the original', () => {
    const s = createMatch({ p1: 'pikachu', p2: 'goku', stage: 'forest', seed: 9 });
    for (let i = 0; i < 500; i++) step(s, [scripted(i, 0), scripted(i, 1)]);
    const c = cloneState(s);
    for (let i = 500; i < 1400; i++) { const m = [scripted(i, 0), scripted(i, 1)]; step(s, m); step(c, m); }
    expect(snap(c)).toBe(snap(s));
  });

  it('a state restored from a packed snapshot resimulates identically (online reconciliation)', () => {
    const s = createMatch({ p1: 'bheem', p2: 'ben10', stage: 'village', seed: 5 });
    for (let i = 0; i < 700; i++) step(s, [scripted(i, 0), scripted(i, 1)]);
    const r = createMatch({ p1: 'bheem', p2: 'ben10', stage: 'village', seed: 5 });
    applyPackedState(r, JSON.parse(snap(s)));
    for (let i = 700; i < 1500; i++) { const m = [scripted(i, 0), scripted(i, 1)]; step(s, m); step(r, m); }
    expect(snap(r)).toBe(snap(s));
  });

  it('a different seed or input changes the outcome (the test can fail)', () => {
    const a = aiMatch('goku', 'bheem', 1, 1800).trail.at(-1);
    const b = aiMatch('goku', 'bheem', 2, 1800).trail.at(-1);
    expect(a).not.toBe(b);
  });

  it('the simulation never reads Math.random or the clock', () => {
    const rnd = Math.random, now = Date.now;
    Math.random = () => { throw new Error('Math.random used'); };
    Date.now = () => { throw new Error('Date.now used'); };
    try {
      expect(() => aiMatch('nobita', 'hattori', 11, 1200)).not.toThrow();
    } finally {
      Math.random = rnd; Date.now = now;
    }
  });
});

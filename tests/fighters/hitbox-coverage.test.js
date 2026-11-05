// Hitbox coverage after the canon-height body overhaul (Pikachu 120/84, Shinchan 138/94, ...).
// Everything here runs the real engine with scripted inputs; nothing is pure geometry.
import { describe, it, expect } from 'vitest';
import { getMove } from '../../shared/index.js';
import { ACTORS, BTN, actorFight, approach, press, hitBy, bodyOf } from '../helpers.js';

const SLOT_MASK = {
  light: BTN.LIGHT, heavy: BTN.HEAVY, crouchLight: BTN.DOWN | BTN.LIGHT, crouchHeavy: BTN.DOWN | BTN.HEAVY, throw: BTN.THROW,
  special1: BTN.SPECIAL, special2: BTN.RIGHT | BTN.SPECIAL, special3: BTN.DOWN | BTN.SPECIAL, ultimate: BTN.ULT,
};
const STANCES = [['standing', 0], ['crouching', BTN.DOWN]];

// Projectiles that may fly over a crouching opponent on purpose: slot -> tallest crouchH allowed to duck it.
// Nobita's pellet flies 104 px up: Shinchan, Pikachu, XLR8 and Goku duck it; everyone else is hit.
const DUCKABLE = { 'nobita.special1': 104 };

/** P1 presses `slot` once (direction/down held through the move) at the current spacing; true if it hits. */
function connects(s, slot, otherMask, frames = 90) {
  const mask = SLOT_MASK[slot];
  const hold = mask & (BTN.DOWN | BTN.SPECIAL);
  for (let i = 0; i < frames; i++) {
    const ev = press(s, 0, i < 2 ? mask : hold, 1, otherMask);
    if (hitBy(ev, 0, slot)) return true;
    if (slot === 'throw' && ev.some((e) => e.type === 'throw' && e.side === 0)) return true;
  }
  return false;
}

/** Jump forward from `gap`, press the air normal `t` ticks after take-off; true if it hits before landing. */
function jumpIn(A, D, slot, gap, t, otherMask) {
  const s = actorFight(A, D);
  approach(s, gap, otherMask);
  const btn = slot === 'airLight' ? BTN.LIGHT : BTN.HEAVY;
  for (let i = 0; i < 70; i++) {
    const m = i < 2 ? BTN.UP | BTN.RIGHT : i < t ? BTN.RIGHT : i < t + 2 ? btn : 0;
    if (hitBy(press(s, 0, m, 1, otherMask), 0, slot)) return true;
  }
  return false;
}

describe('close-range ground attacks reach every body', () => {
  for (const A of ACTORS) {
    it(`${A.key}: standing light and heavy hit every opponent standing and crouching`, () => {
      const misses = [];
      for (const slot of ['light', 'heavy']) for (const D of ACTORS) for (const [st, m2] of STANCES) {
        const s = actorFight(A, D);
        approach(s, 0, m2);
        if (!connects(s, slot, m2)) misses.push(`${slot} vs ${D.key} ${st}`);
      }
      expect(misses).toEqual([]);
    });

    it(`${A.key}: every other grounded hitbox move (lows, throw, specials, ultimate) connects point blank`, () => {
      const misses = [];
      for (const slot of ['crouchLight', 'crouchHeavy', 'throw', 'special1', 'special2', 'special3', 'ultimate']) {
        const mv = getMove(A.id, slot, A.form);
        if (!mv || !mv.hitbox || mv.air) continue;
        for (const D of ACTORS) for (const [st, m2] of STANCES) {
          const s = actorFight(A, D);
          approach(s, 0, m2);
          if (!connects(s, slot, m2)) misses.push(`${slot} vs ${D.key} ${st}`);
        }
      }
      expect(misses).toEqual([]);
    });
  }
});

describe('jump-ins still hit short opponents', () => {
  for (const A of ACTORS) {
    it(`${A.key}: air light and air heavy can hit every opponent standing and crouching`, () => {
      const misses = [];
      for (const slot of ['airLight', 'airHeavy']) for (const D of ACTORS) for (const [st, m2] of STANCES) {
        let ok = false;
        for (let gap = 40; gap <= 200 && !ok; gap += 40) for (let t = 4; t <= 30 && !ok; t += 2) ok = jumpIn(A, D, slot, gap, t, m2);
        if (!ok) misses.push(`${slot} vs ${D.key} ${st}`);
      }
      expect(misses).toEqual([]);
    });
  }
});

describe('projectiles do not fly over short fighters', () => {
  for (const A of ACTORS) {
    const slots = ['special1', 'special2', 'special3', 'ultimate'].filter((sl) => getMove(A.id, sl, A.form)?.projectile);
    if (!slots.length) continue;
    it(`${A.key}: ${slots.join(', ')} hit every standing and crouching opponent at mid range`, () => {
      const misses = [];
      for (const slot of slots) for (const D of ACTORS) for (const [st, m2] of STANCES) {
        const duck = DUCKABLE[`${A.key}.${slot}`];
        if (st === 'crouching' && duck && bodyOf(D).crouchH <= duck) continue;
        const s = actorFight(A, D);
        approach(s, 120, m2);
        if (!connects(s, slot, m2, 150)) misses.push(`${slot} vs ${D.key} ${st}`);
      }
      expect(misses).toEqual([]);
    });
  }

  it('the pellet is the only duckable projectile and still hits tall crouchers (Bheem)', () => {
    expect(Object.keys(DUCKABLE)).toEqual(['nobita.special1']);
    const s = actorFight({ id: 'nobita', form: null }, { id: 'bheem', form: null });
    approach(s, 120, BTN.DOWN);
    expect(connects(s, 'special1', BTN.DOWN, 150)).toBe(true);
  });
});

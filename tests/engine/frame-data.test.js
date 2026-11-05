import { describe, it, expect } from 'vitest';
import { getMove } from '../../shared/index.js';
import { ACTORS, BTN, actorFight, approach, press, run, hitBy } from '../helpers.js';

const GROUND = { light: BTN.LIGHT, heavy: BTN.HEAVY, crouchLight: BTN.DOWN | BTN.LIGHT, crouchHeavy: BTN.DOWN | BTN.HEAVY };

/** Presses a slot from neutral and records the phase seen on every tick until the fighter can act again. */
function trace(A, slot) {
  const s = actorFight(A, A);
  press(s, 0, GROUND[slot], 1);
  const f = s.fighters[0];
  const t = { started: f.action === 'attack' && f.moveId === slot, ticks: 1, firstActive: -1, active: 0 };
  while (f.action === 'attack' && t.ticks < 300) {
    run(s, 1);
    if (f.action !== 'attack') break;
    t.ticks++;
    if (f.movePhase === 'active') { t.active++; if (t.firstActive < 0) t.firstActive = f.moveFrame; }
  }
  return t;
}

describe('frame data resolution', () => {
  for (const A of ACTORS) {
    it(`${A.key}: ground normals run startup, active and recovery exactly (whiff)`, () => {
      for (const slot of Object.keys(GROUND)) {
        const mv = getMove(A.id, slot, A.form);
        const t = trace(A, slot);
        expect(t.started, `${slot} starts`).toBe(true);
        expect(t.firstActive, `${slot} first active frame`).toBe(mv.startup + 1);
        expect(t.active, `${slot} active frames`).toBe(mv.active);
        expect(t.ticks, `${slot} total frames`).toBe(mv.startup + mv.active + mv.recovery);
      }
    });
  }

  it('a close light connects on its first active frame', () => {
    for (const A of ACTORS) {
      const mv = getMove(A.id, 'light', A.form);
      const s = actorFight(A, { id: 'bheem', form: null });
      approach(s, 0);
      const f = s.fighters[0];
      let frameOfHit = -1;
      for (let i = 0; i < 40 && frameOfHit < 0; i++) {
        const ev = press(s, 0, i === 0 ? BTN.LIGHT : 0, 1);
        if (hitBy(ev, 0, 'light')) frameOfHit = f.moveFrame;
      }
      expect(frameOfHit, A.key).toBe(mv.startup + 1);
    }
  });

  it('light is faster than heavy for every fighter and form', () => {
    for (const A of ACTORS) {
      expect(getMove(A.id, 'light', A.form).startup, A.key).toBeLessThan(getMove(A.id, 'heavy', A.form).startup);
    }
  });
});

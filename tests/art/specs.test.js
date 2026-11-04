// Every fighter / form art spec builds, matches its engine body, and draws every part and expression.
// The art files are Phaser-free (Canvas2D drawers), so a recording fake context is enough.
import { describe, it, expect } from 'vitest';
import { getSpec, bodyFor, FORMS, EXPRS } from '@/game/art/chars.js';
import { drawFigure } from '@/game/art/figure.js';
import { NB } from '@/game/art/rig.js';
import { IDLE, POSES } from '@/game/art/poses.js';
import { FIGHTER_IDS } from '@shared/index.js';
import { getStats } from '@shared/fighters/index.js';
import { fakeCtx } from './fakeCtx.js';

const KNOWN_DYN = new Set(['trail', 'ear', 'flame', 'prop', 'staffHand', 'staffBack', 'tailBob']);
const LOOKS = [];
for (const id of FIGHTER_IDS) for (const form of [null, ...(FORMS[id] || [])]) LOOKS.push({ id, form, key: form ? `${id}:${form}` : id });

describe('art specs', () => {
  it('cover every fighter and every Ben 10 form', () => {
    expect(LOOKS.length).toBe(FIGHTER_IDS.length + 3);
    expect(FORMS.ben10.slice().sort()).toEqual(['fourarms', 'heatblast', 'xlr8']);
    expect(EXPRS).toEqual(['blink', 'hurt', 'shout']);
  });

  for (const L of LOOKS) {
    describe(L.key, () => {
      const spec = getSpec(L.id, L.form);

      it('scales to the engine body: k = body.h / H within 0.85..1.15', () => {
        const eb = getStats(L.id, L.form).body;
        expect(spec.body).toEqual(bodyFor(L.id, L.form));
        expect(spec.body.h).toBe(eb.h);
        expect(spec.body.crouchH).toBe(eb.crouchH);
        expect(spec.k).toBeCloseTo(spec.body.h / spec.H, 9);
        expect(spec.k).toBeGreaterThanOrEqual(0.85);
        expect(spec.k).toBeLessThanOrEqual(1.15);
        expect(spec.form).toBe(L.form);
      });

      it('has well-formed, uniquely named parts (the atlas keys frames by part name)', () => {
        expect(spec.parts.length).toBeGreaterThan(8);
        const names = spec.parts.map((p) => p.name);
        expect(names.filter((n, i) => names.indexOf(n) !== i), 'duplicate part names').toEqual([]);
        for (const p of spec.parts) {
          expect(typeof p.draw, p.name).toBe('function');
          expect(Number.isInteger(p.bone) && p.bone >= 0 && p.bone < NB, `${p.name} bone`).toBe(true);
          const [x0, y0, x1, y1] = p.box;
          expect([x0, y0, x1, y1].every(Number.isFinite) && x1 > x0 && y1 > y0, `${p.name} box ${p.box}`).toBe(true);
          if (p.dyn) expect(KNOWN_DYN.has(p.dyn), `${p.name} dyn ${p.dyn}`).toBe(true);
        }
      });

      it('has a head part with blink, hurt and shout variants that each draw differently', () => {
        const head = spec.parts.find((p) => p.name === 'head');
        expect(head).toBeDefined();
        expect(head.variants).toEqual(expect.arrayContaining(['blink', 'hurt', 'shout']));
        const logs = {};
        for (const e of ['normal', ...EXPRS]) {
          const ctx = fakeCtx();
          head.draw(ctx, e === 'normal' ? undefined : e);
          expect(ctx.__bad, `head ${e}`).toEqual([]);
          logs[e] = ctx.__log.join(';');
        }
        for (const e of EXPRS) expect(logs[e], `head@${e} differs from normal`).not.toBe(logs.normal);
      });

      it('draws every part and the posed figure with finite numbers and balanced save/restore', () => {
        for (const p of spec.parts) {
          for (const v of [undefined, ...(p.variants || [])]) {
            const ctx = fakeCtx();
            expect(() => p.draw(ctx, v), `${p.name}@${v}`).not.toThrow();
            expect(ctx.__bad, `${p.name}@${v}`).toEqual([]);
            expect(ctx.__depth, `${p.name}@${v} save/restore`).toBe(0);
          }
        }
        for (const pose of [IDLE, POSES.crouch, POSES.jump, POSES.win]) {
          const ctx = fakeCtx();
          const bones = drawFigure(ctx, spec, pose, { show: { prop: 1, staffHand: 1 }, expr: 'shout' });
          expect(ctx.__bad).toEqual([]);
          expect(Array.from(bones).every(Number.isFinite)).toBe(true);
        }
      });
    });
  }
});

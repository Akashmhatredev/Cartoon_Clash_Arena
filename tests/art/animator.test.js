// The render-only Animator: every action and move animates without NaN, and it never writes the engine state.
import { describe, it, expect } from 'vitest';
import { Animator } from '@/game/art/animator.js';
import { getSpec, FORMS } from '@/game/art/chars.js';
import { createMatch, step, FIGHTER_IDS, getFighter } from '@shared/index.js';
import { SLOTS, getMove } from '@shared/fighters/index.js';
import { createAI } from '@shared/ai/index.js';
import { packState } from '@shared/protocol.js';

const DT = 1 / 60;
const EXPR = new Set(['normal', 'blink', 'hurt', 'shout']);

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) deepFreeze(o[k]); }
  return o;
}

/** A real engine fighter (side 0) with the given overrides, deep-frozen so any write by the animator throws. */
function fighterState(id, form, over) {
  const s = createMatch({ p1: id, p2: 'goku', stage: 'island', seed: 1, training: {} });
  const f = s.fighters[0];
  Object.assign(f, { form, action: 'idle' }, over);
  return deepFreeze(JSON.parse(JSON.stringify(f)));
}

const legLen = (id, form) => { const s = getSpec(id, form); return (s.uLeg + s.lLeg + s.footH) * s.k; };

function animate(an, f, frames, ll) {
  const snapshot = JSON.stringify(f);
  for (let i = 0; i < frames; i++) an.update(f, DT, ll);
  const out = { finite: Array.from(an.cur).every(Number.isFinite) && [an.sx, an.sy, an.spin].every(Number.isFinite) };
  out.expr = an.expr; out.anim = an.anim; out.same = JSON.stringify(f) === snapshot;
  return out;
}

const ACTIONS = [
  ['idle', {}], ['walk', { vx: 4 }], ['walk', { vx: -3 }], ['crouch', { crouching: true }],
  ['jump', { grounded: false, vy: -15, vx: 4 }], ['jump', { grounded: false, vy: 0 }], ['jump', { grounded: false, vy: 12 }],
  ['dash', { vx: 10 }], ['backdash', { vx: -8 }], ['block', { blocking: 'high' }], ['block', { blocking: 'low', crouching: true }],
  ['blockstun', { blocking: 'high' }], ['hitstun', { hitFlash: 6 }], ['hitstun', { grounded: false, vy: -4 }],
  ['hitstun', { crouching: true }], ['launched', { grounded: false, vy: -9, actionFrame: 30 }], ['knockdown', {}], ['getup', {}],
  ['grabbed', {}], ['ko', { ko: true }], ['ko', { ko: true, grounded: false, vy: 5 }], ['win', {}], ['lose', {}], ['intro', {}],
  ['dance', {}], // unknown actions fall back to idle
];

const LOOKS = [];
for (const id of FIGHTER_IDS) for (const form of [null, ...(FORMS[id] || [])]) LOOKS.push({ id, form, key: form ? `${id}:${form}` : id });

describe('Animator', () => {
  for (const L of LOOKS) {
    it(`${L.key}: every action animates without NaN and without touching the state`, () => {
      const ll = legLen(L.id, L.form);
      const an = new Animator(L.id, 0);
      for (const [action, over] of ACTIONS) {
        const r = animate(an, fighterState(L.id, L.form, { action, ...over }), 20, ll);
        expect(r.finite, action).toBe(true);
        expect(r.same, action).toBe(true);
        expect(EXPR.has(r.expr), `${action} expr ${r.expr}`).toBe(true);
        expect(typeof r.anim, action).toBe('string');
      }
    });

    it(`${L.key}: every move animates through startup, active and recovery`, () => {
      const ll = legLen(L.id, L.form);
      const an = new Animator(L.id, 1);
      for (const slot of SLOTS) {
        const mv = getMove(L.id, slot, L.form);
        if (!mv) continue;
        const air = !!mv.air;
        const total = mv.startup + mv.active + mv.recovery;
        for (let t = 0; t <= total; t += Math.max(1, (total / 8) | 0)) {
          const phase = t <= mv.startup ? 'startup' : t <= mv.startup + mv.active ? 'active' : 'recovery';
          const f = fighterState(L.id, L.form, {
            action: 'attack', moveId: slot, moveFrame: t, movePhase: phase, grounded: !air, vy: air ? 3 : 0,
            crouching: slot.startsWith('crouch'), charge: mv.charge && phase === 'startup' ? 10 : 0,
          });
          const r = animate(an, f, 3, ll);
          expect(r.finite, `${slot} ${phase}`).toBe(true);
          expect(r.same, `${slot} ${phase}`).toBe(true);
          if (phase === 'active') expect(r.expr, `${slot} shouts on active frames`).toBe('shout');
        }
      }
    });
  }

  it('survives hitches: zero, negative and huge dt values', () => {
    const an = new Animator('pikachu', 0);
    const f = fighterState('pikachu', null, { action: 'hitstun' });
    for (const dt of [0, -1, 5, 1e-6, 0.25]) an.update(f, dt, 40);
    expect(Array.from(an.cur).every(Number.isFinite)).toBe(true);
  });

  it('never mutates live engine state during a real AI match (with Ben 10 transforming)', () => {
    const play = (withAnimators) => {
      const s = createMatch({ p1: 'ben10', p2: 'doraemon', stage: 'neon_city', seed: 21 });
      const ai = [createAI({ charId: 'ben10', difficulty: 'hard', seed: 3 }), createAI({ charId: 'doraemon', difficulty: 'hard', seed: 4 })];
      const an = [new Animator('ben10', 0), new Animator('doraemon', 1)];
      const inputs = [0, 0];
      const forms = new Set();
      let mutated = 0, nan = 0;
      for (let i = 0; i < 60 * 40 && s.phase !== 'matchEnd'; i++) {
        inputs[0] = ai[0].think(s, 0) | 0; inputs[1] = ai[1].think(s, 1) | 0;
        step(s, inputs);
        forms.add(s.fighters[0].form);
        if (withAnimators) {
          for (let k = 0; k < 2; k++) {
            const f = s.fighters[k];
            const before = JSON.stringify(f);
            an[k].update(f, DT, 60);
            if (JSON.stringify(f) !== before) mutated++;
            if (!Array.from(an[k].cur).every(Number.isFinite)) nan++;
          }
        }
      }
      return { snap: JSON.stringify(packState(s)), mutated, nan, forms };
    };
    const a = play(true), b = play(false);
    expect(a.mutated, 'frames where the animator changed fighter state').toBe(0);
    expect(a.nan, 'animator frames with NaN joints').toBe(0);
    expect(a.snap).toBe(b.snap);
    expect(a.forms.size).toBeGreaterThan(1);
  });

  it('knows every move anim the fighter data uses', async () => {
    const { ATTACKS } = await import('@/game/art/poses.js');
    const missing = [];
    for (const id of FIGHTER_IDS) {
      const d = getFighter(id);
      const sets = [d.moves, ...Object.values(d.forms || {}).map((fo) => fo.moves || {})];
      for (const moves of sets) for (const slot in moves) if (!ATTACKS[moves[slot].anim]) missing.push(`${id}.${slot}:${moves[slot].anim}`);
    }
    expect(missing).toEqual([]);
  });
});

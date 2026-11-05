// Deterministic input-scripting helpers shared by the engine tests (see engine-testing skill).
import { createMatch, step, BTN, cloneState, FIGHTER_IDS, getFighter } from '../shared/index.js';
import { getStats } from '../shared/fighters/index.js';

export { BTN, step, cloneState };

export function newFight(opts = {}) {
  // training: {} skips the intro and never ends rounds; pass training: null for real rounds (then run(state, 100) first)
  return createMatch({ p1: 'goku', p2: 'bheem', stage: 'island', seed: 1, training: {}, ...opts });
}

/** Hold `mask` for `side` during `frames` ticks; the other side holds `otherMask`. Returns all events seen. */
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

/** Every playable body: base fighters plus Ben 10's forms, as { id, form, key }. */
export const ACTORS = [];
for (const id of FIGHTER_IDS) {
  ACTORS.push({ id, form: null, key: id });
  for (const form of Object.keys(getFighter(id).forms || {})) ACTORS.push({ id, form, key: `${id}:${form}` });
}

export const bodyOf = (a) => getStats(a.id, a.form).body;

/** Training match between two actors (forms applied directly; formTime 0 means the form never times out). */
export function actorFight(A, D, opts = {}) {
  const s = createMatch({ p1: A.id, p2: D.id, stage: 'island', seed: 1, training: { infiniteMeter: true }, ...opts });
  const [f, o] = s.fighters;
  if (A.form) { f.form = A.form; f.ammo = 3; }
  if (D.form) { o.form = D.form; o.ammo = 3; }
  return s;
}

/**
 * P1 walks forward until the gap between the two bodies is <= gap (0 = touching; the push box stops it there),
 * then both idle for a few ticks so walk -> idle and P2's crouch (otherMask) settle. Returns the final gap.
 */
export function approach(state, gap, otherMask = 0) {
  const [f, o] = state.fighters;
  const minD = (getStats(f.charId, f.form).body.w + getStats(o.charId, o.form).body.w) / 2;
  for (let i = 0; i < 400 && Math.abs(o.x - f.x) > minD + gap + 0.01; i++) step(state, [fwd(f), otherMask]);
  press(state, 0, 0, 12, otherMask);
  return Math.abs(o.x - f.x) - minD;
}

/** First 'hit' event from `side` matching `moveId` in an event list, or undefined. */
export const hitBy = (events, side, moveId) => events.find((e) => e.type === 'hit' && e.side === side && (!moveId || e.moveId === moveId));

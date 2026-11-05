// Phaser-free pose animator for one fighter. Each frame it builds a target pose from the engine state and the
// character's motion personality, then drives every joint with its own damped spring.
//
// Two kinds of motion are mixed per joint through a feed-forward weight (ff):
//  - keyed motion (attacks, gait, jump arcs, dashes, get-ups) is a deterministic function of the engine's frame
//    counters, so a strike is fully out on the first active frame whatever the render rate. With ff = 1 a joint
//    follows the keyed curve exactly and its spring only absorbs the offset left by a state change
//    (inertialized blending: no pops, no lag, momentum carries over);
//  - soft motion (head, forearms, tail, reactions) keeps a share of its spring lag, which gives drag, overlap and
//    follow-through so nothing moves in robotic lockstep.
// Render-only: it reads fighter state and never writes it, and it allocates nothing per frame after warm-up.
import { getMove } from '@shared/index.js';
import { J, NJ, JOINT_KEYS, makePose } from './rig.js';
import { POSES, ATTACKS, IDLE, CROUCH, AIR_LEG_POSE, OWN_LEGS, guessAnim, overlayLegs, lerpPose } from './poses.js';
import { motionFor } from './motion.js';

const TAU = Math.PI * 2;
const D2R = Math.PI / 180;
const MAX_STEP = 1 / 240; // spring sub-step (s)
const VMAX = 2400;        // joint speed cap (deg/s or px/s) so impulses can never fling a limb through the body
const GETUP_FRAMES = 14;  // engine get-up length (shared/engine)

const table = (def, ...pairs) => {
  const a = new Float32Array(NJ).fill(def);
  for (let k = 0; k < pairs.length; k += 2) for (const i of pairs[k]) a[i] = pairs[k + 1];
  return a;
};
const ROOT = [J.RX, J.RY, J.ROT];
const LEGS = [J.LUF, J.LLF, J.LUB, J.LLB];
const FEET = [J.FTF, J.FTB];
const ARM_U = [J.AUF, J.AUB];
const ARM_L = [J.ALF, J.ALB];
const SCALE = [J.SX, J.SY];

// spring response per joint: hips lead, torso follows, head, forearms and tail trail and overshoot a little
const MUL = table(1, [J.TOR], 0.86, [J.HEAD], 0.62, ARM_U, 0.92, ARM_L, 0.74, LEGS, 1.2, FEET, 1.05, [J.TAIL], 0.42, SCALE, 1.1);
const ZETA = table(0.9, [J.ROT], 0.78, [J.TOR], 0.66, [J.HEAD], 0.5, ARM_U, 0.62, ARM_L, 0.52, LEGS, 0.86, FEET, 0.9, [J.TAIL], 0.3, SCALE, 0.45);

// feed-forward profiles (1 = follow the keyed curve exactly, 0 = pure spring)
const FF_NONE = new Float32Array(NJ);
const FF_KEY = table(1, [J.HEAD], 0.55, [J.TAIL], 0.25);
const FF_GAIT = table(1, [J.TOR], 0.6, ARM_U, 0.5, ARM_L, 0.3, [J.HEAD], 0.35, [J.TAIL], 0.2);
const FF_IDLE = table(0.75, ARM_U, 0.5, ARM_L, 0.35, [J.HEAD], 0.35, [J.TAIL], 0.2);
const FF_AIR = table(0.55, ROOT, 1, [J.TOR], 0.6, ARM_U, 0.4, ARM_L, 0.25, [J.HEAD], 0.3, [J.TAIL], 0.15);
const FF_SOFT = table(0.45, [J.HEAD], 0.2, ARM_L, 0.2, [J.TAIL], 0.1);
const FF_TUMBLE = table(0.2, [J.ROT, J.RX, J.RY], 1, [J.TAIL], 0.05);

// snap lead: share of the snap a joint fires early. Hips and legs go first, the striking hand arrives last (whip).
const LEAD_ARM = table(0.5, ROOT, 1, LEGS, 0.8, FEET, 0.8, [J.TOR], 0.65, [J.HEAD], 0.4, [J.AUB, J.ALB], 0.55, [J.AUF], 0.25, [J.ALF], 0, [J.TAIL], 0);
const LEAD_LEG = table(0.5, ROOT, 1, [J.TOR], 0.7, [J.HEAD], 0.4, ARM_U, 0.6, ARM_L, 0.6, [J.LUB, J.LLB, J.FTB], 0.85, [J.LUF], 0.25, [J.LLF, J.FTF], 0, [J.TAIL], 0);
const LEAD_BODY = table(0.4, ROOT, 0.8, [J.TOR], 0.6, ARM_L, 0.1, [J.TAIL], 0);
// share of the character's stance carried into attack keys (legs keep their stance, the striking arm is absolute)
const ADD = table(0, LEGS, 1, FEET, 1, [J.TOR, J.HEAD, J.ROT], 0.5, [J.AUB, J.ALB], 0.3);
// which joints overshoot past the strike (and how much of the computed amount)
const OVR = table(1, [J.RX, J.RY], 0.6, SCALE, 0, [J.TAIL], 0, [J.HEAD], 0.5);

const AIR_BASE = new Float32Array(NJ);
lerpPose(AIR_BASE, POSES.jump, POSES.fall, 0.5);
overlayLegs(AIR_BASE, AIR_LEG_POSE, false);

const HURT = { hitstun: 1, launched: 1, grabbed: 1, knockdown: 1, ko: 1, lose: 1 };
const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function lim(p, vel, i, lo, hi) {
  if (p[i] < lo) { p[i] = lo; if (vel && vel[i] < 0) vel[i] = 0; }
  else if (p[i] > hi) { p[i] = hi; if (vel && vel[i] > 0) vel[i] = 0; }
}
const deltaPose = (o) => {
  const p = new Float32Array(NJ);
  if (o) for (let i = 0; i < NJ; i++) if (o[JOINT_KEYS[i]] !== undefined) p[i] = o[JOINT_KEYS[i]];
  return p;
};

export class Animator {
  constructor(charId, side = 0) {
    this.charId = charId;
    this.side = side | 0;
    this.cur = new Float32Array(NJ);
    this.vel = new Float32Array(NJ);
    this.tgt = new Float32Array(NJ);
    this.prev = new Float32Array(NJ);    // last frame's target (feed-forward reference)
    this.tv = new Float32Array(NJ);      // target velocity, carried into the springs on a cut
    this.ff = new Float32Array(NJ);
    this.ffPrev = new Float32Array(NJ);
    this.from = new Float32Array(NJ);    // pose captured when a move starts (the wind-up blends from here)
    this.stance = new Float32Array(NJ);
    this.winPose = new Float32Array(NJ);
    this.losePose = new Float32Array(NJ);
    this.introPose = new Float32Array(NJ);
    this.fidgetPose = new Float32Array(NJ);
    this.formKey = undefined;
    this.m = null;
    this._useForm(null);
    this.cur.set(this.stance);
    this.prev.set(this.stance);
    this.t = this.side * 0.37 + (charId.length % 5) * 0.21; // de-sync the two fighters
    this.cut = true;
    this.lastAction = null;
    this.actionT = 0;
    this.af = -1; this.afFrac = 0;       // engine actionFrame + sub-tick fraction
    this.mvId = null; this.mvMf = -1; this.mvFrac = 0; this.activeT = 0; this.altLast = 0;
    this.walkPhase = 0; this.walkDir = 1;
    this.vy0 = -1; this.fallVy = 0; this.flipDir = 0; this.airKind = 0;
    this.landT = 9; this.landAmt = 0;
    this.hitN = 0; this.hitStr = 1; this.blockT = 9; this.lastStun = 0;
    this.fidIn = 3 + this.side; this.fidT = -1;
    this.wasGrounded = true;
    this.air = 0;         // 0 = feet snapped to the floor, 1 = hip anchored (airborne), see FighterView
    this.sq = 1;          // squash/stretch spring (1 = rest)
    this.sqVel = 0;
    this.anim = 'idle';
    this.phase = null;
    this.pole = false;
    this.expr = 'normal';
    this.sx = 1; this.sy = 1;
    this.spin = 1;
    this.blinkIn = 1.5 + (this.side ? 0.9 : 0);
    this.blinkT = 0;
    this.lastHitFlash = 0;
    this.moveCache = {};
    this.seed = (0x9e3779b9 ^ (this.side * 7919 + charId.length * 131)) >>> 0;
  }

  _rnd() { // render-only noise (never touches the simulation)
    let s = this.seed;
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    this.seed = s;
    return s / 4294967296;
  }

  _useForm(form) {
    const key = form || 'base';
    if (this.formKey === key) return;
    const had = this.formKey !== undefined;
    this.formKey = key;
    const m = this.m = motionFor(this.charId, form);
    this.stance.set(makePose(m.stance, IDLE));
    this.winPose.set(m.win ? makePose(m.win, POSES.win) : POSES.win);
    this.losePose.set(m.lose ? makePose(m.lose, POSES.lose) : POSES.lose);
    this.introPose.set(m.intro ? makePose(m.intro, POSES.intro) : POSES.intro);
    this.fidgetPose.set(deltaPose(m.fidget && m.fidget.pose));
    if (had) this.cut = true;
  }

  // ---------------------------------------------------------------- move plans (cached per form and move)
  _plan(f) {
    const id = f.moveId;
    if (!id) return null;
    const fk = f.form || '_';
    const byForm = this.moveCache[fk] || (this.moveCache[fk] = {});
    let e = byForm[id];
    if (e === undefined) e = byForm[id] = this._makePlan(id, f.form || null);
    return e;
  }

  _makePlan(id, form) {
    let mv = null;
    try { mv = getMove(this.charId, id, form); } catch { mv = null; }
    let anim = mv && ATTACKS[mv.anim] ? mv.anim : guessAnim(id);
    if (!ATTACKS[anim]) anim = 'punch';
    const set = ATTACKS[anim];
    const crouch = id === 'crouchLight' || id === 'crouchHeavy';
    const air = !!(mv && mv.air);
    const own = !!OWN_LEGS[anim];
    const base = crouch ? CROUCH : air ? AIR_BASE : this.stance;
    const stance = this.stance;
    const adj = (src) => {
      const p = new Float32Array(NJ);
      for (let i = 0; i < NJ; i++) p[i] = src[i] + (own && ADD[i] === 1 ? 0 : (stance[i] - IDLE[i]) * ADD[i]);
      if (!own) {
        if (crouch) overlayLegs(p, CROUCH);
        else if (air) overlayLegs(p, AIR_LEG_POSE, false);
      }
      return p;
    };
    const w = adj(set.w), s = adj(set.s);
    let r;
    if (set.r) r = adj(set.r);
    else { // follow-through: the body keeps travelling a little, the arms start to come home
      r = new Float32Array(s);
      for (let i = 0; i < NJ; i++) {
        if (i === J.TOR || i === J.ROT || i === J.RX) r[i] = s[i] + (s[i] - w[i]) * 0.08;
        else if (i >= J.AUF && i <= J.ALB) r[i] = s[i] + (base[i] - s[i]) * 0.3;
      }
    }
    const alt = set.alt ? adj(set.alt) : null;
    const lead = set.limb === 'leg' ? LEAD_LEG : set.limb === 'body' ? LEAD_BODY : LEAD_ARM;
    const amp = new Float32Array(NJ);
    const ov = set.ov * this.m.snap;
    for (let i = 0; i < NJ; i++) {
      const cap = i === J.RX || i === J.RY ? 3 : 11;
      amp[i] = clamp((s[i] - w[i]) * ov * OVR[i], -cap, cap);
    }
    return {
      mv, anim, crouch, air, base, w, s, r, alt, lead, amp, limb: set.limb,
      pole: !!(mv && /pole/i.test(String(mv.name || ''))), iv: (mv && mv.hitInterval) || 4,
    };
  }

  /** Kick the springs (velocity impulse in deg/s or px/s). */
  impulse(j, v) { this.vel[j] += v; }

  // ---------------------------------------------------------------- targets
  _idle(tgt, f, dt) {
    const m = this.m, t = this.t;
    tgt.set(this.stance);
    const amp = m.bounce.amp;
    const ph = t * TAU * m.bounce.hz;
    const flex = amp * (0.5 + 0.5 * Math.sin(ph));
    tgt[J.LUF] += flex * 0.7; tgt[J.LLF] -= flex * 1.4;
    tgt[J.LUB] += flex * 0.7; tgt[J.LLB] -= flex * 1.4;
    // the upper body rides the knees a beat later and the head counters to keep the eyes level
    const l1 = Math.sin(ph - 0.7), l2 = Math.sin(ph - 1.4);
    tgt[J.TOR] += amp * 0.3 * l1;
    tgt[J.HEAD] -= amp * 0.22 * l1;
    tgt[J.AUF] += amp * 0.6 * l1; tgt[J.AUB] += amp * 0.5 * l1;
    tgt[J.ALF] -= amp * 0.9 * l2; tgt[J.ALB] -= amp * 0.8 * l2;
    const br = Math.sin(t * TAU * 0.31);
    tgt[J.TOR] += br * m.breathe * 0.6;
    tgt[J.HEAD] -= br * m.breathe * 0.4;
    tgt[J.AUF] += br * m.breathe; tgt[J.AUB] += br * m.breathe * 0.8;
    tgt[J.SY] *= 1 + br * 0.006 * m.breathe;
    tgt[J.RX] += Math.sin(t * TAU * 0.21) * m.sway + Math.sin(t * TAU * 0.13 + 1) * m.sway * 0.5;
    if (m.wiggle) tgt[J.ROT] += Math.sin(t * TAU * 1.1) * m.wiggle;
    if (m.tremble) { tgt[J.RX] += Math.sin(t * 71) * m.tremble; tgt[J.ALF] += Math.sin(t * 53) * m.tremble * 2; }
    tgt[J.TAIL] += Math.sin(t * TAU * 0.6) * 10 + Math.sin(t * TAU * 1.7) * 3;
    // an occasional habit (glance, shrug, glasses push) so a waiting fighter never looks frozen
    const fd = m.fidget;
    if (fd) {
      if (this.fidT >= 0) {
        this.fidT += dt;
        const p = this.fidT / fd.dur;
        if (p >= 1) { this.fidT = -1; this.fidIn = fd.every * (0.7 + 0.6 * this._rnd()); }
        else {
          const env = Math.sin(Math.PI * p);
          const k = env * env * (1.4 - 0.4 * env);
          for (let i = 0; i < NJ; i++) tgt[i] += this.fidgetPose[i] * k;
        }
      } else if (this.actionT > 1.2) {
        this.fidIn -= dt;
        if (this.fidIn <= 0) this.fidT = 0;
      }
    }
    this.ff.set(FF_IDLE);
  }

  _leg(tgt, iu, il, ift, ph, A, sinA, w, rot) {
    const duty = w.duty;
    let th, knee, ft;
    if (ph < duty) { // stance: the ankle slides back in a straight line at ground speed (planted foot)
      const s = ph / duty;
      th = Math.asin(sinA * (1 - 2 * s)) / D2R;
      knee = -6 - w.absorb * Math.sin(Math.PI * s);
      ft = rot - (s > 0.7 ? (s - 0.7) * 70 : 0); // heel peels off before toe-off
    } else { // swing: the knee folds and the foot comes through
      const s = (ph - duty) / (1 - duty);
      th = -A + 2 * A * (s * s * (3 - 2 * s));
      knee = -6 - w.lift * Math.sin(Math.PI * s);
      ft = rot - 22 * (1 - s) * (1 - s) + 12 * s * s; // toe down off the floor, toe up for the heel strike
    }
    tgt[iu] = th - knee * 0.5; // a bent knee pushes the thigh forward so the ankle stays on its line
    tgt[il] = knee;
    tgt[ift] = ft;
    return th;
  }

  _walk(tgt, f, dt, legLen) {
    const m = this.m, w = m.walk;
    const fwd = (f.vx || 0) * (f.facing || 1);
    const dirT = fwd < -0.01 ? -1 : 1;
    if (this.cut) { this.walkPhase = dirT > 0 ? 0.02 : 0.52; this.walkDir = dirT; }
    this.walkDir += (dirT - this.walkDir) * (1 - Math.exp(-dt * 12));
    const slowed = !!(f.buffs && f.buffs.slowed > 0);
    const speed = Math.abs(f.vx || 0) * 60 * (slowed ? 0.5 : 1) * (1 - w.skate);
    const A = dirT < 0 ? w.swing * 0.8 : w.swing;
    const sinA = Math.sin(A * D2R);
    const L = Math.max(20, legLen) * (1 - w.absorb * 0.003);
    // one cycle = two steps; the stance foot covers 2 L sin(A) while the body travels speed * duty * period
    const rate = speed * w.duty / (2 * L * sinA);
    let ph = this.walkPhase + dt * rate * dirT;
    ph -= Math.floor(ph);
    this.walkPhase = ph;

    tgt.set(this.stance);
    lerpPose(tgt, tgt, IDLE, 0.15); // the guard relaxes a touch on the move
    const rot = tgt[J.ROT];
    const xf = this._leg(tgt, J.LUF, J.LLF, J.FTF, ph, A, sinA, w, rot) / A;
    let pb = ph + 0.5; if (pb >= 1) pb -= 1;
    this._leg(tgt, J.LUB, J.LLB, J.FTB, pb, A, sinA, w, rot);
    // passing position (mid-stance of either leg) is the high point; heel strike is the low point
    const pass = Math.cos((ph - w.duty * 0.5) * TAU * 2);
    const wd = this.walkDir, fw = 0.5 + 0.5 * wd;
    tgt[J.RY] -= w.bob * (0.5 + 0.5 * pass);
    if (w.duty < 0.5) { // hopping gait: both feet leave the floor between steps
      const h = ph < 0.5 ? ph : ph - 0.5;
      if (h > w.duty) tgt[J.RY] -= w.hop * Math.sin(Math.PI * (h - w.duty) / (0.5 - w.duty));
    }
    tgt[J.TOR] += m.weight * m.weight * 3 * (0.5 - 0.5 * pass); // heavy footfall
    tgt[J.TOR] += w.lean * fw - w.backLean * (1 - fw) - 1.4 * pass;
    tgt[J.HEAD] += 1.1 * pass - (w.lean * fw - w.backLean * (1 - fw)) * 0.4;
    tgt[J.ROT] += (w.lean * fw - w.backLean * (1 - fw)) * 0.3;
    // arms swing against the legs; forearms drag behind on their softer springs
    tgt[J.AUF] -= w.arm * xf; tgt[J.AUB] += w.arm * xf;
    tgt[J.ALF] += w.arm * 0.35 * xf; tgt[J.ALB] -= w.arm * 0.35 * xf;
    if (wd < 0) { tgt[J.AUF] += 6 * (1 - fw); tgt[J.ALF] += 8 * (1 - fw); } // backing off: guard up
    const sw = Math.sin(ph * TAU);
    if (w.waddle) { tgt[J.ROT] += w.waddle * sw * 0.6; tgt[J.TOR] -= w.waddle * sw * 0.5; tgt[J.HEAD] += w.waddle * sw * 0.3; }
    tgt[J.TAIL] += sw * 14;
    this.ff.set(FF_GAIT);
  }

  _airborne(tgt, f) {
    const m = this.m;
    const vy = f.vy || 0;
    const p = clamp((vy - this.vy0) / (-2 * this.vy0), 0, 1);
    if (f.buffs && f.buffs.glide > 0) {
      tgt.set(ATTACKS.glide.s);
      tgt[J.RY] += Math.sin(this.t * 5) * 3;
      tgt[J.LUF] += Math.sin(this.t * 3) * 6; tgt[J.LUB] -= Math.sin(this.t * 3) * 6;
      this.anim = 'glide';
      this.ff.set(FF_SOFT);
      return;
    }
    // push-off -> apex tuck -> reaching for the floor
    if (p < 0.5) lerpPose(tgt, POSES.jump, POSES.tuck, smooth(p * 2.2));
    else lerpPose(tgt, POSES.tuck, POSES.fall, smooth((p - 0.5) * 2.2));
    const fwd = clamp((f.vx || 0) * (f.facing || 1), -6, 6);
    tgt[J.ROT] += fwd * 1.6;
    tgt[J.TAIL] -= vy * 2;
    if (this.flipDir) {
      const k = smooth((p - 0.1) / 0.66);
      tgt[J.ROT] += 360 * this.flipDir * k;
      const tk = smooth(Math.sin(Math.PI * k) * 1.6); // knees to chest while rotating
      tgt[J.LUF] += (118 - tgt[J.LUF]) * tk; tgt[J.LLF] += (-140 - tgt[J.LLF]) * tk;
      tgt[J.LUB] += (104 - tgt[J.LUB]) * tk; tgt[J.LLB] += (-140 - tgt[J.LLB]) * tk;
      tgt[J.TOR] += (30 - tgt[J.TOR]) * tk; tgt[J.HEAD] += (12 - tgt[J.HEAD]) * tk;
      tgt[J.AUF] += (70 - tgt[J.AUF]) * tk; tgt[J.ALF] += (110 - tgt[J.ALF]) * tk;
      tgt[J.AUB] += (50 - tgt[J.AUB]) * tk; tgt[J.ALB] += (110 - tgt[J.ALB]) * tk;
    }
    this.anim = vy < -4 ? 'jump' : vy < 4 ? 'jump' : 'fall';
    this.ff.set(FF_AIR);
  }

  _attack(tgt, f, dt) {
    const e = this._plan(f);
    if (!e) { tgt.set(this.stance); this.ff.set(FF_SOFT); return 30; }
    const mv = e.mv, m = this.m, t = this.t;
    const mf = f.moveFrame | 0;
    // a new move instance (start, cancel, chain) or a skipped timeline (counter) restarts from the current pose
    if (this.cut || f.moveId !== this.mvId || mf < this.mvMf || mf > this.mvMf + dt * 60 + 2.5) {
      this.from.set(this.cur);
      this.cut = true;
      this.mvFrac = 0; this.activeT = 0; this.altLast = 0;
    } else if (mf === this.mvMf) this.mvFrac = Math.min(0.999, this.mvFrac + dt * 60);
    else this.mvFrac = 0;
    this.mvId = f.moveId; this.mvMf = mf;
    const u = mf + this.mvFrac;
    const ph = f.movePhase;
    this.phase = ph;
    this.pole = this.charId === 'goku' && e.pole;
    if (ph === 'active') this.activeT += dt;

    const st = mv ? mv.startup | 0 : 8;
    const ac = mv ? Math.max(1, mv.active | 0) : 4;
    let rec = mv ? (f.moveConnected ? mv.recovery : (mv.whiffRecovery != null ? mv.whiffRecovery : mv.recovery)) : 12;
    if (f.fastRecover) rec = Math.round(rec * 0.65);
    rec = Math.max(1, rec | 0);

    // timeline (engine frames): wind-up -> snap (strike fully out at the first active frame) -> hold -> recover
    const hit = st + 1;
    const snapLen = Math.min(hit * 0.5, 2 + Math.min(st, 20) * 0.08 + m.weight * 0.6);
    const windEnd = hit - snapLen;
    const pw = windEnd > 0.01 ? clamp(u / (windEnd * 0.8), 0, 1) : 1;
    const ew = 1 - (1 - pw) * (1 - pw);
    const coil = windEnd >= 4 ? 0.08 * smooth((u - windEnd * 0.45) / (windEnd * 0.55)) : 0;
    const ovLen = 2.5 + m.weight * 2;
    const ru = st + ac + 1;
    const span = Math.max(1, rec - 1);
    const q = (u - ru) / span;
    const hold = Math.min(0.35, 2 / span);
    const q1 = Math.max(hold + 0.12, 0.42);
    let wR = 0, wB = 0;
    if (q > hold) {
      if (q < q1) wR = smooth((q - hold) / (q1 - hold));
      else { wR = 1; wB = smooth((q - q1) / (1 - q1)); }
    }
    const whiff = !f.moveConnected && q > 0 && e.limb !== 'body' ? Math.sin(Math.PI * clamp(q, 0, 1)) : 0;
    // alternating strikes (flurries, chains) run on the active clock so held chains keep punching
    let sb = 0;
    if (e.alt) {
      if (ph === 'active') {
        const iv = e.iv, at = this.activeT * 60;
        const k = (at / iv) | 0;
        if (k > 0) {
          const to = k & 1, fr = 1 - to;
          const x = clamp((at - k * iv) / Math.min(2, iv * 0.6), 0, 1);
          sb = fr + (to - fr) * (1 - (1 - x) * (1 - x));
        }
        this.altLast = sb;
      } else if (q > 0) sb = this.altLast;
    }

    const W = e.w, S = e.s, R = e.r, B = e.base, F = this.from, AL = e.alt, lead = e.lead, amp = e.amp;
    for (let i = 0; i < NJ; i++) {
      const L = lead[i];
      const s0 = windEnd - 0.5 * L * snapLen;
      const end = hit - 0.3 * L * snapLen;
      const sx = AL ? S[i] + (AL[i] - S[i]) * sb : S[i];
      let v;
      if (u < end) {
        const wv = F[i] + (W[i] - F[i]) * ew + (W[i] - B[i]) * coil;
        let p = (u - s0) / (end - s0);
        if (p > 0) { const k = 1 - (p > 1 ? 1 : p); v = wv + (sx - wv) * (1 - k * k * k); } else v = wv;
      } else if (q <= 0) v = sx;
      else {
        v = sx + (R[i] - sx) * wR;
        v += (B[i] - v) * wB;
      }
      const oq = (u - end) / ovLen;
      if (oq > 0 && oq < 1) v += amp[i] * 6.75 * oq * (1 - oq) * (1 - oq);
      tgt[i] = v;
    }
    if (whiff) { tgt[J.TOR] += 6 * whiff; tgt[J.RX] += 3 * whiff; tgt[J.HEAD] += 4 * whiff; }
    if ((f.charge | 0) > 0) { // charging: hold the coil and shake with effort
      const k = Math.min(1, (f.charge | 0) / 30);
      tgt[J.TOR] += Math.sin(t * 57) * 1.2 * k; tgt[J.AUF] += Math.sin(t * 61) * 2 * k; tgt[J.AUB] += Math.sin(t * 67) * 2 * k;
      tgt[J.RX] += Math.sin(t * 73) * 0.8 * k; tgt[J.LLF] -= 6 * k; tgt[J.LLB] -= 6 * k;
    }
    const anim = e.anim;
    if (anim === 'spin') {
      const qa = (u - hit) / ac;
      if (qa > 0 && qa < 1) {
        const n = Math.max(1, Math.round(ac / 7));
        let s = Math.cos(TAU * n * qa);
        if (s > -0.15 && s < 0.15) s = s < 0 ? -0.15 : 0.15;
        this.spin = s;
      }
    } else if (anim === 'taunt') { // turn the back on the opponent, wiggle, turn back
      const turn = u < hit ? smooth(u / hit) : q < 0.55 ? 1 : 1 - smooth((q - 0.55) / 0.4);
      let s = Math.cos(Math.PI * turn);
      if (s > -0.15 && s < 0.15) s = s < 0 ? -0.15 : 0.15;
      this.spin = s;
      tgt[J.ROT] += Math.sin(t * 16) * 7 * turn; tgt[J.TOR] -= Math.sin(t * 16) * 4 * turn;
    } else if (anim === 'glide') tgt[J.RY] += Math.sin(t * 5) * 3;
    this.anim = anim;
    this.ff.set(FF_KEY);
    // the springs only absorb blends here; snappier blends for short startups so the strike still lands on time
    return ph === 'startup' ? clamp(230 / hit, 30, 90) : 42;
  }

  _hitstun(tgt, f) {
    const p = (this.af + this.afFrac) / Math.max(1, this.af + this.afFrac + (f.stun | 0));
    const pose = this.hitN & 1 ? POSES.hitGut : POSES.hitstun;
    const k = clamp(this.hitStr, 0.55, 1.3) * (1 - smooth((p - 0.45) / 0.55));
    const st = this.stance;
    for (let i = 0; i < NJ; i++) tgt[i] = st[i] + (pose[i] - st[i]) * k;
    if (!f.grounded) overlayLegs(tgt, POSES.fall, false);
    this.ff.set(FF_SOFT);
    return this.actionT < 0.12 ? 46 : 20;
  }

  _launched(tgt, f, ko) {
    const vy = f.vy || 0;
    const p = clamp((vy - this.vy0) / (-2 * this.vy0), 0, 1);
    const t = this.t;
    tgt.set(POSES.launched);
    tgt[J.ROT] = -(25 + 72 * smooth(p)) - (ko ? 360 * smooth(p * 1.15) : 0);
    // limbs trail and flail; the airborne tumble keeps its own rotation keyed to the arc
    tgt[J.AUF] += Math.sin(t * 9) * 14; tgt[J.AUB] += Math.sin(t * 8 + 1) * 14;
    tgt[J.ALF] += Math.sin(t * 11) * 10; tgt[J.ALB] += Math.sin(t * 10 + 2) * 10;
    tgt[J.LUF] += Math.sin(t * 7 + 1) * 12; tgt[J.LUB] += Math.sin(t * 7 + 2.5) * 12;
    tgt[J.HEAD] += Math.sin(t * 6) * 5;
    this.ff.set(FF_TUMBLE);
  }

  _dash(tgt, f, back) {
    const m = this.m;
    const af = this.af + this.afFrac;
    const p = clamp(af / Math.max(1, af + (f.dashT | 0)), 0, 1);
    const st = this.stance;
    if (back) { // hop back, guard kept up
      lerpPose(tgt, POSES.backdash, POSES.backdash2, smooth(p));
      const hop = Math.sin(Math.PI * clamp(p * 1.15, 0, 1));
      tgt[J.RY] -= hop * 14; tgt[J.LUF] += hop * 16; tgt[J.LLF] -= hop * 24; tgt[J.LLB] -= hop * 20;
    } else { // one big lunging stride
      lerpPose(tgt, POSES.dash, POSES.dash2, smooth((p - 0.3) / 0.45));
      const g = m.dashGuard;
      for (let i = J.AUF; i <= J.ALB; i++) tgt[i] += (st[i] - tgt[i]) * g;
    }
    // lean into it from the stance, then settle back before the engine hands control back
    const a = 1 - (p < 0.34 ? smooth(p / 0.34) : 1);
    const k = a > 0 ? a : smooth((p - 0.72) / 0.28);
    if (k > 0) for (let i = 0; i < NJ; i++) tgt[i] += (st[i] - tgt[i]) * k;
    tgt[J.TAIL] -= 30;
    this.ff.set(FF_KEY);
  }

  _getup(tgt) {
    const p = clamp((this.af + this.afFrac) / GETUP_FRAMES, 0, 1);
    if (p < 0.36) lerpPose(tgt, POSES.knockdown, POSES.sitUp, smooth(p / 0.36));
    else if (p < 0.62) lerpPose(tgt, POSES.sitUp, CROUCH, smooth((p - 0.36) / 0.26));
    else lerpPose(tgt, CROUCH, this.stance, smooth((p - 0.62) / 0.38));
    this.ff.set(FF_KEY);
  }

  _win(tgt) {
    const m = this.m, t = this.actionT;
    tgt.set(this.winPose);
    const b = 0.5 + 0.5 * Math.sin(t * 6);
    switch (m.winMove) {
      case 'buri': { // turn around, bend over, wiggle the butt at the loser
        const turn = smooth((t - 0.15) / 0.4);
        let s = Math.cos(Math.PI * turn);
        if (s > -0.15 && s < 0.15) s = s < 0 ? -0.15 : 0.15;
        this.spin = s;
        for (let i = 0; i < NJ; i++) tgt[i] = this.stance[i] + (tgt[i] - this.stance[i]) * turn;
        const w = Math.sin(t * 11) * turn;
        tgt[J.ROT] += w * 10; tgt[J.TOR] -= w * 5; tgt[J.HEAD] += w * 4;
        tgt[J.AUF] += Math.sin(t * 11 + 1.2) * 16 * turn; tgt[J.AUB] += Math.sin(t * 11 + 2.4) * 16 * turn;
        tgt[J.LLF] -= 6 * (0.5 + 0.5 * w); tgt[J.LLB] -= 6 * (0.5 - 0.5 * w);
        break;
      }
      case 'wiggle': // butt wiggle with flapping arms
        tgt[J.ROT] += Math.sin(t * 9) * 9; tgt[J.TOR] -= Math.sin(t * 9) * 6;
        tgt[J.AUF] += Math.sin(t * 9 + 1) * 16; tgt[J.AUB] += Math.sin(t * 9 + 2) * 16;
        tgt[J.LLF] -= 8 * (0.5 + 0.5 * Math.sin(t * 18)); tgt[J.LLB] -= 8 * (0.5 - 0.5 * Math.sin(t * 18));
        break;
      case 'hop': { // happy little hops, arms waving
        const h = Math.abs(Math.sin(t * 5.5));
        tgt[J.RY] -= 12 * h;
        tgt[J.LLF] -= 18 * (1 - h); tgt[J.LLB] -= 18 * (1 - h); tgt[J.LUF] += 8 * (1 - h);
        tgt[J.AUF] += Math.sin(t * 11) * 12; tgt[J.AUB] -= Math.sin(t * 11) * 12;
        break;
      }
      case 'wave': { // bouncing on the spot, waving the raised paw
        const h = Math.abs(Math.sin(t * 5));
        tgt[J.RY] -= 6 * h; tgt[J.LLF] -= 12 * (1 - h); tgt[J.LLB] -= 12 * (1 - h);
        tgt[J.AUF] += Math.sin(t * 9) * 12; tgt[J.ALF] += Math.sin(t * 9 - 0.8) * 22;
        tgt[J.ROT] += Math.sin(t * 5) * 3;
        break;
      }
      case 'proud': { // chest puffs, head thrown back laughing
        const l = Math.sin(t * 13) * (0.5 + 0.5 * Math.sin(t * 2.1));
        tgt[J.TOR] -= 3 * b + l * 1.5; tgt[J.HEAD] -= 4 * b + l * 3;
        tgt[J.SY] *= 1 + 0.012 * b;
        tgt[J.LLF] -= 4 * b; tgt[J.LLB] -= 4 * b;
        break;
      }
      case 'flex': // biceps pulse, chest out
        tgt[J.ALF] += b * 14; tgt[J.ALB] += b * 14; tgt[J.TOR] -= b * 4; tgt[J.HEAD] -= b * 3;
        tgt[J.LLF] -= 6 * b; tgt[J.LLB] -= 6 * b;
        break;
      case 'bow': { // a ninja bow, then the hand sign with a slow nod
        const bow = t < 1.6 ? Math.sin(Math.PI * clamp(t / 1.4, 0, 1)) : 0;
        tgt[J.TOR] += 34 * bow; tgt[J.HEAD] += 18 * bow; tgt[J.ROT] += 6 * bow;
        tgt[J.HEAD] += Math.sin(t * 2.4) * 3 * (1 - bow);
        tgt[J.LLF] -= 3 * b; tgt[J.LLB] -= 3 * b;
        break;
      }
      case 'blaze': // fists up, flickering with heat
        tgt[J.AUF] += Math.sin(t * 17) * 4; tgt[J.AUB] += Math.sin(t * 19 + 1) * 4;
        tgt[J.ALF] += Math.sin(t * 23) * 6; tgt[J.TOR] -= b * 3;
        tgt[J.LLF] -= 8 * b; tgt[J.LLB] -= 8 * b;
        break;
      default: { // fist pump: the near fist drives down and up, knees bounce with it
        const pm = Math.sin(t * 7);
        tgt[J.AUF] += pm * 12; tgt[J.ALF] -= pm * 12; tgt[J.TOR] -= pm * 3; tgt[J.HEAD] -= pm * 2;
        tgt[J.AUB] += Math.sin(t * 7 - 0.6) * 5;
        tgt[J.LLF] -= 10 * b; tgt[J.LLB] -= 10 * b; tgt[J.LUF] += 5 * b;
      }
    }
    this.ff.set(FF_SOFT);
  }

  _lose(tgt) {
    const m = this.m, t = this.actionT;
    tgt.set(this.losePose);
    tgt[J.TOR] += Math.sin(t * 2.2) * 2; tgt[J.HEAD] += Math.sin(t * 1.3) * 3;
    if (m.loseMove === 'sob') { // shoulders shaking
      const s = Math.sin(t * 15) * (0.5 + 0.5 * Math.sin(t * 1.7));
      tgt[J.TOR] += s * 2.5; tgt[J.HEAD] += s * 3; tgt[J.AUF] += s * 4; tgt[J.AUB] += s * 4;
      tgt[J.AUF] += 30; tgt[J.ALF] += 70; // a hand up to the eyes
    }
    this.ff.set(FF_SOFT);
  }

  _target(f, dt, legLen) {
    const tgt = this.tgt;
    const t = this.t;
    const m = this.m;
    let omega = 14;
    const act = f.action;
    this.actionT += dt;
    this.pole = false;
    this.phase = null;
    this.spin = 1;
    let anim = act;
    let settle = false; // the landing knee-bend applies to grounded, free states

    switch (act) {
      case 'attack': omega = this._attack(tgt, f, dt); anim = this.anim; break;
      case 'walk': this._walk(tgt, f, dt, legLen); omega = 30; settle = true; break;
      case 'jump': this._airborne(tgt, f); anim = this.anim; omega = 22; break;
      case 'crouch': {
        tgt.set(CROUCH);
        const br = Math.sin(t * TAU * 0.33);
        tgt[J.TOR] += br * 1.2; tgt[J.AUF] += br * 1.5; tgt[J.HEAD] -= br * 0.8;
        tgt[J.LLF] -= m.bounce.amp * 0.4 * (0.5 + 0.5 * Math.sin(t * TAU * m.bounce.hz));
        this.ff.set(FF_IDLE);
        omega = 30; settle = true;
        break;
      }
      case 'dash': this._dash(tgt, f, false); omega = 40; break;
      case 'backdash': this._dash(tgt, f, true); omega = 40; break;
      case 'block':
      case 'blockstun': {
        anim = f.blocking === 'low' || f.crouching ? 'crouchBlock' : 'block';
        tgt.set(POSES[anim]);
        this.blockT += dt;
        if (act === 'blockstun') { // pushed back into the guard, then braced
          const k = Math.exp(-this.blockT * 9);
          tgt[J.TOR] -= 10 * k; tgt[J.HEAD] -= 6 * k; tgt[J.RX] -= 6 * k;
          tgt[J.LLF] -= 14 * k; tgt[J.LLB] -= 10 * k; tgt[J.LUF] += 6 * k;
        } else tgt[J.ALF] += Math.sin(t * 3.3) * 1.5;
        this.ff.set(FF_SOFT);
        omega = 34; settle = act === 'block';
        break;
      }
      case 'hitstun': anim = 'hitstun'; omega = this._hitstun(tgt, f); break;
      case 'launched': this._launched(tgt, f, !!f.ko); omega = 16; break;
      case 'ko':
        if (f.grounded) {
          anim = 'knockdown';
          tgt.set(POSES.knockdown);
          tgt[J.ALF] += 10; tgt[J.HEAD] += 4; // limp
          this.ff.set(FF_NONE);
          omega = 10;
        } else { anim = 'launched'; this._launched(tgt, f, true); omega = 16; }
        break;
      case 'knockdown': {
        tgt.set(POSES.knockdown);
        tgt[J.TOR] += Math.sin(t * 3) * 1.5; tgt[J.HEAD] += Math.sin(t * 2.1) * 2;
        // last few frames: plant the hands to push up
        const left = f.stun | 0;
        if (left < 8) { const k = smooth((8 - left) / 8); tgt[J.AUF] -= 40 * k; tgt[J.AUB] -= 50 * k; tgt[J.LUF] += 30 * k; tgt[J.LLF] -= 50 * k; }
        this.ff.set(FF_SOFT);
        omega = 16;
        break;
      }
      case 'getup': this._getup(tgt); omega = 30; break;
      case 'grabbed':
        tgt.set(POSES.grabbed);
        tgt[J.RX] += Math.sin(t * 40) * 1.5; tgt[J.LLF] += Math.sin(t * 22) * 12; tgt[J.LLB] += Math.sin(t * 19 + 1) * 10;
        tgt[J.ALF] += Math.sin(t * 17) * 10;
        this.ff.set(FF_SOFT);
        omega = 22;
        break;
      case 'win': this._win(tgt); omega = 12; break;
      case 'lose': this._lose(tgt); omega = 7; break;
      case 'intro': {
        tgt.set(this.introPose);
        const b = Math.sin(t * 3);
        tgt[J.LLF] -= 4 + 4 * b; tgt[J.LLB] -= 4 + 4 * b; tgt[J.TOR] += b * 2;
        const pound = Math.max(0, Math.sin(t * 8)); // fist into palm
        tgt[J.AUF] += 10 * pound; tgt[J.ALF] -= 14 * pound; tgt[J.HEAD] += 2 * pound;
        this.ff.set(FF_SOFT);
        omega = 14;
        break;
      }
      default: {
        if (f.grounded === false) { this._airborne(tgt, f); anim = this.anim; omega = 22; }
        else { anim = 'idle'; this._idle(tgt, f, dt); omega = 20; settle = true; }
      }
    }
    // lying or tumbling: curl tails up so they never cut into the floor
    if (act === 'knockdown' || act === 'ko' || act === 'launched' || act === 'getup') tgt[J.TAIL] += 80;
    // landing: knees soak up the fall for a moment
    if (settle && this.landT < 0.3) {
      const x = 1 - this.landT / 0.3, e = x * x * this.landAmt;
      tgt[J.LUF] += 24 * e; tgt[J.LLF] -= 44 * e; tgt[J.LUB] += 18 * e; tgt[J.LLB] -= 36 * e;
      tgt[J.TOR] += 10 * e; tgt[J.HEAD] -= 4 * e; tgt[J.AUF] -= 12 * e; tgt[J.AUB] -= 10 * e;
    }
    // big heads tilt less so necks never look broken
    if (m.headK !== 1) tgt[J.HEAD] = this.stance[J.HEAD] + (tgt[J.HEAD] - this.stance[J.HEAD]) * m.headK;
    this._limits(tgt, null);
    if (anim !== this.anim && act !== 'attack') this.cut = true; // e.g. high <-> low guard: blend, don't pop
    this.anim = anim;
    // heavier characters move their mass a bit slower
    return omega * (1.12 - m.weight * 0.24);
  }

  /** One-off reactions when the action changes (impulses give recoil and follow-through). */
  _enter(f, act) {
    const prev = this.lastAction;
    this.lastAction = act;
    this.actionT = 0;
    this.cut = true;
    const v = this.vel;
    const heavy = 1 - this.m.weight * 0.5;
    if (act === 'blockstun') this.blockT = 0;
    else if (act === 'dash') { v[J.TOR] += 300 * heavy; v[J.HEAD] -= 180; this.sqVel -= 3; }
    else if (act === 'backdash') { v[J.TOR] -= 260 * heavy; this.sqVel += 2; }
    else if (act === 'knockdown' && prev === 'launched') { v[J.TOR] += 260; v[J.HEAD] += 380; v[J.RY] -= 160; v[J.AUF] += 400; v[J.AUB] += 300; this.sqVel -= 5; }
    else if (act === 'ko' && prev === 'launched') { v[J.TOR] += 200; v[J.HEAD] += 300; v[J.RY] -= 120; this.sqVel -= 4; }
    else if (act === 'crouch' && prev !== 'attack') this.sqVel -= 2;
    else if (act === 'attack') v[J.HEAD] -= 80;
    else if (act === 'idle' && prev === 'crouch') this.sqVel += 1.5;
  }

  /** A fresh hit landed on this fighter (hitFlash rose): whiplash impulses scaled by the knockback. */
  _hitReact(f) {
    const kb = Math.abs(f.kbx || 0);
    this.hitN++;
    this.hitStr = clamp(0.55 + kb * 0.09 + Math.max(0, -(f.vy || 0)) * 0.03, 0.55, 1.3);
    const v = this.vel;
    const k = this.hitStr * (1 - this.m.weight * 0.45);
    const gut = this.hitN & 1;
    v[J.TOR] += (gut ? 380 : -520) * k; v[J.HEAD] += (gut ? 420 : -700) * k; v[J.ROT] -= 140 * k;
    v[J.AUF] += (this._rnd() - 0.3) * 800 * k; v[J.AUB] += (this._rnd() - 0.3) * 800 * k;
    v[J.ALF] += (this._rnd() - 0.5) * 600 * k; v[J.ALB] += (this._rnd() - 0.5) * 600 * k;
    v[J.RX] -= 70 * k;
    this.sqVel -= 2.5 * k;
    this.cut = true;
  }

  _expression(f, dt) {
    const act = f.action;
    if (HURT[act]) return 'hurt';
    // winners keep their normal (smiling) face and still blink; 'shout' brows read as angry
    if (act === 'attack' && (f.movePhase === 'active' || (f.charge | 0) > 0)) return 'shout';
    if (act === 'attack' && f.moveId === 'ultimate') return 'shout';
    if (act === 'blockstun') return 'blink';
    // blinking: every 2-5 s, sometimes twice
    this.blinkIn -= dt;
    if (this.blinkT > 0) { this.blinkT -= dt; return 'blink'; }
    if (this.blinkIn <= 0) {
      this.blinkT = 0.11;
      this.blinkIn = this._rnd() < 0.18 ? 0.22 : 2 + this._rnd() * 3;
      return 'blink';
    }
    return 'normal';
  }

  /**
   * Advance one render frame. dt in seconds; legLen = hip-to-ankle leg length in world px (for planted feet).
   * Results: this.cur (pose), this.anim, this.phase, this.pole, this.expr, this.sx/this.sy (root scale),
   * this.spin (extra x scale), this.air (0 = feet on the floor, 1 = airborne hip anchor).
   */
  update(f, dt, legLen = 60) {
    if (!f) return;
    dt = dt > 0.1 ? 0.1 : dt > 0 ? dt : 0;
    const slowed = !!(f.buffs && f.buffs.slowed > 0);
    this.t += slowed ? dt * 0.5 : dt;
    if (this.charId === 'ben10') this._useForm(f.form || null);
    if (f.action !== this.lastAction) this._enter(f, f.action);
    const af = f.actionFrame | 0;
    if (af !== this.af) { this.af = af; this.afFrac = 0; } else this.afFrac = Math.min(0.999, this.afFrac + dt * 60);

    // take-off, landing and hit detection
    const g = f.grounded !== false;
    const vy = f.vy || 0;
    if (!g && this.wasGrounded) {
      this.vy0 = Math.min(vy, -1);
      this.fallVy = 0;
      const fw = (f.vx || 0) * (f.facing || 1);
      this.flipDir = f.action === 'jump' && this.m.flip && Math.abs(fw) > 1 ? (fw > 0 ? 1 : -1) : 0;
      if (vy < 0) this.sqVel += 6;
    } else if (!g) {
      if (vy < this.vy0 - 1) { this.vy0 = vy; this.flipDir = 0; this.cut = true; } // launched again
      if (f.action !== 'jump' && f.action !== 'attack') this.flipDir = 0;
    }
    if (!g && vy > this.fallVy) this.fallVy = vy;
    if (g && !this.wasGrounded) {
      this.landAmt = clamp(this.fallVy / 14, 0.3, 1.1);
      this.landT = 0;
      this.flipDir = 0;
      this.sqVel -= 8 * (1.2 - this.m.weight * 0.4) * this.landAmt;
      this.vel[J.LLF] -= 260 * this.landAmt; this.vel[J.LLB] -= 260 * this.landAmt;
    }
    this.landT += dt;
    this.wasGrounded = g;
    const hf = f.hitFlash | 0;
    if (hf > this.lastHitFlash) {
      if (f.action === 'attack') { this.vel[J.TOR] -= 160; this.vel[J.HEAD] -= 200; this.sqVel -= 1.5; } // armored through it
      else if (HURT[f.action]) this._hitReact(f);
    }
    this.lastHitFlash = hf;
    const stun = f.stun | 0;
    if (f.action === 'blockstun' && stun > this.lastStun && this.actionT > 0) {
      this.blockT = 0;
      this.vel[J.TOR] -= 200; this.vel[J.HEAD] -= 240; this.vel[J.RX] -= 40;
    }
    this.lastStun = stun;

    const cur = this.cur, vel = this.vel, tgt = this.tgt, prev = this.prev, ff = this.ff, ffp = this.ffPrev, tv = this.tv;
    if (this.cut) { // keep rotations on the short way round (flips, tumbles)
      let r = cur[J.ROT];
      r -= 360 * Math.round(r / 360);
      cur[J.ROT] = r;
    }
    const omega = this._target(f, dt, legLen);
    this.expr = this._expression(f, dt);

    // feed-forward: joints follow their keyed curves; a cut hands the current motion to the springs instead
    if (this.cut) {
      for (let i = 0; i < NJ; i++) { // carry part of the motion's momentum, never enough to fling a limb
        const c = ffp[i] * tv[i] * 0.4;
        vel[i] += c > 600 ? 600 : c < -600 ? -600 : c;
        tv[i] = 0;
      }
      if (tgt[J.ROT] - cur[J.ROT] > 180) cur[J.ROT] += 360;
      else if (cur[J.ROT] - tgt[J.ROT] > 180) cur[J.ROT] -= 360;
      this.cut = false;
    } else if (dt > 0) {
      const inv = 1 / dt;
      for (let i = 0; i < NJ; i++) {
        const d = tgt[i] - prev[i];
        cur[i] += ff[i] * d;
        tv[i] = d * inv;
      }
    }
    prev.set(tgt);
    ffp.set(ff);

    // integrate the residual springs (implicit, unconditionally stable)
    if (dt > 0) {
      const n = Math.ceil(dt / MAX_STEP);
      const h = dt / n;
      for (let s = 0; s < n; s++) {
        for (let i = 0; i < NJ; i++) {
          const w = omega * MUL[i];
          const hz = 2 * h * ZETA[i] * w;
          const hw = h * h * w * w;
          const det = 1 + hz + hw;
          const x = cur[i], v = vel[i];
          cur[i] = ((1 + hz) * x + h * v + hw * tgt[i]) / det;
          vel[i] = (v + h * w * w * (tgt[i] - x)) / det;
        }
        // squash spring around 1
        const sw = 26, sz = 0.35;
        const shz = 2 * h * sz * sw, shw = h * h * sw * sw;
        const sdet = 1 + shz + shw;
        const sx = this.sq, sv = this.sqVel;
        this.sq = ((1 + shz) * sx + h * sv + shw) / sdet;
        this.sqVel = (sv + h * sw * sw * (1 - sx)) / sdet;
      }
    }
    // never let a bad input poison the pose (NaN would hide the fighter): fall back to the stance
    let sum = 0;
    for (let i = 0; i < NJ; i++) sum += cur[i] + vel[i];
    if (!Number.isFinite(sum)) { cur.set(this.stance); vel.fill(0); this.sq = 1; this.sqVel = 0; this.cut = true; }
    // joint limits: no hyper-extended elbows or knees, no broken necks, no runaway velocities
    this._limits(cur, vel);
    for (let i = 0; i < NJ; i++) { const v = vel[i]; if (v > VMAX) vel[i] = VMAX; else if (v < -VMAX) vel[i] = -VMAX; }

    const airT = g ? 0 : 1;
    this.air += (airT - this.air) * (1 - Math.exp(-dt * (g ? 20 : 12)));
    const sq = clamp(this.sq, 0.8, 1.2);
    this.sy = sq * cur[J.SY];
    this.sx = (1 + (1 - sq) * 0.7) * cur[J.SX];
  }

  _limits(p, vel) {
    const hs = this.stance[J.HEAD], hl = this.m.headLim;
    lim(p, vel, J.HEAD, hs - hl, hs + hl);
    lim(p, vel, J.ALF, -8, 168); lim(p, vel, J.ALB, -8, 168);
    lim(p, vel, J.LLF, -170, 6); lim(p, vel, J.LLB, -170, 6);
    lim(p, vel, J.TOR, -75, 100);
    lim(p, vel, J.RY, -80, 0);
  }

  /** Tool helper (lab/debug, allocates): stance-adjusted key poses the animator uses for an attack anim. */
  keyPoses(moveId, form = null) {
    const e = this._makePlan(moveId, form);
    return { anim: e.anim, w: e.w, s: e.s, r: e.r, alt: e.alt, base: e.base };
  }
}

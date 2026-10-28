// Phaser-free pose library: keyframes as joint-angle arrays (see rig.js for conventions).
import { J, NJ, makePose } from './rig.js';

const IDLE_O = { tor: 6, head: -4, auf: 38, alf: 100, aub: 22, alb: 105, luf: 16, llf: -14, lub: -14, llb: -6 };
export const IDLE = makePose(IDLE_O);
const P = (o, base = IDLE) => makePose(o, base);

const CROUCH_LEGS = { luf: 84, llf: -100, lub: 30, llb: -118, ftf: 0, ftb: 0, sy: 0.92 };
const AIR_LEGS = { luf: 62, llf: -100, lub: 18, llb: -88, ftf: 15, ftb: -15 };
export const CROUCH = P({ ...CROUCH_LEGS, tor: 30, head: -16, auf: 50, alf: 95, aub: 36, alb: 100 });
export const CROUCH_LEG_POSE = CROUCH;
export const AIR_LEG_POSE = P(AIR_LEGS);

export const POSES = {
  idle: IDLE,
  walk: IDLE,
  crouch: CROUCH,
  jump: P({ tor: 4, head: -6, auf: 110, alf: 40, aub: 70, alb: 50, ...AIR_LEGS, luf: 75, llf: -110, lub: 30, llb: -95 }),
  fall: P({ tor: 2, head: -2, auf: 80, alf: 30, aub: 120, alb: 25, luf: 30, llf: -35, lub: -12, llb: -25, ftf: 10, ftb: -20 }),
  dash: P({ tor: 26, rot: 6, head: -14, auf: -35, alf: 40, aub: -55, alb: 30, luf: 55, llf: -50, lub: -45, llb: -35, ftb: -20 }),
  backdash: P({ tor: -14, head: 6, auf: 55, alf: 90, aub: 40, alb: 95, luf: 35, llf: -15, lub: -25, llb: -70, ry: -6 }),
  block: P({ tor: -4, head: 14, auf: 70, alf: 118, aub: 78, alb: 110, luf: 22, llf: -24, lub: -22, llb: -14, rx: -2 }),
  crouchBlock: P({ auf: 75, alf: 118, aub: 82, alb: 110, head: 0 }, CROUCH),
  hitstun: P({ tor: -24, head: -22, rot: -6, auf: -25, alf: 35, aub: 45, alb: 30, luf: 12, llf: -10, lub: -26, llb: -12, rx: -4 }),
  crouchHit: P({ tor: 6, head: -24, auf: -10, alf: 40, aub: 40, alb: 30 }, CROUCH),
  launched: P({ rot: -55, tor: -18, head: -20, auf: 160, alf: 20, aub: 175, alb: 15, luf: 35, llf: -45, lub: 10, llb: -25, ftf: 30, ftb: 20 }),
  knockdown: P({ rot: -90, tor: 0, head: 12, auf: 140, alf: 20, aub: 160, alb: 10, luf: 12, llf: -22, lub: 2, llb: -8 }),
  getup: P({ rot: -25, tor: 30, head: -10, auf: 30, alf: 10, aub: -20, alb: 20, luf: 80, llf: -110, lub: 40, llb: -120 }),
  grabbed: P({ rot: -8, tor: -18, head: -24, auf: 150, alf: 30, aub: 160, alb: 30, luf: 8, llf: -22, lub: -12, llb: -30, ry: -14, ftf: -30, ftb: -30 }),
  win: P({ tor: -6, head: -12, auf: 172, alf: 12, aub: 20, alb: 110, luf: 18, llf: -10, lub: -18, llb: -8 }),
  lose: P({ tor: 34, head: 30, auf: 6, alf: 6, aub: -4, alb: 8, luf: 82, llf: -92, lub: -8, llb: -96 }),
  intro: P({ tor: 2, head: -8, auf: 150, alf: 125, aub: 10, alb: 110, luf: 14, llf: -6, lub: -14, llb: -4 }),
};
POSES.ko = POSES.knockdown;

// attack sets: w = wind-up (startup), s = strike (active), r = recovery start (optional), alt = alternating strike
const A = (w, s, r, alt) => ({ w: P(w), s: P(s), r: r ? P(r) : null, alt: alt ? P(alt) : null });
export const ATTACKS = {
  jab: A({ auf: 20, alf: 125, tor: 2 }, { auf: 88, alf: 4, tor: 12, head: -8, aub: 30, alb: 115, rx: 3 }),
  punch: A({ tor: -14, rot: -3, auf: -15, alf: 115, aub: 55, alb: 75, luf: 24, lub: -20, rx: -3 },
    { tor: 22, rot: 6, head: -10, auf: 92, alf: 0, aub: -35, alb: 55, luf: 36, llf: -16, lub: -36, llb: -6, rx: 8 }),
  kick: A({ tor: -6, auf: 55, alf: 90, aub: 20, alb: 100, luf: 72, llf: -125, ftf: 10 },
    { tor: -24, rot: -4, head: 8, auf: 65, alf: 60, aub: -35, alb: 45, luf: 100, llf: -2, ftf: 75, lub: -8, llb: -6 },
    { tor: -8, luf: 45, llf: -70 }),
  lowKick: A({ ...CROUCH_LEGS, tor: 26, luf: 70, llf: -120 },
    { ...CROUCH_LEGS, tor: 22, luf: 78, llf: -4, ftf: 40, lub: 28, llb: -120, rx: 4 }),
  sweep: A({ ...CROUCH_LEGS, tor: 20, rot: -6 },
    { ...CROUCH_LEGS, tor: 36, rot: 10, head: -24, auf: 80, alf: 0, luf: 88, llf: 0, ftf: 55, lub: 34, llb: -125, rx: 6 }),
  uppercut: A({ tor: 24, head: -6, auf: -20, alf: 130, aub: 40, alb: 90, luf: 45, llf: -70, lub: -15, llb: -65 },
    { tor: -12, rot: -5, head: -18, auf: 168, alf: 8, aub: 20, alb: 100, luf: 12, llf: -6, lub: -24, llb: -14, ry: -10 }),
  airPunch: A({ ...AIR_LEGS, tor: -6, auf: 30, alf: 120 }, { ...AIR_LEGS, tor: 20, head: -10, auf: 62, alf: 2, aub: 110, alb: 40 }),
  airKick: A({ tor: 4, luf: 70, llf: -120, lub: 20, llb: -90, auf: 100, alf: 40, aub: 130, alb: 30 },
    { tor: -12, head: 6, luf: 62, llf: -4, ftf: 45, lub: -6, llb: -100, auf: 100, alf: 30, aub: 140, alb: 30 }),
  slam: A({ tor: -16, head: -14, auf: 172, alf: 25, aub: 165, alb: 25, luf: 18, llf: -10, lub: -18, llb: -8, ry: -6 },
    { tor: 42, rot: 8, head: -20, auf: 72, alf: 0, aub: 64, alb: 4, luf: 58, llf: -78, lub: -38, llb: -55 }),
  throw: A({ tor: 12, auf: 82, alf: 30, aub: 84, alb: 40, luf: 30, lub: -20 },
    { tor: -26, rot: -10, head: -12, auf: 155, alf: 40, aub: 145, alb: 45, luf: 20, llf: -10, lub: -30, llb: -20 }),
  taunt: A({ tor: -4, head: -10, auf: 120, alf: 120, aub: 0, alb: 120 },
    { tor: -8, head: -14, auf: 160, alf: 110, aub: -10, alb: 120, luf: 30, llf: -60, lub: -16, llb: -6 }),
  spin: A({ tor: -10, auf: 20, alf: 110, aub: 20, alb: 110 },
    { tor: 4, head: -6, auf: 92, alf: 0, aub: -92, alb: 0, luf: 10, llf: -8, lub: -12, llb: -8 }),
  cast: A({ tor: -10, auf: 15, alf: 120, aub: 25, alb: 115 },
    { tor: 14, head: -8, auf: 90, alf: 0, aub: 84, alb: 6, luf: 30, llf: -12, lub: -30, llb: -8, rx: 4 }),
  beam: A({ tor: -16, head: -6, auf: -30, alf: 85, aub: -38, alb: 80, luf: 40, llf: -55, lub: -38, llb: -25 },
    { tor: 12, head: -6, auf: 92, alf: 0, aub: 88, alb: 3, luf: 42, llf: -40, lub: -40, llb: -20, rx: 4 }),
  dashStrike: A({ tor: 10, head: -6, auf: 20, alf: 110, aub: -20, alb: 60, luf: 50, llf: -80, lub: -30, llb: -60 },
    { tor: 30, rot: 12, head: -18, auf: 96, alf: 0, aub: -60, alb: 25, luf: 60, llf: -60, lub: -60, llb: -25, rx: 10 }),
  glide: A({ tor: 6, head: -10, auf: 115, alf: 15, aub: 120, alb: 20, luf: 12, llf: -24, lub: -6, llb: -30, ftf: -20, ftb: -25 },
    { tor: 6, head: -10, auf: 115, alf: 15, aub: 120, alb: 20, luf: 12, llf: -24, lub: -6, llb: -30, ftf: -20, ftb: -25, ry: -4 }),
  teleport: A({ ...CROUCH_LEGS, tor: 20, auf: 70, alf: 120, aub: 75, alb: 120 },
    { tor: 0, head: 0, auf: 20, alf: 10, aub: 10, alb: 10, luf: 0, llf: -5, lub: 0, llb: -5 }),
  buff: A({ tor: 14, head: 6, auf: -12, alf: 95, aub: -15, alb: 95, luf: 30, llf: -40, lub: -30, llb: -30 },
    { tor: -10, head: -18, auf: 98, alf: 140, aub: 100, alb: 140, luf: 28, llf: -30, lub: -28, llb: -20 }),
  flurry: A({ auf: 20, alf: 125, tor: 2 },
    { tor: 16, head: -8, auf: 92, alf: 0, aub: 30, alb: 110, luf: 30, llf: -14, lub: -28, llb: -6, rx: 5 }, null,
    { tor: 18, head: -8, auf: 30, alf: 110, aub: 92, alb: 0, luf: 30, llf: -14, lub: -28, llb: -6, rx: 6 }),
  ultimate: A({ tor: -14, head: -10, auf: -40, alf: 70, aub: -45, alb: 70, luf: 42, llf: -60, lub: -40, llb: -30, sy: 0.97 },
    { tor: 22, rot: 6, head: -14, auf: 115, alf: 0, aub: 105, alb: 5, luf: 42, llf: -24, lub: -42, llb: -10, rx: 6 }, null,
    { tor: 26, rot: 8, head: -10, auf: 92, alf: 0, aub: 40, alb: 100, luf: 46, llf: -24, lub: -42, llb: -10, rx: 8 }),
};

/** anims whose own legs should be kept when the move is done crouching / in the air */
export const OWN_LEGS = { lowKick: 1, sweep: 1, uppercut: 1, airKick: 1, airPunch: 1, glide: 1, slam: 1, kick: 1, teleport: 1 };

/** guess an anim when the engine move has none or an unknown key */
export function guessAnim(moveId) {
  switch (moveId) {
    case 'light': return 'jab';
    case 'heavy': return 'punch';
    case 'crouchLight': return 'lowKick';
    case 'crouchHeavy': return 'sweep';
    case 'airLight': return 'airPunch';
    case 'airHeavy': return 'airKick';
    case 'throw': return 'throw';
    case 'special1': return 'cast';
    case 'special2': return 'dashStrike';
    case 'special3': return 'slam';
    case 'ultimate': return 'ultimate';
    default: return 'punch';
  }
}

export function copyPose(dst, src) { dst.set(src); }
export function lerpPose(dst, a, b, t) {
  for (let i = 0; i < NJ; i++) dst[i] = a[i] + (b[i] - a[i]) * t;
}
const LEG_IDX = [J.LUF, J.LLF, J.LUB, J.LLB, J.FTF, J.FTB];
export function overlayLegs(dst, src, sy = true) {
  for (let i = 0; i < LEG_IDX.length; i++) dst[LEG_IDX[i]] = src[LEG_IDX[i]];
  if (sy) dst[J.SY] = src[J.SY];
}

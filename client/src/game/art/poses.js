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
  // jump arc: push-off (legs long, arms swinging up) -> apex tuck -> reaching for the floor
  jump: P({ tor: 2, head: -8, auf: 120, alf: 36, aub: 70, alb: 50, luf: 18, llf: -12, lub: -16, llb: -20, ftf: -30, ftb: -40 }),
  tuck: P({ tor: 14, head: -4, auf: 70, alf: 100, aub: 50, alb: 95, luf: 92, llf: -120, lub: 50, llb: -110, ftf: 10, ftb: -10 }),
  fall: P({ tor: 4, head: -2, auf: 96, alf: 40, aub: 112, alb: 34, luf: 34, llf: -40, lub: -8, llb: -30, ftf: 12, ftb: -14 }),
  dash: P({ tor: 26, rot: 6, head: -14, auf: -22, alf: 44, aub: -45, alb: 34, luf: 55, llf: -50, lub: -45, llb: -35, ftb: -20 }),
  dash2: P({ tor: 22, rot: 4, head: -12, auf: -20, alf: 50, aub: -45, alb: 40, luf: -10, llf: -60, lub: 30, llb: -70, ftf: -20 }),
  backdash: P({ tor: -14, head: 6, auf: 55, alf: 90, aub: 40, alb: 95, luf: 35, llf: -15, lub: -25, llb: -70, ry: -6 }),
  backdash2: P({ tor: -6, head: 4, auf: 46, alf: 100, aub: 30, alb: 100, luf: 40, llf: -60, lub: 10, llb: -70 }),
  block: P({ tor: -4, head: 14, auf: 70, alf: 118, aub: 78, alb: 110, luf: 22, llf: -24, lub: -22, llb: -14, rx: -2 }),
  crouchBlock: P({ auf: 75, alf: 118, aub: 82, alb: 110, head: 0 }, CROUCH),
  // two hit reactions, alternated so combos do not repeat the same frame: head snapped back / doubled over
  hitstun: P({ tor: -22, head: -16, rot: -6, auf: 20, alf: 50, aub: 60, alb: 40, luf: 14, llf: -14, lub: -24, llb: -14, rx: -4 }),
  hitGut: P({ tor: 30, head: 18, rot: -4, auf: 30, alf: 70, aub: 40, alb: 80, luf: 26, llf: -34, lub: -20, llb: -22, rx: -5 }),
  crouchHit: P({ tor: 6, head: -18, auf: -10, alf: 40, aub: 40, alb: 30 }, CROUCH),
  launched: P({ rot: -55, tor: -18, head: -16, auf: 150, alf: 30, aub: 165, alb: 25, luf: 35, llf: -45, lub: 10, llb: -25, ftf: 30, ftb: 20 }),
  knockdown: P({ rot: -90, tor: 0, head: 10, auf: 112, alf: 30, aub: 132, alb: 20, luf: 12, llf: -22, lub: 2, llb: -8 }),
  sitUp: P({ rot: -50, tor: 52, head: 6, auf: 26, alf: 40, aub: 6, alb: 50, luf: 88, llf: -120, lub: 70, llb: -130 }),
  getup: P({ rot: -25, tor: 30, head: -10, auf: 30, alf: 10, aub: -20, alb: 20, luf: 80, llf: -110, lub: 40, llb: -120 }),
  grabbed: P({ rot: -8, tor: -18, head: -24, auf: 150, alf: 30, aub: 160, alb: 30, luf: 8, llf: -22, lub: -12, llb: -30, ry: -14, ftf: -30, ftb: -30 }),
  // victory default: near fist punched up and forward of the face (never across it), far fist at the hip
  win: P({ tor: -8, head: -12, auf: 126, alf: 26, aub: 20, alb: 100, luf: 18, llf: -10, lub: -18, llb: -8 }),
  lose: P({ tor: 34, head: 26, auf: 6, alf: 6, aub: -4, alb: 8, luf: 82, llf: -92, lub: -8, llb: -96 }),
  // round intro: chin up, fist pounding the open palm at chest height ("bring it on")
  intro: P({ tor: -4, head: -10, auf: 48, alf: 112, aub: 56, alb: 96, luf: 14, llf: -6, lub: -14, llb: -4 }),
};
POSES.ko = POSES.knockdown;

// attack sets: w = wind-up (startup), s = strike (active), r = follow-through (recovery), alt = alternating strike.
// limb picks which joints lead the snap (the striking limb arrives last, like a whip); ov = overshoot past the strike.
const A = (w, s, r, alt, meta) => ({
  w: P(w), s: P(s), r: r ? P(r) : null, alt: alt ? P(alt) : null,
  limb: (meta && meta.limb) || 'arm', ov: meta && meta.ov != null ? meta.ov : 0.1,
});
export const ATTACKS = {
  jab: A({ tor: 0, auf: 28, alf: 130, aub: 26, alb: 112, rx: -2 },
    { tor: 12, rot: 2, head: -6, auf: 90, alf: 2, aub: 26, alb: 118, rx: 4 },
    { tor: 9, auf: 66, alf: 60, aub: 24, alb: 114, rx: 2 }, null, { ov: 0.08 }),
  punch: A({ tor: -14, rot: -4, head: 4, auf: -18, alf: 120, aub: 60, alb: 72, luf: 22, lub: -22, rx: -4 },
    { tor: 24, rot: 6, head: -10, auf: 94, alf: 0, aub: -32, alb: 52, luf: 36, llf: -18, lub: -36, llb: -4, rx: 9 },
    { tor: 30, rot: 7, head: -6, auf: 72, alf: 26, aub: -22, alb: 62, luf: 34, llf: -20, lub: -32, llb: -8, rx: 7 }, null, { ov: 0.12 }),
  kick: A({ tor: -6, auf: 55, alf: 95, aub: 24, alb: 100, luf: 80, llf: -122, ftf: 10, lub: -10, llb: -8 },
    { tor: -22, rot: -4, head: 6, auf: 66, alf: 70, aub: -32, alb: 50, luf: 100, llf: -2, ftf: 72, lub: -8, llb: -6 },
    { tor: -12, head: 2, auf: 60, alf: 85, aub: -10, alb: 70, luf: 72, llf: -96, ftf: 20, lub: -10, llb: -8 }, null, { limb: 'leg', ov: 0.1 }),
  lowKick: A({ ...CROUCH_LEGS, tor: 26, luf: 70, llf: -124 },
    { ...CROUCH_LEGS, tor: 20, head: -4, luf: 80, llf: -6, ftf: 40, lub: 28, llb: -120, rx: 4 },
    { ...CROUCH_LEGS, tor: 24, luf: 78, llf: -60, ftf: 15 }, null, { limb: 'leg', ov: 0.06 }),
  sweep: A({ ...CROUCH_LEGS, tor: 20, rot: -6, luf: 64, llf: -122 },
    { ...CROUCH_LEGS, tor: 36, rot: 10, head: -20, auf: 80, alf: 6, luf: 88, llf: 0, ftf: 55, lub: 34, llb: -125, rx: 6 },
    { ...CROUCH_LEGS, tor: 34, rot: 7, head: -14, auf: 70, alf: 30, luf: 86, llf: -24, ftf: 30, lub: 32, llb: -122, rx: 5 }, null, { limb: 'leg', ov: 0.08 }),
  uppercut: A({ tor: 26, head: -4, auf: -24, alf: 130, aub: 40, alb: 90, luf: 48, llf: -76, lub: -15, llb: -66 },
    { tor: -12, rot: -5, head: -18, auf: 150, alf: 8, aub: 20, alb: 100, luf: 12, llf: -6, lub: -26, llb: -14, ftb: -30, ry: -12 },
    { tor: -6, rot: -3, head: -10, auf: 136, alf: 36, aub: 24, alb: 104, luf: 18, llf: -14, lub: -22, llb: -12, ry: -4 }, null, { ov: 0.1 }),
  airPunch: A({ ...AIR_LEGS, tor: -6, auf: 30, alf: 124 },
    { ...AIR_LEGS, tor: 20, head: -10, auf: 64, alf: 2, aub: 110, alb: 40 },
    { ...AIR_LEGS, tor: 14, head: -6, auf: 60, alf: 50, aub: 104, alb: 46 }, null, { ov: 0.08 }),
  airKick: A({ tor: 4, luf: 72, llf: -122, lub: 20, llb: -90, auf: 100, alf: 40, aub: 130, alb: 30 },
    { tor: -12, head: 6, luf: 62, llf: -4, ftf: 45, lub: -6, llb: -100, auf: 100, alf: 30, aub: 140, alb: 30 },
    { tor: -8, head: 4, luf: 66, llf: -30, ftf: 30, lub: -2, llb: -96, auf: 96, alf: 34, aub: 132, alb: 32 }, null, { limb: 'leg', ov: 0.06 }),
  slam: A({ tor: -16, head: -8, auf: 200, alf: 40, aub: 195, alb: 40, luf: 18, llf: -10, lub: -18, llb: -8, ry: -6 },
    { tor: 44, rot: 8, head: -20, auf: 70, alf: 0, aub: 62, alb: 4, luf: 58, llf: -78, lub: -38, llb: -55 },
    { tor: 48, rot: 9, head: -14, auf: 52, alf: 12, aub: 46, alb: 14, luf: 60, llf: -84, lub: -38, llb: -58 }, null, { ov: 0.08 }),
  throw: A({ tor: 14, auf: 86, alf: 24, aub: 88, alb: 34, luf: 30, lub: -20, rx: 3 },
    { tor: 8, head: -6, auf: 72, alf: 64, aub: 74, alb: 72, luf: 28, llf: -18, lub: -24, llb: -8, rx: 2 },
    { tor: -22, rot: -8, head: -6, auf: 205, alf: 30, aub: 195, alb: 40, luf: 20, llf: -10, lub: -30, llb: -20 }, null, { limb: 'body', ov: 0.04 }),
  // Shinchan's butt taunt: he turns his back (the animator flips him) and bends over
  taunt: A({ tor: 10, head: -10, auf: 20, alf: 60, aub: 20, alb: 60, luf: 10, llf: -10, lub: -14, llb: -8 },
    { tor: 62, rot: -6, head: -46, auf: -24, alf: 70, aub: -30, alb: 80, luf: 4, llf: -6, lub: -16, llb: -4 },
    { tor: 56, rot: -6, head: -40, auf: -20, alf: 90, aub: -24, alb: 96, luf: 6, llf: -8, lub: -14, llb: -6 }, null, { limb: 'body', ov: 0 }),
  spin: A({ tor: -10, auf: 20, alf: 110, aub: 20, alb: 110 },
    { tor: 4, head: -6, auf: 92, alf: 0, aub: -92, alb: 0, luf: 10, llf: -8, lub: -12, llb: -8 },
    { tor: 6, head: -4, auf: 80, alf: 20, aub: -70, alb: 20, luf: 12, llf: -10, lub: -12, llb: -8 }, null, { limb: 'body', ov: 0.04 }),
  cast: A({ tor: -12, rot: -3, auf: -12, alf: 125, aub: 34, alb: 95, luf: 22, lub: -22, rx: -3 },
    { tor: 14, head: -8, auf: 90, alf: 0, aub: 84, alb: 6, luf: 30, llf: -12, lub: -30, llb: -8, rx: 4 },
    { tor: 16, head: -6, auf: 80, alf: 16, aub: 70, alb: 24, luf: 30, llf: -12, lub: -30, llb: -8, rx: 3 }, null, { ov: 0.1 }),
  beam: A({ tor: -16, head: -6, auf: -30, alf: 85, aub: -38, alb: 80, luf: 40, llf: -55, lub: -38, llb: -25 },
    { tor: 12, head: -6, auf: 92, alf: 0, aub: 88, alb: 3, luf: 42, llf: -40, lub: -40, llb: -20, rx: 4 },
    { tor: 14, head: -6, auf: 90, alf: 4, aub: 86, alb: 6, luf: 42, llf: -40, lub: -40, llb: -20, rx: 3 }, null, { ov: 0.06 }),
  dashStrike: A({ tor: 10, head: -6, auf: 20, alf: 110, aub: -20, alb: 60, luf: 50, llf: -80, lub: -30, llb: -60 },
    { tor: 30, rot: 12, head: -18, auf: 96, alf: 0, aub: -60, alb: 25, luf: 60, llf: -60, lub: -60, llb: -25, rx: 10 },
    { tor: 24, rot: 8, head: -12, auf: 80, alf: 20, aub: -40, alb: 40, luf: 50, llf: -50, lub: -46, llb: -26, rx: 6 }, null, { ov: 0.1 }),
  glide: A({ tor: 6, head: -10, auf: 115, alf: 15, aub: 120, alb: 20, luf: 12, llf: -24, lub: -6, llb: -30, ftf: -20, ftb: -25 },
    { tor: 6, head: -10, auf: 115, alf: 15, aub: 120, alb: 20, luf: 12, llf: -24, lub: -6, llb: -30, ftf: -20, ftb: -25, ry: -4 }, null, null, { limb: 'body', ov: 0 }),
  teleport: A({ ...CROUCH_LEGS, tor: 20, auf: 70, alf: 120, aub: 75, alb: 120 },
    { tor: 0, head: 0, auf: 20, alf: 10, aub: 10, alb: 10, luf: 0, llf: -5, lub: 0, llb: -5 },
    { tor: 10, head: -4, auf: 30, alf: 70, aub: 20, alb: 80, luf: 10, llf: -12, lub: -10, llb: -8 }, null, { limb: 'body', ov: 0 }),
  buff: A({ tor: 22, head: 10, auf: 60, alf: 120, aub: 56, alb: 124, luf: 34, llf: -48, lub: -30, llb: -36 },
    { tor: -12, head: -18, auf: 22, alf: 42, aub: 26, alb: 48, luf: 30, llf: -30, lub: -30, llb: -20, sy: 1.03 },
    { tor: -8, head: -12, auf: 24, alf: 56, aub: 26, alb: 60, luf: 28, llf: -26, lub: -28, llb: -16 }, null, { limb: 'body', ov: 0.05 }),
  flurry: A({ auf: 22, alf: 128, tor: 2, rx: -2 },
    { tor: 16, head: -8, auf: 92, alf: 0, aub: 30, alb: 110, luf: 30, llf: -14, lub: -28, llb: -6, rx: 5 },
    { tor: 10, head: -6, auf: 64, alf: 70, aub: 40, alb: 104, luf: 26, llf: -14, lub: -26, llb: -6, rx: 2 },
    { tor: 18, head: -8, auf: 30, alf: 110, aub: 92, alb: 0, luf: 30, llf: -14, lub: -28, llb: -6, rx: 6 }, { ov: 0.06 }),
  ultimate: A({ tor: -14, head: -10, auf: -40, alf: 70, aub: -45, alb: 70, luf: 42, llf: -60, lub: -40, llb: -30, sy: 0.97 },
    { tor: 22, rot: 6, head: -14, auf: 115, alf: 0, aub: 105, alb: 5, luf: 42, llf: -24, lub: -42, llb: -10, rx: 6 },
    { tor: 18, rot: 4, head: -10, auf: 96, alf: 20, aub: 86, alb: 24, luf: 40, llf: -24, lub: -40, llb: -10, rx: 4 },
    { tor: 26, rot: 8, head: -10, auf: 92, alf: 0, aub: 40, alb: 100, luf: 46, llf: -24, lub: -42, llb: -10, rx: 8 }, { ov: 0.08 }),
};

/** anims whose own legs should be kept when the move is done crouching / in the air */
export const OWN_LEGS = { lowKick: 1, sweep: 1, uppercut: 1, airKick: 1, airPunch: 1, glide: 1, slam: 1, kick: 1, teleport: 1, taunt: 1 };

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

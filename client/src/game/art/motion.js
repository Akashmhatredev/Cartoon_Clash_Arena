// Phaser-free per-character motion personality: fighting stance, idle life, gait, jump, weight, reactions and
// victory/defeat loops. Angles follow rig.js conventions (degrees, forward-positive). Stances, win/lose/intro
// poses are partial poses merged over IDLE; fidget poses are partial DELTAS added on top of the idle.

const BASE = {
  stance: {},
  bounce: { amp: 3, hz: 1.4 },     // knee flex (deg) and frequency of the fighting-stance bounce
  breathe: 1.6,                    // torso/shoulder breathing amplitude (deg)
  sway: 0.8,                       // weight-shift amplitude (px)
  wiggle: 0,                       // hip wiggle amplitude (deg), cheeky characters
  tremble: 0,                      // nervous high-frequency shake (px)
  // gait: swing = hip-to-ankle half-step angle (deg), duty = stance share of the cycle, lift = swing knee bend,
  // absorb = mid-stance knee bend, arm = arm swing (deg), lean/backLean = torso pitch walking fwd/back (deg),
  // bob = extra hop at the passing position (px), waddle = side roll (deg), skate = share of ground speed the
  // feet may slide (0 = planted, 1 = gliding), hop = flight height (px) when duty < 0.5 (bounding gait)
  walk: { swing: 26, duty: 0.58, lift: 46, absorb: 10, arm: 12, lean: 4, backLean: 5, bob: 1, waddle: 0, skate: 0, hop: 0 },
  weight: 0.5,                     // 0 = light and bouncy, 1 = heavy and planted
  snap: 1,                         // strike overshoot scale
  headK: 1,                        // how much the head follows pose head angles (big heads tilt less)
  headLim: 38,                     // max head tilt away from the stance (deg)
  flip: false,                     // front flip on forward jumps
  dashGuard: 0.3,                  // 0 = arms swept back while dashing (ninja run), 1 = guard kept up
  fidget: null,                    // { every: s, dur: s, pose: deltas } idle habit
  win: null,                       // partial pose for the victory loop (falls back to POSES.win)
  winMove: 'pump',                 // pump | buri | wiggle | hop | wave | flex | proud | bow | blaze
  lose: null,
  loseMove: 'slump',               // slump | sob
  intro: null,
};

const M = {
  shinchan: {
    // cheeky: knees loose, hips cocked, fists low and lazy
    stance: { tor: 2, head: -4, rot: -2, auf: 22, alf: 76, aub: 10, alb: 70, luf: 14, llf: -12, lub: -12, llb: -8 },
    bounce: { amp: 4, hz: 1.8 }, breathe: 2, wiggle: 3.5,
    walk: { swing: 30, duty: 0.55, lift: 52, absorb: 6, arm: 30, lean: 2, backLean: 4, bob: 2.5, waddle: 5, skate: 0.3 },
    weight: 0.25, snap: 1.2, headK: 0.55, headLim: 22,
    fidget: { every: 4.5, dur: 1.1, pose: { rot: 6, tor: -6, head: -8, aub: 30, alb: 40 } },
    // his signature victory: back to the opponent, bent over, butt wiggle
    win: { tor: 56, rot: -6, head: -42, auf: -30, alf: 60, aub: -36, alb: 70, luf: 6, llf: -8, lub: -16, llb: -6 },
    winMove: 'buri',
    lose: { tor: 40, head: 14, luf: 86, llf: -100, lub: -6, llb: -100 },
    loseMove: 'sob',
  },
  doraemon: {
    // round and calm: upright, near paw resting low at the side so the bell and the 4D pocket stay visible
    stance: { tor: -2, head: -2, auf: -12, alf: 46, aub: 80, alb: 36, luf: 10, llf: -8, lub: -10, llb: -6 },
    bounce: { amp: 2, hz: 1.0 }, breathe: 1.4, sway: 1.2,
    walk: { swing: 34, duty: 0.6, lift: 40, absorb: 6, arm: 10, lean: 1, backLean: 3, bob: 1.5, waddle: 7, skate: 0.5 },
    weight: 0.6, snap: 0.8, headK: 0.4, headLim: 14,
    fidget: { every: 6, dur: 1.2, pose: { tor: -4, head: -6, auf: 40, alf: 30 } },
    // waving paw raised out to the side, clear of his chin, bell and pocket
    win: { tor: -6, head: -6, auf: 205, alf: 26, aub: 150, alb: 20, luf: 12, llf: -10, lub: -12, llb: -8 },
    winMove: 'wave',
  },
  hattori: {
    // low ninja: deep wide stance, lead hand blade-forward, rear hand ready at the hip
    stance: { tor: 20, head: -14, rot: 2, auf: 74, alf: 28, aub: -34, alb: 58, luf: 28, llf: -46, lub: -22, llb: -30, ftb: -10 },
    bounce: { amp: 2, hz: 0.9 }, breathe: 1.2, sway: 0.5,
    walk: { swing: 33, duty: 0.56, lift: 56, absorb: 14, arm: 6, lean: 8, backLean: 2, bob: 0, waddle: 0 },
    weight: 0.2, snap: 1.2, flip: true, dashGuard: 0,
    fidget: { every: 6, dur: 0.9, pose: { head: 10, tor: -4 } },
    // a bow, then the ninja hand sign held at the chest (nin-nin)
    win: { tor: 2, head: -6, auf: 58, alf: 128, aub: 54, alb: 132, luf: 6, llf: -4, lub: -6, llb: -4 },
    winMove: 'bow',
    intro: { tor: 2, head: -6, auf: 58, alf: 128, aub: 54, alb: 132, luf: 6, llf: -4, lub: -6, llb: -4 },
  },
  pikachu: {
    // bouncy: up on its toes, paws up, constant springy hop
    stance: { tor: 14, head: -8, auf: 60, alf: 80, aub: 46, alb: 84, luf: 30, llf: -52, lub: 12, llb: -44 },
    bounce: { amp: 6, hz: 2.4 }, breathe: 1.4,
    walk: { swing: 32, duty: 0.3, lift: 50, absorb: 12, arm: 16, lean: 6, backLean: 4, bob: 0, waddle: 2, skate: 0.2, hop: 7 },
    weight: 0.15, snap: 1.2, headK: 0.45, headLim: 16, flip: true,
    fidget: { every: 4, dur: 0.7, pose: { head: -8, tor: -4, auf: 20 } },
    win: { tor: -10, head: -10, auf: 40, alf: 60, aub: 30, alb: 60, luf: 20, llf: -30, lub: 4, llb: -26 },
    winMove: 'hop',
  },
  ben10: {
    // scrappy kid brawler: fists up, light on his feet
    stance: { tor: 8, head: -4, auf: 46, alf: 108, aub: 30, alb: 114, luf: 20, llf: -18, lub: -16, llb: -8 },
    bounce: { amp: 3, hz: 1.5 },
    walk: { swing: 26, duty: 0.56, lift: 48, absorb: 10, arm: 10, lean: 4, backLean: 5, bob: 1 },
    weight: 0.45,
    fidget: { every: 5, dur: 0.9, pose: { aub: 30, alb: 20, auf: -10, head: 8 } },
    win: { tor: -8, head: -12, auf: 128, alf: 24, aub: 20, alb: 104, luf: 16, llf: -10, lub: -16, llb: -8 },
  },
  fourarms: {
    // huge and heavy: wide, sunk into the knees, slow breathing
    stance: { tor: 10, head: 2, auf: 34, alf: 84, aub: 24, alb: 92, luf: 26, llf: -28, lub: -24, llb: -14 },
    bounce: { amp: 2, hz: 0.8 }, breathe: 2.4, sway: 1.4,
    walk: { swing: 22, duty: 0.64, lift: 36, absorb: 14, arm: 8, lean: 6, backLean: 4, bob: 0, waddle: 3 },
    weight: 1, snap: 0.7, dashGuard: 0.8,
    win: { tor: -12, head: -14, auf: -25, alf: 95, aub: -20, alb: 95, luf: 24, llf: -18, lub: -24, llb: -12 },
    winMove: 'proud',
  },
  xlr8: {
    // coiled sprinter: low and forward, tail out, wheels glide instead of stepping
    stance: { tor: 26, head: -16, auf: 22, alf: 72, aub: -12, alb: 62, luf: 36, llf: -54, lub: -10, llb: -42 },
    bounce: { amp: 4, hz: 2.6 }, breathe: 1,
    walk: { swing: 18, duty: 0.6, lift: 30, absorb: 8, arm: 6, lean: 12, backLean: 0, bob: 0, waddle: 0, skate: 0.6 },
    weight: 0.1, snap: 1.3, flip: true, dashGuard: 0,
    win: { tor: 6, head: -10, auf: 60, alf: 120, aub: 40, alb: 124, luf: 30, llf: -30, lub: -10, llb: -20 },
    winMove: 'pump',
  },
  heatblast: {
    // fiery: upright and proud, fists loaded, flickering energy
    stance: { tor: 4, head: -4, auf: 62, alf: 66, aub: 30, alb: 82, luf: 18, llf: -16, lub: -16, llb: -8 },
    bounce: { amp: 2.5, hz: 1.3 }, breathe: 2,
    weight: 0.5, snap: 1.1,
    win: { tor: -8, head: -12, auf: 130, alf: 24, aub: 40, alb: 90, luf: 16, llf: -10, lub: -16, llb: -8 },
    winMove: 'blaze',
  },
  nobita: {
    // timid: knees together, hunched, hands up near the chin, trembling
    stance: { tor: 12, head: 6, auf: 52, alf: 122, aub: 46, alb: 124, luf: 8, llf: -10, lub: -6, llb: -8 },
    bounce: { amp: 1.5, hz: 1.0 }, breathe: 2.4, tremble: 0.6,
    walk: { swing: 20, duty: 0.6, lift: 36, absorb: 6, arm: 10, lean: 8, backLean: 10, bob: 1, waddle: 1 },
    weight: 0.35, snap: 0.9,
    fidget: { every: 5, dur: 1.0, pose: { auf: 70, alf: 40, head: -6 } },
    win: { tor: -10, head: -14, auf: 140, alf: 14, aub: 30, alb: 90, luf: 14, llf: -10, lub: -14, llb: -8 },
    winMove: 'hop',
    loseMove: 'sob',
  },
  goku: {
    // martial artist: Turtle-school stance, lead open hand forward, rear fist chambered
    stance: { tor: 12, head: -8, rot: 2, auf: 66, alf: 64, aub: -22, alb: 112, luf: 32, llf: -38, lub: -28, llb: -22 },
    bounce: { amp: 4, hz: 2.0 }, breathe: 1.2,
    walk: { swing: 32, duty: 0.55, lift: 50, absorb: 10, arm: 8, lean: 6, backLean: 3, bob: 1 },
    weight: 0.3, snap: 1.2, headK: 0.8, flip: true, dashGuard: 0.2,
    fidget: { every: 5, dur: 0.9, pose: { auf: -10, aub: 20, tor: -4, head: -6 } },
    win: { tor: -6, head: -12, auf: 124, alf: 28, aub: 16, alb: 108, luf: 22, llf: -14, lub: -22, llb: -10 },
    winMove: 'pump',
  },
  bheem: {
    // strong village kid: broad, planted, chest out
    stance: { tor: 4, head: -6, auf: 32, alf: 96, aub: 26, alb: 100, luf: 26, llf: -24, lub: -24, llb: -10 },
    bounce: { amp: 2, hz: 0.9 }, breathe: 2.4, sway: 1,
    walk: { swing: 24, duty: 0.62, lift: 40, absorb: 12, arm: 12, lean: 4, backLean: 4, bob: 0, waddle: 2 },
    weight: 0.85, snap: 0.8, dashGuard: 0.7,
    fidget: { every: 6, dur: 1.2, pose: { tor: -6, head: -8, auf: 30, alf: 40 } },
    // hands on hips, chest out, laughing
    win: { tor: -12, head: -14, auf: -25, alf: 95, aub: -20, alb: 95, luf: 24, llf: -18, lub: -24, llb: -10 },
    winMove: 'proud',
  },
};

const cache = new Map();
/** Motion style for a fighter or ben10 form (form wins when it has its own entry). */
export function motionFor(charId, form = null) {
  const key = (form && M[form] ? form : charId) || 'ben10';
  let m = cache.get(key);
  if (m) return m;
  const src = M[key] || {};
  m = { ...BASE, ...src, bounce: { ...BASE.bounce, ...src.bounce }, walk: { ...BASE.walk, ...src.walk } };
  cache.set(key, m);
  return m;
}

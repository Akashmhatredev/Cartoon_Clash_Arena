// AI difficulty profiles and per-fighter play styles. Pure data.
//
// Difficulty fields:
//   reaction   frames of perception delay (opponent is seen this many frames in the past)
//   jitter     extra 0..jitter frames added (seeded), so reactions are never faster than `reaction`
//   decide     frames between neutral decisions
//   block      chance to guard a perceived attack / projectile (rolled once per threat)
//   antiAir    chance to anti-air a perceived jump-in
//   punish     chance to punish a perceived unsafe move (opponent in recovery)
//   throwBlk   chance per neutral decision to throw a blocking opponent at close range
//   combo      max moves in a planned combo route
//   chain      chance to continue a route blind (without a hit confirm) for one more press
//   special    multiplier on special usage
//   ult        uses ultimates at all
//   mistake    chance to mis-time / skip a correct response
//   aggression multiplier on the style's aggression
//   wake       chance to block on wake-up
//   tech       chance to tech a throw
//   jumpDodge  chance to jump over / dodge a projectile instead of blocking it
//   spacing    0..1 how strictly it honours its preferred range
//   projGap    minimum frames between own projectiles (avoid spam)
//   stall      frames without attacking before it forces offence
export const DIFFICULTY = {
  easy: {
    reaction: 24, jitter: 6, decide: 24, block: 0.2, antiAir: 0.05, punish: 0, throwBlk: 0.04,
    combo: 1, chain: 0.12, special: 0.18, ult: false, mistake: 0.25, aggression: 0.6, wake: 0.1,
    tech: 0, jumpDodge: 0.05, spacing: 0.25, projGap: 220, stall: 150,
  },
  normal: {
    reaction: 14, jitter: 4, decide: 12, block: 0.5, antiAir: 0.3, punish: 0.3, throwBlk: 0.18,
    combo: 3, chain: 0.4, special: 0.65, ult: true, mistake: 0.15, aggression: 0.85, wake: 0.4,
    tech: 0.25, jumpDodge: 0.25, spacing: 0.75, projGap: 140, stall: 130,
  },
  hard: {
    reaction: 9, jitter: 3, decide: 7, block: 0.75, antiAir: 0.65, punish: 0.8, throwBlk: 0.45,
    combo: 4, chain: 0.5, special: 1, ult: true, mistake: 0.1, aggression: 1, wake: 0.7,
    tech: 0.5, jumpDodge: 0.45, spacing: 1, projGap: 110, stall: 110,
  },
  boss: {
    reaction: 8, jitter: 2, decide: 6, block: 0.8, antiAir: 0.75, punish: 0.9, throwBlk: 0.5,
    combo: 4, chain: 0.55, special: 1, ult: true, mistake: 0.07, aggression: 1.1, wake: 0.8,
    tech: 0.6, jumpDodge: 0.5, spacing: 1, projGap: 100, stall: 100,
  },
};

// Style fields:
//   range      preferred gap (px from own centre to the opponent's hurtbox edge); null = auto from best poke
//   keepAway   retreats when the opponent is inside its range (zoners)
//   aggression 0..1 chance to attack when in range
//   jump       chance to jump in when approaching from mid range
//   dash       chance to dash instead of walk when approaching
//   antiAir    preferred anti-air slot (falls back to the best upward hitbox)
//   routes     combo routes [{ s: [slots...], w: weight }]; first move must reach
//   specials   [{ slot, use, min, max, w, dir: 'fwd'|'back'|null, ... }]
//              use: zone | approach | close | escape | buff | trap | charge | punish
//   forms      ben10 only: preferred form by gap
export const STYLES = {
  shinchan: {
    range: null, keepAway: false, aggression: 0.75, jump: 0.14, dash: 0.35, antiAir: 'heavy',
    routes: [
      { s: ['light', 'light', 'heavy', 'special3'], w: 3 },
      { s: ['crouchLight', 'light', 'special2'], w: 2 },
      { s: ['heavy', 'special3'], w: 1 },
      { s: ['crouchHeavy'], w: 1 },
    ],
    specials: [
      { slot: 'special2', use: 'approach', min: 60, max: 220, w: 1.2, dir: 'fwd' },
      { slot: 'special1', use: 'escape', min: 0, max: 120, w: 1, dir: 'back' },
      { slot: 'special3', use: 'close', min: 0, max: 60, w: 0.5 },
    ],
  },
  doraemon: {
    range: null, keepAway: false, aggression: 0.55, jump: 0.06, dash: 0.15, antiAir: 'heavy',
    routes: [
      { s: ['light', 'light', 'heavy'], w: 3 },
      { s: ['crouchLight', 'heavy', 'special3'], w: 2 },
      { s: ['heavy'], w: 1 },
    ],
    specials: [
      { slot: 'special3', use: 'close', min: 0, max: 160, w: 0.8 },
      { slot: 'special2', use: 'escape', min: 0, max: 90, w: 0.8, dir: 'back' },
      { slot: 'special2', use: 'approach', min: 260, max: 900, w: 0.4, dir: 'fwd' },
      { slot: 'special1', use: 'approach', min: 180, max: 420, w: 0.3 },
    ],
  },
  hattori: {
    range: null, keepAway: false, aggression: 0.7, jump: 0.2, dash: 0.45, antiAir: 'heavy',
    routes: [
      { s: ['light', 'light', 'crouchHeavy'], w: 3 },
      { s: ['crouchLight', 'light', 'heavy', 'special2'], w: 2 },
      { s: ['crouchHeavy'], w: 1 },
    ],
    specials: [
      { slot: 'special3', use: 'zone', min: 240, max: 900, w: 0.7 },
      { slot: 'special2', use: 'approach', min: 120, max: 360, w: 0.8, dir: 'fwd' },
      { slot: 'special2', use: 'punish', min: 0, max: 360, w: 1, dir: 'fwd' },
      { slot: 'special1', use: 'zone', min: 260, max: 900, w: 0.3 },
    ],
  },
  pikachu: {
    range: 220, keepAway: false, aggression: 0.6, jump: 0.12, dash: 0.3, antiAir: 'heavy',
    routes: [
      { s: ['light', 'light', 'heavy', 'special3'], w: 3 },
      { s: ['crouchLight', 'heavy', 'special2'], w: 2 },
      { s: ['heavy'], w: 1 },
    ],
    specials: [
      { slot: 'special1', use: 'zone', min: 220, max: 900, w: 1.2 },
      { slot: 'special2', use: 'approach', min: 140, max: 380, w: 0.6, dir: 'fwd' },
      { slot: 'special2', use: 'punish', min: 0, max: 380, w: 1, dir: 'fwd' },
      { slot: 'special3', use: 'close', min: 0, max: 90, w: 0.6 },
    ],
  },
  ben10: {
    range: null, keepAway: false, aggression: 0.65, jump: 0.1, dash: 0.3, antiAir: 'heavy',
    routes: [
      { s: ['light', 'light', 'heavy', 'special3'], w: 3 },
      { s: ['crouchLight', 'heavy'], w: 2 },
      { s: ['heavy', 'special2'], w: 1 },
    ],
    specials: [
      { slot: 'special2', use: 'approach', min: 120, max: 360, w: 0.6, dir: 'fwd' },
      { slot: 'special3', use: 'zone', min: 220, max: 900, w: 0.8 },
    ],
    // form preferences: far -> heatblast (ranged, needs ammo), mid -> xlr8 (fast), close -> fourarms (strong)
    forms: { shiftSlot: 'special1', far: 'heatblast', mid: 'xlr8', close: 'fourarms', farGap: 320, closeGap: 140 },
  },
  nobita: {
    range: 340, keepAway: true, aggression: 0.45, jump: 0.05, dash: 0.1, antiAir: 'heavy',
    routes: [
      { s: ['light', 'heavy'], w: 3 },
      { s: ['crouchLight', 'light', 'special1'], w: 2 },
      { s: ['heavy'], w: 1 },
    ],
    specials: [
      { slot: 'special1', use: 'zone', min: 200, max: 900, w: 1.3 },
      { slot: 'special3', use: 'trap', min: 160, max: 900, w: 0.8, entity: 'trap' },
      { slot: 'special2', use: 'escape', min: 0, max: 110, w: 1, dir: 'back' },
    ],
  },
  goku: {
    range: null, keepAway: false, aggression: 0.9, jump: 0.14, dash: 0.55, antiAir: 'heavy',
    routes: [
      { s: ['light', 'light', 'heavy', 'special3'], w: 4 },
      { s: ['crouchLight', 'light', 'heavy', 'special2'], w: 2 },
      { s: ['heavy', 'special3'], w: 1 },
      { s: ['crouchHeavy'], w: 1 },
    ],
    specials: [
      { slot: 'special1', use: 'charge', min: 460, max: 1200, w: 0.7, hold: 40 },
      { slot: 'special3', use: 'approach', min: 120, max: 320, w: 0.7, dir: null },
      { slot: 'special2', use: 'close', min: 80, max: 260, w: 0.4, dir: 'fwd' },
      { slot: 'special2', use: 'punish', min: 0, max: 260, w: 1, dir: 'fwd' },
    ],
  },
  bheem: {
    range: null, keepAway: false, aggression: 0.7, jump: 0.05, dash: 0.2, antiAir: 'heavy',
    routes: [
      { s: ['heavy'], w: 3 },
      { s: ['light', 'heavy', 'special2'], w: 3 },
      { s: ['crouchLight', 'crouchHeavy'], w: 1 },
      { s: ['light', 'light', 'heavy'], w: 2 },
    ],
    specials: [
      { slot: 'special3', use: 'buff', min: 220, max: 900, w: 0.8, buff: 'superStrength' },
      { slot: 'special1', use: 'approach', min: 120, max: 320, w: 0.5 },
      { slot: 'special1', use: 'punish', min: 0, max: 320, w: 1 },
      { slot: 'special2', use: 'close', min: 0, max: 70, w: 0.6, dir: 'fwd' },
    ],
  },
};

const DEFAULT_STYLE = {
  range: null, keepAway: false, aggression: 0.65, jump: 0.1, dash: 0.3, antiAir: 'heavy',
  routes: [{ s: ['light', 'light', 'heavy'], w: 2 }, { s: ['heavy'], w: 1 }],
  specials: [],
};

export function getStyle(charId) {
  return STYLES[charId] || DEFAULT_STYLE;
}

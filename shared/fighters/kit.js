// Move builders. Every move is plain data; fighter files override only what differs.
// hitbox: { x, y, w, h } relative to the feet, x forward (mirrored by facing), y negative = up (top edge), h downward.
// Frame model: frames 1..startup are startup, the next `active` frames can hit, then `recovery`.

const BASE = {
  kind: 'normal', guard: 'mid', hits: 1, hitInterval: 0, cooldown: 0, meterGain: 5, meterCost: 0, scaling: 1,
  effect: 'hit', strength: 1, chip: null, knockback: { x: 3, y: 0 }, knockdown: false, juggle: 1,
};

const mk = (def, o = {}) => ({ ...BASE, ...def, ...o });

// Normals cancel into the listed slots on hit or block (and into any special/ultimate).
const LIGHT_CHAIN = ['light', 'crouchLight', 'heavy', 'crouchHeavy'];

export const light = (o) => mk({
  input: 'L', anim: 'jab', startup: 5, active: 3, recovery: 9, damage: 5, hitstun: 15, blockstun: 10,
  knockback: { x: 2.5, y: 0 }, hitbox: { x: 8, y: -120, w: 64, h: 60 }, meterGain: 4, cancel: LIGHT_CHAIN,
}, o);

export const heavy = (o) => mk({
  input: 'H', anim: 'punch', startup: 10, active: 4, recovery: 16, damage: 10, hitstun: 20, blockstun: 14,
  knockback: { x: 5, y: 0 }, hitbox: { x: 10, y: -125, w: 84, h: 70 }, strength: 2, meterGain: 7, effect: 'heavyHit',
}, o);

export const crouchLight = (o) => mk({
  input: '↓+L', anim: 'lowKick', startup: 5, active: 3, recovery: 9, damage: 4, hitstun: 14, blockstun: 9, guard: 'low',
  knockback: { x: 2, y: 0 }, hitbox: { x: 8, y: -42, w: 66, h: 42 }, meterGain: 4, cancel: LIGHT_CHAIN,
}, o);

export const crouchHeavy = (o) => mk({
  input: '↓+H', anim: 'sweep', startup: 11, active: 4, recovery: 20, damage: 9, hitstun: 22, blockstun: 12, guard: 'low',
  knockback: { x: 4, y: -6 }, knockdown: true, hitbox: { x: 10, y: -36, w: 92, h: 36 }, strength: 2, meterGain: 7, effect: 'dust',
}, o);

export const airLight = (o) => mk({
  input: 'Air L', anim: 'airPunch', startup: 5, active: 6, recovery: 6, damage: 5, hitstun: 14, blockstun: 9, guard: 'high',
  knockback: { x: 2.5, y: 0 }, hitbox: { x: 0, y: -70, w: 64, h: 80 }, meterGain: 4, air: true,
}, o);

export const airHeavy = (o) => mk({
  input: 'Air H', anim: 'airKick', startup: 8, active: 6, recovery: 10, damage: 9, hitstun: 18, blockstun: 12, guard: 'high',
  knockback: { x: 4, y: 0 }, hitbox: { x: -4, y: -60, w: 80, h: 84 }, strength: 2, meterGain: 6, air: true, effect: 'heavyHit',
}, o);

export const throwMove = (o) => mk({
  kind: 'throw', input: 'Throw', anim: 'throw', startup: 4, active: 2, recovery: 24, damage: 11, hitstun: 30, blockstun: 0,
  knockback: { x: 7, y: -9 }, knockdown: true, hitbox: { x: 0, y: -130, w: 56, h: 90 }, strength: 2, meterGain: 8,
  name: 'Throw', desc: 'Grab a grounded foe. Breaks guard; escape by pressing Throw right after being grabbed.',
}, o);

export const special = (o) => mk({
  kind: 'special', anim: 'cast', startup: 12, active: 4, recovery: 18, damage: 10, hitstun: 20, blockstun: 14,
  knockback: { x: 5, y: 0 }, hitbox: null, strength: 2, meterGain: 8, scaling: 0.9,
}, o);

export const ultimate = (o) => mk({
  kind: 'ultimate', input: 'Ult', anim: 'ultimate', startup: 14, active: 6, recovery: 30, damage: 12, hitstun: 30, blockstun: 18,
  knockback: { x: 8, y: -10 }, knockdown: true, hitbox: null, strength: 3, meterGain: 0, meterCost: 100, invuln: [1, 6],
}, o);

// Projectile defaults (x,y of a live projectile are its centre).
export const proj = (o) => ({
  vx: 8, vy: 0, gravity: 0, w: 40, h: 30, offX: 50, offY: -95, life: 90, damage: 8, chip: null, hitstun: 18, blockstun: 12,
  hits: 1, interval: 0, knockback: { x: 4, y: 0 }, guard: 'mid', effect: 'energy', strength: 2, knockdown: false, juggle: 1,
  ...o,
});

// Fighter defaults (movement in px per 60 Hz tick).
export const fighter = (o) => ({
  walkSpeed: 4, backSpeed: 3.2, jumpVel: -17, jumpSpeedX: 4, gravity: 0.9, dashSpeed: 10, dashFrames: 12,
  dmgMult: 1, defMult: 1, ...o,
});

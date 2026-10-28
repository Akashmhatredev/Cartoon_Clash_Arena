// Cached, pre-digested move data for the AI (built once per fighter/form, never per tick).
import { getMove, getFighter } from '../fighters/index.js';

export const SLOTS = ['light', 'heavy', 'crouchLight', 'crouchHeavy', 'airLight', 'airHeavy', 'throw',
  'special1', 'special2', 'special3', 'ultimate'];

export const GUARD_MID = 0, GUARD_LOW = 1, GUARD_HIGH = 2;
const GUARD = { mid: GUARD_MID, low: GUARD_LOW, high: GUARD_HIGH };
export const KIND_NORMAL = 0, KIND_SPECIAL = 1, KIND_ULT = 2, KIND_THROW = 3;
const KIND = { normal: KIND_NORMAL, special: KIND_SPECIAL, ultimate: KIND_ULT, throw: KIND_THROW };

const FULL_SCREEN = 1400;
const cache = {};

function num(v, d) { return typeof v === 'number' && v === v ? v : d; }

// Extra forward distance a move travels before/while its hitbox is out (lunges, dashes, teleports).
function travel(m) {
  let t = 0;
  if (typeof m.travel === 'number') t = Math.max(t, m.travel);
  if (typeof m.lunge === 'number') t = Math.max(t, m.lunge);
  if (m.teleport && typeof m.teleport === 'object') t = Math.max(t, num(m.teleport.dist, num(m.teleport.distance, 0)));
  else if (typeof m.teleport === 'number') t = Math.max(t, m.teleport);
  const vx = num(m.vx, num(m.dashVx, num(m.dashSpeed, num(m.moveVx, 0))));
  if (vx > 0) {
    const frames = num(m.dashFrames, num(m.moveFrames, num(m.startup, 0) + num(m.active, 0)));
    t = Math.max(t, vx * frames);
  }
  if (m.dash && typeof m.dash === 'object') {
    t = Math.max(t, num(m.dash.dist, num(m.dash.distance, num(m.dash.speed, num(m.dash.vx, 0)) * num(m.dash.frames, num(m.active, 0)))));
  }
  return t;
}

function isProjectile(m) {
  return !!(m.projectile || m.proj || (m.spawn && (m.spawn.kind || m.spawn.projectile)) || m.projectileKind);
}

export function analyze(slot, m) {
  const hb = m.hitbox || null;
  const startup = Math.max(1, num(m.startup, 1));
  const active = Math.max(1, num(m.active, 1));
  const recovery = Math.max(0, num(m.recovery, 0));
  const hits = Math.max(1, num(m.hits, 1));
  const proj = isProjectile(m);
  const tr = travel(m);
  const front = hb ? num(hb.x, 0) + num(hb.w, 0) : 0;
  const top = hb ? -num(hb.y, 0) : 0;            // height above feet of hitbox top
  const bottom = hb ? -(num(hb.y, 0) + num(hb.h, 0)) : 0;
  const kind = KIND[m.kind] ?? (slot === 'ultimate' ? KIND_ULT : slot === 'throw' ? KIND_THROW
    : slot.startsWith('special') ? KIND_SPECIAL : KIND_NORMAL);
  const dmg = num(m.damage, 0) * hits;
  return {
    slot, move: m, kind,
    startup, active, recovery,
    total: startup + active + recovery + (hits > 1 ? num(m.hitInterval, 0) * (hits - 1) : 0),
    reach: proj ? FULL_SCREEN : front + tr,
    meleeReach: front,
    reachMin: hb ? num(hb.x, 0) : 0,
    top, bottom,
    hasHitbox: !!hb || proj,
    damage: dmg,
    guard: GUARD[m.guard] ?? GUARD_MID,
    meterCost: num(m.meterCost, 0),
    cooldown: num(m.cooldown, 0),
    proj,
    travel: tr,
    buff: !!m.buff,
    entity: !!(m.entity || m.spawnEntity || m.trap),
    charge: !!(m.charge || m.chargeable || m.maxCharge),
    formShift: !!(m.formShift || m.shift || m.cycleForm || m.changeForm),
    // frame advantage on block (positive = safe); rough when the move does not define blockstun
    onBlock: num(m.blockstun, 0) - recovery,
  };
}

function build(charId, form) {
  const t = { all: [] };
  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    let m = null;
    try { m = getMove(charId, slot, form); } catch (e) { m = null; }
    const info = m ? analyze(slot, m) : null;
    t[slot] = info;
    if (info) t.all.push(info);
  }
  return t;
}

export function moveTable(charId, form) {
  let c = cache[charId];
  if (!c) c = cache[charId] = {};
  const key = form || 'base';
  let t = c[key];
  if (!t) t = c[key] = build(charId, form || null);
  return t;
}

const halfCache = {};
export function halfWidth(charId) {
  let h = halfCache[charId];
  if (h === undefined) {
    let w = 76;
    try { const f = getFighter(charId); if (f && f.body && f.body.w) w = f.body.w; } catch (e) { /* default */ }
    h = halfCache[charId] = w / 2;
  }
  return h;
}

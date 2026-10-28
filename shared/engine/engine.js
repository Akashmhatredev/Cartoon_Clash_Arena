// Deterministic 60 Hz combat core. Pure data in, pure data out: the state is plain JSON
// (no classes, Maps or functions) so it can be cloned, sent over the wire and re-simulated.
import { STAGE, ROUND_FRAMES, ROUNDS_TO_WIN, METER_MAX, INPUT_BUFFER_FRAMES } from '../constants.js';
import { BTN } from '../input.js';
import { getFighter, getMove, getStats, SLOTS } from '../fighters/index.js';

const GROUND = STAGE.groundY;
const PROJ_POOL = 16;
const ENT_POOL = 12;
const INTRO_FRAMES = 100;
const ROUND_END_FRAMES = 150;
const POSE_FRAME = 70;
const DASH_WINDOW = 12;
const TECH_WINDOW = 8;
const GRAB_HOLD = 12;
const MAX_COMBO_FRAMES = 150; // a combo can never keep someone helpless longer than 2.5 s
const JUGGLE_LIMIT = 6;
const KNOCKDOWN_FRAMES = 32;
const GETUP_FRAMES = 14;
const START_X = [440, 840];
const HITSTOP = [0, 5, 8, 11];

// press slots
const P_LIGHT = 0, P_HEAVY = 1, P_SPECIAL = 2, P_THROW = 3, P_ULT = 4, P_UP = 5;
const PRESS_BITS = [BTN.LIGHT, BTN.HEAVY, BTN.SPECIAL, BTN.THROW, BTN.ULT, BTN.UP];
const FORM_CYCLE = { null: 'fourarms', fourarms: 'xlr8', xlr8: 'heatblast', heatblast: null };

// ---------------------------------------------------------------- creation

function makeFighter(side, charId, mod) {
  const d = getFighter(charId);
  if (!d) throw new Error(`unknown fighter ${charId}`);
  const hp = Math.round(d.hp * (mod.hpMult || 1));
  const cooldowns = {};
  for (const s of SLOTS) cooldowns[s] = 0;
  return {
    side, charId, x: START_X[side], y: GROUND, vx: 0, vy: 0, facing: side ? -1 : 1,
    hp, maxHp: hp, meter: 0,
    action: 'intro', actionFrame: 0,
    moveId: null, moveFrame: 0, movePhase: null,
    grounded: true, crouching: false, blocking: null,
    invuln: 0, armor: false,
    comboHits: 0, comboDamage: 0, lastMoveName: '',
    cooldowns, form: null, ammo: 0,
    buffs: { superStrength: 0, staticCharge: 0, gadgetHaste: 0, reflex: 0, slowed: 0, glide: 0, survival: 0, formTime: 0 },
    charge: 0, hitFlash: 0,
    // internals
    mask: 0, prevMask: 0, press: [-99, -99, -99, -99, -99, -99], tapDir: 0, tapFrame: -99, dashReq: 0, dashReqFrame: -99,
    stun: 0, lag: 0, kbx: 0, dashT: 0, dmgMod: mod.dmgMult || 1,
    moveHits: 0, moveConnected: false, hitTimer: 0, chainCount: 0, chainLeft: 0, chainTimer: 0,
    moveBonus: 1, fastRecover: false, passThrough: false, counterOn: false, juggle: 0, comboTime: 0,
    grabbedBy: -1, grabT: 0, grabStart: 0, ko: false, momentum: 0, ammoT: 0, skip: false, pending: false,
  };
}

function makeProj() {
  return {
    active: false, id: 0, owner: 0, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0, facing: 1, life: 0, hitsLeft: 0,
    gravity: 0, damage: 0, chip: 0, hitstun: 0, blockstun: 0, kbx: 0, kby: 0, guard: 'mid', effect: 'energy', strength: 1,
    knockdown: false, juggle: 1, interval: 0, cd: 0, moveId: '', moveName: '', bonus: 1,
  };
}

function makeEnt() {
  return {
    active: false, id: 0, owner: 0, kind: 'door', x: 0, y: 0, w: 0, h: 0, facing: 1, life: 0, maxLife: 0,
    damage: 0, hitsLeft: 0, cd: 0, moveName: '',
  };
}

export function createMatch(opts = {}) {
  const p1 = getFighter(opts.p1) ? opts.p1 : 'shinchan';
  const p2 = getFighter(opts.p2) ? opts.p2 : 'goku';
  const m = opts.mods || [];
  const mods = [0, 1].map((i) => ({ hpMult: (m[i] && m[i].hpMult) || 1, dmgMult: (m[i] && m[i].dmgMult) || 1 }));
  const roundsToWin = opts.roundsToWin || ROUNDS_TO_WIN;
  const training = opts.training ? { dummyInvincible: !!opts.training.dummyInvincible, infiniteMeter: !!opts.training.infiniteMeter } : null;
  const state = {
    v: 1, frame: 0, rng: (opts.seed >>> 0) || 1,
    phase: 'intro', phaseFrame: 0, round: 1, timer: opts.roundFrames || ROUND_FRAMES, roundFrames: opts.roundFrames || ROUND_FRAMES,
    roundsToWin, wins: [0, 0], roundWinner: null, matchWinner: null,
    hitstop: 0, shake: 0, slow: 0, nextId: 1,
    config: { p1, p2, stage: opts.stage || getFighter(p1).homeStage, roundsToWin, training, mods },
    fighters: [makeFighter(0, p1, mods[0]), makeFighter(1, p2, mods[1])],
    projectiles: Array.from({ length: PROJ_POOL }, makeProj),
    entities: Array.from({ length: ENT_POOL }, makeEnt),
    events: [],
    stats: { maxCombo: [0, 0], damage: [0, 0] },
  };
  resetRound(state);
  if (training) {
    state.phase = 'fight';
    for (const f of state.fighters) f.action = 'idle';
  }
  return state;
}

export function cloneState(state) {
  return typeof structuredClone === 'function' ? structuredClone(state) : JSON.parse(JSON.stringify(state));
}

function resetRound(state) {
  for (const f of state.fighters) {
    f.x = START_X[f.side]; f.y = GROUND; f.vx = 0; f.vy = 0; f.kbx = 0; f.facing = f.side ? -1 : 1;
    f.hp = f.maxHp; f.action = 'intro'; f.actionFrame = 0;
    f.moveId = null; f.moveFrame = 0; f.movePhase = null; f.grounded = true; f.crouching = false; f.blocking = null;
    f.invuln = 0; f.armor = false; f.comboHits = 0; f.comboDamage = 0; f.form = null; f.ammo = 0; f.charge = 0; f.hitFlash = 0;
    for (const k in f.buffs) f.buffs[k] = 0;
    for (const k in f.cooldowns) f.cooldowns[k] = 0;
    f.stun = 0; f.lag = 0; f.dashT = 0; f.moveHits = 0; f.moveConnected = false; f.hitTimer = 0; f.chainCount = 0;
    f.chainLeft = 0; f.chainTimer = 0; f.moveBonus = 1; f.fastRecover = false; f.passThrough = false; f.counterOn = false;
    f.juggle = 0; f.comboTime = 0; f.grabbedBy = -1; f.grabT = 0; f.ko = false; f.momentum = 0; f.ammoT = 0; f.dashReq = 0;
  }
  for (const p of state.projectiles) p.active = false;
  for (const e of state.entities) e.active = false;
  state.timer = state.roundFrames;
  state.phase = 'intro';
  state.phaseFrame = 0;
  state.roundWinner = null;
  state.hitstop = 0;
}

// ---------------------------------------------------------------- helpers

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const statsOf = (f) => getStats(f.charId, f.form);
const moveOf = (f) => (f.moveId ? getMove(f.charId, f.moveId, f.form) : null);

function wallClamp(f) {
  const hw = statsOf(f).body.w / 2;
  const lo = STAGE.left + hw, hi = STAGE.right - hw;
  if (f.x < lo) { f.x = lo; return true; }
  if (f.x > hi) { f.x = hi; return true; }
  return false;
}

function atWall(f) {
  const hw = statsOf(f).body.w / 2;
  return f.x <= STAGE.left + hw + 1 || f.x >= STAGE.right - hw - 1;
}

function hurtH(f) {
  const b = statsOf(f).body;
  return f.crouching && f.grounded ? b.crouchH : b.h;
}

// AABB of a rect vs fighter hurtbox
function rectHits(o, x, y, w, h) {
  const b = statsOf(o).body;
  const hh = hurtH(o);
  const ox = o.x - b.w / 2, oy = o.y - hh;
  return x < ox + b.w && x + w > ox && y < oy + hh && y + h > oy;
}

function boxHits(f, hb, o) {
  const x = f.facing === 1 ? f.x + hb.x : f.x - hb.x - hb.w;
  return rectHits(o, x, f.y + hb.y, hb.w, hb.h);
}

function isHitState(a) {
  return a === 'hitstun' || a === 'launched' || a === 'grabbed';
}

function canAct(f) {
  const a = f.action;
  return a === 'idle' || a === 'walk' || a === 'crouch' || a === 'block' || a === 'jump';
}

function canBeHit(o) {
  if (o.invuln > 0 || o.ko) return false;
  const a = o.action;
  if (a === 'knockdown' || a === 'getup' || a === 'ko' || a === 'grabbed' || a === 'intro') return false;
  if (a === 'launched' && o.juggle >= JUGGLE_LIMIT) return false;
  if (o.comboTime > MAX_COMBO_FRAMES) return false;
  return true;
}

function push(state, ev) {
  state.events.push(ev);
}

function setAction(f, a) {
  if (f.action !== a) { f.action = a; f.actionFrame = 0; }
}

// ---------------------------------------------------------------- step

export function step(state, inputs) {
  const ev = state.events;
  ev.length = 0;
  state.frame++;
  const F = state.fighters;
  const live = state.phase === 'fight';
  for (let i = 0; i < 2; i++) {
    const raw = inputs ? inputs[i] : 0;
    readInput(state, F[i], live && Number.isInteger(raw) && raw >= 0 && raw <= 1023 ? raw : 0);
  }

  if (state.hitstop > 0) {
    state.hitstop--;
    decayShake(state);
    return;
  }
  state.phaseFrame++;

  if (state.phase === 'intro') {
    if (state.phaseFrame === 1) push(state, { type: 'roundStart', round: state.round });
    if (state.phaseFrame === POSE_FRAME) for (const f of F) setAction(f, 'idle');
    if (state.phaseFrame >= INTRO_FRAMES) {
      state.phase = 'fight';
      state.phaseFrame = 0;
      for (const f of F) setAction(f, 'idle');
      push(state, { type: 'fight' });
    }
  }

  for (let i = 0; i < 2; i++) updateFighter(state, F[i], F[1 - i]);
  for (let i = 0; i < 2; i++) physics(state, F[i]);
  separate(F[0], F[1]);
  for (let i = 0; i < 2; i++) if (canAct(F[i]) && F[i].grounded && F[i].action !== 'jump') face(F[i], F[1 - i]);
  updateGrab(state, F[0], F[1]);
  updateGrab(state, F[1], F[0]);
  if (state.phase === 'fight') {
    resolveMelee(state);
    updateProjectiles(state);
    updateEntities(state);
  } else {
    for (const p of state.projectiles) if (p.active && --p.life <= 0) p.active = false;
  }
  for (let i = 0; i < 2; i++) timers(state, F[i], F[1 - i]);
  roundLogic(state);
  decayShake(state);
}

function decayShake(state) {
  state.shake *= 0.88;
  if (state.shake < 0.01) state.shake = 0;
  for (const f of state.fighters) if (f.hitFlash > 0) f.hitFlash--;
}

function readInput(state, f, mask) {
  const pressed = mask & ~f.prevMask;
  if (pressed) {
    for (let i = 0; i < 6; i++) if (pressed & PRESS_BITS[i]) f.press[i] = state.frame;
    const lr = pressed & (BTN.LEFT | BTN.RIGHT);
    if (lr === BTN.LEFT || lr === BTN.RIGHT) {
      const dir = lr === BTN.RIGHT ? 1 : -1;
      if (f.tapDir === dir && state.frame - f.tapFrame <= DASH_WINDOW) {
        f.dashReq = dir; f.dashReqFrame = state.frame; f.tapDir = 0;
      } else {
        f.tapDir = dir; f.tapFrame = state.frame;
      }
    }
  }
  f.prevMask = mask;
  f.mask = mask;
}

function buffered(state, f, i) {
  return state.frame - f.press[i] <= INPUT_BUFFER_FRAMES;
}

function face(f, o) {
  const dx = o.x - f.x;
  if (dx > 1) f.facing = 1;
  else if (dx < -1) f.facing = -1;
}

// ---------------------------------------------------------------- fighter update

function updateFighter(state, f, o) {
  f.skip = f.buffs.slowed > 0 && (state.frame & 1) === 1; // half speed inside a time field
  if (f.skip) return;
  f.actionFrame++;
  switch (f.action) {
    case 'hitstun':
    case 'blockstun':
      if (--f.stun <= 0) {
        f.stun = 0;
        setAction(f, f.grounded ? 'idle' : 'jump');
        control(state, f, o);
      }
      return;
    case 'knockdown':
      if (--f.stun <= 0) { setAction(f, 'getup'); f.stun = GETUP_FRAMES; f.invuln = Math.max(f.invuln, GETUP_FRAMES + 2); }
      return;
    case 'getup':
      if (--f.stun <= 0) setAction(f, 'idle');
      return;
    case 'dash':
    case 'backdash':
      if (--f.dashT <= 0) {
        f.vx = 0;
        setAction(f, 'idle');
        if (f.charId === 'hattori') f.buffs.reflex = 60;
      } else {
        const s = statsOf(f);
        const dir = f.action === 'dash' ? f.facing : -f.facing;
        f.vx = dir * s.dashSpeed * (f.action === 'dash' ? 1 : 0.85) * (f.dashT < 4 ? 0.5 : 1);
      }
      return;
    case 'attack':
      advanceMove(state, f, o);
      if (f.action === 'attack') tryCancel(state, f);
      return;
    case 'idle': case 'walk': case 'crouch': case 'block': case 'jump':
      if (state.phase === 'fight') control(state, f, o);
      else if (f.grounded) { f.vx = 0; setAction(f, 'idle'); f.crouching = false; f.blocking = null; }
      return;
    default:
      return; // intro, launched, grabbed, ko, win, lose
  }
}

function control(state, f, o) {
  const mask = f.mask;
  const s = statsOf(f);
  const fwd = f.facing === 1 ? BTN.RIGHT : BTN.LEFT;
  const back = f.facing === 1 ? BTN.LEFT : BTN.RIGHT;
  if (f.lag > 0) {
    f.lag--;
    if (f.grounded) f.vx = 0;
    return;
  }
  const slot = pickAttack(state, f, mask, null);
  if (slot) { startMove(state, f, slot); return; }

  if (!f.grounded) {
    setAction(f, 'jump');
    if (f.buffs.glide > 0) {
      const dir = (mask & BTN.RIGHT ? 1 : 0) - (mask & BTN.LEFT ? 1 : 0);
      f.vx = dir * 3.4;
    }
    return;
  }

  if (f.dashReq && state.frame - f.dashReqFrame <= 6) {
    const dir = f.dashReq;
    f.dashReq = 0;
    const fw = dir === f.facing;
    setAction(f, fw ? 'dash' : 'backdash');
    f.dashT = fw ? s.dashFrames : s.dashFrames + 2;
    if (!fw) f.invuln = Math.max(f.invuln, 8);
    f.crouching = false; f.blocking = null;
    push(state, { type: 'dash', side: f.side });
    return;
  }

  if (buffered(state, f, P_UP) && !(mask & BTN.BLOCK)) {
    f.press[P_UP] = -99;
    const dir = mask & fwd ? f.facing : mask & back ? -f.facing : 0;
    f.vy = s.jumpVel; f.vx = dir * s.jumpSpeedX; f.grounded = false;
    f.crouching = false; f.blocking = null;
    setAction(f, 'jump');
    push(state, { type: 'jump', side: f.side });
    return;
  }

  const down = (mask & BTN.DOWN) !== 0;
  if (mask & BTN.BLOCK) {
    setAction(f, 'block');
    f.crouching = down; f.blocking = down ? 'low' : 'high'; f.vx = 0;
    return;
  }
  f.blocking = null;
  if (down) {
    setAction(f, 'crouch');
    f.crouching = true; f.vx = 0;
    return;
  }
  f.crouching = false;
  const slowWalk = f.buffs.superStrength > 0 ? 0.75 : 1;
  if (mask & fwd) { setAction(f, 'walk'); f.vx = f.facing * s.walkSpeed * slowWalk; }
  else if (mask & back) { setAction(f, 'walk'); f.vx = -f.facing * s.backSpeed * slowWalk; }
  else { setAction(f, 'idle'); f.vx = 0; }
}

function pickAttack(state, f, mask, from) {
  const air = !f.grounded;
  const down = (mask & BTN.DOWN) !== 0;
  const side = (mask & (BTN.LEFT | BTN.RIGHT)) !== 0;
  let slot = null, pi = -1;
  if (buffered(state, f, P_ULT)) { slot = 'ultimate'; pi = P_ULT; }
  else if (buffered(state, f, P_SPECIAL)) { slot = down ? 'special3' : side ? 'special2' : 'special1'; pi = P_SPECIAL; }
  else if (buffered(state, f, P_THROW) && !air) { slot = 'throw'; pi = P_THROW; }
  else if (buffered(state, f, P_HEAVY)) { slot = air ? 'airHeavy' : down ? 'crouchHeavy' : 'heavy'; pi = P_HEAVY; }
  else if (buffered(state, f, P_LIGHT)) { slot = air ? 'airLight' : down ? 'crouchLight' : 'light'; pi = P_LIGHT; }
  if (!slot) return null;
  const mv = getMove(f.charId, slot, f.form);
  if (!mv) return null;
  if (f.cooldowns[slot] > 0) return null;
  if (mv.meterCost && f.meter < mv.meterCost) return null;
  if (air && !mv.air) return null;
  if (!air && mv.air) return null;
  if (mv.ammo && f.ammo <= 0) return null;
  if (from) {
    // cancel rules: normals -> listed normals / any special / ultimate; specials -> ultimate
    const k = mv.kind;
    let ok = false;
    if (from.kind === 'normal') ok = k === 'special' || k === 'ultimate' || (!!from.cancel && from.cancel.includes(slot) && f.chainCount < 3);
    else if (from.kind === 'special') ok = k === 'ultimate' && !from.noCancel;
    if (!ok || mv.noCancel) return null;
  }
  f.press[pi] = -99;
  return slot;
}

function tryCancel(state, f) {
  if (!f.moveConnected || f.movePhase === 'startup' || f.chainLeft > 0) return;
  const cur = moveOf(f);
  if (!cur || cur.kind === 'throw' || cur.kind === 'ultimate') return;
  const slot = pickAttack(state, f, f.mask, cur);
  if (!slot) return;
  const chained = cur.kind === 'normal' && getMove(f.charId, slot, f.form).kind === 'normal';
  const count = chained ? f.chainCount + 1 : 0;
  startMove(state, f, slot);
  f.chainCount = count;
}

function startMove(state, f, slot) {
  const mv = getMove(f.charId, slot, f.form);
  setAction(f, 'attack');
  f.moveId = slot; f.moveFrame = 0; f.movePhase = 'startup';
  f.moveHits = 0; f.moveConnected = false; f.hitTimer = 0; f.chainLeft = 0; f.chainTimer = 0; f.chainCount = 0;
  f.charge = 0; f.counterOn = false; f.passThrough = false; f.armor = false;
  f.lastMoveName = mv.name;
  f.fastRecover = f.buffs.reflex > 0;
  f.moveBonus = 1;
  if (mv.electric && f.buffs.staticCharge > 0) {
    f.moveBonus = 1 + 0.15 * f.buffs.staticCharge;
    f.buffs.staticCharge = 0;
  }
  if (mv.cooldown) f.cooldowns[slot] = mv.cooldown;
  if (mv.meterCost) f.meter = Math.max(0, f.meter - mv.meterCost);
  if (mv.ammo) f.ammo--;
  if (mv.meterOnUse) f.meter = Math.min(METER_MAX, f.meter + mv.meterOnUse);
  if (f.grounded) f.vx = 0;
  f.crouching = slot === 'crouchLight' || slot === 'crouchHeavy';
  f.blocking = null;
  push(state, { type: 'moveStart', side: f.side, moveId: slot, moveName: mv.name, kind: mv.kind });
  if (mv.kind === 'ultimate') {
    push(state, { type: 'superFlash', side: f.side });
    state.shake = Math.max(state.shake, 0.25);
  }
}

function endMove(state, f, silent) {
  const mv = moveOf(f);
  if (!silent && mv && !f.moveConnected && mv.kind === 'normal' && mv.hitbox) push(state, { type: 'whiff', side: f.side, moveId: f.moveId });
  if (mv && mv.reflex && f.charId === 'hattori') f.buffs.reflex = 60; // Ninja Reflex after a dodge
  f.moveId = null; f.moveFrame = 0; f.movePhase = null;
  f.armor = false; f.passThrough = false; f.counterOn = false; f.charge = 0; f.chainLeft = 0;
  f.crouching = f.grounded && (f.mask & BTN.DOWN) !== 0;
  setAction(f, f.grounded ? (f.crouching ? 'crouch' : 'idle') : 'jump');
}

function advanceMove(state, f, o) {
  const mv = moveOf(f);
  if (!mv) { endMove(state, f, true); return; }

  // Charge moves hold on their charge frame while the button is held.
  if (mv.charge && f.moveFrame === mv.charge.at && (f.mask & BTN.SPECIAL) && f.charge < mv.charge.max) {
    if (f.charge === 0) push(state, { type: 'charge', side: f.side });
    f.charge++;
    return;
  }
  // Ultimate strike chains run on a timer once the opening hit connects.
  if (f.chainLeft > 0) { runChain(state, f, o, mv); return; }

  const t = ++f.moveFrame;
  const s = mv.startup, a = mv.active;
  let rec = f.moveConnected ? mv.recovery : (mv.whiffRecovery != null ? mv.whiffRecovery : mv.recovery);
  if (f.fastRecover) rec = Math.round(rec * 0.65);
  f.movePhase = t <= s ? 'startup' : t <= s + a ? 'active' : 'recovery';

  if (mv.dash) {
    const from = mv.dash.from || 1;
    if (t >= from && t < from + mv.dash.frames && !(mv.dash.stopOnHit && f.moveConnected)) f.vx = f.facing * mv.dash.speed;
    else if (f.grounded) f.vx = 0;
  }
  if (mv.hop && t === mv.hop.at) {
    f.vy = mv.hop.vy; f.vx = f.facing * (mv.hop.vx || 0); f.grounded = false;
  }
  if (mv.invuln && t >= mv.invuln[0] && t <= mv.invuln[1]) f.invuln = Math.max(f.invuln, 2);
  f.armor = !!(mv.armor && t >= mv.armor[0] && t <= mv.armor[1]);
  f.passThrough = !!(mv.passThrough && t >= mv.passThrough[0] && t <= mv.passThrough[1]);
  f.counterOn = !!(mv.counter && t >= mv.counter[0] && t <= mv.counter[1]);

  if (mv.projectile && t === (mv.projectile.frame || s + 1)) spawnProjectiles(state, f, mv);
  if (mv.entity && t === (mv.entity.frame || s + 1)) spawnEntity(state, f, o, mv.entity, mv.name);
  if (mv.behavior && t === (mv.behaviorFrame || s + 1)) runBehavior(state, f, o, mv);

  if (t >= s + a + rec) endMove(state, f, false);
}

function runBehavior(state, f, o, mv) {
  switch (mv.behavior) {
    case 'teleport': {
      const backHeld = (f.mask & (f.facing === 1 ? BTN.LEFT : BTN.RIGHT)) !== 0;
      const fromX = f.x;
      spawnEntity(state, f, o, { kind: 'door', offX: 0, w: 70, h: 150, life: 36 }, mv.name);
      f.x += f.facing * (backHeld ? -mv.teleport.back : mv.teleport.dist);
      wallClamp(f);
      spawnEntity(state, f, o, { kind: 'door', offX: 0, w: 70, h: 150, life: 36 }, mv.name);
      face(f, o);
      push(state, { type: 'teleport', side: f.side, fromX, toX: f.x });
      break;
    }
    case 'clone': {
      spawnEntity(state, f, o, { kind: 'shadowClone', offX: 0, w: 70, h: 180, life: 150 }, mv.name);
      const fromX = f.x;
      f.x -= f.facing * 110;
      wallClamp(f);
      push(state, { type: 'teleport', side: f.side, fromX, toX: f.x });
      break;
    }
    case 'formShift': {
      f.form = FORM_CYCLE[f.form] === undefined ? null : FORM_CYCLE[f.form];
      f.buffs.formTime = f.form ? 900 : 0;
      f.ammo = f.form === 'heatblast' ? 3 : 0;
      f.ammoT = 0;
      push(state, { type: 'form', side: f.side, form: f.form });
      break;
    }
    case 'buff': {
      f.buffs[mv.buff.name] = mv.buff.frames;
      push(state, { type: 'buff', side: f.side, buff: mv.buff.name });
      break;
    }
    case 'glide': {
      f.vy = -11; f.vx = 0; f.grounded = false; f.buffs.glide = 80;
      push(state, { type: 'buff', side: f.side, buff: 'glide' });
      break;
    }
    case 'storm': {
      const xs = [o.x - 120, o.x, o.x + 120];
      for (let i = 0; i < 3; i++) {
        const e = spawnEntity(state, f, o, { kind: 'stormWarning', w: 80, h: 30, life: 40 + i * 8, damage: mv.stormDamage }, mv.name);
        if (e) { e.x = clamp(xs[i], STAGE.left + 30, STAGE.right - 30); e.y = GROUND - 12; }
      }
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------- spawning

function spawnProjectiles(state, f, mv) {
  const def = mv.projectile;
  for (const p of state.projectiles) if (p.active && p.owner === f.side && p.kind === def.kind) return; // one volley at a time
  const spread = def.spread || [0];
  const c = mv.charge ? f.charge / mv.charge.max : 0;
  for (let i = 0; i < spread.length; i++) {
    const p = state.projectiles.find((q) => !q.active);
    if (!p) return;
    p.active = true; p.id = state.nextId++; p.owner = f.side; p.kind = def.kind;
    p.facing = f.facing;
    p.w = Math.round(def.w * (1 + 0.6 * c)); p.h = Math.round(def.h * (1 + 0.6 * c));
    p.x = f.x + f.facing * def.offX; p.y = f.y + def.offY;
    p.vx = f.facing * def.vx; p.vy = spread[i]; p.gravity = def.gravity;
    p.life = def.life; p.hitsLeft = def.hits; p.interval = def.interval || 0; p.cd = 0;
    p.damage = def.damage * (1 + 0.8 * c); p.chip = def.chip; p.hitstun = def.hitstun; p.blockstun = def.blockstun;
    p.kbx = def.knockback.x; p.kby = def.knockback.y; p.guard = def.guard; p.effect = def.effect; p.strength = def.strength;
    p.knockdown = def.knockdown; p.juggle = def.juggle; p.moveId = mv.id; p.moveName = mv.name; p.bonus = f.moveBonus;
  }
  push(state, { type: 'projectile', side: f.side, kind: def.kind });
}

function spawnEntity(state, f, o, def, name) {
  if (def.unique) for (const e of state.entities) if (e.active && e.owner === f.side && e.kind === def.kind) e.active = false;
  const e = state.entities.find((q) => !q.active);
  if (!e) return null;
  e.active = true; e.id = state.nextId++; e.owner = f.side; e.kind = def.kind; e.facing = f.facing;
  e.w = def.w; e.h = def.h; e.life = def.life; e.maxLife = def.life;
  e.x = clamp(f.x + f.facing * (def.offX || 0), STAGE.left + 20, STAGE.right - 20);
  e.y = def.ground ? GROUND - def.h / 2 : f.y - def.h / 2;
  e.damage = def.damage || 0; e.hitsLeft = def.hits || 0; e.cd = 0; e.moveName = name || '';
  return e;
}

// ---------------------------------------------------------------- physics

function physics(state, f) {
  const k = f.buffs.slowed > 0 ? 0.5 : 1;
  const hit = f.action === 'hitstun' || f.action === 'blockstun' || f.action === 'launched' || f.action === 'knockdown' || f.action === 'ko';
  let vx = hit ? 0 : f.vx;
  if (f.action === 'grabbed') vx = 0;
  vx += f.kbx;
  f.kbx *= f.grounded ? (hit ? 0.84 : 0.7) : 0.985;
  if (Math.abs(f.kbx) < 0.05) f.kbx = 0;
  f.x += vx * k;

  if (!f.grounded && f.action !== 'grabbed') {
    const s = statsOf(f);
    const glide = f.buffs.glide > 0 && f.vy > 0;
    f.vy += s.gravity * (glide ? 0.25 : 1) * k;
    if (glide && f.vy > 2.2) f.vy = 2.2;
    f.y += f.vy * k;
    if (f.y >= GROUND) land(state, f);
  }
  if (wallClamp(f) && hit) f.kbx = 0;
}

function land(state, f) {
  f.y = GROUND; f.vy = 0; f.grounded = true; f.buffs.glide = 0;
  switch (f.action) {
    case 'jump':
      setAction(f, 'idle'); f.vx = 0; f.lag = 2;
      push(state, { type: 'land', side: f.side });
      break;
    case 'attack': {
      const mv = moveOf(f);
      if (mv && mv.air) { endMove(state, f, true); f.vx = 0; f.lag = 5; push(state, { type: 'land', side: f.side }); }
      else f.vx = 0;
      break;
    }
    case 'launched':
    case 'hitstun':
      f.vx = 0; f.kbx *= 0.4;
      if (f.ko) { setAction(f, 'ko'); }
      else {
        setAction(f, 'knockdown'); f.stun = KNOCKDOWN_FRAMES; f.invuln = KNOCKDOWN_FRAMES + GETUP_FRAMES + 4;
      }
      f.juggle = 0;
      state.shake = Math.max(state.shake, 0.12);
      push(state, { type: 'land', side: f.side });
      break;
    default:
      f.vx = 0;
  }
}

function separate(a, b) {
  if (a.passThrough || b.passThrough || a.action === 'grabbed' || b.action === 'grabbed') return;
  const sa = statsOf(a).body, sb = statsOf(b).body;
  const minD = (sa.w + sb.w) / 2;
  const dx = b.x - a.x;
  const adx = Math.abs(dx);
  if (adx >= minD) return;
  // vertical overlap of bodies
  const atop = a.y - hurtH(a), btop = b.y - hurtH(b);
  if (a.y <= btop + 4 || b.y <= atop + 4) return;
  const dir = dx > 0 ? 1 : dx < 0 ? -1 : (a.side === 0 ? 1 : -1);
  const ov = (minD - adx) / 2;
  a.x -= dir * ov;
  b.x += dir * ov;
  if (wallClamp(a)) b.x = a.x + dir * minD;
  if (wallClamp(b)) a.x = b.x - dir * minD;
  wallClamp(a); wallClamp(b);
}

// ---------------------------------------------------------------- combat

function canBlock(o) {
  if (!o.grounded) return false;
  const a = o.action;
  if (a === 'block' || a === 'blockstun') return true;
  return (a === 'idle' || a === 'walk' || a === 'crouch') && (o.mask & BTN.BLOCK) !== 0;
}

function guardOk(o, guard) {
  const low = (o.mask & BTN.DOWN) !== 0;
  if (guard === 'low') return low;
  if (guard === 'high') return !low;
  return true;
}

function resolveMelee(state) {
  const F = state.fighters;
  for (let i = 0; i < 2; i++) {
    const f = F[i], o = F[1 - i];
    f.pending = false;
    if (f.action !== 'attack' || f.movePhase !== 'active' || f.chainLeft > 0 || f.skip) continue;
    const mv = moveOf(f);
    if (!mv || !mv.hitbox || f.moveHits >= mv.hits || f.hitTimer > 0) continue;
    if (mv.kind === 'throw') {
      if (!o.grounded || o.invuln > 0 || o.ko) continue;
      const a = o.action;
      if (a === 'hitstun' || a === 'blockstun' || a === 'launched' || a === 'knockdown' || a === 'getup' || a === 'grabbed') continue;
    } else if (!canBeHit(o)) continue;
    if (boxHits(f, mv.hitbox, o)) f.pending = true;
  }
  // both pending: resolve simultaneously (trade); double throw = tech
  const a = F[0], b = F[1];
  if (a.pending && b.pending && a.moveId === 'throw' && b.moveId === 'throw') {
    techApart(state, a, b);
    return;
  }
  const ma = a.pending ? moveOf(a) : null;
  const mb = b.pending ? moveOf(b) : null;
  if (ma) applyHit(state, a, b, ma, null);
  if (mb) applyHit(state, b, a, mb, null);
}

function techApart(state, a, b) {
  for (const f of [a, b]) {
    if (f.action === 'attack') endMove(state, f, true);
    if (f.action === 'grabbed') setAction(f, 'idle');
    f.grabbedBy = -1;
    f.kbx = (f.x < (a.x + b.x) / 2 ? -1 : 1) * 7;
    f.lag = 6;
  }
  push(state, { type: 'tech', side: a.side });
  push(state, { type: 'tech', side: b.side });
}

function scaleFor(n, mv) {
  let s = n < 2 ? 1 : n === 2 ? 0.85 : Math.max(0.3, 0.85 - 0.1 * (n - 2));
  if (n > 0) s *= mv.scaling == null ? 1 : mv.scaling;
  if (mv.kind === 'ultimate') s = Math.max(s, 0.5);
  return Math.max(0.3, s);
}

function computeDamage(state, att, def, base, mv, counter, bonus) {
  const as = statsOf(att), ds = statsOf(def);
  let d = base * as.dmgMult * att.dmgMod * bonus;
  if (att.buffs.superStrength > 0) d *= 1.25;
  d *= ds.defMult;
  if (def.charId === 'nobita' && def.hp < def.maxHp * 0.3) d *= 0.85; // Survival Instinct
  if (counter) d *= 1.15;
  d *= scaleFor(att.comboHits, mv);
  return Math.max(1, Math.round(d));
}

function dealDamage(state, att, def, dmg) {
  const tr = state.config.training;
  if (tr) {
    if (!(tr.dummyInvincible && def.side === 1)) def.hp = Math.max(1, def.hp - dmg);
  } else {
    def.hp = Math.max(0, def.hp - dmg);
  }
  state.stats.damage[att.side] += dmg;
}

// src: move (melee) or projectile/entity-like object with the same hit fields
function applyHit(state, att, def, mv, p) {
  const src = p || mv;
  const kbx = p ? p.kbx : mv.knockback.x;
  const kby = p ? p.kby : mv.knockback.y;
  const dir = p ? p.facing : att.facing;
  const strength = src.strength || 1;
  const hx = p ? p.x : def.x - dir * statsOf(def).body.w * 0.3;
  const hy = p ? p.y : def.y - hurtH(def) * 0.6;
  att.moveHits += p ? 0 : 1;
  att.hitTimer = p ? 0 : (mv.hitInterval || 0);

  // Nobita's Impossible Comeback: a melee attack into the stance gets punished
  if (!p && def.counterOn && mv.kind !== 'throw') {
    triggerCounter(state, def, att);
    return;
  }

  // throws
  if (!p && mv.kind === 'throw') {
    if (def.action === 'attack') endMove(state, def, true);
    setAction(def, 'grabbed');
    def.grabbedBy = att.side; def.grabT = 0; def.grabStart = state.frame; def.vx = 0; def.kbx = 0;
    def.crouching = false; def.blocking = null;
    att.moveConnected = true;
    def.x = att.x + att.facing * ((statsOf(att).body.w + statsOf(def).body.w) / 2 - 6);
    wallClamp(def);
    return;
  }

  // super armor vs light hits (Bheem)
  if (def.armor && strength <= 1 && !p) {
    const dmg = computeDamage(state, att, def, src.damage, mv, false, 1);
    dealDamage(state, att, def, Math.ceil(dmg * 0.5));
    att.moveConnected = true;
    def.hitFlash = 4;
    state.hitstop = 4;
    push(state, { type: 'armor', side: def.side });
    push(state, { type: 'block', side: att.side, target: def.side, x: hx, y: hy, damage: Math.ceil(dmg * 0.5) });
    return;
  }

  if (canBlock(def) && guardOk(def, src.guard)) {
    let chip = src.chip != null ? src.chip : mv && mv.kind === 'normal' && !p ? 0 : Math.ceil(src.damage * 0.15);
    if (chip > 0) {
      chip = Math.min(chip, def.hp - 1);
      if (chip > 0) dealDamage(state, att, def, chip);
    }
    if (def.action === 'attack') endMove(state, def, true);
    setAction(def, 'blockstun');
    def.stun = src.blockstun || 10;
    def.blocking = (def.mask & BTN.DOWN) ? 'low' : 'high';
    def.crouching = def.blocking === 'low';
    def.kbx = dir * kbx * 0.8;
    if (!p && atWall(def)) att.kbx = -dir * kbx * 0.6;
    att.moveConnected = true;
    att.meter = Math.min(METER_MAX, att.meter + Math.ceil((mv ? mv.meterGain : 4) / 2));
    def.meter = Math.min(METER_MAX, def.meter + 3);
    state.hitstop = Math.max(state.hitstop, 3);
    push(state, { type: 'block', side: att.side, target: def.side, x: hx, y: hy, damage: Math.max(0, chip) });
    return;
  }

  const counter = def.action === 'attack' && def.movePhase === 'startup';
  const dmg = computeDamage(state, att, def, src.damage, mv || { kind: 'special', scaling: 1 }, counter, p ? p.bonus : att.moveBonus);
  landHit(state, att, def, dmg, {
    hitstun: src.hitstun, kbx, kby, dir, knockdown: src.knockdown, juggle: src.juggle || 1, strength, counter,
    effect: src.effect, moveId: p ? p.moveId : mv.id, moveName: p ? p.moveName : mv.name, x: hx, y: hy,
    stunCap: mv && mv.stunCap, melee: !p,
  });
  att.moveConnected = true;
  if (!p && mv.chainHits && att.moveHits === 1 && def.hp > 0) {
    att.chainLeft = mv.chainHits; att.chainTimer = mv.chainInterval || 6;
  }
}

// shared by melee, projectiles, traps, lightning and chains
function landHit(state, att, def, dmg, h) {
  if (def.action === 'attack') endMove(state, def, true);
  dealDamage(state, att, def, dmg);
  att.comboHits++;
  att.comboDamage += dmg;
  if (att.comboHits > state.stats.maxCombo[att.side]) state.stats.maxCombo[att.side] = att.comboHits;

  let hs = Math.max(6, h.hitstun - Math.max(0, att.comboHits - 4) * 2) + (h.counter ? 4 : 0);
  if (h.stunCap && def.comboTime > 0) hs = Math.min(hs, h.stunCap); // no stun chains
  def.hitFlash = 6;
  def.kbx = h.dir * h.kbx;
  if (h.melee && atWall(def)) att.kbx = -h.dir * h.kbx * 0.6;
  def.crouching = false; def.blocking = null;

  const launch = h.kby < 0 || !def.grounded || def.hp <= 0;
  if (launch) {
    setAction(def, 'launched');
    def.vy = h.kby < 0 ? h.kby : def.hp <= 0 ? -9 : -5;
    def.grounded = false;
    def.juggle += h.juggle;
  } else {
    setAction(def, 'hitstun');
    def.stun = hs;
  }
  if (h.knockdown && !launch) { setAction(def, 'launched'); def.vy = -4; def.grounded = false; }

  // meter
  att.meter = Math.min(METER_MAX, att.meter + (h.meterGain != null ? h.meterGain : 5 + h.strength * 2));
  def.meter = Math.min(METER_MAX, def.meter + Math.ceil(dmg * 0.5));

  // passives
  if (att.charId === 'pikachu' && h.melee && att.moveId && getMove('pikachu', att.moveId).kind === 'normal') {
    att.buffs.staticCharge = Math.min(3, att.buffs.staticCharge + 1);
  }
  if (att.charId === 'goku' && att.momentum < 14 && (att.comboHits === 4 || att.comboHits === 7)) {
    const g = Math.min(8, 14 - att.momentum);
    att.momentum += g;
    att.meter = Math.min(METER_MAX, att.meter + g);
    push(state, { type: 'buff', side: att.side, buff: 'momentum' });
  }
  if (att.charId === 'doraemon' && att.comboHits >= 3 && att.buffs.gadgetHaste <= 0) {
    att.buffs.gadgetHaste = 240;
    push(state, { type: 'buff', side: att.side, buff: 'gadgetHaste' });
  }

  state.hitstop = Math.max(state.hitstop, HITSTOP[h.strength] + (h.counter ? 3 : 0));
  state.shake = Math.max(state.shake, 0.12 * h.strength + (h.counter ? 0.1 : 0));
  push(state, {
    type: 'hit', side: att.side, target: def.side, x: h.x, y: h.y, damage: dmg, moveId: h.moveId, moveName: h.moveName,
    effect: h.effect || 'hit', strength: h.strength, comboHits: att.comboHits, counter: !!h.counter,
  });
  if (def.hp <= 0 && !def.ko) {
    def.ko = true;
    if (def.action !== 'launched') { setAction(def, 'launched'); def.vy = -9; def.grounded = false; }
    def.kbx = h.dir * Math.max(5, Math.abs(h.kbx));
    state.hitstop = 24;
    state.shake = 0.6;
    push(state, { type: 'ko', side: def.side });
  }
}

function runChain(state, f, o, mv) {
  if (--f.chainTimer > 0) return;
  f.chainLeft--;
  const final = f.chainLeft <= 0;
  if (o.ko || o.action === 'knockdown') { f.chainLeft = 0; f.moveFrame = mv.startup + mv.active; return; }
  // hold the target in front
  o.x = f.x + f.facing * ((statsOf(f).body.w + statsOf(o).body.w) / 2 + 4);
  wallClamp(o);
  const base = final ? mv.chainFinal.damage : mv.chainDamage;
  const dmg = computeDamage(state, f, o, base, mv, false, 1);
  landHit(state, f, o, dmg, {
    hitstun: (mv.chainInterval || 6) + 14,
    kbx: final ? mv.chainFinal.knockback.x : 0.5, kby: final ? mv.chainFinal.knockback.y : 0,
    dir: f.facing, knockdown: final, juggle: 0, strength: final ? 3 : 1, counter: false,
    effect: mv.effect, moveId: mv.id, moveName: mv.name, x: o.x, y: o.y - hurtH(o) * 0.6, melee: true, meterGain: 0,
  });
  if (!final && o.action === 'launched' && !o.ko) { setAction(o, 'hitstun'); o.stun = 20; o.vy = 0; o.y = f.y; o.grounded = f.grounded; }
  f.chainTimer = mv.chainInterval || 6;
  if (final) { f.chainLeft = 0; f.moveFrame = mv.startup + mv.active; }
}

function triggerCounter(state, def, att) {
  const mv = moveOf(def);
  def.counterOn = false;
  def.moveConnected = true;
  def.moveFrame = mv.startup + mv.active; // skip to recovery
  def.invuln = Math.max(def.invuln, 12);
  push(state, { type: 'superFlash', side: def.side });
  const dmg = computeDamage(state, def, att, mv.counterDamage, mv, false, 1);
  landHit(state, def, att, dmg, {
    hitstun: 40, kbx: 9, kby: -11, dir: def.facing, knockdown: true, juggle: 3, strength: 3, counter: true,
    effect: 'sparkle', moveId: mv.id, moveName: mv.name, x: att.x, y: att.y - hurtH(att) * 0.6, melee: true, meterGain: 0,
  });
}

function updateGrab(state, att, def) {
  if (def.action !== 'grabbed' || def.grabbedBy !== att.side) return;
  def.grabT++;
  // tech: press Throw within the window after being grabbed
  if (def.grabT <= TECH_WINDOW && def.press[P_THROW] >= def.grabStart - 2) {
    def.press[P_THROW] = -99;
    techApart(state, att, def);
    return;
  }
  if (def.grabT >= GRAB_HOLD) {
    const mv = getMove(att.charId, 'throw', att.form);
    def.grabbedBy = -1;
    setAction(def, 'hitstun');
    push(state, { type: 'throw', side: att.side, target: def.side });
    const dmg = computeDamage(state, att, def, mv.damage, mv, false, 1);
    landHit(state, att, def, dmg, {
      hitstun: mv.hitstun, kbx: mv.knockback.x, kby: mv.knockback.y, dir: att.facing, knockdown: true, juggle: 3,
      strength: 2, counter: false, effect: 'heavyHit', moveId: 'throw', moveName: mv.name, x: def.x, y: def.y - 90, melee: true,
    });
  }
}

// ---------------------------------------------------------------- projectiles & entities

function updateProjectiles(state) {
  const F = state.fighters;
  const P = state.projectiles;
  for (let i = 0; i < P.length; i++) {
    const p = P[i];
    if (!p.active) continue;
    const owner = F[p.owner];
    if (--p.life <= 0) { p.active = false; continue; }
    p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
    if (p.x < -120 || p.x > 1400 || p.y > GROUND + 40) { p.active = false; continue; }
    if (p.cd > 0) p.cd--;
    // projectile clash
    for (let j = i + 1; j < P.length; j++) {
      const q = P[j];
      if (!q.active || q.owner === p.owner) continue;
      if (Math.abs(p.x - q.x) < (p.w + q.w) / 2 && Math.abs(p.y - q.y) < (p.h + q.h) / 2) {
        p.active = false; q.active = false;
        push(state, { type: 'block', side: p.owner, target: q.owner, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, damage: 0 });
        break;
      }
    }
    if (!p.active) continue;
    // a shadow clone soaks one projectile
    for (const e of state.entities) {
      if (e.active && e.kind === 'shadowClone' && e.owner !== p.owner && Math.abs(p.x - e.x) < (p.w + e.w) / 2) {
        e.active = false; p.active = false;
        push(state, { type: 'block', side: p.owner, target: e.owner, x: e.x, y: p.y, damage: 0 });
        break;
      }
    }
    if (!p.active) continue;
    const o = F[1 - p.owner];
    if (p.cd === 0 && canBeHit(o) && rectHits(o, p.x - p.w / 2, p.y - p.h / 2, p.w, p.h)) {
      applyHit(state, owner, o, null, p);
      if (--p.hitsLeft <= 0) p.active = false;
      else p.cd = p.interval || 8;
    }
  }
}

const TRAP_HIT = { hitstun: 40, blockstun: 0, guard: 'mid', strength: 1, effect: 'gadget', knockdown: false, juggle: 1 };

function updateEntities(state) {
  const F = state.fighters;
  for (const e of state.entities) {
    if (!e.active) continue;
    const owner = F[e.owner], o = F[1 - e.owner];
    if (e.cd > 0) e.cd--;
    switch (e.kind) {
      case 'slowField':
        if (Math.abs(o.x - e.x) < e.w / 2 && o.y > e.y - e.h / 2) o.buffs.slowed = 2;
        break;
      case 'trap':
        if (o.grounded && canBeHit(o) && Math.abs(o.x - e.x) < (e.w + statsOf(o).body.w) / 2) {
          const dmg = computeDamage(state, owner, o, e.damage, { kind: 'special', scaling: 1 }, false, 1);
          landHit(state, owner, o, dmg, {
            ...TRAP_HIT, hitstun: owner.comboHits > 0 ? 12 : 40, kbx: 0, kby: 0, dir: e.facing, x: e.x, y: o.y - 40,
            moveId: 'special3', moveName: e.moveName, melee: false,
          });
          e.active = false;
          continue;
        }
        break;
      case 'stormWarning':
        if (e.life === 1) {
          const l = state.entities.find((q) => !q.active);
          if (l) {
            l.active = true; l.id = state.nextId++; l.owner = e.owner; l.kind = 'lightning'; l.facing = e.facing;
            l.w = 70; l.h = GROUND; l.x = e.x; l.y = GROUND / 2; l.life = 16; l.maxLife = 16; l.damage = e.damage || 9; l.hitsLeft = 2; l.cd = 0;
            l.moveName = e.moveName;
          }
        }
        break;
      case 'lightning':
        if (e.hitsLeft > 0 && e.cd === 0 && canBeHit(o) && Math.abs(o.x - e.x) < (e.w + statsOf(o).body.w) / 2) {
          e.hitsLeft--; e.cd = 7;
          const src = { damage: e.damage, hitstun: 22, blockstun: 14, guard: 'mid', strength: 2, effect: 'electric', chip: 2,
            kbx: 1.5, kby: 0, facing: o.x >= e.x ? 1 : -1, x: e.x, y: o.y - 90, moveId: 'ultimate', moveName: e.moveName,
            knockdown: e.hitsLeft === 0, juggle: 1, bonus: 1 };
          applyHit(state, owner, o, null, src);
        }
        break;
      default:
        break;
    }
    if (--e.life <= 0) e.active = false;
  }
}

// ---------------------------------------------------------------- timers & rounds

function timers(state, f, o) {
  if (f.invuln > 0) f.invuln--;
  if (f.hitTimer > 0) f.hitTimer--;
  const cdStep = f.buffs.gadgetHaste > 0 ? 2 : 1;
  for (const k in f.cooldowns) if (f.cooldowns[k] > 0) f.cooldowns[k] = Math.max(0, f.cooldowns[k] - cdStep);
  const b = f.buffs;
  if (b.superStrength > 0) b.superStrength--;
  if (b.gadgetHaste > 0) b.gadgetHaste--;
  if (b.reflex > 0) b.reflex--;
  if (b.slowed > 0) b.slowed--;
  if (b.glide > 0 && f.grounded) b.glide = 0; else if (b.glide > 0) b.glide--;
  b.survival = f.charId === 'nobita' && f.hp < f.maxHp * 0.3 ? 1 : 0;
  if (f.form && b.formTime > 0 && --b.formTime === 0 && f.action !== 'attack') {
    f.form = null; f.ammo = 0;
    push(state, { type: 'form', side: f.side, form: null });
  }
  if (f.form === 'heatblast' && f.ammo < 3 && ++f.ammoT >= 150) { f.ammo++; f.ammoT = 0; }

  // combo bookkeeping lives on the victim's state
  if (isHitState(f.action)) f.comboTime++;
  else {
    if (f.comboTime > 0 || o.comboHits > 0) {
      o.comboHits = 0; o.comboDamage = 0; o.momentum = 0;
      if (state.config.training && f.action !== 'knockdown') f.hp = f.maxHp;
    }
    f.comboTime = 0;
    if (f.grounded) f.juggle = 0;
  }
  if (state.config.training) {
    if (state.config.training.infiniteMeter) f.meter = METER_MAX;
    if (f.action === 'getup' && f.stun <= 1) f.hp = f.maxHp;
  }
}

function roundLogic(state) {
  const F = state.fighters;
  if (state.phase === 'fight') {
    if (state.config.training) return;
    if (state.timer > 0) state.timer--;
    const k0 = F[0].hp <= 0, k1 = F[1].hp <= 0;
    if (k0 || k1) endRound(state, k0 && k1 ? 'draw' : k0 ? 1 : 0, 'ko');
    else if (state.timer <= 0) {
      push(state, { type: 'timeUp' });
      const r0 = F[0].hp / F[0].maxHp, r1 = F[1].hp / F[1].maxHp;
      endRound(state, Math.abs(r0 - r1) < 1e-9 ? 'draw' : r0 > r1 ? 0 : 1, 'time');
    }
  } else if (state.phase === 'roundEnd') {
    if (state.phaseFrame === POSE_FRAME) pose(state);
    if (state.phaseFrame >= ROUND_END_FRAMES) {
      const rtw = state.roundsToWin;
      if (state.wins[0] >= rtw || state.wins[1] >= rtw) {
        state.phase = 'matchEnd';
        state.phaseFrame = 0;
        state.matchWinner = state.wins[0] >= rtw && state.wins[1] >= rtw ? 'draw' : state.wins[0] >= rtw ? 0 : 1;
        push(state, { type: 'matchEnd', winner: state.matchWinner });
      } else {
        state.round++;
        resetRound(state);
      }
    }
  }
}

function endRound(state, winner, reason) {
  state.phase = 'roundEnd';
  state.phaseFrame = 0;
  state.roundWinner = winner;
  if (winner === 'draw') { state.wins[0]++; state.wins[1]++; }
  else state.wins[winner]++;
  push(state, { type: 'roundEnd', winner, reason: winner === 'draw' ? 'draw' : reason });
}

function pose(state) {
  const w = state.roundWinner;
  for (const f of state.fighters) {
    if (f.ko || f.action === 'ko' || !f.grounded) continue;
    if (f.action === 'attack') endMove(state, f, true);
    f.vx = 0;
    setAction(f, w === 'draw' ? 'lose' : w === f.side ? 'win' : 'lose');
  }
}

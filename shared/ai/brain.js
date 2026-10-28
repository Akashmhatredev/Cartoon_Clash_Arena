// AI brain: state machine + delayed (fair) perception. Allocation-free per tick.
import { BTN } from '../input.js';
import { STAGE } from '../constants.js';
import { moveTable, halfWidth, GUARD_LOW, GUARD_HIGH, KIND_THROW, KIND_ULT, KIND_SPECIAL } from './moves.js';
import { getStyle, DIFFICULTY } from './styles.js';

const { LEFT, RIGHT, UP, DOWN, LIGHT, HEAVY, SPECIAL, BLOCK, THROW, ULT } = BTN;

export const AI_STATES = ['idle', 'approach', 'retreat', 'attack', 'block', 'jump', 'dodge', 'recover', 'special', 'ultimate'];
const S_IDLE = 0, S_APPROACH = 1, S_RETREAT = 2, S_ATTACK = 3, S_BLOCK = 4, S_JUMP = 5, S_DODGE = 6,
  S_RECOVER = 7, S_SPECIAL = 8, S_ULT = 9;

// 1 = helpless, 2 = knocked down (wake-up), 3 = blockstun
const LOCKED = { hitstun: 1, launched: 1, grabbed: 1, ko: 1, win: 1, lose: 1, intro: 1, knockdown: 2, getup: 2, blockstun: 3 };
const HIST = 64; // power of two
const MAX_PLAN = 6;
const R_NONE = 0, R_BLOCK = 1, R_JUMP = 2, R_ANTI = 3;

function makeObs() {
  return {
    frame: 0, x: 0, y: 0, vx: 0, vy: 0, grounded: true, action: 'idle', facing: 1,
    moveId: null, movePhase: null, moveFrame: 0, serial: 0,
    guard: 0, reach: 0, startup: 0, total: 0, kind: 0, proj: false, damage: 0, onBlock: 0,
    blocking: false, crouching: false, invuln: 0, airSerial: 0,
    projDist: 9999, projSpeed: 0, projLow: false, projSerial: 0, hazard: false, trapX: -9999,
  };
}

export function createBrain(charId, difficulty, seed) {
  const D = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  const S = getStyle(charId);
  const seed0 = (((seed >>> 0) * 2654435761) ^ 0x5bd1e995) >>> 0 || 1;
  const rsBuf = new Uint32Array(1); // typed storage: no boxed uint32 per call
  rsBuf[0] = seed0;
  function rnd() { // mulberry32
    rsBuf[0] = rsBuf[0] + 0x6D2B79F5;
    let t = rsBuf[0] | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  const hist = new Array(HIST);
  for (let i = 0; i < HIST; i++) hist[i] = makeObs();
  const plan = new Array(MAX_PLAN).fill('');
  const planBack = new Array(MAX_PLAN).fill(false);
  const planBlind = new Array(MAX_PLAN).fill(false);
  const routeW = new Array(16).fill(0);

  let head = -1, count = 0, delay = D.reaction, delayTimer = 0;
  let opSerial = 0, lastOpMove = null, lastOpFrame = 0, airSerial = 0, opWasAir = false, projSerial = 0, projWasNear = false;
  let st = S_IDLE, stTimer = 0, moveBits = 0;
  let pressBits = 0, cmdDirs = 0, cmdTimer = 0, prevMask = 0, chargeHold = 0;
  let dashStep = 0, dashBit = 0;
  let planLen = 0, planIdx = 0, planStarted = false, planIssued = 0, planRepress = false, planHitBase = 0, planConfirmed = false;
  let rolledSerial = -1, threatResp = R_NONE, rolledProj = -1, projResp = R_NONE, rolledAir = -1, airResp = R_NONE;
  let punishSerial = -1, blockedSerial = -1, blockedPunished = -1;
  let blockLow = false, blockLinger = 0;
  let wakeRolled = false, wakeBlock = false, techRolled = false, techOk = false;
  let lastAttack = 0, lastProj = -9999, zoneStreak = 0, lastRound = -1, now = 0;
  let airAttacked = false, hazardRolled = false, hazardBlock = false;
  let planPrevMove = null, planPrevFrame = 0, wasInRange = false;
  let myHalf = 38, opHalf = 38, inited = false, prefGap = 60, pokeGap = 60, opPoke = 90;
  let fwdBit = RIGHT, backBit = LEFT;

  function clearPlan() { planLen = 0; planIdx = 0; planStarted = false; planRepress = false; planConfirmed = false; }

  function softReset() {
    head = -1; count = 0; delayTimer = 0;
    lastOpMove = null; lastOpFrame = 0; opWasAir = false; projWasNear = false;
    st = S_IDLE; stTimer = 0; moveBits = 0; wasInRange = false;
    pressBits = 0; cmdDirs = 0; cmdTimer = 0; chargeHold = 0; dashStep = 0;
    clearPlan();
    rolledSerial = -1; threatResp = R_NONE; rolledProj = -1; projResp = R_NONE; rolledAir = -1; airResp = R_NONE;
    punishSerial = -1; blockedSerial = -1; blockedPunished = -1; blockLinger = 0;
    wakeRolled = false; techRolled = false; airAttacked = false; zoneStreak = 0; lastProj = -9999;
  }

  function reset() {
    rsBuf[0] = seed0; softReset(); prevMask = 0; lastRound = -1; lastAttack = 0; inited = false;
    opSerial = 0; airSerial = 0; projSerial = 0;
  }

  function init(me, op) {
    inited = true;
    myHalf = halfWidth(me.charId);
    opHalf = halfWidth(op.charId);
    const t = moveTable(me.charId, null);
    let poke = 0;
    if (t.light) poke = Math.max(poke, t.light.meleeReach);
    if (t.crouchLight) poke = Math.max(poke, t.crouchLight.meleeReach);
    if (t.heavy) poke = Math.max(poke, t.heavy.meleeReach * 0.9);
    pokeGap = Math.max(25, poke - 14);
    const ot = moveTable(op.charId, null);
    opPoke = 0;
    if (ot.light) opPoke = Math.max(opPoke, ot.light.meleeReach);
    if (ot.heavy) opPoke = Math.max(opPoke, ot.heavy.meleeReach);
    if (ot.crouchHeavy) opPoke = Math.max(opPoke, ot.crouchHeavy.meleeReach);
    if (opPoke <= 0) opPoke = 90;
    prefGap = S.range != null ? S.range : pokeGap;
  }

  // ---------- perception ----------
  function record(state, side, me, op) {
    head = (head + 1) & (HIST - 1);
    if (count < HIST) count++;
    const o = hist[head];
    o.frame = state.frame; o.x = op.x; o.y = op.y; o.vx = op.vx; o.vy = op.vy; o.grounded = !!op.grounded;
    o.action = op.action; o.facing = op.facing; o.invuln = op.invuln | 0; o.crouching = !!op.crouching;
    o.blocking = !!op.blocking || op.action === 'block' || op.action === 'blockstun';
    if (op.action === 'attack' && op.moveId) {
      if (op.moveId !== lastOpMove || op.moveFrame < lastOpFrame) opSerial++;
      lastOpMove = op.moveId; lastOpFrame = op.moveFrame;
      const info = moveTable(op.charId, op.form)[op.moveId];
      o.moveId = op.moveId; o.movePhase = op.movePhase; o.moveFrame = op.moveFrame | 0;
      if (info) {
        o.guard = info.guard; o.reach = info.reach; o.startup = info.startup; o.total = info.total;
        o.kind = info.kind; o.proj = info.proj; o.damage = info.damage; o.onBlock = info.onBlock;
      } else {
        o.guard = 0; o.reach = 90; o.startup = 6; o.total = 24; o.kind = 0; o.proj = false; o.damage = 5; o.onBlock = 0;
      }
    } else {
      lastOpMove = null; lastOpFrame = 0;
      o.moveId = null; o.movePhase = null; o.moveFrame = 0; o.guard = 0; o.reach = 0; o.startup = 0;
      o.total = 0; o.kind = 0; o.proj = false; o.damage = 0; o.onBlock = 0;
    }
    o.serial = opSerial;
    const air = !op.grounded;
    if (air && !opWasAir) airSerial++;
    opWasAir = air;
    o.airSerial = airSerial;

    // incoming projectiles
    let best = 9999, spd = 0, low = false;
    const ps = state.projectiles;
    if (ps) {
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!p || !p.active || p.owner === side) continue;
        const dx = me.x - p.x, vx = p.vx || 0;
        if (dx * vx < 0 && Math.abs(dx) > myHalf) continue; // flying away
        let d = Math.abs(dx) - (p.w || 30) * 0.5 - myHalf;
        if (d < 0) d = 0;
        if (d < best) { best = d; spd = Math.abs(vx); low = (p.y + (p.h || 30) * 0.5) > STAGE.groundY - 120; }
      }
    }
    const near = best < 9999;
    if (near && !projWasNear) projSerial++;
    projWasNear = near;
    o.projDist = best; o.projSpeed = spd; o.projLow = low; o.projSerial = projSerial;

    // hazards (visible warnings / zones / traps owned by the opponent)
    let hazard = false, trapX = -9999;
    const es = state.entities;
    if (es) {
      for (let i = 0; i < es.length; i++) {
        const e = es[i];
        if (!e || !e.active || e.owner === side) continue;
        const k = e.kind;
        if (k === 'trap') { trapX = e.x; continue; }
        if (k === 'lightning' || k === 'stormWarning' || k === 'quake') {
          if (Math.abs(e.x - me.x) < (e.w || 80) * 0.5 + myHalf + 24) hazard = true;
        }
      }
    }
    o.hazard = hazard; o.trapX = trapX;
  }

  function observe() {
    const d = delay < count ? delay : count - 1;
    return hist[(head - d) & (HIST - 1)];
  }

  // ---------- helpers ----------
  function ready(me, info) {
    if (!info) return false;
    const cd = me.cooldowns;
    if (cd && (cd[info.slot] | 0) > 0) return false;
    if (info.meterCost > 0 && (me.meter || 0) < info.meterCost) return false;
    return true;
  }

  function slotInput(slot, back) {
    switch (slot) {
      case 'light': case 'airLight': pressBits = LIGHT; cmdDirs = 0; break;
      case 'heavy': case 'airHeavy': pressBits = HEAVY; cmdDirs = 0; break;
      case 'crouchLight': pressBits = LIGHT; cmdDirs = DOWN; break;
      case 'crouchHeavy': pressBits = HEAVY; cmdDirs = DOWN; break;
      case 'throw': pressBits = THROW; cmdDirs = 0; break;
      case 'special1': pressBits = SPECIAL; cmdDirs = 0; break;
      case 'special2': pressBits = SPECIAL; cmdDirs = back ? backBit : fwdBit; break;
      case 'special3': pressBits = SPECIAL; cmdDirs = DOWN; break;
      case 'ultimate': pressBits = ULT; cmdDirs = 0; break;
      default: pressBits = 0; cmdDirs = 0;
    }
    cmdTimer = 3;
  }

  function issue(slot, back) {
    slotInput(slot, back);
    planIssued = now; planStarted = false; planRepress = true;
  }

  function startPlan(me, len, state) {
    planPrevMove = me.action === 'attack' ? me.moveId : null; planPrevFrame = me.moveFrame | 0;
    planLen = len; planIdx = 0; planConfirmed = false;
    planHitBase = me.comboHits | 0;
    st = state; stTimer = 0;
    issue(plan[0], planBack[0]);
    lastAttack = now;
  }

  function single(me, slot, back, state) {
    plan[0] = slot; planBack[0] = !!back; planBlind[0] = false;
    startPlan(me, 1, state);
  }

  function cornered(bit, me) {
    return bit === LEFT ? me.x - STAGE.left < 110 : STAGE.right - me.x < 110;
  }

  function pickRoute(me, myT, gap) {
    const routes = S.routes;
    let total = 0;
    const n = routes.length < routeW.length ? routes.length : routeW.length;
    for (let i = 0; i < n; i++) {
      routeW[i] = 0;
      const first = myT[routes[i].s[0]];
      if (!first || !first.hasHitbox || !ready(me, first)) continue;
      if (first.reach + 6 < gap) continue;
      routeW[i] = routes[i].w;
      total += routes[i].w;
    }
    if (total <= 0) return false;
    let r = rnd() * total, pick = 0;
    for (let i = 0; i < n; i++) { r -= routeW[i]; if (r <= 0 && routeW[i] > 0) { pick = i; break; } }
    const steps = routes[pick].s;
    let max = D.combo;
    if (max <= 1 && rnd() < D.chain) max = 2;
    let len = 0;
    for (let i = 0; i < steps.length && len < max && len < MAX_PLAN; i++) {
      const info = myT[steps[i]];
      if (!info) break;
      if (info.kind === KIND_SPECIAL && i > 0 && rnd() > D.special) break;
      plan[len] = steps[i]; planBack[len] = false; planBlind[len] = len > 0 && rnd() < D.chain;
      len++;
    }
    if (!len) return false;
    startPlan(me, len, S_ATTACK);
    return true;
  }

  // best move to punish a window of `window` frames at distance `gap`
  function pickPunish(me, myT, gap, window) {
    let best = null, score = -1;
    const all = myT.all;
    for (let i = 0; i < all.length; i++) {
      const m = all[i];
      if (m.kind === KIND_THROW || !m.hasHitbox || m.slot === 'airLight' || m.slot === 'airHeavy') continue;
      if (m.kind === KIND_ULT && !D.ult) continue;
      if (m.startup + 1 > window || m.reach + 4 < gap || !ready(me, m)) continue;
      if (m.proj && m.startup > 14) continue;
      const s = m.damage + (m.kind === KIND_ULT ? 30 : 0) - m.startup * 0.2;
      if (s > score) { score = s; best = m; }
    }
    return best;
  }

  function enterJump(dirBit) {
    st = S_JUMP; stTimer = 70; airAttacked = false;
    pressBits = 0; cmdDirs = UP | dirBit; cmdTimer = 3;
  }

  function startDash(bit) { dashStep = 4; dashBit = bit; }

  function useSpecial(me, sp, state) {
    single(me, sp.slot, sp.dir === 'back', state);
    if (sp.use === 'charge') chargeHold = sp.hold || 30;
  }

  // find a style special for `use` that fits the gap; returns the entry or null
  function findSpecial(me, myT, use, gap) {
    const list = S.specials;
    for (let i = 0; i < list.length; i++) {
      const sp = list[i];
      if (sp.use !== use || gap < sp.min || gap > sp.max) continue;
      const info = myT[sp.slot];
      if (!info || !ready(me, info)) continue;
      return sp;
    }
    return null;
  }

  function ownProjectileActive(state, side) {
    const ps = state.projectiles;
    if (!ps) return false;
    for (let i = 0; i < ps.length; i++) if (ps[i] && ps[i].active && ps[i].owner === side) return true;
    return false;
  }

  function ownEntity(state, side, kind) {
    const es = state.entities;
    if (!es) return false;
    for (let i = 0; i < es.length; i++) { const e = es[i]; if (e && e.active && e.owner === side && e.kind === kind) return true; }
    return false;
  }

  // ---------- plan execution while my move runs ----------
  function continuePlan(me, ob, myT, gap) {
    if (!planLen) return 0;
    const cur = plan[planIdx];
    if (!planStarted && me.moveId === cur && (cur !== planPrevMove || (me.moveFrame | 0) < planPrevFrame)) {
      planStarted = true; planHitBase = me.comboHits | 0;
    }
    const info = me.moveId ? myT[me.moveId] : null;
    const remaining = info ? info.total - (me.moveFrame | 0) : 0;
    if (!planStarted) {
      // still finishing the previous move: re-press into the input buffer near its end
      if (planRepress && remaining <= 6 && now - planIssued > 1) { planRepress = false; slotInput(cur, planBack[planIdx]); }
      if (now - planIssued > 45) clearPlan();
      return 0;
    }
    if ((me.comboHits | 0) > planHitBase) planConfirmed = true;
    if (planIdx + 1 >= planLen) {
      // last step: tack on an ultimate when it would land
      if (planConfirmed && D.ult && planLen > 1 && cur !== 'ultimate') {
        const u = myT.ultimate;
        if (u && ready(me, u) && u.reach + 10 >= gap && rnd() < (difficulty === 'normal' ? 0.5 : 0.85)) {
          plan[planLen] = 'ultimate'; planBack[planLen] = false; planBlind[planLen] = false;
          if (planLen < MAX_PLAN - 1) planLen++;
        }
      }
      if (planIdx + 1 >= planLen) return 0;
    }
    const next = plan[planIdx + 1];
    const nInfo = myT[next];
    if (!nInfo || !ready(me, nInfo)) { planLen = planIdx + 1; return 0; }
    let go = false;
    if (planConfirmed) go = true;
    else if (planBlind[planIdx + 1] && remaining <= 7 && me.movePhase === 'recovery') go = true;
    else if (me.movePhase === 'recovery' && remaining <= 2) { planLen = planIdx + 1; return 0; }
    if (go) {
      planPrevMove = me.moveId; planPrevFrame = me.moveFrame | 0;
      planIdx++;
      issue(next, planBack[planIdx]);
      planConfirmed = false;
      lastAttack = now;
    }
    return 0;
  }

  // ---------- main ----------
  function think(state, side) {
    const me = state.fighters[side], op = state.fighters[side ^ 1];
    if (!me || !op) return 0;
    if (state.phase !== 'fight') { softReset(); prevMask = 0; return 0; }
    if (state.round !== lastRound) { lastRound = state.round; softReset(); lastAttack = state.frame; }
    if (!inited) init(me, op);
    now = state.frame;
    fwdBit = me.facing === -1 ? LEFT : RIGHT;
    backBit = fwdBit === RIGHT ? LEFT : RIGHT;
    record(state, side, me, op);
    if (--delayTimer <= 0) { delay = D.reaction + ((rnd() * (D.jitter + 1)) | 0); delayTimer = 30 + ((rnd() * 30) | 0); }
    const ob = observe();

    let m = decide(state, side, me, ob);

    if (dashStep > 0) {
      // double tap: press, release, press, hold
      m = (m & ~(LEFT | RIGHT)) | (dashStep === 3 ? 0 : dashBit);
      dashStep--;
    }
    if (cmdTimer > 0) m = cmdDirs;
    if (pressBits) {
      if (prevMask & pressBits) { /* button still down from last tick: release first, press next tick */ }
      else { m |= pressBits; pressBits = 0; }
    }
    if (cmdTimer > 0 && !pressBits) cmdTimer--;
    if (chargeHold > 0) {
      if (me.action === 'attack' || pressBits) { m |= SPECIAL; chargeHold--; } else chargeHold = 0;
    }
    if ((m & LEFT) && (m & RIGHT)) m &= ~LEFT;
    prevMask = m;
    return m;
  }

  function decide(state, side, me, ob) {
    const myT = moveTable(me.charId, me.form);
    const toward = ob.x >= me.x ? RIGHT : LEFT, away = toward === RIGHT ? LEFT : RIGHT;
    const dist = Math.abs(ob.x - me.x);
    const gap = dist - opHalf;
    const act = me.action;
    const lock = LOCKED[act] | 0;

    // ----- not actionable -----
    if (lock === 1) {
      clearPlan(); chargeHold = 0; st = S_RECOVER; stTimer = 0; wakeRolled = false;
      if (act === 'grabbed') {
        if (!techRolled) { techRolled = true; techOk = rnd() < D.tech; }
        if (techOk && (me.actionFrame | 0) >= 1) { pressBits = THROW; cmdDirs = 0; cmdTimer = 1; }
      } else techRolled = false;
      return 0;
    }
    techRolled = false;
    if (lock === 3) {
      clearPlan(); st = S_BLOCK; if (blockLinger < 6) blockLinger = 6;
      if (ob.moveId && ob.onBlock < -2 && (ob.damage >= 8 || ob.kind !== 0)) blockedSerial = ob.serial;
      return BLOCK | (me.blocking === 'low' || me.crouching ? DOWN : 0);
    }
    if (lock === 2) {
      clearPlan(); chargeHold = 0;
      if (!wakeRolled) { wakeRolled = true; wakeBlock = rnd() < D.wake; }
      st = S_RECOVER; stTimer = wakeBlock ? 14 : 0;
      return wakeBlock ? BLOCK : 0;
    }
    wakeRolled = false;

    if (act === 'attack') return continuePlan(me, ob, myT, gap);

    // pressed something that has not started yet
    if (planLen && !planStarted) {
      if (now - planIssued <= 8) return 0;
      clearPlan();
    } else if (planLen) {
      clearPlan(); // plan finished
      st = S_IDLE; stTimer = 0;
    }

    // ----- airborne -----
    if (!me.grounded) {
      if (!airAttacked) {
        const a = rnd() < 0.6 ? (myT.airHeavy || myT.airLight) : (myT.airLight || myT.airHeavy);
        if (a && gap <= a.meleeReach + 14 && (me.vy | 0) > -7 && Math.abs(ob.y - me.y) < 170 && ready(me, a)) {
          airAttacked = true;
          if (rnd() > D.mistake) { single(me, a.slot, false, S_ATTACK); }
        }
      }
      return 0;
    }
    if (st === S_JUMP) { st = S_IDLE; stTimer = 0; }

    // ----- threats (perceived through the delay) -----
    const opAttacking = ob.moveId !== null && (ob.movePhase === 'startup' || ob.movePhase === 'active');
    const melee = opAttacking && ob.kind !== KIND_THROW && !ob.proj && dist <= ob.reach + myHalf + 30;
    const ultThreat = opAttacking && ob.kind === KIND_ULT && dist <= ob.reach + myHalf + 60;
    const projThreat = ob.projDist <= Math.max(120, ob.projSpeed * 22 + 60);
    if (melee || ultThreat) {
      if (ob.serial !== rolledSerial) {
        rolledSerial = ob.serial;
        let p = D.block;
        if (st === S_BLOCK && blockLinger > 0) p += 0.15; // already guarding: keep guarding strings
        if (ultThreat) p += 0.1;
        threatResp = rnd() < p ? R_BLOCK : R_NONE;
        blockLow = ob.guard === GUARD_LOW;
        if (ob.guard !== 0 && rnd() < D.mistake * 0.5) blockLow = !blockLow;
      }
      if (threatResp === R_BLOCK) { clearPlan(); st = S_BLOCK; blockLinger = 6; return BLOCK | (blockLow ? DOWN : 0); }
    }
    if (projThreat) {
      if (ob.projSerial !== rolledProj) {
        rolledProj = ob.projSerial;
        const r = rnd();
        if (ob.projLow && gap > 110 && r < D.jumpDodge) projResp = R_JUMP;
        else projResp = rnd() < D.block + 0.1 ? R_BLOCK : R_NONE;
      }
      if (projResp === R_JUMP && ob.projDist <= ob.projSpeed * 18 + 50) {
        projResp = R_NONE; clearPlan(); st = S_DODGE; enterJump(toward); return 0;
      }
      if (projResp === R_BLOCK) { clearPlan(); st = S_BLOCK; blockLinger = 6; blockLow = false; return BLOCK; }
    }
    if (ob.hazard) {
      if (!hazardRolled) { hazardRolled = true; hazardBlock = rnd() < D.block + 0.1; }
      if (hazardBlock) { clearPlan(); st = S_BLOCK; blockLinger = 10; blockLow = false; return BLOCK; }
    } else hazardRolled = false;
    // opponent just stepped into its striking range: maybe raise the guard (anticipation, rolled once per entry)
    const inRange = dist <= opPoke + myHalf + 30 && ob.action !== 'knockdown' && ob.action !== 'getup';
    if (inRange && !wasInRange && st !== S_BLOCK && now - lastAttack < D.stall && rnd() < D.block * 0.75) {
      clearPlan(); st = S_BLOCK; blockLinger = 14 + ((rnd() * 22) | 0); blockLow = rnd() < 0.5;
    }
    wasInRange = inRange;
    if (st === S_BLOCK) {
      if (blockLinger > 0) { blockLinger--; return BLOCK | (blockLow ? DOWN : 0); }
      st = S_IDLE; stTimer = 0;
    }

    // ----- anti-air -----
    if (!ob.grounded && ob.y < STAGE.groundY - 30 && gap < 300) {
      if (ob.airSerial !== rolledAir) {
        rolledAir = ob.airSerial;
        const r = rnd();
        airResp = r < D.antiAir ? R_ANTI : (r < D.antiAir + D.block * 0.5 ? R_BLOCK : R_NONE);
      }
      if (airResp === R_ANTI) {
        const aa = myT[S.antiAir] && ready(me, myT[S.antiAir]) ? myT[S.antiAir] : (myT.heavy || myT.light);
        if (aa && gap <= aa.meleeReach + 26 && ob.vy > -4) {
          airResp = R_NONE;
          if (rnd() > D.mistake) { single(me, aa.slot, false, S_ATTACK); return 0; }
        }
        return 0;
      }
      if (airResp === R_BLOCK && gap < 160) { st = S_BLOCK; blockLinger = 8; blockLow = false; return BLOCK; }
    }

    // ----- punish unsafe moves -----
    if (D.punish > 0) {
      let window = 0, serial = -1;
      if (ob.moveId && ob.movePhase === 'recovery' && ob.serial !== punishSerial) {
        window = ob.total - ob.moveFrame - delay + 2; serial = ob.serial;
      } else if (blockedSerial >= 0 && blockedSerial !== blockedPunished) {
        window = 8; serial = blockedSerial; blockedPunished = blockedSerial;
      }
      if (serial >= 0) {
        punishSerial = serial;
        if (window > 0 && rnd() < D.punish && rnd() > D.mistake) {
          const pm = pickPunish(me, myT, gap, window);
          if (pm) {
            plan[0] = pm.slot; planBack[0] = false; planBlind[0] = false;
            let len = 1;
            if (pm.kind !== KIND_ULT && D.combo > 1 && (pm.slot === 'light' || pm.slot === 'crouchLight')) {
              const h = myT.heavy;
              if (h) { plan[1] = 'heavy'; planBack[1] = false; planBlind[1] = false; len = 2; }
            }
            startPlan(me, len, pm.kind === KIND_ULT ? S_ULT : S_ATTACK);
            return 0;
          }
        }
      }
    }

    // ----- ultimate when it would land -----
    if (D.ult) {
      const u = myT.ultimate;
      if (u && ready(me, u)) {
        const helpless = ob.action === 'hitstun' || ob.action === 'launched' ||
          (ob.moveId && ob.movePhase === 'recovery' && ob.total - ob.moveFrame - delay >= u.startup);
        if (helpless && u.reach + 10 >= gap && ob.invuln <= 0 && rnd() > D.mistake) { single(me, 'ultimate', false, S_ULT); return 0; }
      }
    }

    // ----- continue current neutral state -----
    if (stTimer > 0) {
      stTimer--;
      if (st === S_APPROACH) {
        if (gap <= prefGap + 6) stTimer = 0;
        else if (ob.trapX > -9999 && Math.abs(ob.trapX - me.x) < 110 && (ob.trapX - me.x) * (toward === RIGHT ? 1 : -1) > 0) { enterJump(toward); return 0; }
        else return toward;
      } else if (st === S_RETREAT) {
        if (cornered(away, me)) stTimer = 0; else return away;
      } else if (st === S_RECOVER) {
        return wakeBlock ? BLOCK : 0;
      } else if (st === S_IDLE || st === S_DODGE) {
        return moveBits;
      }
    }
    return neutral(state, side, me, ob, myT, gap, toward, away);
  }

  function neutral(state, side, me, ob, myT, gap, toward, away) {
    moveBits = 0;
    const stalled = now - lastAttack > D.stall;
    const aggr = Math.min(1, S.aggression * D.aggression + (stalled ? 0.6 : 0));
    const usePref = rnd() < D.spacing;
    const pref = usePref ? prefGap : pokeGap;
    const band = 28;
    const opDown = ob.action === 'knockdown' || ob.action === 'getup' || ob.invuln > 0;
    const spRate = D.special;

    // ben10: pick a form for the range
    const F = S.forms;
    if (F && spRate > 0.3) {
      const shift = myT[F.shiftSlot];
      if (shift && ready(me, shift) && rnd() < 0.35 * spRate) {
        const want = gap > F.farGap ? F.far : gap < F.closeGap ? F.close : F.mid;
        const bad = (me.form || null) !== want || (me.form === 'heatblast' && (me.ammo | 0) <= 0);
        if (bad && !(me.form === 'heatblast' && want === 'heatblast' && (me.ammo | 0) <= 0)) { single(me, F.shiftSlot, false, S_SPECIAL); return 0; }
      }
    }

    // set-up specials at safe distance (buff, trap, charge)
    if (gap > 160 && rnd() < spRate * 0.5) {
      const list = S.specials;
      for (let i = 0; i < list.length; i++) {
        const sp = list[i];
        if (gap < sp.min || gap > sp.max) continue;
        if (sp.use === 'buff' && !(me.buffs && me.buffs[sp.buff])) {
          if (ready(me, myT[sp.slot]) && rnd() < sp.w) { useSpecial(me, sp, S_SPECIAL); return 0; }
        } else if (sp.use === 'trap' && !ownEntity(state, side, sp.entity)) {
          if (ready(me, myT[sp.slot]) && rnd() < sp.w) { useSpecial(me, sp, S_SPECIAL); return 0; }
        } else if (sp.use === 'charge') {
          const closing = (ob.x - me.x) * (ob.vx || 0) < 0 && Math.abs(ob.vx || 0) > 1;
          if ((!closing || opDown) && !ob.proj && ready(me, myT[sp.slot]) && rnd() < sp.w) { useSpecial(me, sp, S_SPECIAL); lastProj = now; return 0; }
        }
      }
    }

    if (opDown && !stalled) {
      // don't swing at an invulnerable opponent; get to range and wait
      if (gap > pref + band) { st = S_APPROACH; stTimer = 8; return toward; }
      st = S_IDLE; stTimer = 4; moveBits = 0; return 0;
    }

    // zoning
    if (gap > pokeGap + 20 && now - lastProj >= D.projGap && (zoneStreak < 3 || S.keepAway) && !ownProjectileActive(state, side)) {
      const sp = findSpecial(me, myT, 'zone', gap);
      if (sp && rnd() < sp.w * spRate * (S.keepAway ? 0.8 : 0.45)) {
        useSpecial(me, sp, S_SPECIAL); lastProj = now; zoneStreak++; return 0;
      }
    }

    // throw a turtle
    const th = myT.throw;
    if (th && ob.blocking && gap <= th.meleeReach + 6 && rnd() < D.throwBlk) { single(me, 'throw', false, S_ATTACK); return 0; }

    if (gap > pref + band) {
      zoneStreak = 0;
      const ap = findSpecial(me, myT, 'approach', gap);
      if (ap && rnd() < ap.w * spRate * 0.3) { useSpecial(me, ap, S_SPECIAL); return 0; }
      if (gap > 80 && gap < 280 && rnd() < S.jump * (stalled ? 0.5 : 1)) { enterJump(toward); return 0; }
      st = S_APPROACH; stTimer = D.decide + ((rnd() * 12) | 0);
      if (gap > 160 && rnd() < S.dash) startDash(toward);
      return toward;
    }

    if (gap < pref - band - 10 && S.keepAway && !stalled && !cornered(away, me)) {
      const es = findSpecial(me, myT, 'escape', gap);
      if (es && rnd() < es.w * spRate * 0.4) { useSpecial(me, es, S_DODGE); return 0; }
      st = S_RETREAT; stTimer = D.decide + ((rnd() * 10) | 0);
      if (rnd() < 0.3) startDash(away);
      return away;
    }

    // inside the opponent's reach while they are free: guard for a moment (anticipation, not a read)
    const opFree = !ob.moveId && (ob.action === 'idle' || ob.action === 'walk' || ob.action === 'crouch' || ob.action === 'dash');
    if (opFree && !stalled && gap + opHalf <= opPoke + myHalf + 24 && rnd() < D.block * (0.75 - aggr * 0.35)) {
      st = S_BLOCK; blockLinger = (D.decide * 0.8 + rnd() * 10) | 0; blockLow = rnd() < 0.55;
      return BLOCK | (blockLow ? DOWN : 0);
    }

    // in range
    if (rnd() < aggr) {
      if (rnd() < 0.25 * spRate) {
        const cs = findSpecial(me, myT, 'close', gap);
        if (cs) { useSpecial(me, cs, S_SPECIAL); return 0; }
      }
      if (pickRoute(me, myT, gap)) return 0;
      // nothing reaches: step in
      st = S_APPROACH; stTimer = 6; return toward;
    }
    // pressured near a wall: escape
    if (gap < 40 && cornered(away, me)) {
      const es = findSpecial(me, myT, 'escape', gap);
      if (es && rnd() < spRate * 0.5) { useSpecial(me, es, S_DODGE); return 0; }
      if (rnd() < 0.3) { enterJump(toward); return 0; }
    }
    // not attacking while inside the opponent's reach: usually guard
    if (!stalled && gap + opHalf <= opPoke + myHalf + 30 && rnd() < D.block * 1.3) {
      st = S_BLOCK; blockLinger = (D.decide + rnd() * 12) | 0; blockLow = rnd() < 0.5;
      return BLOCK | (blockLow ? DOWN : 0);
    }
    // footsies
    const r = rnd();
    if (r < 0.45) { st = S_IDLE; stTimer = D.decide; moveBits = 0; return 0; }
    if (r < 0.65 && !cornered(away, me)) { st = S_RETREAT; stTimer = 6 + ((rnd() * 8) | 0); return away; }
    if (r < 0.85) { st = S_APPROACH; stTimer = 5 + ((rnd() * 6) | 0); return toward; }
    st = S_IDLE; stTimer = D.decide; moveBits = DOWN; return DOWN;
  }

  return {
    think,
    reset,
    get state() { return AI_STATES[st]; },
  };
}

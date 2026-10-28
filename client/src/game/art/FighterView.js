// Skeletal puppet renderer for one fighter. A Container of atlas Images posed per joint.
import { getMove } from '@shared/index.js';
import { getSpec, FORMS } from './chars.js';
import { buildAtlas } from './atlas.js';
import { J, NJ, B, NB, D2R, solveRig, lowestY } from './rig.js';
import { POSES, ATTACKS, IDLE, CROUCH, AIR_LEG_POSE, OWN_LEGS, guessAnim, overlayLegs, lerpPose } from './poses.js';
import { ensureCommonTextures, TEX, invScale, getRes } from '../fx/textures.js';
import { hexNum } from './draw.js';

const GROUND_Y = 640;
const SIDE_GLOW = [0x22e4ff, 0xff2fa6];
const BUFF_COLORS = {
  superStrength: 0xff4a1f, staticCharge: 0xffe94a, gadgetHaste: 0x22e4ff, momentum: 0xff8a1f,
  survival: 0x7fb8ff, reflex: 0x9fe8ff,
};
const TWO_PI = Math.PI * 2;

function lerpColor(a, b, t) {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return ((r & 255) << 16) | ((g & 255) << 8) | (bl & 255);
}

export class FighterView {
  constructor(scene, charId, side) {
    this.scene = scene;
    this.charId = charId;
    this.side = side | 0;
    ensureCommonTextures(scene);
    this.res = getRes(scene);
    this.root = scene.add.container(0, 0).setDepth(20 + this.side);
    this.container = this.root;
    this.softInv = invScale(scene, TEX.soft);

    this.shadow = scene.add.image(0, GROUND_Y, TEX.shadow).setDepth(19).setAlpha(0.5);
    this.shadowInv = invScale(scene, TEX.shadow);
    this.glow = scene.add.image(0, 0, TEX.soft).setBlendMode('ADD').setTint(SIDE_GLOW[this.side & 1]).setAlpha(0.16);
    this.aura = scene.add.image(0, 0, TEX.soft).setBlendMode('ADD').setVisible(false);
    this.orb = scene.add.image(0, 0, TEX.soft).setBlendMode('ADD').setVisible(false);
    this.orbCore = scene.add.image(0, 0, TEX.star).setBlendMode('ADD').setVisible(false);
    this.ring = scene.add.image(0, 0, TEX.ring).setBlendMode('ADD').setVisible(false);
    this.root.add([this.glow, this.aura, this.orb, this.orbCore, this.ring]);

    this.rigs = {};
    this.rig = null;
    this.formKey = undefined;
    this.cur = new Float32Array(NJ); this.cur.set(IDLE);
    this.tgt = new Float32Array(NJ);
    this.bones = new Float32Array(NB * 3);
    this.t = (this.side * 0.37) % 1;
    this.walkPhase = 0;
    this.sq = 1;
    this.wasGrounded = true;
    this.lastAction = null;
    this.actionT = 0;
    this.tintMode = -1;
    this.formFlashT = 0;
    this.moveCache = {};
    this.anim = 'idle';
    this.phase = null;
    this.pole = false;
    this._useRig(null);
  }

  // ------------------------------------------------------------------ rigs / forms
  _makeRig(form) {
    const spec = getSpec(this.charId, form);
    const atlas = buildAtlas(this.scene, spec);
    const c = this.scene.add.container(0, 0);
    const imgs = [];
    const inv = 1 / atlas.S;
    for (let i = 0; i < spec.parts.length; i++) {
      const p = spec.parts[i];
      const fr = atlas.frames[p.name];
      const img = this.scene.add.image(0, 0, atlas.key, p.name).setOrigin(fr.ox, fr.oy).setScale(inv);
      if (p.dyn === 'prop' || p.dyn === 'staffHand') img.setVisible(false);
      imgs.push(img);
    }
    c.add(imgs);
    c.setScale(spec.k);
    this.root.addAt(c, 2);
    return { spec, c, imgs, parts: spec.parts, inv, k: spec.k, body: spec.body, accent: hexNum(spec.pal.accent || '#22e4ff') };
  }

  _useRig(form) {
    const forms = FORMS[this.charId];
    const fk = form && forms && forms.indexOf(form) >= 0 ? form : null;
    const key = fk || 'base';
    if (this.formKey === key) return;
    let rig = this.rigs[key];
    if (!rig) rig = this.rigs[key] = this._makeRig(fk);
    if (this.rig) this.rig.c.setVisible(false);
    rig.c.setVisible(true);
    const had = this.formKey !== undefined;
    this.rig = rig;
    this.formKey = key;
    this.tintMode = -1;
    if (had) this.formFlashT = 0.4;
  }

  _move(f) {
    const id = f.moveId;
    if (!id) return null;
    const fk = f.form || '_';
    let byForm = this.moveCache[fk];
    if (!byForm) byForm = this.moveCache[fk] = {};
    let e = byForm[id];
    if (e === undefined) {
      let mv = null;
      try { mv = getMove ? getMove(this.charId, id, f.form || null) : null; } catch { mv = null; }
      e = byForm[id] = { mv, pole: !!(mv && /pole/i.test(String(mv.name || ''))) };
    }
    return e;
  }

  // ------------------------------------------------------------------ pose targets
  _target(f, dt) {
    const tgt = this.tgt;
    const t = this.t;
    let rate = 14;
    const act = f.action;
    if (act !== this.lastAction) { this.lastAction = act; this.actionT = 0; }
    this.actionT += dt;
    this.pole = false;
    this.phase = null;
    let anim = act;

    switch (act) {
      case 'attack': {
        const e = this._move(f);
        const mv = e ? e.mv : null;
        anim = mv && ATTACKS[mv.anim] ? mv.anim : guessAnim(f.moveId);
        if (!ATTACKS[anim]) anim = 'punch';
        const set = ATTACKS[anim];
        this.pole = this.charId === 'goku' && !!e && e.pole;
        const ph = f.movePhase;
        this.phase = ph;
        const crouchMove = !!f.crouching || (typeof f.moveId === 'string' && f.moveId.startsWith('crouch'));
        const mf = f.moveFrame | 0;
        if (ph === 'startup') { tgt.set(set.w); rate = 24; }
        else if (ph === 'active') {
          const iv = (mv && mv.hitInterval) || 4;
          const alt = set.alt && (((mf / iv) | 0) & 1);
          tgt.set(alt ? set.alt : set.s);
          rate = 62;
        } else if (ph === 'recovery') {
          const st = mv ? (mv.startup || 0) + (mv.active || 0) : 0;
          const rec = mv && mv.recovery ? mv.recovery : 12;
          let p = (mf - st) / rec;
          p = p < 0 ? 0 : p > 1 ? 1 : p;
          lerpPose(tgt, set.r || set.s, crouchMove ? CROUCH : IDLE, p * 0.9);
          rate = 16;
        } else { tgt.set(set.s); rate = 30; }
        if (!OWN_LEGS[anim]) {
          if (crouchMove) overlayLegs(tgt, CROUCH);
          else if (!f.grounded) overlayLegs(tgt, AIR_LEG_POSE, false);
        }
        if (anim === 'taunt') { tgt[J.ROT] += Math.sin(t * 14) * 5; tgt[J.ALF] += Math.sin(t * 16) * 18; }
        if (anim === 'glide') tgt[J.RY] += Math.sin(t * 5) * 3;
        break;
      }
      case 'walk': {
        const fwd = (f.vx || 0) * (f.facing || 1);
        const dir = fwd < -0.01 ? -1 : 1;
        let cyc = Math.abs(f.vx || 0) * 60 / 140;
        cyc = cyc < 1 ? 1 : cyc > 2.6 ? 2.6 : cyc;
        this.walkPhase = (this.walkPhase + dt * TWO_PI * cyc * dir) % (TWO_PI * 100);
        const p = this.walkPhase, sp = Math.sin(p), cp = Math.cos(p) * dir;
        tgt.set(IDLE);
        tgt[J.LUF] = 10 + 26 * sp; tgt[J.LUB] = -8 - 26 * sp;
        tgt[J.LLF] = -12 - 34 * (cp > 0 ? cp : 0);
        tgt[J.LLB] = -12 - 34 * (cp < 0 ? -cp : 0);
        tgt[J.AUF] -= 8 * sp; tgt[J.AUB] += 8 * sp;
        tgt[J.TOR] += dir > 0 ? 4 : -3;
        rate = 30;
        break;
      }
      case 'jump':
        anim = (f.vy || 0) < 0 ? 'jump' : 'fall';
        tgt.set(POSES[anim]); rate = 16;
        break;
      case 'crouch': tgt.set(CROUCH); rate = 24; break;
      case 'dash': tgt.set(POSES.dash); rate = 24; break;
      case 'backdash': tgt.set(POSES.backdash); rate = 24; break;
      case 'block':
      case 'blockstun':
        anim = f.blocking === 'low' || f.crouching ? 'crouchBlock' : 'block';
        tgt.set(POSES[anim]);
        if (act === 'blockstun') tgt[J.RX] -= 3;
        rate = 30;
        break;
      case 'hitstun':
        anim = f.crouching ? 'crouchHit' : 'hitstun';
        tgt.set(POSES[anim]);
        if (!f.grounded) overlayLegs(tgt, POSES.fall, false);
        rate = this.actionT < 0.12 ? 48 : 14;
        break;
      case 'launched':
        tgt.set(POSES.launched);
        tgt[J.ROT] = -40 - Math.min(f.actionFrame | 0, 40) * 2.2;
        rate = 14;
        break;
      case 'ko':
        anim = f.grounded ? 'knockdown' : 'launched';
        tgt.set(POSES[anim]);
        rate = 10;
        break;
      case 'knockdown': tgt.set(POSES.knockdown); rate = 12; break;
      case 'getup': tgt.set(POSES.getup); rate = 10; break;
      case 'grabbed': tgt.set(POSES.grabbed); tgt[J.RX] += Math.sin(t * 40) * 1.5; rate = 20; break;
      case 'win': {
        tgt.set(POSES.win);
        const b = 0.5 + 0.5 * Math.sin(t * 6);
        tgt[J.LLF] -= 14 * b; tgt[J.LLB] -= 14 * b; tgt[J.LUF] += 6 * b;
        tgt[J.AUF] += Math.sin(t * 6) * 8;
        rate = 10;
        break;
      }
      case 'lose': tgt.set(POSES.lose); rate = 6; break;
      case 'intro': {
        tgt.set(POSES.intro);
        const b = Math.sin(t * 3);
        tgt[J.LLF] -= 4 + 4 * b; tgt[J.LLB] -= 4 + 4 * b; tgt[J.TOR] += b * 2;
        rate = 8;
        break;
      }
      default: {
        anim = f.grounded === false ? 'fall' : 'idle';
        tgt.set(anim === 'fall' ? POSES.fall : IDLE);
        if (anim === 'idle') {
          const br = Math.sin(t * 2.4);
          tgt[J.LLF] += -2 - 2 * br; tgt[J.LLB] += -2 - 2 * br;
          tgt[J.TOR] += br * 1.2; tgt[J.HEAD] += br;
          tgt[J.AUF] += br * 2; tgt[J.AUB] += br * 2;
        }
        rate = 12;
      }
    }
    this.anim = anim;
    return rate;
  }

  // ------------------------------------------------------------------ per-frame
  sync(f, x, y, dtMs, perf) {
    if (!f) return;
    const dt = Math.min(0.1, Math.max(0, (dtMs || 16.67) / 1000));
    this.t += dt;
    const t = this.t;
    this._useRig(this.charId === 'ben10' ? f.form : null);
    const rig = this.rig;
    const s = rig.spec;
    const cur = this.cur, tgt = this.tgt;

    const rate = this._target(f, dt);
    const a = 1 - Math.exp(-rate * dt);
    for (let i = 0; i < NJ; i++) cur[i] += (tgt[i] - cur[i]) * a;

    const bones = this.bones;
    solveRig(s, cur, bones);
    const dy = -lowestY(s, bones) + cur[J.RY];
    let dx = cur[J.RX];
    if (f.hitFlash > 0 && f.action === 'hitstun') dx += Math.sin(t * 90) * 2;

    // place parts
    const parts = rig.parts, imgs = rig.imgs, inv = rig.inv;
    const fwd = (f.vx || 0) * (f.facing || 1);
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const img = imgs[i];
      const bi = p.bone * 3;
      let px = bones[bi] + dx, py = bones[bi + 1] + dy;
      const r = bones[bi + 2];
      if (p.ox || p.oy) {
        const c = Math.cos(r), sn = Math.sin(r);
        px += p.ox * c - p.oy * sn;
        py += p.ox * sn + p.oy * c;
      }
      let rot = r + p.rot * D2R;
      if (p.dyn) {
        switch (p.dyn) {
          case 'trail': {
            let k = fwd * 5; k = k < -20 ? -20 : k > 45 ? 45 : k;
            rot += (k + Math.sin(t * 7 + i) * 7 - cur[J.ROT] * 0.5) * D2R;
            break;
          }
          case 'ear': rot += (Math.sin(t * 3.1 + i) * 3 - cur[J.ROT] * 0.15 - (f.action === 'hitstun' ? 18 : 0)) * D2R; break;
          case 'flame':
            img.setScale(inv * (1 + Math.sin(t * 19) * 0.05), inv * (1 + Math.sin(t * 13) * 0.08 + Math.sin(t * 31) * 0.04));
            break;
          case 'prop': {
            const on = this.anim === 'glide' || !!(f.buffs && f.buffs.glide);
            if (img.visible !== on) img.setVisible(on);
            if (on) img.setScale(inv * Math.cos(t * 42), inv);
            break;
          }
          case 'staffHand': if (img.visible !== this.pole) img.setVisible(this.pole); break;
          case 'staffBack': if (img.visible === this.pole) img.setVisible(!this.pole); break;
          default: break;
        }
      }
      img.x = px; img.y = py; img.rotation = rot;
    }

    // squash & stretch on land / take-off
    const g = f.grounded !== false;
    if (g && !this.wasGrounded) this.sq = 0.84;
    else if (!g && this.wasGrounded && (f.vy || 0) < 0) this.sq = 1.13;
    this.wasGrounded = g;
    this.sq += (1 - this.sq) * (1 - Math.exp(-11 * dt));
    const sqy = this.sq * cur[J.SY];
    const sqx = (1 + (1 - this.sq) * 0.7) * cur[J.SX];
    let spin = 1;
    if (this.anim === 'spin' && this.phase === 'active') {
      spin = Math.cos(t * 24);
      if (spin > -0.15 && spin < 0.15) spin = spin < 0 ? -0.15 : 0.15;
    }
    const facing = (f.facing || 1) < 0 ? -1 : 1;
    this.root.setPosition(x, y);
    this.root.setScale(facing * sqx * spin, sqy);

    // alpha: invulnerability flicker, teleport fade
    let alpha = 1;
    if (f.invuln > 0 && f.action !== 'ko') alpha = ((t * 24) | 0) & 1 ? 0.42 : 0.95;
    if (this.anim === 'teleport' && this.phase === 'active') alpha *= 0.22;
    if (this.root.alpha !== alpha) this.root.setAlpha(alpha);

    // tint: hit flash > form flash > armor > slowed
    this.formFlashT = this.formFlashT > 0 ? this.formFlashT - dt : 0;
    let slowed = false;
    const buffs = f.buffs;
    let auraCol = -1;
    if (buffs) {
      for (const k in buffs) {
        const v = buffs[k];
        if (!v) continue;
        if (k === 'slowed') slowed = true;
        if (auraCol < 0 && BUFF_COLORS[k] !== undefined) auraCol = BUFF_COLORS[k];
      }
    }
    let mode = 0;
    if (f.hitFlash > 0 || this.formFlashT > 0.26) mode = 1;
    else if (f.armor) mode = 2;
    else if (slowed) mode = 3;
    if (mode === 1) {
      if (this.tintMode !== 1) for (let i = 0; i < imgs.length; i++) imgs[i].setTintFill(0xffffff);
    } else if (mode === 2) {
      const col = lerpColor(0xffffff, 0xffb84a, 0.5 + 0.5 * Math.sin(t * 22));
      for (let i = 0; i < imgs.length; i++) imgs[i].setTint(col);
    } else if (mode === 3) {
      if (this.tintMode !== 3) for (let i = 0; i < imgs.length; i++) imgs[i].setTint(0xc8b4ff);
    } else if (this.tintMode !== 0) {
      for (let i = 0; i < imgs.length; i++) imgs[i].clearTint();
    }
    this.tintMode = mode;

    // glows (world units inside root)
    const bw = rig.body.w, bh = rig.body.h;
    const si = this.softInv;
    if (!perf) {
      if (!this.glow.visible) this.glow.setVisible(true);
      this.glow.setPosition(0, -bh * 0.5);
      this.glow.setScale((bw * 2.1) / 64 * si, (bh * 1.3) / 64 * si);
      this.glow.setAlpha(0.13 + Math.sin(t * 2) * 0.03);
    } else if (this.glow.visible) this.glow.setVisible(false);

    if (f.armor) auraCol = 0xffc34a;
    if (auraCol >= 0) {
      if (!this.aura.visible) this.aura.setVisible(true);
      const pulse = perf ? 0 : Math.sin(t * 8);
      this.aura.setTint(auraCol);
      this.aura.setPosition(0, -bh * 0.5);
      this.aura.setScale((bw * 2.6 + pulse * 6) / 64 * si, (bh * 1.45 + pulse * 8) / 64 * si);
      this.aura.setAlpha(0.42 + pulse * 0.16);
    } else if (this.aura.visible) this.aura.setVisible(false);

    // charge orb between the hands
    const charge = f.charge || 0;
    const showOrb = charge > 0 || (this.anim === 'beam' && this.phase === 'startup');
    if (showOrb) {
      const k = rig.k;
      const hx = ((bones[B.HF * 3] + bones[B.HB * 3]) * 0.5 + dx) * k;
      const hy = ((bones[B.HF * 3 + 1] + bones[B.HB * 3 + 1]) * 0.5 + dy) * k + s.handR * 0.6 * k;
      const c = Math.min(charge, 120);
      const size = 14 + c * 0.32 + Math.sin(t * 30) * 2;
      const col = this.charId === 'goku' ? 0x5fd0ff : rig.accent;
      this.orb.setVisible(true).setPosition(hx, hy).setTint(col).setScale((size * 2.2) / 64 * si).setAlpha(0.85);
      this.orbCore.setVisible(true).setPosition(hx, hy).setRotation(t * 6)
        .setScale((size * 1.2) / 48 * invScale(this.scene, TEX.star)).setAlpha(0.9);
    } else if (this.orb.visible) { this.orb.setVisible(false); this.orbCore.setVisible(false); }

    // form swap ring
    if (this.formFlashT > 0) {
      const p = 1 - this.formFlashT / 0.4;
      this.ring.setVisible(true).setPosition(0, -bh * 0.5).setTint(0x7dff4a)
        .setScale((0.6 + p * 2.4) * invScale(this.scene, TEX.ring) * bh / 96).setAlpha(1 - p);
    } else if (this.ring.visible) this.ring.setVisible(false);

    // ground shadow
    const hgt = GROUND_Y - y;
    let hn = hgt / 280; hn = hn < 0 ? 0 : hn > 1 ? 1 : hn;
    const shw = this.anim === 'knockdown' || this.anim === 'ko' ? bh * 1.1 : bw * 1.35;
    this.shadow.setPosition(x, GROUND_Y);
    this.shadow.setScale((shw / 128) * this.shadowInv * (1 - hn * 0.45), this.shadowInv * (1 - hn * 0.3));
    this.shadow.setAlpha(0.55 * (1 - hn * 0.6));
  }

  destroy() {
    if (this.root) this.root.destroy();
    if (this.shadow) this.shadow.destroy();
    this.root = null; this.shadow = null; this.rigs = {}; this.rig = null;
  }
}

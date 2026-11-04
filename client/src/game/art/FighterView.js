// Skeletal puppet renderer for one fighter. A Container of atlas Images posed per joint.
import { getSpec, FORMS } from './chars.js';
import { buildAtlas } from './atlas.js';
import { J, B, NB, D2R, solveRig, lowestY } from './rig.js';
import { Animator } from './animator.js';
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
    this.animator = new Animator(charId, this.side);
    this.bones = new Float32Array(NB * 3);
    this.t = 0;
    this.face = this.side ? -1 : 1; // displayed facing, eases through 0 when the fighter turns around
    this.expr = 'normal';
    this.anim = 'idle';
    this.phase = null;
    this.pole = false;
    this.tintMode = -1;
    this.formFlashT = 0;
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
    // faces with expression variants (blink, hurt, shout) are extra atlas frames named "<part>@<expr>"
    const faces = [];
    for (let i = 0; i < spec.parts.length; i++) {
      const p = spec.parts[i];
      if (p.variants) faces.push({ img: imgs[i], name: p.name, has: new Set(p.variants) });
    }
    // parts that stick out past the skeleton's contact points (hair, ears, the pole on Goku's back, shawls, tails):
    // when the fighter lies down or tumbles they must not cut into the floor
    const reach = [];
    for (let i = 0; i < spec.parts.length; i++) {
      const p = spec.parts[i];
      if (p.name === 'head' || p.name === 'tail' || p.dyn === 'staffBack' || p.dyn === 'ear' || p.dyn === 'trail' || p.dyn === 'tailBob') reach.push(i);
    }
    return { spec, c, imgs, parts: spec.parts, inv, k: spec.k, body: spec.body, accent: hexNum(spec.pal.accent || '#22e4ff'), faces, exprShown: 'normal', reach };
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

  _setExpr(rig, expr) {
    this.expr = expr;
    rig.exprShown = expr;
    for (const fc of rig.faces) {
      const name = expr !== 'normal' && fc.has.has(expr) ? `${fc.name}@${expr}` : fc.name;
      if (fc.img.frame && fc.img.frame.name !== name) fc.img.setFrame(name, false, false);
    }
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
    const A = this.animator;
    A.update(f, dt, (s.uLeg + s.lLeg) * s.k);
    const cur = A.cur;
    this.anim = A.anim; this.phase = A.phase; this.pole = A.pole;
    if (A.expr !== this.expr || rig.exprShown !== A.expr) this._setExpr(rig, A.expr);

    const bones = this.bones;
    if (rig.standLow === undefined) { solveRig(s, A.stance, bones); rig.standLow = lowestY(s, bones); }
    solveRig(s, cur, bones);
    // grounded: the lowest point sits on the floor; airborne: the hip keeps its standing height above the
    // feet so flips and tumbles turn around the body instead of rolling over whichever limb is lowest
    let low = lowestY(s, bones);
    const r0 = cur[J.ROT];
    if (r0 < -30 || r0 > 30) low = this._reachLow(rig, bones, low);
    let dy = -low + cur[J.RY];
    const air = A.air;
    if (air > 0.001) {
      dy += (low - rig.standLow) * air;
      const maxDy = (GROUND_Y - y) / (s.k * (A.sy || 1)) - low; // never dip below the floor
      if (dy > maxDy) dy = maxDy;
    }
    let dx = cur[J.RX];
    if (f.hitFlash > 0 && f.action === 'hitstun') dx += Math.sin(t * 90) * 2;

    // place parts
    const parts = rig.parts, imgs = rig.imgs, inv = rig.inv;
    const fwd = (f.vx || 0) * (f.facing || 1);
    const tilt = Math.sin(cur[J.ROT] * D2R) * 57.3; // periodic so flips and tumbles never pop the cloth
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
            rot += (k + Math.sin(t * 7 + i) * 7 - tilt * 0.5) * D2R;
            break;
          }
          case 'ear': rot += (Math.sin(t * 3.1 + i) * 3 - tilt * 0.15 - (f.action === 'hitstun' ? 18 : 0)) * D2R; break;
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

    // squash & stretch and spin come from the animator; turning around eases through zero width
    const facing = (f.facing || 1) < 0 ? -1 : 1;
    let fc = this.face + (facing - this.face) * (1 - Math.exp(-28 * dt));
    if (Math.abs(facing - fc) < 0.02) fc = facing;
    if (fc > -0.12 && fc < 0.12) fc = facing > 0 ? 0.12 : -0.12;
    this.face = fc;
    this.root.setPosition(x, y);
    this.root.setScale(fc * A.sx * A.spin, A.sy);

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

  /** lowest drawn point of the parts that reach past the skeleton (box corners pulled in 20%) */
  _reachLow(rig, bones, low) {
    const parts = rig.parts, reach = rig.reach;
    for (let n = 0; n < reach.length; n++) {
      const p = parts[reach[n]];
      if (p.dyn === 'staffBack' && this.pole) continue;
      const bi = p.bone * 3;
      let y = bones[bi + 1];
      const r = bones[bi + 2];
      if (p.ox || p.oy) y += p.ox * Math.sin(r) + p.oy * Math.cos(r);
      const rr = r + p.rot * D2R, c = Math.cos(rr), sn = Math.sin(rr);
      const b = p.box;
      const cx = (b[0] + b[2]) * 0.5, cy = (b[1] + b[3]) * 0.5;
      const hw = (b[2] - b[0]) * 0.4, hh = (b[3] - b[1]) * 0.4;
      const yc = y + cx * sn + cy * c;
      const ext = Math.abs(hw * sn) + Math.abs(hh * c);
      if (yc + ext > low) low = yc + ext;
    }
    return low;
  }

  destroy() {
    if (this.root) this.root.destroy();
    if (this.shadow) this.shadow.destroy();
    this.root = null; this.shadow = null; this.rigs = {}; this.rig = null;
  }
}

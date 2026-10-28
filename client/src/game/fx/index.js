// Content (C) Effects: pooled particles, hit/block sparks, dust, KO burst, combo/announcer text, super flash.
import { ensureCommonTextures, TEX, invScale, getRes } from './textures.js';
import { bodyFor } from '../art/chars.js';

const GROUND_Y = 640;
const DEPTH = 40;
const POOL = 260;
const SIDE_COL = [0x22e4ff, 0xff2fa6];
const SIDE_CSS = ['#22e4ff', '#ff2fa6'];
const FONT = 'Bungee, Inter, system-ui, sans-serif';

export class Effects {
  constructor(scene, { perf = false } = {}) {
    this.scene = scene;
    this.perf = !!perf;
    ensureCommonTextures(scene);
    const res = getRes(scene);
    this.inv = {};
    for (const k in TEX) this.inv[TEX[k]] = invScale(scene, TEX[k]);

    // particle pool (struct of arrays, no per-frame allocation)
    this.img = new Array(POOL);
    this.x = new Float32Array(POOL); this.y = new Float32Array(POOL);
    this.vx = new Float32Array(POOL); this.vy = new Float32Array(POOL);
    this.life = new Float32Array(POOL); this.max = new Float32Array(POOL);
    this.s0 = new Float32Array(POOL); this.s1 = new Float32Array(POOL);
    this.a0 = new Float32Array(POOL); this.spin = new Float32Array(POOL);
    this.grav = new Float32Array(POOL); this.drag = new Float32Array(POOL);
    this.sx = new Float32Array(POOL); this.orient = new Uint8Array(POOL);
    this.ks = new Float32Array(POOL);
    for (let i = 0; i < POOL; i++) {
      this.img[i] = scene.add.image(-100, -100, TEX.soft).setVisible(false).setDepth(DEPTH);
    }
    this.cursor = 0;
    this.seed = 0x9e3779b9;

    // overlays
    this.dim = scene.add.rectangle(640, 360, 1400, 820, 0x000000, 1).setDepth(12).setAlpha(0).setVisible(false);
    this.streak = scene.add.image(640, 360, TEX.streak).setDepth(13).setBlendMode('ADD').setVisible(false);
    this.flash = scene.add.rectangle(640, 360, 1400, 820, 0xffffff, 1).setDepth(DEPTH + 2).setAlpha(0).setVisible(false);
    this.dimT = 0; this.flashT = 0; this.flashMax = 0.25; this.streakY = 360;

    const base = { fontFamily: FONT, color: '#eaf2ff', stroke: '#0b0f1e', align: 'center', resolution: res };
    this.ann = scene.add.text(640, 290, '', { ...base, fontSize: '112px', strokeThickness: 14 })
      .setOrigin(0.5).setDepth(DEPTH + 5).setVisible(false);
    this.annT = 0; this.annDur = 0;
    this.combo = [0, 1].map((s) => scene.add.text(0, 0, '', { ...base, fontSize: '42px', strokeThickness: 9, color: SIDE_CSS[s] })
      .setOrigin(0.5).setDepth(DEPTH + 3).setVisible(false));
    this.comboT = [0, 0]; this.comboN = [0, 0];
    this.counter = [0, 1].map(() => scene.add.text(0, 0, 'COUNTER', { ...base, fontSize: '34px', strokeThickness: 8, color: '#ff8a1f' })
      .setOrigin(0.5).setDepth(DEPTH + 3).setVisible(false));
    this.counterT = [0, 0];
    for (const t of [this.ann, ...this.combo, ...this.counter]) {
      try { t.setShadow(0, 0, '#22e4ff', 18, true, false); } catch { /* ignore */ }
    }
  }

  setPerf(b) { this.perf = !!b; }

  _rnd() {
    let s = this.seed;
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    this.seed = s;
    return s / 4294967296;
  }

  _n(k) { return this.perf ? Math.max(1, Math.round(k * 0.3)) : k; }

  /** spawn one particle; size in world px (s0 -> s1), life seconds */
  _p(key, x, y, vx, vy, life, s0, s1, alpha, tint, add, rot, spin, grav, drag, orient, sx = 1) {
    const i = this.cursor;
    this.cursor = (i + 1) % POOL;
    const img = this.img[i];
    img.setTexture(key);
    img.setBlendMode(add ? 'ADD' : 'NORMAL');
    img.setTint(tint);
    img.setRotation(rot);
    img.setVisible(true);
    img.setPosition(x, y);
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max[i] = life;
    const base = key === TEX.ring || key === TEX.soft || key === TEX.smoke ? 64 : key === TEX.star ? 48 : key === TEX.streak ? 64 : key === TEX.hex ? 110 : key === TEX.bolt ? 96 : key === TEX.flame ? 64 : 12;
    this.ks[i] = (this.inv[key] || 1) / (key === TEX.ring ? 96 : base);
    this.s0[i] = s0; this.s1[i] = s1; this.a0[i] = alpha;
    this.spin[i] = spin; this.grav[i] = grav; this.drag[i] = drag; this.orient[i] = orient ? 1 : 0; this.sx[i] = sx;
    this._apply(i, 0);
  }

  _apply(i, t) {
    const img = this.img[i];
    const s = (this.s0[i] + (this.s1[i] - this.s0[i]) * t) * this.ks[i];
    img.setScale(s * this.sx[i], s);
    const a = this.a0[i] * (1 - t * t);
    img.setAlpha(a);
  }

  // ------------------------------------------------------------------ bursts
  _sparks(x, y, n, dir, speed, len, tint, spread = Math.PI) {
    for (let i = 0; i < n; i++) {
      const ang = (dir < 0 ? Math.PI : 0) + (this._rnd() - 0.5) * spread * 2;
      const v = speed * (0.5 + this._rnd() * 0.7);
      this._p(TEX.streak, x, y, Math.cos(ang) * v, Math.sin(ang) * v, 0.16 + this._rnd() * 0.12, len, len * 0.3, 1, tint, true, ang, 0, 300, 4, true, 1.6);
    }
  }

  burst(type, x, y, dir = 1, power = 1) {
    const r = () => this._rnd();
    const n = (k) => this._n(k);
    switch (type) {
      case 'heavyHit':
        this._p(TEX.soft, x, y, 0, 0, 0.16, 90 * power, 150 * power, 1, 0xffd08a, true, 0, 0, 0, 0, false);
        this._p(TEX.ring, x, y, 0, 0, 0.3, 30, 150 * power, 1, 0xff8a1f, true, 0, 0, 0, 0, false);
        this._p(TEX.ring, x, y, 0, 0, 0.22, 20, 90, 0.8, 0xffffff, true, 0, 0, 0, 0, false);
        this._sparks(x, y, n(14), dir, 900, 46, 0xffe2b0, 1.2);
        for (let i = 0; i < n(4); i++) this._p(TEX.star, x, y, (r() - 0.5) * 500, -200 - r() * 300, 0.4, 26, 6, 1, 0xffe94a, true, r() * 6, 10, 900, 1, false);
        break;
      case 'electric':
        this._p(TEX.soft, x, y, 0, 0, 0.18, 80, 130, 1, 0xfff27a, true, 0, 0, 0, 0, false);
        for (let i = 0; i < n(5); i++) this._p(TEX.bolt, x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, 0, 0, 0.14 + r() * 0.1, 40 + r() * 30, 50, 1, 0xfff6a0, true, r() * 6.28, 0, 0, 0, false);
        this._sparks(x, y, n(10), dir, 800, 34, 0xffe94a, Math.PI);
        for (let i = 0; i < n(6); i++) this._p(TEX.dot, x, y, (r() - 0.5) * 600, (r() - 0.5) * 600, 0.3, 6, 2, 1, 0xffffaa, true, 0, 0, 0, 3, false);
        break;
      case 'fire':
        this._p(TEX.soft, x, y, 0, 0, 0.2, 80, 140, 1, 0xff8a1f, true, 0, 0, 0, 0, false);
        for (let i = 0; i < n(9); i++) this._p(TEX.flame, x + (r() - 0.5) * 30, y + (r() - 0.5) * 20, (r() - 0.5) * 200 + dir * 80, -150 - r() * 250, 0.35 + r() * 0.2, 30 + r() * 20, 8, 1, r() < 0.5 ? 0xff6a1a : 0xffc34a, true, 0, 0, -200, 2, false);
        for (let i = 0; i < n(4); i++) this._p(TEX.smoke, x, y, (r() - 0.5) * 120, -80 - r() * 80, 0.6, 30, 70, 0.45, 0x3a2a24, false, r() * 6, 1, -40, 1, false);
        break;
      case 'wind':
        this._p(TEX.ring, x, y, 0, 0, 0.25, 30, 130, 0.9, 0xcff8ff, true, 0, 0, 0, 0, false, 1.6);
        for (let i = 0; i < n(10); i++) {
          const v = 600 + r() * 600;
          this._p(TEX.streak, x - dir * 40, y + (r() - 0.5) * 80, dir * v, (r() - 0.5) * 60, 0.25, 60, 20, 0.9, 0xe0fbff, true, dir < 0 ? Math.PI : 0, 0, 0, 3, true, 2.2);
        }
        break;
      case 'gadget':
        this._p(TEX.soft, x, y, 0, 0, 0.16, 70, 120, 1, 0xff92e0, true, 0, 0, 0, 0, false);
        this._p(TEX.ring, x, y, 0, 0, 0.3, 20, 110, 1, 0xff2fa6, true, 0, 0, 0, 0, false);
        for (let i = 0; i < n(8); i++) this._p(TEX.star, x, y, (r() - 0.5) * 700, (r() - 0.7) * 600, 0.45, 22, 6, 1, r() < 0.5 ? 0x22e4ff : 0xff2fa6, true, r() * 6, 8, 1000, 1.5, false);
        break;
      case 'energy':
        this._p(TEX.soft, x, y, 0, 0, 0.22, 110, 200, 1, 0x7fd8ff, true, 0, 0, 0, 0, false);
        this._p(TEX.ring, x, y, 0, 0, 0.32, 30, 170, 1, 0x2f6bff, true, 0, 0, 0, 0, false);
        this._sparks(x, y, n(12), dir, 850, 44, 0xbff4ff, Math.PI);
        break;
      case 'dust':
        for (let i = 0; i < n(7); i++) this._p(TEX.smoke, x + (r() - 0.5) * 40, y, (r() - 0.5) * 260, -40 - r() * 90, 0.55, 26, 64, 0.55, 0xb8a284, false, r() * 6, 1, 60, 2, false);
        break;
      case 'slash': {
        const ang = dir > 0 ? -0.55 : Math.PI + 0.55;
        this._p(TEX.streak, x, y, 0, 0, 0.18, 70, 110, 1, 0xffffff, true, ang, 0, 0, 0, false, 3.2);
        this._p(TEX.streak, x, y, 0, 0, 0.14, 50, 80, 0.8, 0x9fe8ff, true, ang + 0.25, 0, 0, 0, false, 2.6);
        this._sparks(x, y, n(6), dir, 700, 30, 0xffffff, 0.9);
        break;
      }
      case 'sparkle':
        for (let i = 0; i < n(10); i++) {
          const c = [0x22e4ff, 0xff2fa6, 0xffe94a, 0xffffff][(r() * 4) | 0];
          this._p(TEX.star, x + (r() - 0.5) * 50, y + (r() - 0.5) * 50, (r() - 0.5) * 300, -100 - r() * 250, 0.6, 24, 4, 1, c, true, r() * 6, 6, 400, 1, false);
        }
        break;
      case 'block':
        this._p(TEX.hex, x, y, 0, 0, 0.22, 70, 100, 0.95, 0x22e4ff, true, 0, 0, 0, 0, false, 0.75);
        this._p(TEX.soft, x, y, 0, 0, 0.14, 70, 110, 0.9, 0x2f6bff, true, 0, 0, 0, 0, false);
        this._sparks(x, y, n(7), -dir, 650, 30, 0x9fe8ff, 1.1);
        break;
      case 'hit':
      default:
        this._p(TEX.soft, x, y, 0, 0, 0.12, 60, 100, 1, 0xffffff, true, 0, 0, 0, 0, false);
        this._p(TEX.ring, x, y, 0, 0, 0.2, 18, 80, 0.9, 0x22e4ff, true, 0, 0, 0, 0, false);
        this._sparks(x, y, n(8), dir, 750, 36, 0xeaffff, 1.1);
        break;
    }
  }

  _dust(x, n, spread, dir = 0) {
    const r = () => this._rnd();
    for (let i = 0; i < this._n(n); i++) {
      this._p(TEX.smoke, x + (r() - 0.5) * spread, GROUND_Y - 6, (dir ? -dir * (80 + r() * 160) : (r() - 0.5) * 300), -30 - r() * 60,
        0.45 + r() * 0.2, 20, 54, 0.5, 0xc8b8a0, false, r() * 6, 1, 40, 2.5, false);
    }
  }

  _announce(text, color, dur) {
    this.ann.setText(text);
    this.ann.setColor(color);
    try { this.ann.setShadow(0, 0, color, 26, true, false); } catch { /* ignore */ }
    this.ann.setVisible(true).setAlpha(0).setScale(2.2);
    this.annT = 0; this.annDur = dur;
  }

  _fighterPos(state, side) {
    const f = state && state.fighters && state.fighters[side];
    if (!f) return null;
    const b = bodyFor(f.charId, f.form || null);
    return { f, x: f.x, y: f.y, h: b.h, facing: f.facing || 1 };
  }

  // ------------------------------------------------------------------ events
  handleEvents(events, state) {
    if (!events || !events.length) return;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (!ev) continue;
      switch (ev.type) {
        case 'hit': {
          const att = state && state.fighters ? state.fighters[ev.side] : null;
          const dir = att ? (att.facing || 1) : 1;
          const strength = ev.strength || 1;
          let fx = ev.effect || (strength >= 3 ? 'heavyHit' : 'hit');
          if (fx === 'hit' && strength >= 3) fx = 'heavyHit';
          this.burst(fx, ev.x, ev.y, dir, strength >= 3 ? 1.2 : 1);
          if (fx !== 'hit' && fx !== 'heavyHit' && strength >= 2) this.burst('hit', ev.x, ev.y, dir);
          if (ev.comboHits >= 2 && att) {
            const s = ev.side & 1;
            const t = this.combo[s];
            if (this.comboN[s] !== ev.comboHits) { this.comboN[s] = ev.comboHits; t.setText(ev.comboHits + ' HITS'); }
            const pos = this._fighterPos(state, ev.side);
            const cx = Math.max(110, Math.min(1170, att.x));
            t.setPosition(cx, Math.max(70, (pos ? att.y - pos.h - 40 : att.y - 200)));
            t.setVisible(true).setAlpha(1).setScale(1.4);
            this.comboT[s] = 1.1;
          }
          if (ev.counter) {
            const s = ev.side & 1;
            const t = this.counter[s];
            t.setPosition(Math.max(110, Math.min(1170, ev.x)), ev.y - 70).setVisible(true).setAlpha(1).setScale(1.5);
            this.counterT[s] = 0.85;
          }
          break;
        }
        case 'block': {
          const att = state && state.fighters ? state.fighters[ev.side] : null;
          this.burst('block', ev.x, ev.y, att ? att.facing || 1 : 1);
          break;
        }
        case 'jump': { const p = this._fighterPos(state, ev.side); if (p) this._dust(p.x, 3, 30); break; }
        case 'land': { const p = this._fighterPos(state, ev.side); if (p) this._dust(p.x, 5, 50); break; }
        case 'dash': { const p = this._fighterPos(state, ev.side); if (p) this._dust(p.x, 4, 20, p.facing); break; }
        case 'throw': {
          const p = this._fighterPos(state, ev.target);
          if (p) { this.burst('heavyHit', p.x, p.y - p.h * 0.5, -p.facing, 0.8); this._dust(p.x, 5, 60); }
          break;
        }
        case 'tech': { const p = this._fighterPos(state, ev.side); if (p) this._p(TEX.ring, p.x, p.y - p.h * 0.5, 0, 0, 0.25, 20, 120, 1, 0xffffff, true, 0, 0, 0, 0, false); break; }
        case 'projectile': {
          const p = this._fighterPos(state, ev.side);
          if (p) this._p(TEX.soft, p.x + p.facing * 40, p.y - p.h * 0.55, 0, 0, 0.12, 30, 60, 0.8, SIDE_COL[ev.side & 1], true, 0, 0, 0, 0, false);
          break;
        }
        case 'teleport': {
          const p = this._fighterPos(state, ev.side);
          const yy = p ? p.y - p.h * 0.45 : 520;
          for (const xx of [ev.fromX, ev.toX]) {
            if (typeof xx !== 'number') continue;
            this.burst('sparkle', xx, yy, 1);
            for (let k = 0; k < this._n(5); k++) this._p(TEX.smoke, xx + (this._rnd() - 0.5) * 50, yy + (this._rnd() - 0.5) * 90, 0, -40, 0.5, 40, 80, 0.5, 0xe8e0ff, false, 0, 1, 0, 1, false);
          }
          break;
        }
        case 'form': {
          const p = this._fighterPos(state, ev.side);
          if (p) {
            this._p(TEX.soft, p.x, p.y - p.h * 0.5, 0, 0, 0.3, 120, 260, 1, 0x7dff4a, true, 0, 0, 0, 0, false);
            this._p(TEX.ring, p.x, p.y - p.h * 0.5, 0, 0, 0.4, 40, 260, 1, 0x7dff4a, true, 0, 0, 0, 0, false);
            this._sparks(p.x, p.y - p.h * 0.5, this._n(12), 1, 700, 40, 0xc8ff9a, Math.PI);
          }
          break;
        }
        case 'buff': { const p = this._fighterPos(state, ev.side); if (p) this.burst('sparkle', p.x, p.y - p.h * 0.6, p.facing); break; }
        case 'armor': { const p = this._fighterPos(state, ev.side); if (p) this._p(TEX.ring, p.x, p.y - p.h * 0.5, 0, 0, 0.2, 60, 140, 0.9, 0xffc34a, true, 0, 0, 0, 0, false, 0.7); break; }
        case 'superFlash': {
          const p = this._fighterPos(state, ev.side);
          this.dimT = 0.45;
          this.dim.setVisible(true);
          this.streakY = p ? p.y - p.h * 0.55 : 400;
          this.streak.setVisible(true).setTint(SIDE_COL[ev.side & 1]).setPosition(p ? p.x : 640, this.streakY);
          if (p) {
            this._p(TEX.soft, p.x, this.streakY, 0, 0, 0.4, 120, 320, 1, SIDE_COL[ev.side & 1], true, 0, 0, 0, 0, false);
            this._p(TEX.star, p.x, this.streakY, 0, 0, 0.35, 60, 200, 1, 0xffffff, true, 0, 4, 0, 0, false);
          }
          break;
        }
        case 'ko': {
          const p = this._fighterPos(state, ev.side);
          if (p) {
            const cy = p.y - p.h * 0.5;
            this.burst('heavyHit', p.x, cy, -p.facing, 1.6);
            this._p(TEX.ring, p.x, cy, 0, 0, 0.5, 40, 420, 1, 0xff2fa6, true, 0, 0, 0, 0, false);
            this._sparks(p.x, cy, this._n(18), 1, 1100, 60, 0xffffff, Math.PI);
          }
          this.flashT = this.flashMax = 0.28;
          this.flash.setVisible(true);
          this._announce('K.O.', '#ff2fa6', 1.6);
          break;
        }
        case 'roundStart': {
          const w = state && state.wins;
          const rtw = (state && state.roundsToWin) || 2;
          const final = w && w[0] === rtw - 1 && w[1] === rtw - 1 && ev.round > 1;
          this._announce(final ? 'FINAL ROUND' : 'ROUND ' + (ev.round || 1), '#22e4ff', 1.3);
          break;
        }
        case 'fight': this._announce('FIGHT!', '#ff8a1f', 0.9); break;
        case 'timeUp': this._announce('TIME', '#ff8a1f', 1.4); break;
        case 'roundEnd': if (ev.reason === 'draw' || ev.winner === 'draw') this._announce('DRAW', '#22e4ff', 1.4); break;
        default: break;
      }
    }
  }

  // ------------------------------------------------------------------ per-frame
  update(dtMs) {
    const dt = Math.min(0.1, Math.max(0, (dtMs || 16.67) / 1000));
    for (let i = 0; i < POOL; i++) {
      if (this.life[i] <= 0) continue;
      const img = this.img[i];
      this.life[i] -= dt;
      if (this.life[i] <= 0) { img.setVisible(false); continue; }
      const dr = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= dr; this.vy[i] = this.vy[i] * dr + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
      img.setPosition(this.x[i], this.y[i]);
      if (this.orient[i]) img.setRotation(Math.atan2(this.vy[i], this.vx[i]));
      else if (this.spin[i]) img.rotation += this.spin[i] * dt;
      this._apply(i, 1 - this.life[i] / this.max[i]);
    }

    // super flash dim + streak
    if (this.dimT > 0) {
      this.dimT -= dt;
      const p = 1 - Math.max(0, this.dimT) / 0.45;
      const a = p < 0.12 ? p / 0.12 : p > 0.7 ? (1 - p) / 0.3 : 1;
      this.dim.setAlpha(0.58 * a);
      const sw = Math.min(1, p / 0.25);
      this.streak.setScale((1500 / 64) * sw * this.inv[TEX.streak], 2.2 * (1 - p * 0.6) * this.inv[TEX.streak] * 3).setAlpha(a);
      this.streak.x = 640;
      if (this.dimT <= 0) { this.dim.setVisible(false); this.streak.setVisible(false); }
    }
    if (this.flashT > 0) {
      this.flashT -= dt;
      this.flash.setAlpha(Math.max(0, this.flashT / this.flashMax) * 0.7);
      if (this.flashT <= 0) this.flash.setVisible(false);
    }

    // announcer
    if (this.annDur > 0) {
      this.annT += dt;
      const t = this.annT, d = this.annDur;
      if (t >= d) { this.ann.setVisible(false); this.annDur = 0; }
      else if (t < 0.18) {
        const k = t / 0.18;
        const e = 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2);
        this.ann.setScale(2.2 - 1.2 * e).setAlpha(Math.min(1, k * 1.6));
      } else if (t > d - 0.25) {
        const k = (t - (d - 0.25)) / 0.25;
        this.ann.setScale(1 + k * 0.25).setAlpha(1 - k);
      } else {
        this.ann.setScale(1 + Math.sin(t * 9) * 0.015).setAlpha(1);
      }
    }

    // combo / counter text
    for (let s = 0; s < 2; s++) {
      if (this.comboT[s] > 0) {
        this.comboT[s] -= dt;
        const t = this.combo[s];
        t.setScale(1 + (t.scaleX - 1) * Math.exp(-14 * dt));
        if (this.comboT[s] < 0.3) t.setAlpha(Math.max(0, this.comboT[s] / 0.3));
        if (this.comboT[s] <= 0) { t.setVisible(false); this.comboN[s] = 0; }
      }
      if (this.counterT[s] > 0) {
        this.counterT[s] -= dt;
        const t = this.counter[s];
        t.y -= 40 * dt;
        t.setScale(1 + (t.scaleX - 1) * Math.exp(-12 * dt));
        if (this.counterT[s] < 0.3) t.setAlpha(Math.max(0, this.counterT[s] / 0.3));
        if (this.counterT[s] <= 0) t.setVisible(false);
      }
    }
  }

  destroy() {
    for (let i = 0; i < POOL; i++) if (this.img[i]) this.img[i].destroy();
    this.img = [];
    for (const o of [this.dim, this.streak, this.flash, this.ann, ...this.combo, ...this.counter]) if (o) o.destroy();
    this.combo = []; this.counter = [];
    this.life.fill(0);
  }
}

// Pooled renderer for state.projectiles (depth 30) and state.entities (depth 15), by pool index.
// Convention: P/E x,y are the CENTRE of their w x h box.
import { ensureCommonTextures, TEX, invScale } from '../fx/textures.js';
import { PT, preloadProjectileArt } from './projectileArt.js';
import { getSpec } from './chars.js';
import { buildBodyTexture } from './atlas.js';

const GROUND_Y = 640;
const P_DEPTH = 30, E_DEPTH = 15, FX_DEPTH = 29;

function hideSlot(sl) {
  if (!sl.on) return;
  sl.on = false;
  sl.a.setVisible(false); sl.b.setVisible(false); sl.e.setVisible(false);
}

export class ProjectileLayer {
  constructor(scene) {
    this.scene = scene;
    ensureCommonTextures(scene);
    preloadProjectileArt(scene);
    this.p = [];
    this.e = [];
    this.t = 0;
    this.inv = {};
    for (const k in TEX) this.inv[TEX[k]] = invScale(scene, TEX[k]);
    for (const k in PT) this.inv[PT[k]] = invScale(scene, PT[k]);
  }

  _slot(list, i, depth) {
    let sl = list[i];
    if (sl) return sl;
    const s = this.scene;
    const mk = () => s.add.image(-200, -200, TEX.soft).setVisible(false).setDepth(depth);
    sl = { a: mk(), b: mk(), e: mk(), kind: null, on: false, rot: 0, owner: -1, bodyInv: 1 };
    list[i] = sl;
    return sl;
  }

  _tex(img, key, blend, tint, depth) {
    img.setTexture(key);
    img.setBlendMode(blend);
    if (tint === null) img.clearTint(); else img.setTint(tint);
    img.setOrigin(0.5, 0.5).setRotation(0).setFlip(false, false).setDepth(depth);
  }

  _setupP(sl, kind) {
    const { a, b, e } = sl;
    const N = 'NORMAL', A = 'ADD', D = P_DEPTH;
    e.setVisible(false); b.setVisible(true); a.setVisible(true);
    switch (kind) {
      case 'shuriken': this._tex(a, PT.shuriken, N, null, D); this._tex(b, TEX.soft, A, 0xbfe8ff, D - 0.1); break;
      case 'thunderJolt': this._tex(a, TEX.soft, A, 0xffe94a, D); this._tex(b, TEX.bolt, A, 0xfff6a0, D + 0.1); this._tex(e, TEX.star, A, 0xffffff, D + 0.2); e.setVisible(true); break;
      case 'kamehameha': this._tex(a, PT.beam, A, 0x3fb8ff, D); this._tex(b, PT.beam, A, 0xeaffff, D + 0.1); this._tex(e, TEX.soft, A, 0xbff4ff, D + 0.2); e.setVisible(true); break;
      case 'pellet': this._tex(a, PT.pellet, N, null, D); this._tex(b, TEX.streak, A, 0xffffff, D - 0.1); break;
      case 'fireball': this._tex(a, TEX.soft, A, 0xff6a1a, D); this._tex(b, TEX.flame, A, 0xffc34a, D + 0.1); this._tex(e, TEX.soft, A, 0xfff3b0, D + 0.2); e.setVisible(true); break;
      case 'gadgetMissile': this._tex(a, PT.missile, N, null, D); this._tex(b, TEX.flame, A, 0xff8a1f, D - 0.1); this._tex(e, TEX.soft, A, 0xff2fa6, D - 0.2); e.setVisible(true); break;
      case 'spark': this._tex(a, TEX.star, A, 0xffe94a, D); this._tex(b, TEX.soft, A, 0xfff27a, D - 0.1); this._tex(e, TEX.bolt, A, 0xffffff, D + 0.1); e.setVisible(true); break;
      case 'shockwave': this._tex(a, PT.wave, A, 0xffb02e, D); this._tex(b, TEX.smoke, N, 0xc8a070, D - 0.1); break;
      default: this._tex(a, TEX.soft, A, 0x22e4ff, D); this._tex(b, TEX.star, A, 0xffffff, D + 0.1);
    }
  }

  _setupE(sl, kind, state, E) {
    const { a, b, e } = sl;
    const N = 'NORMAL', A = 'ADD', D = E_DEPTH;
    e.setVisible(false); b.setVisible(true); a.setVisible(true);
    switch (kind) {
      case 'shadowClone': {
        const f = state.fighters && state.fighters[E.owner];
        const spec = getSpec((f && f.charId) || 'hattori', null);
        const info = buildBodyTexture(this.scene, spec);
        this._tex(a, info.key, N, 0x3a5bd8, D); a.setOrigin(info.ox, info.oy);
        sl.bodyInv = 1 / info.S;
        this._tex(b, TEX.soft, A, 0x2f6bff, D - 0.1);
        break;
      }
      case 'slowField': this._tex(a, PT.dome, A, 0xb48cff, D); this._tex(b, PT.hand, A, 0xeadcff, D + 0.1); b.setOrigin(0.5, 0.5); this._tex(e, PT.hand, A, 0xeadcff, D + 0.1); e.setOrigin(0.5, 0.5); e.setVisible(true); break;
      case 'trap': this._tex(a, PT.trap, N, null, D); this._tex(b, TEX.dot, A, 0xff3b3b, D + 0.1); break;
      case 'stormWarning': this._tex(a, TEX.ring, A, 0xffe94a, FX_DEPTH); this._tex(b, TEX.soft, A, 0xffe94a, D); this._tex(e, PT.warn, N, null, FX_DEPTH); e.setVisible(true); break;
      case 'lightning': this._tex(a, PT.lightning, A, 0xfff6a0, FX_DEPTH); this._tex(b, TEX.soft, A, 0xfff27a, FX_DEPTH - 0.1); this._tex(e, TEX.soft, A, 0xffffff, FX_DEPTH - 0.2); e.setVisible(true); break;
      case 'door': this._tex(a, PT.door, N, null, D); this._tex(b, TEX.soft, A, 0xff6fb5, D - 0.1); break;
      case 'quake': this._tex(a, PT.cracks, N, null, D); this._tex(b, TEX.smoke, N, 0xb89a72, D + 0.1); break;
      default: this._tex(a, TEX.soft, A, 0xff2fa6, D); b.setVisible(false);
    }
  }

  sync(state, alpha = 1, dtMs = 16.67, perf = false) {
    if (!state) return;
    const dt = Math.min(0.1, Math.max(0, dtMs / 1000));
    this.t += dt;
    const t = this.t;
    const back = 1 - (alpha > 1 ? 1 : alpha < 0 ? 0 : alpha);
    const inv = this.inv;

    const P = state.projectiles || [];
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      const sl = this._slot(this.p, i, P_DEPTH);
      if (!p || !p.active) { hideSlot(sl); sl.kind = null; continue; }
      if (sl.kind !== p.kind || !sl.on) { this._setupP(sl, p.kind); sl.kind = p.kind; sl.on = true; sl.rot = 0; }
      const x = p.x - (p.vx || 0) * back, y = p.y - (p.vy || 0) * back;
      const fc = (p.facing || 1) < 0 ? -1 : 1;
      const w = p.w || 24, h = p.h || 24;
      const life = p.life === undefined ? 99 : p.life;
      const fade = life >= 6 ? 1 : life <= 0 ? 0 : life / 6;
      const { a, b, e } = sl;
      sl.rot += dt;
      switch (p.kind) {
        case 'shuriken': {
          const s = Math.max(w, h) / 34;
          a.setPosition(x, y).setScale(s * inv[PT.shuriken]).setRotation(t * 24 * fc).setAlpha(fade);
          b.setPosition(x, y).setScale(s * 0.9 * inv[TEX.soft]).setAlpha(perf ? 0 : 0.3 * fade);
          break;
        }
        case 'thunderJolt': {
          const s = Math.max(w, h);
          const fl = (((t * 30) | 0) & 3);
          a.setPosition(x, y).setScale((s * 1.7) / 64 * inv[TEX.soft] * (1 + Math.sin(t * 40) * 0.08)).setAlpha(fade);
          b.setPosition(x, y).setScale((s / 60) * inv[TEX.bolt]).setRotation(fl * 1.57 + 0.4).setAlpha((fl & 1 ? 0.95 : 0.6) * fade);
          e.setPosition(x, y).setScale((s * 0.9) / 48 * inv[TEX.star]).setRotation(-t * 8).setAlpha(fade);
          break;
        }
        case 'kamehameha': {
          const lead = x + fc * w * 0.5;
          const wob = 1 + Math.sin(t * 50) * 0.06;
          a.setPosition(x, y).setDisplaySize(w, h * 1.9 * wob).setAlpha(0.9 * fade);
          b.setPosition(x, y).setDisplaySize(w, h * 0.7 * wob).setAlpha(fade);
          e.setPosition(lead, y).setScale((h * 2.6 * wob) / 64 * inv[TEX.soft]).setAlpha(fade);
          break;
        }
        case 'pellet': {
          const s = Math.max(w, h) / 12;
          a.setPosition(x, y).setScale(s * inv[PT.pellet]).setAlpha(fade);
          b.setPosition(x - fc * 18, y).setScale(0.7 * inv[TEX.streak], 0.5 * inv[TEX.streak]).setFlipX(fc < 0).setAlpha(perf ? 0 : 0.45 * fade);
          break;
        }
        case 'fireball': {
          const s = Math.max(w, h);
          a.setPosition(x, y).setScale((s * 1.8) / 64 * inv[TEX.soft] * (1 + Math.sin(t * 33) * 0.07)).setAlpha(fade);
          b.setPosition(x - fc * s * 0.3, y).setScale((s * 1.3) / 48 * inv[TEX.flame]).setRotation(-fc * 1.5708).setAlpha(0.9 * fade);
          e.setPosition(x, y).setScale((s * 0.7) / 64 * inv[TEX.soft]).setAlpha(fade);
          break;
        }
        case 'gadgetMissile': {
          const vx = p.vx || fc, vy = p.vy || 0;
          const ang = Math.atan2(vy, vx);
          const s = Math.max(w, 30) / 50;
          a.setPosition(x, y).setScale(s * inv[PT.missile]).setRotation(ang).setAlpha(fade);
          const tx = x - Math.cos(ang) * 24 * s, ty = y - Math.sin(ang) * 24 * s;
          b.setPosition(tx, ty).setScale((0.45 + Math.sin(t * 45) * 0.08) * inv[TEX.flame]).setRotation(ang - 1.5708).setAlpha(fade);
          e.setPosition(x, y).setScale(0.8 * inv[TEX.soft]).setAlpha(perf ? 0 : 0.35 * fade);
          break;
        }
        case 'spark': {
          const s = Math.max(w, h);
          a.setPosition(x, y).setScale((s * 1.4) / 48 * inv[TEX.star]).setRotation(t * 10).setAlpha(fade);
          b.setPosition(x, y).setScale((s * 2.2) / 64 * inv[TEX.soft]).setAlpha(0.6 * fade);
          e.setPosition(x, y).setScale((s * 0.9) / 60 * inv[TEX.bolt]).setRotation(((t * 24) | 0) * 2.1).setAlpha(fade);
          break;
        }
        case 'shockwave': {
          const hh = h || 60;
          a.setPosition(x, y).setDisplaySize(Math.max(w, 40) * 1.3, hh * 1.2).setFlipX(fc < 0).setAlpha(fade);
          b.setPosition(x - fc * w * 0.3, y + hh * 0.25).setScale((hh * 1.4) / 64 * inv[TEX.smoke]).setRotation(t * 2).setAlpha(0.55 * fade);
          break;
        }
        default:
          a.setPosition(x, y).setScale(Math.max(w, h) / 40 * inv[TEX.soft]).setAlpha(fade);
          b.setPosition(x, y).setScale(Math.max(w, h) / 48 * inv[TEX.star]).setRotation(t * 6).setAlpha(fade);
      }
    }
    for (let i = P.length; i < this.p.length; i++) hideSlot(this.p[i]);

    const E = state.entities || [];
    for (let i = 0; i < E.length; i++) {
      const en = E[i];
      const sl = this._slot(this.e, i, E_DEPTH);
      if (!en || !en.active) { hideSlot(sl); sl.kind = null; continue; }
      if (sl.kind !== en.kind || !sl.on || sl.owner !== en.owner) {
        this._setupE(sl, en.kind, state, en); sl.kind = en.kind; sl.on = true; sl.owner = en.owner;
      }
      const x = en.x, y = en.y, w = en.w || 60, h = en.h || 60;
      const maxL = en.maxLife || 60, life = en.life === undefined ? maxL : en.life;
      const fin = Math.min(1, (maxL - life) / 6 + 0.001), fout = Math.min(1, life / 10);
      const fade = Math.max(0, Math.min(fin, fout));
      const fc = (en.facing || 1) < 0 ? -1 : 1;
      const { a, b, e } = sl;
      switch (en.kind) {
        case 'shadowClone': {
          const feet = y + h * 0.5;
          const flick = perf ? 1 : 0.85 + Math.sin(t * 25) * 0.15;
          a.setPosition(x, feet).setScale(sl.bodyInv * fc, sl.bodyInv).setAlpha(0.55 * fade * flick);
          b.setPosition(x, y).setScale((w * 2) / 64 * inv[TEX.soft], (h * 1.2) / 64 * inv[TEX.soft]).setAlpha(perf ? 0 : 0.22 * fade);
          break;
        }
        case 'slowField': {
          const d = Math.max(w, h);
          a.setPosition(x, y).setDisplaySize(w, h).setAlpha(0.7 * fade).setRotation(Math.sin(t * 1.5) * 0.05);
          b.setPosition(x, y).setScale((d * 0.4) / 64 * inv[PT.hand]).setRotation(t * 2.5).setAlpha(0.8 * fade);
          e.setPosition(x, y).setScale((d * 0.28) / 64 * inv[PT.hand]).setRotation(t * 0.4).setAlpha(0.8 * fade);
          break;
        }
        case 'trap': {
          const s = Math.max(w, 40) / 52;
          a.setPosition(x, y).setScale(s * inv[PT.trap]).setAlpha(fade);
          b.setPosition(x, y - 2).setScale(0.6 * inv[TEX.dot]).setAlpha(((t * 3) | 0) & 1 ? fade : 0.15 * fade);
          break;
        }
        case 'stormWarning': {
          const pulse = 0.5 + 0.5 * Math.sin(t * 14);
          const gy = Math.min(GROUND_Y, y + h * 0.5);
          const r = Math.max(w, 40);
          a.setPosition(x, gy).setScale((r * (0.9 + pulse * 0.25)) / 96 * inv[TEX.ring], (r * 0.28) / 96 * inv[TEX.ring]).setAlpha((0.5 + pulse * 0.5) * fade);
          b.setPosition(x, gy - 160).setScale((r * 0.9) / 64 * inv[TEX.soft], 340 / 64 * inv[TEX.soft]).setAlpha(perf ? 0 : 0.14 * fade);
          e.setPosition(x, gy - 40 - pulse * 6).setScale(0.8 * inv[PT.warn]).setAlpha(fade);
          break;
        }
        case 'lightning': {
          const top = y - h * 0.5, bot = Math.min(GROUND_Y + 4, y + h * 0.5);
          const len = Math.max(60, bot - top);
          const fl = (((t * 40) | 0) & 1) ? 1 : 0.7;
          a.setPosition(x, (top + bot) * 0.5).setDisplaySize(Math.max(w, 48) * 1.2, len).setFlipX((((t * 20) | 0) & 1) === 1).setAlpha(fl * fade);
          b.setPosition(x, bot).setScale((Math.max(w, 48) * 3) / 64 * inv[TEX.soft], 1.2 * inv[TEX.soft]).setAlpha(0.9 * fade);
          e.setPosition(x, (top + bot) * 0.5).setScale((Math.max(w, 48) * 1.6) / 64 * inv[TEX.soft], len / 64 * inv[TEX.soft]).setAlpha(perf ? 0 : 0.25 * fade * fl);
          break;
        }
        case 'door': {
          const pop = fin < 1 ? 0.6 + fin * 0.4 : fout < 1 ? 0.6 + fout * 0.4 : 1;
          const dh = Math.max(h, 100);
          a.setPosition(x, y).setScale(pop * (dh / 120) * inv[PT.door]).setAlpha(fade);
          b.setPosition(x, y).setScale((dh * 1.4) / 64 * inv[TEX.soft]).setAlpha(perf ? 0 : 0.3 * fade);
          break;
        }
        case 'quake': {
          a.setPosition(x, Math.max(y, GROUND_Y - 12)).setDisplaySize(Math.max(w, 80), 30).setAlpha(fade);
          b.setPosition(x, GROUND_Y - 14).setScale((Math.max(w, 80) * 0.8) / 64 * inv[TEX.smoke], 0.6 * inv[TEX.smoke]).setRotation(t).setAlpha(0.35 * fade);
          break;
        }
        default:
          a.setPosition(x, y).setScale(Math.max(w, h) / 64 * inv[TEX.soft]).setAlpha(0.5 * fade);
      }
    }
    for (let i = E.length; i < this.e.length; i++) hideSlot(this.e[i]);
  }

  destroy() {
    for (const list of [this.p, this.e]) {
      for (const sl of list) { if (sl) { sl.a.destroy(); sl.b.destroy(); sl.e.destroy(); } }
    }
    this.p = []; this.e = [];
  }
}

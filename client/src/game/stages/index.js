// Procedural layered stage backgrounds.
// buildStage(scene, stageId, { perf }) -> { update(dtMs, focusX), destroy() }
import Phaser from 'phaser';
import { W, H, X0, LW, PAD, mkRng, hashStr } from './paint.js';
import { STAGE_DEFS } from './defs.js';

let UID = 0;

export const STAGE_ART_IDS = Object.keys(STAGE_DEFS);

export function buildStage(scene, stageId, { perf = false } = {}) {
  const id = STAGE_DEFS[stageId] ? stageId : 'neon_city';
  const def = STAGE_DEFS[id];
  const res = Math.max(0.5, Math.min(2, Number(scene.registry.get('res')) || 1));
  const lres = perf ? Math.min(res, 1) : res;
  const sres = Math.min(Math.max(res, 1), 2);
  const uid = ++UID;
  const keys = [];
  const canvases = [];
  const objs = [];
  const par = [];
  const ticks = [];
  const texCache = Object.create(null);
  const marks = {};
  const rnd = mkRng(hashStr(id) ^ 0x9e3779b9);
  let alive = true;

  function addCanvasTex(canvas) {
    const key = `cc_stage_${id}_${uid}_${keys.length}`;
    const tex = scene.textures.create(key, canvas, canvas.width, canvas.height);
    if (tex) tex.add('__BASE', 0, 0, 0, canvas.width, canvas.height);
    keys.push(key);
    canvases.push(canvas);
    if (tex && tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return key;
  }

  const B = {
    perf: !!perf,
    rnd,
    marks,
    scene,
    tex(name, w, h, paint) {
      if (texCache[name]) return texCache[name];
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(w * sres);
      cv.height = Math.ceil(h * sres);
      const c = cv.getContext('2d');
      c.scale(sres, sres);
      paint(c, w, h);
      texCache[name] = addCanvasTex(cv);
      return texCache[name];
    },
    img(key, x, y, depth, f = 0, ox = 0.5, oy = 0.5) {
      const o = scene.add.image(x, y, key).setOrigin(ox, oy).setDepth(depth).setScale(1 / sres);
      const rec = { o, x, f, k: 1 / sres, s: 1, ph: 0 };
      objs.push(o);
      par.push(rec);
      return rec;
    },
    rect(color, alpha, depth) {
      const o = scene.add.rectangle(W / 2, H / 2, LW + 240, H + 240, color, 1).setAlpha(alpha).setDepth(depth);
      objs.push(o);
      return o;
    },
    add(rec) {
      if (!perf) rec.o.setBlendMode(Phaser.BlendModes.ADD);
      return rec;
    },
    tick(fn) {
      ticks.push(fn);
    },
  };

  for (let i = 0; i < def.layers.length; i++) {
    const L = def.layers[i];
    const top = L.top ?? 0;
    const h = L.h ?? H;
    const q = L.soft ? Math.max(0.75, lres * 0.6) : lres;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(LW * q);
    cv.height = Math.ceil(h * q);
    const c = cv.getContext('2d');
    c.scale(q, q);
    c.translate(PAD, -top);
    try {
      L.draw(c, rnd, marks, !!perf);
    } catch (e) {
      console.warn('[stage] layer draw failed', id, i, e);
    }
    const key = addCanvasTex(cv);
    const o = scene.add.image(X0, top, key).setOrigin(0, 0).setScale(1 / q).setDepth(L.d ?? i);
    objs.push(o);
    par.push({ o, x: X0, f: L.f ?? 0, k: 1 / q, s: 1, ph: 0 });
  }

  try {
    if (def.amb) def.amb(B, marks);
  } catch (e) {
    console.warn('[stage] ambient setup failed', id, e);
  }

  let t = 0;
  let off = 0;

  return {
    id,
    update(dtMs, focusX) {
      if (!alive) return;
      const dt = dtMs > 0 ? (dtMs > 100 ? 100 : dtMs) : 0;
      t += dt;
      let target = Number.isFinite(focusX) ? focusX - W / 2 : 0;
      if (target > W / 2) target = W / 2;
      else if (target < -W / 2) target = -W / 2;
      off += (target - off) * Math.min(1, dt * 0.006);
      for (let i = 0; i < ticks.length; i++) ticks[i](dt, t, off);
      for (let i = 0; i < par.length; i++) {
        const r = par[i];
        r.o.x = r.x + off * r.f;
      }
    },
    destroy() {
      if (!alive) return;
      alive = false;
      for (let i = 0; i < objs.length; i++) {
        try {
          objs[i].destroy();
        } catch (e) {
          /* already gone with the scene */
        }
      }
      for (let i = 0; i < keys.length; i++) {
        try {
          if (scene.textures && scene.textures.exists(keys[i])) scene.textures.remove(keys[i]);
        } catch (e) {
          /* texture manager torn down */
        }
      }
      for (let i = 0; i < canvases.length; i++) {
        canvases[i].width = 0;
        canvases[i].height = 0;
      }
      objs.length = 0;
      par.length = 0;
      ticks.length = 0;
      keys.length = 0;
      canvases.length = 0;
    },
  };
}

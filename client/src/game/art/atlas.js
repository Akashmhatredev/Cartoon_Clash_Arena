// Rasterize a fighter's vector parts into one high-res canvas atlas registered as Phaser frames.
import { makeCanvas } from './draw.js';
import { getRes } from '../fx/textures.js';
import { drawFigure } from './figure.js';
import { IDLE } from './poses.js';

const infoCache = new Map();
const PAD = 2;

/** @returns {{ key, S, frames: Object<string,{ox,oy}> }} */
export function buildAtlas(scene, spec) {
  const res = getRes(scene);
  const S = res * spec.k;
  const key = `ccf:${spec.id}:${spec.form || 'base'}:${S.toFixed(3)}`;
  const known = infoCache.get(key);
  if (known && scene.textures.exists(key)) return known;

  const items = spec.parts.map((p) => {
    const [x0, y0, x1, y1] = p.box;
    return { p, x0, y0, w: Math.ceil((x1 - x0) * S) + PAD * 2, h: Math.ceil((y1 - y0) * S) + PAD * 2, x: 0, y: 0 };
  });
  let area = 0, maxW = 0;
  for (const it of items) { area += it.w * it.h; if (it.w > maxW) maxW = it.w; }
  const W = Math.max(maxW, Math.ceil(Math.sqrt(area) * 1.25));
  const sorted = items.slice().sort((a, b) => b.h - a.h);
  let cx = 0, cy = 0, rowH = 0;
  for (const it of sorted) {
    if (cx + it.w > W) { cx = 0; cy += rowH; rowH = 0; }
    it.x = cx; it.y = cy;
    cx += it.w; if (it.h > rowH) rowH = it.h;
  }
  const H = cy + rowH;
  const cv = makeCanvas(W, H);
  const ctx = cv.getContext('2d');
  const frames = {};
  for (const it of items) {
    ctx.save();
    ctx.translate(it.x + PAD - it.x0 * S, it.y + PAD - it.y0 * S);
    ctx.scale(S, S);
    try { it.p.draw(ctx); } catch (e) { console.warn('[art] part', spec.id, it.p.name, e); }
    ctx.restore();
    frames[it.p.name] = { ox: (PAD - it.x0 * S) / it.w, oy: (PAD - it.y0 * S) / it.h, it };
  }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.create(key, cv, cv.width, cv.height);
  tex.add('__BASE', 0, 0, 0, cv.width, cv.height);
  for (const it of items) tex.add(it.p.name, 0, it.x, it.y, it.w, it.h);
  const info = { key, S, frames };
  infoCache.set(key, info);
  return info;
}

/** idle full-body texture (feet origin) used for shadow clones and silhouettes */
export function buildBodyTexture(scene, spec) {
  const res = getRes(scene);
  const S = res * spec.k;
  const key = `ccb:${spec.id}:${spec.form || 'base'}:${S.toFixed(3)}`;
  const known = infoCache.get(key);
  if (known && scene.textures.exists(key)) return known;
  const w = Math.max(spec.headW * 2.6, spec.torsoW * 2.4) + 60;
  const h = spec.H * 1.35 + 30;
  const footY = h - 14;
  const cv = makeCanvas(w * S, h * S);
  const ctx = cv.getContext('2d');
  ctx.scale(S, S);
  ctx.translate(w / 2, footY);
  try { drawFigure(ctx, spec, IDLE); } catch (e) { console.warn('[art] body', spec.id, e); }
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.create(key, cv, cv.width, cv.height).add('__BASE', 0, 0, 0, cv.width, cv.height);
  const info = { key, S: res, ox: 0.5, oy: footY / h };
  infoCache.set(key, info);
  return info;
}

export function bodyTextureKey(scene, spec) {
  const res = getRes(scene);
  return `ccb:${spec.id}:${spec.form || 'base'}:${(res * spec.k).toFixed(3)}`;
}

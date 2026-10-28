// Generated (canvas) textures shared by fighters, projectiles, stages and fx. High-res, linear filtered.
import { makeCanvas, OUTLINE, rgba, polyPath, ellipsePath } from '../art/draw.js';

export function getRes(scene) {
  const r = Number(scene && scene.registry && scene.registry.get('res'));
  return r > 0 ? Math.min(3, r) : 1;
}

/** create (once per texture manager) a canvas texture drawn at `scale`, in world units w x h */
export function canvasTexture(scene, key, w, h, draw, scale = getRes(scene)) {
  const tm = scene.textures;
  if (tm.exists(key)) return tm.get(key);
  const cv = makeCanvas(w * scale, h * scale);
  const ctx = cv.getContext('2d');
  ctx.scale(scale, scale);
  draw(ctx, w, h);
  const tex = tm.create(key, cv, cv.width, cv.height);
  if (tex) tex.add('__BASE', 0, 0, 0, cv.width, cv.height);
  if (tex) tex.ccScale = scale;
  return tex;
}

/** 1 / (texture raster scale) so an image displays at its world size */
export function invScale(scene, key) {
  const t = scene.textures.exists(key) ? scene.textures.get(key) : null;
  return t && t.ccScale ? 1 / t.ccScale : 1;
}

export const TEX = {
  soft: 'cc_soft', streak: 'cc_streak', star: 'cc_star', ring: 'cc_ring', smoke: 'cc_smoke',
  shadow: 'cc_shadow', bolt: 'cc_bolt', dot: 'cc_dot', hex: 'cc_hex', flame: 'cc_flame', white: 'cc_white',
};

export function ensureCommonTextures(scene) {
  if (scene.textures.exists(TEX.white)) return;
  canvasTexture(scene, TEX.soft, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  });
  canvasTexture(scene, TEX.streak, 64, 12, (c) => {
    const g = c.createLinearGradient(0, 0, 64, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 6); c.quadraticCurveTo(40, 0.5, 64, 6); c.quadraticCurveTo(40, 11.5, 0, 6); c.fill();
  });
  canvasTexture(scene, TEX.star, 48, 48, (c) => {
    const g = c.createRadialGradient(24, 24, 0, 24, 24, 24);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 24 : 5;
      c.lineTo(24 + Math.cos(a) * r, 24 + Math.sin(a) * r);
    }
    c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(24, 24, 4, 0, Math.PI * 2); c.fill();
  });
  canvasTexture(scene, TEX.ring, 96, 96, (c) => {
    c.strokeStyle = '#fff'; c.lineWidth = 5;
    c.beginPath(); c.arc(48, 48, 42, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 10;
    c.beginPath(); c.arc(48, 48, 40, 0, Math.PI * 2); c.stroke();
  });
  canvasTexture(scene, TEX.smoke, 64, 64, (c) => {
    const blob = (x, y, r, a) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    };
    blob(32, 34, 26, 0.7); blob(22, 28, 16, 0.5); blob(42, 26, 15, 0.5); blob(34, 40, 14, 0.4);
  });
  canvasTexture(scene, TEX.shadow, 128, 32, (c) => {
    c.save(); c.translate(64, 16); c.scale(1, 0.25);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 62);
    g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.6, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, 62, 0, Math.PI * 2); c.fill();
    c.restore();
  });
  canvasTexture(scene, TEX.bolt, 32, 96, (c) => {
    const pts = [16, 0, 8, 30, 18, 34, 6, 64, 16, 66, 10, 96, 26, 58, 16, 55, 26, 30, 16, 27, 22, 0];
    c.shadowColor = 'rgba(160,240,255,1)'; c.shadowBlur = 6;
    polyPath(c, pts); c.fillStyle = '#fff'; c.fill();
  });
  canvasTexture(scene, TEX.dot, 12, 12, (c) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(6, 6, 5.5, 0, Math.PI * 2); c.fill(); });
  canvasTexture(scene, TEX.hex, 96, 110, (c) => {
    const hex = (r) => {
      c.beginPath();
      for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; c.lineTo(48 + Math.cos(a) * r, 55 + Math.sin(a) * r); }
      c.closePath();
    };
    hex(50); c.fillStyle = 'rgba(255,255,255,0.18)'; c.fill();
    c.lineWidth = 4; c.strokeStyle = '#fff'; c.stroke();
    hex(38); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
  });
  canvasTexture(scene, TEX.flame, 48, 64, (c) => {
    const g = c.createRadialGradient(24, 46, 2, 24, 40, 30);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(24, 2); c.quadraticCurveTo(44, 30, 40, 46); c.quadraticCurveTo(34, 62, 24, 62);
    c.quadraticCurveTo(14, 62, 8, 46); c.quadraticCurveTo(4, 30, 24, 2); c.fill();
  });
  canvasTexture(scene, TEX.white, 8, 8, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 8, 8); });
}

// re-exported for convenience in other content modules
export { OUTLINE, rgba, ellipsePath };

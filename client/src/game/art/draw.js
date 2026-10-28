// Phaser-free Canvas2D helpers shared by the fighter atlas, portraits, stages and fx textures.

export const OUTLINE = '#0b0f1e';
export const LW = 3; // outline width in world units

export function makeCanvas(w, h) {
  w = Math.max(1, Math.ceil(w));
  h = Math.max(1, Math.ceil(h));
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  return null;
}

// ---------- colour ----------
const rgbCache = new Map();
export function hexToRgb(hex) {
  let v = rgbCache.get(hex);
  if (v) return v;
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16) || 0;
  v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  rgbCache.set(hex, v);
  return v;
}
const toHex = (r, g, b) =>
  '#' + [r, g, b].map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('');
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
/** f < 1 darkens toward navy-black, f > 1 lightens toward white */
export function shade(hex, f) {
  return f < 1 ? mix(hex, '#0b0f1e', 1 - f) : mix(hex, '#ffffff', f - 1);
}
export function hexNum(hex) {
  const c = hexToRgb(hex);
  return (c[0] << 16) | (c[1] << 8) | c[2];
}
export function rgba(hex, a) {
  const c = hexToRgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}
export function isHex(v) {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
}

// ---------- paths ----------
export function taperPath(ctx, x1, y1, x2, y2, r1, r2) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.arc(x1, y1, r1, a + Math.PI / 2, a + Math.PI * 1.5);
  ctx.arc(x2, y2, r2, a - Math.PI / 2, a + Math.PI / 2);
  ctx.closePath();
}
export function ellipsePath(ctx, cx, cy, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
}
export function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function polyPath(ctx, pts, close = true) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  if (close) ctx.closePath();
}
/** smooth closed blob through points using quadratic midpoints */
export function blobPath(ctx, pts) {
  const n = pts.length / 2;
  ctx.beginPath();
  const mx = (i) => (pts[(i % n) * 2] + pts[((i + 1) % n) * 2]) / 2;
  const my = (i) => (pts[(i % n) * 2 + 1] + pts[((i + 1) % n) * 2 + 1]) / 2;
  ctx.moveTo(mx(n - 1), my(n - 1));
  for (let i = 0; i < n; i++) ctx.quadraticCurveTo(pts[i * 2], pts[i * 2 + 1], mx(i), my(i));
  ctx.closePath();
}

// ---------- fill / stroke ----------
export function fillStroke(ctx, fill, lw = LW, stroke = OUTLINE) {
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw > 0) {
    ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.stroke();
  }
}
export function line(ctx, x1, y1, x2, y2, lw, color = OUTLINE) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}
export function curve(ctx, x1, y1, cx, cy, x2, y2, lw, color = OUTLINE) {
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.quadraticCurveTo(cx, cy, x2, y2);
  ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke();
}
export function circle(ctx, x, y, r, fill, lw = LW) {
  ellipsePath(ctx, x, y, r, r);
  fillStroke(ctx, fill, lw);
}
export function dot(ctx, x, y, r, color) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
}

/**
 * Fill the current path with `base`, then inside a clip run `inner(ctx)` (bands, shading),
 * then stroke. The path must be the current path when called; it is rebuilt by `pathFn`.
 */
export function shaded(ctx, pathFn, base, inner, lw = LW) {
  pathFn(ctx);
  ctx.fillStyle = base; ctx.fill();
  ctx.save();
  pathFn(ctx);
  ctx.clip();
  if (inner) inner(ctx);
  ctx.restore();
  pathFn(ctx);
  fillStroke(ctx, null, lw);
}

/** flat-shade wash on one side of a clipped region: side < 0 back (left), > 0 front highlight */
export function sideShade(ctx, x0, x1, y0, y1, alpha = 0.18) {
  ctx.fillStyle = `rgba(11,15,30,${alpha})`;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}

/**
 * Limb along +y from pivot (0,0) to (0,len): tapered capsule with colour bands.
 * bands: [[fromFraction, colour], ...] (first fraction should be 0)
 */
export function limb(ctx, len, r1, r2, bands, dim = 0, seams = true) {
  const path = (c) => taperPath(c, 0, 0, 0, len, r1, r2);
  const R = Math.max(r1, r2) + 2;
  shaded(ctx, path, bands[0][1], (c) => {
    for (let i = 1; i < bands.length; i++) {
      c.fillStyle = bands[i][1];
      c.fillRect(-R, bands[i][0] * len, R * 2, len + R * 2);
    }
    if (seams) {
      for (let i = 1; i < bands.length; i++) line(c, -R, bands[i][0] * len, R, bands[i][0] * len, LW * 0.55);
    }
    sideShade(c, -R, -R * 0.25, -R, len + R, 0.2);
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(R * 0.2, -R, R * 0.25, len + R * 2);
    if (dim) { c.fillStyle = `rgba(11,15,30,${dim})`; c.fillRect(-R, -R, R * 2, len + R * 2); }
  });
}

export function dimOver(ctx, pathFn, dim) {
  if (!dim) return;
  ctx.save(); pathFn(ctx); ctx.clip();
  ctx.fillStyle = `rgba(11,15,30,${dim})`;
  ctx.fillRect(-500, -500, 1000, 1000);
  ctx.restore();
}

/** cartoon eye: white sclera + pupil + highlight */
export function eye(ctx, x, y, rx, ry, pupil = OUTLINE, pr = 0.55, pdx = 0.25, iris = null) {
  ellipsePath(ctx, x, y, rx, ry);
  fillStroke(ctx, '#ffffff', LW * 0.6);
  if (iris) dot(ctx, x + rx * pdx, y + ry * 0.1, Math.min(rx, ry) * 0.72, iris);
  dot(ctx, x + rx * pdx, y + ry * 0.1, Math.min(rx, ry) * pr, pupil);
  dot(ctx, x + rx * pdx + rx * 0.22, y - ry * 0.25, Math.min(rx, ry) * 0.2, '#ffffff');
}
/** solid dot eye with highlight */
export function dotEye(ctx, x, y, rx, ry) {
  ellipsePath(ctx, x, y, rx, ry);
  ctx.fillStyle = OUTLINE; ctx.fill();
  dot(ctx, x + rx * 0.3, y - ry * 0.35, Math.min(rx, ry) * 0.38, '#ffffff');
}

export function radialGlow(ctx, x, y, r, color, a0 = 1, a1 = 0) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a0));
  g.addColorStop(1, rgba(color, a1));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/** deterministic tiny PRNG for procedural drawing */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

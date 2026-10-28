// Canvas2D painting helpers for procedural stage backgrounds.
// All drawing happens in world coordinates (0..1280 x 0..720); layer canvases extend PAD px on each side.

export const W = 1280;
export const H = 720;
export const PAD = 60;
export const X0 = -PAD;
export const X1 = W + PAD;
export const LW = X1 - X0;
export const FLOOR_Y = 640;
export const TAU = Math.PI * 2;

export function mkRng(seed) {
  let s = (seed >>> 0) || 1;
  return function rnd() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export const lerp = (a, b, t) => a + (b - a) * t;
export const between = (r, a, b) => a + (b - a) * r();
export const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

export function hexRgb(hex) {
  let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a = 1) {
  const c = hexRgb(hex);
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

export function mix(a, b, t) {
  const A = hexRgb(a);
  const B = hexRgb(b);
  const ch = (i) => Math.max(0, Math.min(255, Math.round(A[i] + (B[i] - A[i]) * t)));
  return '#' + ((1 << 24) | (ch(0) << 16) | (ch(1) << 8) | ch(2)).toString(16).slice(1);
}

export function vgrad(c, y0, y1, stops) {
  const g = c.createLinearGradient(0, y0, 0, y1);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}

export function hgrad(c, x0, x1, stops) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  for (let i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
  return g;
}

export function fillAll(c, style, y0 = -40, y1 = H + 40) {
  c.fillStyle = style;
  c.fillRect(X0 - 2, y0, LW + 4, y1 - y0);
}

// Soft radial glow. sy squashes vertically (for floor reflections / haze bands).
export function glow(c, x, y, r, color, a = 1, sy = 1) {
  c.save();
  c.translate(x, y);
  c.scale(1, sy);
  const g = c.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.35, rgba(color, a * 0.45));
  g.addColorStop(1, rgba(color, 0));
  c.fillStyle = g;
  c.beginPath();
  c.arc(0, 0, r, 0, TAU);
  c.fill();
  c.restore();
}

export function rrect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

export function circle(c, x, y, r, fill) {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(x, y, r, 0, TAU);
  c.fill();
}

export function ellipse(c, x, y, rx, ry, fill) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, TAU);
  c.fill();
}

// Device-pixel scale of the current transform (shadowBlur ignores transforms).
export function devScale(c) {
  return c.getTransform ? c.getTransform().a : 1;
}

// Neon tube: blurred colored stroke with a white-hot core. pathFn builds the path.
export function neon(c, color, lw, blur, pathFn) {
  const s = devScale(c);
  c.save();
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.shadowColor = color;
  c.shadowBlur = blur * s;
  c.strokeStyle = color;
  c.lineWidth = lw;
  pathFn();
  c.stroke();
  c.stroke();
  c.shadowBlur = 0;
  c.strokeStyle = 'rgba(255,255,255,0.85)';
  c.lineWidth = Math.max(1, lw * 0.35);
  c.stroke();
  c.restore();
}

// Silhouette ridge (hills/mountains) from left to right edge.
export function ridge(c, r, { base, amp, step = 60, fill, peaks = false, bottom = H + 40 }) {
  const x0 = X0 - step;
  const x1 = X1 + step;
  c.beginPath();
  c.moveTo(x0, bottom);
  let px = x0;
  let py = base - amp * (0.4 + 0.6 * r());
  c.lineTo(px, py);
  let i = 0;
  for (let x = x0 + step; x <= x1 + step; x += step, i++) {
    let y;
    if (peaks) y = base - amp * (i % 2 ? 0.15 + 0.3 * r() : 0.6 + 0.4 * r());
    else y = base - amp * (0.35 + 0.65 * r());
    if (peaks) c.lineTo(x, y);
    else c.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
    px = x;
    py = y;
  }
  c.lineTo(x1 + step, bottom);
  c.closePath();
  c.fillStyle = fill;
  c.fill();
}

// Puffy cloud built from overlapping circles, filled with a vertical gradient.
export function cloud(c, x, y, w, h, top, bottom, a = 1) {
  c.save();
  c.globalAlpha = a;
  c.fillStyle = vgrad(c, y - h, y + h * 0.35, [[0, top], [1, bottom]]);
  c.beginPath();
  c.ellipse(x + w / 2, y, w / 2, h * 0.32, 0, 0, TAU);
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const cx = x + w * (0.14 + 0.72 * t);
    const rad = h * (0.32 + 0.38 * Math.sin(Math.PI * (0.15 + 0.7 * t)));
    const cy = y - rad * 0.55;
    c.moveTo(cx + rad, cy);
    c.arc(cx, cy, rad, 0, TAU);
  }
  c.fill();
  c.restore();
}

export function stars(c, r, n, y0, y1, color = '#eaf2ff', maxR = 1.4) {
  for (let i = 0; i < n; i++) {
    c.fillStyle = rgba(color, 0.15 + 0.55 * r());
    c.beginPath();
    c.arc(between(r, X0, X1), between(r, y0, y1), 0.4 + r() * maxR, 0, TAU);
    c.fill();
  }
}

// Ground band: base gradient, perspective seams converging to a vanishing point,
// receding cross seams, center light pool, edge highlight and a contact shadow lip.
export function floor(c, o) {
  const top = o.top ?? FLOOR_Y;
  const bottom = H + 40;
  const vpx = W / 2;
  const vpy = o.vpy ?? top - 320;
  const spacing = o.spacing ?? 120;
  c.save();
  // contact shadow on the background just above the floor
  c.fillStyle = vgrad(c, top - 26, top, [[0, 'rgba(0,0,0,0)'], [1, rgba(o.shadow || '#000000', 0.55)]]);
  c.fillRect(X0, top - 26, LW, 26);
  c.fillStyle = vgrad(c, top, bottom, [[0, o.c0], [0.55, o.c1], [1, o.c2 || o.c1]]);
  c.fillRect(X0 - 2, top, LW + 4, bottom - top);
  if (o.pool) glow(c, vpx, top + 40, 620, o.pool, o.poolA ?? 0.22, 0.16);
  if (o.decor) o.decor(c);
  c.beginPath();
  c.rect(X0, top, LW, bottom - top);
  c.clip();
  // depth seams
  c.strokeStyle = rgba(o.line, o.lineA ?? 0.25);
  c.lineWidth = o.lineW ?? 1.5;
  c.beginPath();
  const k = (top - vpy) / (bottom - vpy);
  for (let i = -16; i <= 16; i++) {
    const xb = vpx + i * spacing + (o.shift || 0);
    const xt = vpx + (xb - vpx) * k;
    c.moveTo(xt, top);
    c.lineTo(xb, bottom);
  }
  c.stroke();
  // cross seams, spacing grows toward the viewer
  const rows = o.rows ?? 4;
  for (let j = 1; j <= rows; j++) {
    const t = j / (rows + 0.6);
    const y = top + (bottom - top) * t * t * 1.15;
    c.strokeStyle = rgba(o.line, (o.lineA ?? 0.25) * (0.55 + 0.45 * t));
    c.lineWidth = (o.lineW ?? 1.5) * (0.7 + t);
    c.beginPath();
    c.moveTo(X0, y);
    c.lineTo(X1, y);
    c.stroke();
  }
  // side and bottom shading
  c.fillStyle = hgrad(c, X0, X1, [[0, 'rgba(0,0,0,0.45)'], [0.22, 'rgba(0,0,0,0)'], [0.78, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
  c.fillRect(X0, top, LW, bottom - top);
  c.fillStyle = vgrad(c, top, bottom, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.5)']]);
  c.fillRect(X0, top, LW, bottom - top);
  // lip highlight
  c.fillStyle = vgrad(c, top, top + 16, [[0, rgba(o.edge, (o.edgeA ?? 0.8) * 0.45)], [1, rgba(o.edge, 0)]]);
  c.fillRect(X0, top, LW, 16);
  c.fillStyle = rgba(o.edge, o.edgeA ?? 0.8);
  c.fillRect(X0, top - 1, LW, 2.5);
  c.restore();
}

// Vertical haze band (atmospheric depth) between y0..y1.
export function haze(c, y0, y1, color, a0, a1) {
  c.fillStyle = vgrad(c, y0, y1, [[0, rgba(color, a0)], [1, rgba(color, a1)]]);
  c.fillRect(X0 - 2, y0, LW + 4, y1 - y0);
}

// Simple window grid for building silhouettes.
export function windows(c, r, x, y, w, h, colors, p, a = 0.8, cw = 6, ch = 8, gx = 6, gy = 8) {
  const cols = Math.max(1, Math.floor((w - gx) / (cw + gx)));
  const rows = Math.max(1, Math.floor((h - gy) / (ch + gy)));
  const ox = x + (w - cols * (cw + gx) + gx) / 2;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (r() > p) continue;
      c.fillStyle = rgba(pick(r, colors), a * (0.45 + 0.55 * r()));
      c.fillRect(ox + i * (cw + gx), y + gy + j * (ch + gy), cw, ch);
    }
  }
}

// Draws a catenary-ish wire/rope; returns nothing, optionally reports sample points via cb(x, y).
export function rope(c, x0, y0, x1, y1, sag, color, lw = 2, cb = null, n = 0) {
  c.strokeStyle = color;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(x0, y0);
  c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2, x1, y1);
  c.stroke();
  if (cb && n > 0) {
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2 + sag * 2;
      const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * mx + t * t * x1;
      const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * my + t * t * y1;
      cb(x, y, i);
    }
  }
}

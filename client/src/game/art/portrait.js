// Menu portraits. NO Phaser import: reuses the Canvas2D part drawings from chars.js.
import { getSpec } from './chars.js';
import { drawFigure } from './figure.js';
import { makePose, B, NB, solveRig, lowestY } from './rig.js';
import { IDLE } from './poses.js';
import { makeCanvas, roundRectPath, rgba, shade, radialGlow } from './draw.js';

const PORTRAIT_POSE = makePose({ tor: 4, head: -5, auf: 18, alf: 70, aub: 12, alb: 80 }, IDLE);
const EXTRA_TOP = { pikachu: 30, heatblast: 34, goku: 20, doraemon: 2, xlr8: 6, fourarms: 4, bheem: 10, hattori: 4 };
const probeBones = new Float32Array(NB * 3);
const cache = new Map();
const urlCache = new Map();

/**
 * Framed bust portrait. opts: { form, flip, frame = true, background = true }
 * @returns {HTMLCanvasElement}
 */
export function renderPortrait(charId, size = 256, opts = {}) {
  size = Math.max(16, Math.round(size));
  const form = opts.form || null;
  const frame = opts.frame !== false;
  const bg = opts.background !== false;
  const key = `${charId}|${size}|${form || ''}|${opts.flip ? 1 : 0}|${frame ? 1 : 0}|${bg ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const cv = makeCanvas(size, size);
  if (!cv) return null;
  const ctx = cv.getContext('2d');
  if (!ctx) return cv;
  const spec = getSpec(charId, form);
  const accent = spec.pal.accent || '#22e4ff';
  const r = size * 0.08;
  const inset = frame ? size * 0.03 : 0;

  try {
    if (bg) {
      const g = ctx.createLinearGradient(0, 0, size, size);
      g.addColorStop(0, '#0d1530');
      g.addColorStop(0.55, '#070b1a');
      g.addColorStop(1, shade(accent, 0.35));
      roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
      ctx.fillStyle = g; ctx.fill();
      ctx.save();
      roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
      ctx.clip();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = accent; ctx.lineWidth = size * 0.035;
      for (let i = -size; i < size * 2; i += size * 0.11) {
        ctx.beginPath(); ctx.moveTo(i, size); ctx.lineTo(i + size, 0); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      radialGlow(ctx, size * 0.5, size * 0.42, size * 0.5, accent, 0.4, 0);
      ctx.restore();
    }

    // fit the bust: head + upper torso
    const extra = EXTRA_TOP[spec.form || spec.id] || 0;
    const bustH = spec.headH + spec.neck + spec.torsoLen * 0.72 + extra;
    const sc = Math.min((size * 0.9) / bustH, (size * 0.86) / (spec.headW * 1.5));
    ctx.save();
    roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
    ctx.clip();
    ctx.translate(size / 2, 0);
    if (opts.flip) ctx.scale(-1, 1);
    // solve once to find the head position, then draw positioned
    solveRig(spec, PORTRAIT_POSE, probeBones);
    const snap = -lowestY(spec, probeBones);
    const headX = probeBones[B.HEAD * 3];
    const headY = probeBones[B.HEAD * 3 + 1] + snap;
    const topY = headY - spec.headH - extra;
    ctx.translate(-(headX + spec.headW * 0.08) * sc, size * 0.07 - topY * sc);
    ctx.scale(sc, sc);
    drawFigure(ctx, spec, PORTRAIT_POSE);
    ctx.restore();

    if (bg) {
      ctx.save();
      roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
      ctx.clip();
      const v = ctx.createLinearGradient(0, size * 0.62, 0, size);
      v.addColorStop(0, 'rgba(7,11,26,0)');
      v.addColorStop(1, 'rgba(7,11,26,0.75)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, size, size);
      ctx.restore();
    }
    if (frame) {
      roundRectPath(ctx, inset, inset, size - inset * 2, size - inset * 2, r);
      ctx.lineWidth = Math.max(2, size * 0.022);
      ctx.strokeStyle = rgba(accent, 0.95);
      ctx.shadowColor = accent; ctx.shadowBlur = size * 0.04;
      ctx.stroke();
      ctx.shadowBlur = 0;
      roundRectPath(ctx, inset * 2.2, inset * 2.2, size - inset * 4.4, size - inset * 4.4, r * 0.8);
      ctx.lineWidth = Math.max(1, size * 0.006);
      ctx.strokeStyle = 'rgba(234,242,255,0.25)';
      ctx.stroke();
    }
  } catch (e) {
    // never break menus because of art
    if (typeof console !== 'undefined') console.warn('[portrait]', charId, e);
  }
  cache.set(key, cv);
  return cv;
}

/** cached PNG data URL of renderPortrait(charId, size) */
export function portraitURL(charId, size = 256) {
  const key = charId + '|' + size;
  let u = urlCache.get(key);
  if (u !== undefined) return u;
  const cv = renderPortrait(charId, size);
  try { u = cv && cv.toDataURL ? cv.toDataURL('image/png') : ''; } catch { u = ''; }
  urlCache.set(key, u);
  return u;
}

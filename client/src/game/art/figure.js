// Phaser-free: draw a whole posed figure onto a Canvas2D context with the same parts as the atlas.
import { NB, J, D2R, solveRig, lowestY } from './rig.js';

const HIDDEN_BY_DEFAULT = { prop: 1, staffHand: 1 };
const bones = new Float32Array(NB * 3);

/**
 * Draws spec's parts in pose `pose` with feet at (0,0) in the ctx's current transform.
 * Returns the bones array (shared scratch, valid until the next call).
 */
export function drawFigure(ctx, spec, pose, opts = {}) {
  solveRig(spec, pose, bones);
  const snap = -lowestY(spec, bones) + pose[J.RY];
  const dx = pose[J.RX];
  const show = opts.show || null;
  for (let i = 0; i < spec.parts.length; i++) {
    const p = spec.parts[i];
    if (HIDDEN_BY_DEFAULT[p.dyn] && !(show && show[p.dyn])) continue;
    if (opts.skip && opts.skip(p)) continue;
    const bi = p.bone * 3;
    let x = bones[bi] + dx, y = bones[bi + 1] + snap;
    const r = bones[bi + 2];
    if (p.ox || p.oy) {
      const c = Math.cos(r), s = Math.sin(r);
      x += p.ox * c - p.oy * s;
      y += p.ox * s + p.oy * c;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r + p.rot * D2R);
    p.draw(ctx);
    ctx.restore();
  }
  bones.snap = snap;
  return bones;
}

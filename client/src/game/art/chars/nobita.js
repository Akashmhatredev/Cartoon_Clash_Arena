// Fighter art: Nobita. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import {
  DARK, LW, OUT, assemble, dotEyes, ear, fist, mk, openMouth, shoe, smile, tunicPath,
} from './kit.js';

const PAL_NOBITA = { primary: '#ffd84a', secondary: '#2d4f9e', accent: '#22e4ff', skin: '#ffd8b8' };

/** limb with a flared cloth hem over its top (short sleeve or shorts leg) */
function hemLimb(ctx, len, r1, r2, cloth, skin, frac, flare, dim, bulge) {
  D.limb(ctx, len, r1, r2, [[0, skin]], dim, false, { bulge });
  const h = len * frac, w0 = r1 + 1, w1 = r1 + flare;
  const path = (k) => {
    k.beginPath();
    k.moveTo(-w0, -r1 * 0.6);
    k.quadraticCurveTo(0, -r1 * 1.3, w0, -r1 * 0.6);
    k.lineTo(w1, h);
    k.quadraticCurveTo(0, h + 2, -w1, h);
    k.closePath();
  };
  D.shaded(ctx, path, cloth, (k) => {
    k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-w1 - 2, -r1 * 2, w1 * 0.8, h + r1 * 3);
    k.fillStyle = 'rgba(255,255,255,0.18)'; k.fillRect(w1 * 0.25, -r1, w1 * 0.28, h + 2);
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-w1 - 2, -r1 * 2, w1 * 2 + 4, h + r1 * 3); }
  }, LW * 0.8);
}

/** thin eyebrow; tilt raises (+) or lowers (-) the inner end (inner = right end for the near brow) */
function brow(ctx, x1, y1, x2, y2, w, innerAtEnd, tilt) {
  if (innerAtEnd) y2 -= tilt; else y1 -= tilt;
  D.curve(ctx, x1, y1, (x1 + x2) / 2, Math.min(y1, y2) - 1.2, x2, y2, w, OUT);
}

// Nobita: ten years old (~140 cm), about three heads tall and visibly skinny. Round face under a neat black
// helmet of hair, big round black-rimmed glasses (far lens foreshortened and poking past the face), small dot
// eyes, yellow short-sleeve shirt with a collar, navy shorts, white socks, blue shoes.
function nobita(c) {
  const s = mk({ headW: 56, headH: 55, neck: 3, torsoLen: 45, torsoW: 32, pelvisDrop: 10,
    uArm: 21, lArm: 19, armR: 4.6, armR2: 3.9, handR: 5.6, uLeg: 26, lLeg: 25, legR: 5.8, legR2: 4.5, footL: 20, footH: 9,
    shY: 40, shXF: 3, shXB: -6, hipXF: 6, hipXB: -5 });
  const yel = c.primary, navy = PAL_NOBITA.secondary, skin = c.skin, shoeCol = '#3f70c8';
  const lens = D.mix(skin, '#ffffff', 0.45);
  const face = (k) => D.blobPath(k, [6, 2, 26, -3, 31, -26, 25, -50, 1, -58, -22, -51, -28, -27, -19, -4]);
  // hair helmet: covers the crown and back of the head, straight fringe across the forehead, short at the nape
  const hair = (k) => {
    k.beginPath();
    k.moveTo(-24, -11);
    k.quadraticCurveTo(-33, -30, -28, -47);
    k.quadraticCurveTo(-18, -61, 3, -61);
    k.quadraticCurveTo(22, -60, 29.5, -46);
    k.lineTo(30, -42.5);
    k.quadraticCurveTo(26, -44.5, 22.5, -42);
    k.quadraticCurveTo(16, -45, 10.5, -42);
    k.quadraticCurveTo(4.5, -44.5, -0.5, -40.5);
    k.quadraticCurveTo(-5, -37.5, -8, -33);
    k.quadraticCurveTo(-16, -35, -18, -26);
    k.quadraticCurveTo(-19, -15, -24, -11);
    k.closePath();
  };
  const d = {
    head(ctx, e) {
      D.shaded(ctx, face, skin, (k) => { k.fillStyle = 'rgba(11,15,30,0.09)'; k.fillRect(-32, -62, 12, 66); });
      ear(ctx, -11, -24, skin, 4.6, 6.2);
      D.shaded(ctx, hair, DARK, (k) => {
        D.curve(k, -18, -52, -2, -60, 16, -56, 2.2, 'rgba(255,255,255,0.2)');
        D.line(k, -12, -44, -18, -36, 1.2, 'rgba(255,255,255,0.12)');
      });
      // thin brows just under the fringe
      const t = e === 'shout' ? -1.6 : e === 'hurt' ? 1.6 : 0;
      brow(ctx, 8, -39.5, 17, -40.2, 1.7, true, t);
      brow(ctx, 24.5, -40.2, 29.5, -39.5, 1.5, false, t);
      // big round glasses: near lens a full circle, far lens foreshortened and breaking the face outline;
      // the glass is a pale wash of skin so the small dot eyes read through it
      D.line(ctx, 4.5, -29.5, -8, -27.5, 2.2);
      D.ellipsePath(ctx, 28.4, -28, 5.2, 8.6); ctx.fillStyle = lens; ctx.fill();
      D.ellipsePath(ctx, 13.5, -28, 9, 9); ctx.fill();
      dotEyes(ctx, e, [[14, -28, 2.3, 2.7], [28, -28, 1.7, 2.6]], 1.6);
      D.ellipsePath(ctx, 28.4, -28, 5.2, 8.6); D.fillStroke(ctx, null, LW * 0.95);
      D.ellipsePath(ctx, 13.5, -28, 9, 9); D.fillStroke(ctx, null, LW * 0.95);
      D.line(ctx, 22.3, -29.5, 23.4, -29.5, 2.2);
      D.curve(ctx, 7.5, -31.5, 8.5, -35, 12, -35.8, 1.5, 'rgba(255,255,255,0.95)');
      D.line(ctx, 26.2, -32.5, 27.4, -34.8, 1.4, 'rgba(255,255,255,0.95)');
      // small nose and the mouth
      D.curve(ctx, 30, -21, 33, -18, 29.5, -16.5, 1.5);
      if (e === 'shout') openMouth(ctx, 20, -11, 11, 8);
      else if (e === 'hurt') { const mp = (k) => D.ellipsePath(k, 20, -11, 4.4, 3.2); D.shaded(ctx, mp, '#6b1020', null, LW * 0.6); }
      else smile(ctx, 15, -12, 24.5, -12, 2.8, 1.9);
    },
    headBox: [-38, -68, 42, 8],
    torso(ctx) {
      // navy shorts
      D.roundRectPath(ctx, -17, -13, 34, 23, 6); D.fillStroke(ctx, navy);
      D.line(ctx, 0, -12, 0, 10, LW * 0.45);
      // yellow shirt hanging straight over a narrow chest
      D.shaded(ctx, (k) => tunicPath(k, -46, 28, 33, -6), yel, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-24, -54, 8.5, 52);
        D.curve(k, 6, -38, 13, -28, 11, -12, 1.6, 'rgba(255,255,255,0.25)');
        D.line(k, -14, -8, 14, -8, 1, 'rgba(11,15,30,0.25)');
      });
      // shirt collar: two pointed flaps
      D.polyPath(ctx, [-8, -47, 3, -46, -3, -38.5]); D.fillStroke(ctx, yel, LW * 0.6);
      D.polyPath(ctx, [3, -46, 13, -47, 8, -38.5]); D.fillStroke(ctx, yel, LW * 0.6);
    },
    torsoBox: [-26, -56, 26, 16],
    uArm: (ctx, dim) => hemLimb(ctx, s.uArm, s.armR, s.armR * 0.94, yel, skin, 0.42, 2.8, dim, 0.06),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, skin]], dim, true, { bulge: 0.08 }),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => hemLimb(ctx, s.uLeg, s.legR, s.legR * 0.88, navy, skin, 0.3, 3.2, dim, 0.04),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.88, s.legR2, [[0, skin], [0.68, '#ffffff']], dim, true, { bulge: 0.1 }),
    foot: (ctx, dim) => shoe(ctx, s, shoeCol, '#f0f0f0', dim),
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  nobita: { body: { w: 64, h: 168, crouchH: 108 }, palette: PAL_NOBITA, build: nobita },
};

// Fighter art: Shinchan. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import {
  DARK, LW, OUT, assemble, dotEyes, ear, fist, grit, mk, openMouth, shoe, smile,
} from './kit.js';

const PAL_SHINCHAN = { primary: '#e8322b', secondary: '#ffd23f', accent: '#ff8a1f', skin: '#ffd8b8' };

/** caterpillar eyebrow: a thick round-capped arc; tilt raises (+) or lowers (-) the inner end */
function brow(ctx, x1, y1, x2, y2, w, arch, innerAtEnd, tilt) {
  if (innerAtEnd) y2 -= tilt; else y1 -= tilt;
  D.curve(ctx, x1, y1, (x1 + x2) / 2, Math.min(y1, y2) - arch, x2, y2, w, OUT);
}

/** short-trouser leg: skin limb with a flared cloth hem over the top */
function shortsLeg(ctx, len, r1, r2, cloth, skin, frac, dim) {
  D.limb(ctx, len, r1, r2, [[0, skin]], dim, false, { bulge: 0.2 });
  const h = len * frac, w0 = r1 + 1.2, w1 = r1 + 2.6;
  const path = (k) => {
    k.beginPath();
    k.moveTo(-w0, -r1 * 0.6);
    k.quadraticCurveTo(0, -r1 * 1.25, w0, -r1 * 0.6);
    k.lineTo(w1, h);
    k.quadraticCurveTo(0, h + 2.2, -w1, h);
    k.closePath();
  };
  D.shaded(ctx, path, cloth, (k) => {
    k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-w1 - 2, -r1 * 2, w1 * 0.8, h + r1 * 3);
    k.fillStyle = 'rgba(255,255,255,0.18)'; k.fillRect(w1 * 0.25, -r1, w1 * 0.3, h + 2);
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-w1 - 2, -r1 * 2, w1 * 2 + 4, h + r1 * 3); }
  }, LW * 0.85);
}

// Shinchan: five years old, about 2.3 heads tall. Huge flat-topped head whose lower front swells into a round
// puffy cheek, caterpillar eyebrows well below a black hair cap, big dark oval eyes, red tee, yellow shorts,
// white socks, yellow shoes (anime colours).
function shinchan(c) {
  const s = mk({ headW: 70, headH: 57, neck: -3, torsoLen: 38, torsoW: 42, pelvisDrop: 9,
    uArm: 15, lArm: 14, armR: 5.8, armR2: 5.2, handR: 6.2, uLeg: 19, lLeg: 17, legR: 7.2, legR2: 6.1, footL: 19, footH: 8,
    shY: 33, shXF: 5, shXB: -7, hipXF: 8, hipXB: -7 });
  const HS = 0.93; // head drawing scale (about 2.3 heads tall overall)
  const red = c.primary, yel = c.secondary, skin = c.skin;
  const shoeCol = '#ffd23f';
  // flat top, round back of the skull, and the famous cheek that bulges out low at the front
  const headPath = (k) => D.blobPath(k, [12, 4, 31, 3, 46, -8, 46, -27, 36, -37, 35, -52, 27, -62, 0, -63,
    -22, -62, -33, -52, -35, -30, -29, -11, -16, -1]);
  const d = {
    head(ctx, e) {
      ctx.save();
      ctx.scale(HS, HS);
      D.shaded(ctx, headPath, skin, (k) => {
        // hair cap: covers the top and the back of the skull, passes above the ear, straight fringe high on
        // the forehead (leaving room for the brows)
        k.beginPath();
        k.moveTo(-50, -4); k.lineTo(-28, -7);
        k.quadraticCurveTo(-19, -12, -19, -22);
        k.quadraticCurveTo(-18, -33, -8, -35);
        k.quadraticCurveTo(0, -38, 2, -47);
        k.lineTo(8, -51.5); k.lineTo(13, -50); k.lineTo(19, -52.5); k.lineTo(25, -51); k.lineTo(33, -53.5); k.lineTo(40, -53);
        k.lineTo(50, -72); k.lineTo(-50, -72); k.closePath();
        k.fillStyle = DARK; k.fill();
        k.beginPath();
        k.moveTo(-28, -7); k.quadraticCurveTo(-19, -12, -19, -22); k.quadraticCurveTo(-18, -33, -8, -35);
        k.quadraticCurveTo(0, -38, 2, -47); k.lineTo(8, -51.5); k.lineTo(13, -50); k.lineTo(19, -52.5);
        k.lineTo(25, -51); k.lineTo(33, -53.5); k.lineTo(40, -53);
        k.lineWidth = LW * 0.6; k.strokeStyle = OUT; k.lineJoin = 'round'; k.stroke();
        D.curve(k, -24, -52, -6, -60, 14, -57, 2.4, 'rgba(255,255,255,0.18)');
        // cel shade on the back of the face and a warm roundness on the cheek
        k.fillStyle = 'rgba(11,15,30,0.1)'; k.fillRect(-40, -72, 12, 80);
        D.dot(k, 35, -16, 9.5, 'rgba(255,150,130,0.2)');
        D.curve(k, 32, -30, 41, -24, 42, -13, 1.6, 'rgba(255,255,255,0.35)');
      });
      ear(ctx, -9, -22, skin, 5, 6.5);
      // the signature caterpillar eyebrows: thick, short and close together, sitting low over the eyes
      const tN = e === 'shout' ? -3.2 : e === 'hurt' ? 2.6 : 0;
      brow(ctx, 6, -41, 18, -42, 7.4, 2.2, true, tN);
      brow(ctx, 24, -42, 32, -40.5, 6.4, 1.6, false, tN);
      dotEyes(ctx, e, [[12.5, -30, 3.9, 5.9], [27, -29.5, 3.3, 5.4]], 2.4);
      // mouth sits on the puffy cheek
      if (e === 'shout') openMouth(ctx, 27, -13, 16, 12);
      else if (e === 'hurt') grit(ctx, 27, -13, 12, 6);
      else {
        smile(ctx, 20, -15.5, 34, -16, 5.6, 2.4);
        D.curve(ctx, 33, -18, 35.5, -16.5, 34, -14, 1.4);
      }
      ctx.restore();
    },
    headBox: [-40, -70, 52, 10],
    torso(ctx) {
      // yellow shorts
      const sp = (k) => { k.beginPath(); k.moveTo(-21, -12); k.lineTo(21, -12); k.quadraticCurveTo(25, 2, 21, 10); k.lineTo(-21, 10); k.quadraticCurveTo(-25, 2, -21, -12); k.closePath(); };
      D.shaded(ctx, sp, yel, (k) => { D.line(k, 3, -3, 3, 10, LW * 0.5); k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-26, -14, 10, 30); });
      // red tee with a round toddler belly, hem flaring over the waistband
      const shirt = (k) => {
        k.beginPath(); k.moveTo(-16, -37); k.quadraticCurveTo(2, -41, 18, -37);
        k.quadraticCurveTo(28, -23, 25, -6); k.quadraticCurveTo(2, -1, -22, -6); k.quadraticCurveTo(-25, -23, -16, -37); k.closePath();
      };
      D.shaded(ctx, shirt, red, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-28, -42, 11, 40);
        D.curve(k, 10, -27, 22, -20, 20, -9, 1.8, 'rgba(255,255,255,0.24)');
        D.curve(k, -8, -5, -2, -9, 6, -7, 1, 'rgba(11,15,30,0.3)');
      });
      // round neckline
      D.curve(ctx, -5, -38.5, 3, -33.5, 11, -38.5, LW * 0.6);
    },
    torsoBox: [-30, -48, 32, 18],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.96, [[0, red], [0.5, skin]], dim, true, { bulge: 0.22 }),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, skin]], dim, true, { bulge: 0.2 }),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => shortsLeg(ctx, s.uLeg, s.legR, s.legR * 0.95, yel, skin, 0.42, dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.94, s.legR2, [[0, skin], [0.6, '#ffffff']], dim, true, { bulge: 0.18 }),
    foot: (ctx, dim) => shoe(ctx, s, shoeCol, D.shade(shoeCol, 0.72), dim),
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  shinchan: { body: { w: 72, h: 138, crouchH: 94 }, palette: PAL_SHINCHAN, build: shinchan },
};

// Fighter art: Ninja Hattori. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import { B } from '../rig.js';
import {
  LW, OUT, assemble, brows, fist, grit, mk, openMouth, part, ribbon, shoe, smile, squeeze, tunicPath,
} from './kit.js';

const PAL_HATTORI = { primary: '#2f63d8', secondary: '#ffcc33', accent: '#2f6bff', skin: '#ffd8b8' };
const ROSY = 'rgba(255,96,120,0.5)';
const LATTICE = 'rgba(176,96,0,0.62)';

/** acorn-shaped solid eye (rounded bottom, softly pointed top) with one highlight */
function acorn(ctx, x, y, rx, ry) {
  ctx.beginPath();
  ctx.moveTo(x, y - ry);
  ctx.quadraticCurveTo(x + rx * 1.2, y - ry * 0.4, x + rx, y + ry * 0.35);
  ctx.quadraticCurveTo(x + rx * 0.9, y + ry, x, y + ry);
  ctx.quadraticCurveTo(x - rx * 0.9, y + ry, x - rx, y + ry * 0.35);
  ctx.quadraticCurveTo(x - rx * 1.2, y - ry * 0.4, x, y - ry);
  ctx.closePath();
  ctx.fillStyle = OUT; ctx.fill();
  D.dot(ctx, x + rx * 0.28, y - ry * 0.18, Math.min(rx, ry) * 0.42, '#ffffff');
}

/** diagonal cross-hatch (the yellow inner layer's pattern); call inside a clip */
function lattice(k, x0, y0, x1, y1, step) {
  k.strokeStyle = LATTICE; k.lineWidth = 0.9; k.lineCap = 'round';
  k.beginPath();
  const h = y1 - y0;
  for (let x = x0 - h; x < x1 + h; x += step) { k.moveTo(x, y0); k.lineTo(x + h, y1); k.moveTo(x + h, y0); k.lineTo(x, y1); }
  k.stroke();
}

// Ninja Hattori: eleven-year-old Iga ninja (~140 cm), about 2.7 heads tall. Blue cloth hood tied at the back around
// a big round, rosy-cheeked face; blue V-neck robe with sleeves folded to the elbow over yellow cross-patterned inner
// sleeves; blue pants; red ribbon belt tied in a bow; katana on the back (our addition).
function hattori(c) {
  const s = mk({ headW: 60, headH: 58, neck: 0, torsoLen: 46, torsoW: 38, pelvisDrop: 10,
    uArm: 21, lArm: 20, armR: 6, armR2: 5, handR: 6, uLeg: 22, lLeg: 22, legR: 7.8, legR2: 6, footL: 19, footH: 9,
    shY: 41, shXF: 4, shXB: -8 });
  const blue = c.primary, dblue = D.shade(c.primary, 0.8), lblue = D.shade(c.primary, 1.14);
  const yellow = c.secondary && c.secondary !== '#1a2550' ? c.secondary : '#ffcc33';
  const skin = c.skin, belt = '#e8322b', dbelt = D.shade('#e8322b', 0.78);
  const hood = (k) => D.blobPath(k, [20, 2, 32, -9, 36, -28, 31, -48, 12, -61, -10, -59, -26, -47, -32, -31, -27, -13, -13, 0, 3, 5]);
  const face = (k) => D.blobPath(k, [14.5, -5, 29.5, -10, 34.5, -27, 29.5, -43, 14.5, -48.5, 0, -43, -5.5, -27, 0, -10]);
  const vneck = (k) => D.polyPath(k, [-3, -47, 21, -47, 9, -23]);
  const foldedSleeve = (ctx, dim) => {
    const r = s.armR * 0.96, L = s.lArm * 0.34;
    const p = (k) => { k.beginPath(); k.moveTo(-r - 1.6, -r * 0.4); k.lineTo(r + 1.6, -r * 0.4); k.lineTo(r + 2.4, L); k.quadraticCurveTo(0, L + 2, -r - 2.4, L); k.closePath(); };
    D.shaded(ctx, p, blue, (k) => {
      D.line(k, -r - 3, L * 0.45, r + 3, L * 0.45, 1, dblue);
      k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-r - 4, -r, r * 0.9, L + r + 4);
      if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-r - 4, -r - 2, r * 2 + 8, L + r + 6); }
    }, LW * 0.8);
  };
  const d = {
    head(ctx, e) {
      // cloth hood wrapped around the whole head, folds gathering toward the knot at the back
      D.shaded(ctx, hood, blue, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-36, -64, 12, 70);
        D.curve(k, -2, -58, 16, -63, 32, -44, 5, 'rgba(255,255,255,0.12)');
        D.curve(k, -6, -50, -16, -42, -26, -34, 1.3, dblue);
        D.curve(k, -7, -14, -16, -18, -26, -27, 1.3, dblue);
        // fabric lip around the face opening
        D.curve(k, 2, -50, -9, -31, 3, -7, 2.2, lblue);
        D.curve(k, 2, -50, 16, -54, 30, -45, 2, lblue);
        D.curve(k, 4, -4, 18, 0, 31, -9, 1.6, lblue);
      });
      D.shaded(ctx, face, skin, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.07)'; k.fillRect(-6, -50, 8, 46);
        D.dot(k, 5.5, -19, 4.6, ROSY); D.dot(k, 31, -19.5, 3.6, ROSY);
      }, LW * 0.8);
      // the knot at the back of the head
      const knot = (k) => D.blobPath(k, [-26, -36, -32, -37, -36, -31, -34, -24, -28, -24, -25, -29]);
      D.shaded(ctx, knot, blue, (k) => { k.fillStyle = 'rgba(11,15,30,0.18)'; k.fillRect(-40, -40, 6, 20); }, LW * 0.7);
      D.curve(ctx, -30, -35, -28, -30, -31, -25.5, 1.1, dblue);
      brows(ctx, e, [[7, -37, 14, -38.2, 2.7], [19, -38.2, 25, -37.2, 2.4]]);
      const eyes = [[11, -29.5, 2.8, 4.3], [22, -29.5, 2.4, 3.9]];
      for (let i = 0; i < 2; i++) {
        const [x, y, rx, ry] = eyes[i];
        if (e === 'blink') D.curve(ctx, x - rx * 1.3, y + 0.5, x, y + ry * 0.7, x + rx * 1.3, y + 0.5, 2);
        else if (e === 'hurt') squeeze(ctx, x, y, rx * 1.1, ry * 0.9, i === 0, 2);
        else acorn(ctx, x, y, e === 'shout' ? rx * 1.08 : rx, e === 'shout' ? ry * 1.08 : ry);
      }
      D.curve(ctx, 28, -25.5, 30, -24, 28.2, -22.6, 1.3);
      if (e === 'shout') openMouth(ctx, 18, -16.5, 10.5, 8);
      else if (e === 'hurt') grit(ctx, 18, -16.5, 9.5, 4.4);
      else { smile(ctx, 12, -18.5, 24, -18.5, 4.6, 2); D.line(ctx, 11.4, -19.2, 12.6, -17.8, 1.3); }
    },
    headBox: [-42, -66, 42, 10],
    torso(ctx) {
      D.roundRectPath(ctx, -19, -12, 38, 22, 6); D.fillStroke(ctx, dblue);
      D.shaded(ctx, (k) => tunicPath(k, -48, 36, 41, -5), blue, (k) => {
        // V-neck showing the yellow cross-patterned inner layer
        vneck(k); k.fillStyle = yellow; k.fill();
        k.save(); vneck(k); k.clip(); lattice(k, -4, -48, 22, -22, 3.6); k.restore();
        D.line(k, -3, -47, 9, -23, LW * 0.75); D.line(k, 21, -47, 9, -23, LW * 0.75);
        D.curve(k, -12, -38, -14, -30, -12, -22, 1.1, dblue);
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-26, -56, 10, 52);
        k.fillStyle = 'rgba(255,255,255,0.1)'; k.fillRect(14, -44, 5, 30);
      });
      // red ribbon belt tied in a bow at the front
      D.roundRectPath(ctx, -21, -20, 42, 7, 3); D.fillStroke(ctx, belt, LW * 0.8);
      D.line(ctx, -19, -16.5, 19, -16.5, 1, dbelt);
      ctx.save(); ctx.translate(13, -16.5);
      D.ellipsePath(ctx, -5, -3.4, 5.4, 3.4, 0.5); D.fillStroke(ctx, belt, LW * 0.6);
      D.ellipsePath(ctx, 5, -3.4, 5.4, 3.4, -0.5); D.fillStroke(ctx, belt, LW * 0.6);
      D.polyPath(ctx, [-2.5, 1, -6, 12, -1.5, 10.5]); D.fillStroke(ctx, belt, LW * 0.55);
      D.polyPath(ctx, [1.5, 1, 6.5, 11, 2.5, 11.5]); D.fillStroke(ctx, dbelt, LW * 0.55);
      D.ellipsePath(ctx, 0, -1, 2.8, 3); D.fillStroke(ctx, dbelt, LW * 0.6);
      ctx.restore();
    },
    torsoBox: [-28, -62, 28, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR * 1.04, s.armR, [[0, blue]], dim, true, { bulge: 0.14 }),
    lArm: (ctx, dim) => {
      const r1 = s.armR * 0.92, r2 = s.armR2;
      D.limb(ctx, s.lArm, r1, r2, [[0, yellow]], dim, false, { bulge: 0.08 });
      ctx.save(); D.limbPath(ctx, s.lArm, r1 - 1.6, r2 - 1.6, 0.08); ctx.clip();
      lattice(ctx, -r1, 0, r1, s.lArm + r2, 3.4);
      if (dim) { ctx.fillStyle = `rgba(11,15,30,${dim * 0.5})`; ctx.fillRect(-r1 - 2, -2, r1 * 2 + 4, s.lArm + r2 + 4); }
      ctx.restore();
      foldedSleeve(ctx, dim);
    },
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR * 1.04, s.legR * 0.96, [[0, dblue]], dim, true, { bulge: 0.14 }),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.94, s.legR2, [[0, dblue]], dim, true, { bulge: 0.12 }),
    foot: (ctx, dim) => {
      // dark tabi boots with the split-toe crease
      shoe(ctx, s, '#262b40', '#13151e', dim);
      D.curve(ctx, s.footL * 0.62, s.footH * 0.1, s.footL * 0.68, s.footH * 0.4, s.footL * 0.65, s.footH * 0.68, 1.1, 'rgba(255,255,255,0.28)');
    },
    behind: [
      part('sword', B.TORSO, (ctx) => {
        D.roundRectPath(ctx, -3.6, -26, 7.2, 54, 3); D.fillStroke(ctx, '#2a2230', LW * 0.8);
        D.line(ctx, 1, -22, 1, 24, 1.2, 'rgba(255,255,255,0.25)');
        D.ellipsePath(ctx, 0, -27, 7, 2.4); D.fillStroke(ctx, '#ffc83a', LW * 0.6);
        D.roundRectPath(ctx, -2.6, -44, 5.2, 16, 2); D.fillStroke(ctx, '#f1ece0', LW * 0.6);
        for (let y = -41; y < -30; y += 4) D.line(ctx, -2.4, y, 2.4, y + 2.5, 1, '#3b3550');
      }, [-12, -52, 12, 34], { ox: -9, oy: -26, rot: -40 }),
      // two short hood-tie ends flaring out of the knot
      part('trail', B.HEAD, (ctx) => {
        ctx.rotate(-0.32); ribbon(ctx, 13, 5.4, blue, 2.5);
        ctx.rotate(0.62); ribbon(ctx, 11, 5, dblue, 1.5);
      }, [-16, -6, 16, 22], { ox: -32, oy: -29, rot: 52, dyn: 'trail' }),
      part('beltTrail', B.TORSO, (ctx) => { ribbon(ctx, 18, 5.5, belt, 3); }, [-12, -4, 14, 26], { ox: -17, oy: -16, rot: 40, dyn: 'trail' }),
    ],
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  hattori: { body: { w: 66, h: 166, crouchH: 108 }, palette: PAL_HATTORI, build: hattori },
};

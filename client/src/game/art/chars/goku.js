// Fighter art: Kid Goku. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import { B } from '../rig.js';
import {
  DARK, LW, OUT, assemble, brows, fist, grit, mk, openMouth, part, shoe, smile, squeeze, staffDraw, tunicPath,
} from './kit.js';

const PAL_GOKU = { primary: '#ff8a1f', secondary: '#2550c8', accent: '#5fd0ff', skin: '#ffd8b8' };

/** closed outline through alternating valley/tip points with gently curved sides (spiky hair) */
function spikyPath(k, pts, bend) {
  const n = pts.length / 2;
  k.beginPath();
  k.moveTo(pts[0], pts[1]);
  for (let i = 1; i <= n; i++) {
    const x0 = pts[((i - 1) % n) * 2], y0 = pts[((i - 1) % n) * 2 + 1];
    const x1 = pts[(i % n) * 2], y1 = pts[(i % n) * 2 + 1];
    const dx = x1 - x0, dy = y1 - y0;
    k.quadraticCurveTo((x0 + x1) / 2 - dy * bend, (y0 + y1) / 2 + dx * bend, x1, y1);
  }
  k.closePath();
}

/** stroke only segments [from, to) of a spikyPath outline (hairline edges that must not outline the crown) */
function spikyEdge(k, pts, bend, from, to, lw) {
  const n = pts.length / 2;
  k.beginPath();
  k.moveTo(pts[from * 2], pts[from * 2 + 1]);
  for (let i = from + 1; i <= to; i++) {
    const x0 = pts[((i - 1) % n) * 2], y0 = pts[((i - 1) % n) * 2 + 1];
    const x1 = pts[(i % n) * 2], y1 = pts[(i % n) * 2 + 1];
    const dx = x1 - x0, dy = y1 - y0;
    k.quadraticCurveTo((x0 + x1) / 2 - dy * bend, (y0 + y1) / 2 + dx * bend, x1, y1);
  }
  k.lineWidth = lw; k.strokeStyle = OUT; k.lineCap = 'round'; k.lineJoin = 'round'; k.stroke();
}

/** big round anime eye: white, large black pupil looking forward, one highlight */
function roundEye(ctx, x, y, rx, ry, pupil) {
  D.ellipsePath(ctx, x, y, rx, ry);
  D.fillStroke(ctx, '#ffffff', LW * 0.6);
  D.ellipsePath(ctx, x + rx * 0.2, y + ry * 0.08, rx * pupil, ry * pupil * 1.08);
  ctx.fillStyle = OUT; ctx.fill();
  D.dot(ctx, x + rx * 0.38, y - ry * 0.22, Math.min(rx, ry) * 0.3, '#ffffff');
}

// Kid Goku: small kid (~110-124 cm), about 3 heads tall with the hair. Wild spiky black hair radiating up and back
// with jagged bangs over the forehead, big round eyes, orange Turtle School gi with a blue sash, blue wristbands and
// kung-fu shoes, brown monkey tail and the red Power Pole slung across his back.
function goku(c) {
  const s = mk({ headW: 50, headH: 48, neck: 1, torsoLen: 38, torsoW: 38, pelvisDrop: 10,
    uArm: 18, lArm: 17, armR: 6.2, armR2: 5.1, handR: 6.4, uLeg: 20, lLeg: 20, legR: 8.2, legR2: 6.4, footL: 20, footH: 9,
    shY: 33, tail: { x: -18, y: 4, base: -70 } });
  const gi = c.primary, dgi = D.shade(c.primary, 0.82), blue = PAL_GOKU.secondary, skin = c.skin, boot = D.shade(PAL_GOKU.secondary, 0.72);
  const back = [24, -37, 37, -58, 17, -56, 17, -87, 2, -63, -14, -87, -14, -62, -40, -78, -28, -52, -56, -57, -32, -40,
    -57, -29, -31, -26, -46, -8, -24, -14, -28, 4, -10, -6];
  // crown (indices 0-4, hidden inside the back hair) then the jagged hairline and the sideburn lock
  const bangs = [-21, -28, -19, -42, -6, -51, 10, -52, 23, -46, 27, -38, 31, -28, 22, -38, 19.5, -29, 13, -39.5, 8, -30, 2, -39,
    -2.5, -31, -7, -36, -6, -13, -13, -25];
  const fp = (k) => D.blobPath(k, [4, 1, 21.5, -5, 26.5, -21, 21.5, -40, 3, -47, -15, -42, -21, -22, -15, -4]);
  const d = {
    head(ctx, e) {
      // back hair: big spikes radiating up and back
      D.shaded(ctx, (k) => spikyPath(k, back, 0.1), DARK, (k) => {
        k.strokeStyle = 'rgba(255,255,255,0.1)'; k.lineWidth = 1.5; k.lineCap = 'round';
        k.beginPath(); k.moveTo(-8, -58); k.quadraticCurveTo(-11, -68, -13, -78); k.moveTo(-22, -48); k.quadraticCurveTo(-36, -54, -50, -55);
        k.moveTo(6, -60); k.quadraticCurveTo(12, -70, 15, -79); k.stroke();
      });
      D.shaded(ctx, fp, skin, (k) => { k.fillStyle = 'rgba(11,15,30,0.09)'; k.fillRect(-26, -48, 12, 52); });
      // ear tucked under the side hair
      D.ellipsePath(ctx, -12, -19, 4.4, 5.8, 0.15); D.fillStroke(ctx, skin, LW * 0.7);
      D.curve(ctx, -11, -22.5, -14.5, -19, -11.5, -15.5, 1.2, D.shade(skin, 0.6));
      // jagged bangs over the forehead and a sideburn lock in front of the ear
      spikyPath(ctx, bangs, 0.06); ctx.fillStyle = DARK; ctx.fill();
      spikyEdge(ctx, bangs, 0.06, 4, 16, LW);
      D.curve(ctx, -4, -47, 8, -50, 18, -44, 1.6, 'rgba(255,255,255,0.14)');
      D.curve(ctx, 9, -45, 14, -40, 20, -33, 1.2, 'rgba(255,255,255,0.1)');
      brows(ctx, e, [[7.5, -31.2, 15, -32.4, 2.3], [18.8, -32.4, 24, -31.4, 2.1]]);
      const eyes = [[12, -21.5, 5.6, 6.9], [21.8, -21.5, 3.7, 6.3]];
      for (let i = 0; i < 2; i++) {
        const [x, y, rx, ry] = eyes[i];
        if (e === 'blink') D.curve(ctx, x - rx * 1.1, y + 0.5, x, y + ry * 0.62, x + rx * 1.1, y + 0.5, 2.1);
        else if (e === 'hurt') squeeze(ctx, x, y, rx, ry * 0.8, i === 0, 2.1);
        else roundEye(ctx, x, y, rx, ry, e === 'shout' ? 0.48 : 0.7);
      }
      D.curve(ctx, 23.6, -17.5, 25.6, -15.2, 23.2, -14.2, 1.4);
      if (e === 'shout') openMouth(ctx, 17, -9.5, 11, 8);
      else if (e === 'hurt') grit(ctx, 17, -9.5, 9.5, 4.4);
      else smile(ctx, 12.5, -10, 21.5, -10, 3.6, 2);
    },
    headBox: [-66, -94, 42, 10],
    torso(ctx) {
      D.roundRectPath(ctx, -20, -13, 40, 23, 6); D.fillStroke(ctx, gi);
      D.shaded(ctx, (k) => tunicPath(k, -40, 36, 40, -6), gi, (k) => {
        // wrap collar crossing to the sash
        D.curve(k, -12, -41, -2, -26, 10, -14, LW * 0.6);
        D.curve(k, -8, -41, 2, -36, 6, -30, 1.2, dgi);
        // Turtle School emblem: white circle with a stylised glyph
        D.circle(k, 9, -27, 6.4, '#ffffff', LW * 0.5);
        k.strokeStyle = OUT; k.lineWidth = 1.2; k.lineCap = 'round'; k.lineJoin = 'round';
        k.beginPath();
        k.moveTo(7.6, -31.2); k.lineTo(10.2, -30.2);
        k.rect(6.6, -29.4, 4.8, 3.6); k.moveTo(9, -29.4); k.lineTo(9, -25.8);
        k.moveTo(6.4, -24.2); k.lineTo(11.4, -24.2); k.quadraticCurveTo(12, -22.6, 10.6, -22.6);
        k.stroke();
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-28, -50, 10, 46);
        k.fillStyle = 'rgba(255,255,255,0.12)'; k.fillRect(15, -38, 4, 22);
      });
      // blue obi sash knotted at the front
      D.roundRectPath(ctx, -21, -16, 42, 7.5, 3); D.fillStroke(ctx, blue, LW * 0.8);
      D.roundRectPath(ctx, 11, -11, 4.4, 13, 1.6); D.fillStroke(ctx, blue, LW * 0.6);
      D.roundRectPath(ctx, 15.4, -11, 4.4, 10.5, 1.6); D.fillStroke(ctx, D.shade(blue, 0.85), LW * 0.6);
      D.roundRectPath(ctx, 11.5, -16.5, 7, 7.5, 2.2); D.fillStroke(ctx, blue, LW * 0.6);
    },
    torsoBox: [-28, -52, 28, 18],
    uArm: (ctx, dim) => {
      D.limb(ctx, s.uArm, s.armR, s.armR * 0.94, [[0, gi], [0.44, skin]], dim, true, { bulge: 0.18 });
      D.line(ctx, -s.armR - 1.2, s.uArm * 0.44, s.armR + 1.2, s.uArm * 0.44, LW * 0.8);
    },
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.94, s.armR2, [[0, skin], [0.6, blue]], dim, true, { bulge: 0.16 }),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR * 1.04, s.legR, [[0, gi]], dim, true, { bulge: 0.2 }),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.96, s.legR2, [[0, gi], [0.7, boot]], dim, true, { bulge: 0.14 }),
    foot: (ctx, dim) => shoe(ctx, s, boot, '#e8b45a', dim),
    tail: part('tail', B.TAIL, (ctx) => {
      const path = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-15, -16, -15, -40, 2, -42); ctx.quadraticCurveTo(13, -42, 10, -32); };
      path(); ctx.lineWidth = 10.5; ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.stroke();
      path(); ctx.lineWidth = 7; ctx.strokeStyle = '#8a5a2b'; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-8, -10); ctx.bezierCurveTo(-12, -20, -10, -34, 0, -38);
      ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.stroke();
    }, [-22, -50, 20, 8]),
    behind: [part('staffBack', B.TORSO, staffDraw(-100, 24), [-10, -108, 10, 32], { ox: -6, oy: -18, rot: -40, dyn: 'staffBack' })],
    beforeHandF: [part('staffHand', B.HF, staffDraw(-26, 104), [-10, -34, 10, 112], { oy: 4, dyn: 'staffHand' })],
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  goku: { body: { w: 70, h: 146, crouchH: 98 }, palette: PAL_GOKU, build: goku },
};

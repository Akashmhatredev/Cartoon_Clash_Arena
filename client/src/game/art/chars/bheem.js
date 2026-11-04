// Fighter art: Chhota Bheem. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import { B } from '../rig.js';
import {
  DARK, LW, assemble, bareFoot, brows, ear, fist, grit, mk, openMouth, part, ribbon, whiteEyes,
} from './kit.js';

const PAL_BHEEM = { primary: '#ff8a1f', secondary: '#ffcc33', accent: '#ff8a1f', skin: '#c98552' };

/** gold band around a limb (armlet / bracelet) in limb space, centred at y */
function band(ctx, y, r, h, gold, dim) {
  D.roundRectPath(ctx, -r - 1.2, y - h / 2, r * 2 + 2.4, h, h * 0.4); D.fillStroke(ctx, dim ? D.mix(gold, '#0b0f1e', dim) : gold, LW * 0.6);
  D.line(ctx, -r * 0.6, y - h * 0.12, r * 0.7, y - h * 0.12, 1, 'rgba(255,255,255,0.55)');
  D.dot(ctx, r * 0.35, y + h * 0.16, h * 0.18, '#d8261e');
}

// Chhota Bheem: strong nine-year-old from Dholakpur, about 3.2 heads tall and stocky. Big round face with large eyes,
// thick brows and a wide grin; short black hair with an upright tuft; brown skin; bare muscular chest with a gold
// pendant; yellow angavastra over one shoulder; orange dhoti with front pleats; gold armlets and bracelets; bare feet.
function bheem(c) {
  const s = mk({ headW: 50, headH: 50, neck: 1, torsoLen: 52, torsoW: 58, pelvisDrop: 14,
    uArm: 23, lArm: 21, armR: 9.4, armR2: 7.6, handR: 8.8, uLeg: 24, lLeg: 23, legR: 10.8, legR2: 7.2, footL: 21, footH: 9,
    shY: 46, shXF: 5, shXB: -12, hipXF: 9, hipXB: -8 });
  const dhoti = c.primary, dhotiDk = D.shade(dhoti, 0.72), scarf = PAL_BHEEM.secondary, skin = c.skin, skinDk = D.shade(skin, 0.72), gold = '#ffc83a';
  const d = {
    head(ctx, e) {
      const fp = (k) => D.blobPath(k, [3, -1, 22, -5, 27, -22, 22, -42, 2, -50, -18, -45, -25, -25, -18, -5]);
      D.shaded(ctx, fp, skin, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.12)'; k.fillRect(-30, -58, 12, 62);
        D.dot(k, 13, -13, 4, 'rgba(255,120,90,0.18)');
      });
      // short black hair: rounded cap with a widow's-peak hairline and sideburn, the upright tuft on the crown
      const hp = (k) => {
        k.beginPath(); k.moveTo(-24, -17); k.quadraticCurveTo(-30, -46, -4, -52); k.quadraticCurveTo(20, -55, 26, -38);
        k.quadraticCurveTo(19, -41, 13, -38.5); k.lineTo(9, -42); k.lineTo(4, -37); k.quadraticCurveTo(-3, -36, -4, -30);
        k.lineTo(-2, -22); k.lineTo(-7, -27); k.quadraticCurveTo(-14, -30, -17, -23); k.lineTo(-20, -14); k.closePath();
      };
      D.shaded(ctx, hp, DARK, (k) => {
        D.curve(k, -16, -44, 0, -51, 16, -47, 2.2, 'rgba(255,255,255,0.2)');
        D.curve(k, -22, -30, -16, -40, -6, -44, 1.2, 'rgba(255,255,255,0.12)');
      });
      const tuft = (k) => {
        k.beginPath(); k.moveTo(-6, -49); k.quadraticCurveTo(-12, -62, -2, -66); k.quadraticCurveTo(9, -67, 7, -58);
        k.quadraticCurveTo(3, -61, 0, -57); k.quadraticCurveTo(0, -53, 4, -50); k.closePath();
      };
      D.shaded(ctx, tuft, DARK, (k) => D.curve(k, -5, -56, -3, -63, 3, -64, 1.2, 'rgba(255,255,255,0.25)'), LW * 0.8);
      ear(ctx, -8, -22, skin, 5, 6.6);
      brows(ctx, e, [[6, -33.5, 15.5, -35.5, 3.2], [19, -35.5, 25.5, -33.5, 2.8]]);
      whiteEyes(ctx, e, [[11.5, -26.5, 4.6, 5.6], [21.8, -26.5, 3.8, 5.1]], '#3a2414', 0.56, 2.2);
      D.curve(ctx, 24, -22, 27.2, -18.5, 23.8, -16.6, 1.7);
      if (e === 'shout') openMouth(ctx, 17.5, -10.5, 12, 8.5);
      else if (e === 'hurt') grit(ctx, 17.5, -11, 11, 5);
      else {
        const mp = (k) => { k.beginPath(); k.moveTo(9.5, -14.5); k.quadraticCurveTo(17.5, -12.5, 25.5, -15); k.quadraticCurveTo(22.5, -6.5, 17, -7); k.quadraticCurveTo(11, -7.5, 9.5, -14.5); k.closePath(); };
        D.shaded(ctx, mp, '#ffffff', (k) => { D.ellipsePath(k, 18, -6.5, 5, 2.6); k.fillStyle = '#ff8f8f'; k.fill(); }, LW * 0.6);
      }
    },
    headBox: [-36, -72, 38, 8],
    torso(ctx) {
      // orange dhoti: wide waist wrap, pleated front panel tucked at the navel
      const dp = (k) => { k.beginPath(); k.moveTo(-27, -19); k.lineTo(27, -19); k.quadraticCurveTo(33, 0, 25, 15); k.quadraticCurveTo(12, 19, 1, 12); k.quadraticCurveTo(-11, 19, -26, 15); k.quadraticCurveTo(-33, 0, -27, -19); k.closePath(); };
      D.shaded(ctx, dp, dhoti, (k) => {
        D.line(k, -12, -14, -15, 10, 1.6, dhotiDk); D.line(k, 18, -14, 21, 10, 1.6, dhotiDk);
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-35, -20, 12, 40);
      });
      const pl = (k) => { k.beginPath(); k.moveTo(1, -16); k.lineTo(13, -16); k.lineTo(15, 22); k.quadraticCurveTo(8, 25, 0, 22); k.closePath(); };
      D.shaded(ctx, pl, D.shade(dhoti, 1.06), (k) => { D.line(k, 5, -14, 4.5, 22, 1.2, dhotiDk); D.line(k, 9.5, -14, 10, 22, 1.2, dhotiDk); }, LW * 0.7);
      // bare, broad, muscular chest
      const cp = (k) => { k.beginPath(); k.moveTo(-27, -50); k.quadraticCurveTo(0, -58, 29, -50); k.quadraticCurveTo(35, -36, 23, -18); k.lineTo(-23, -18); k.quadraticCurveTo(-35, -36, -27, -50); k.closePath(); };
      D.shaded(ctx, cp, skin, (k) => {
        // pecs, sternum and abs
        D.curve(k, -6, -40, 6, -33, 14, -38, 1.8, skinDk); D.curve(k, 14, -38, 22, -33, 30, -40, 1.8, skinDk);
        D.line(k, 13, -30, 13, -20, 1.3, skinDk);
        D.curve(k, 6, -26, 13, -24.5, 20, -26, 1.2, skinDk);
        D.dot(k, 13, -21.5, 1.2, skinDk);
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-37, -62, 13, 48);
        k.fillStyle = 'rgba(255,255,255,0.1)'; k.fillRect(20, -52, 5, 30);
        // yellow angavastra: over the near shoulder, across the chest to the far hip
        k.fillStyle = scarf; D.polyPath(k, [12, -62, 30, -54, -12, -14, -32, -20]); k.fill();
        D.line(k, 12, -62, -32, -20, LW * 0.7); D.line(k, 30, -54, -12, -14, LW * 0.7);
        D.line(k, 17, -54, -20, -19, 1.2, D.shade(scarf, 0.75)); D.line(k, 24, -52, -10, -20, 1, D.shade(scarf, 0.82));
      });
      // gold necklace with a round pendant and a red gem
      D.curve(ctx, -8, -52, 8, -42, 24, -51, 2.2, gold);
      D.curve(ctx, -8, -52, 8, -42, 24, -51, 0.8, D.shade(gold, 0.7));
      D.circle(ctx, 8.5, -40, 4.2, gold, LW * 0.6);
      D.dot(ctx, 8.5, -40, 1.8, '#d8261e');
      // waist knot
      D.roundRectPath(ctx, -27, -22, 54, 7.5, 3); D.fillStroke(ctx, dhotiDk, LW * 0.8);
      D.line(ctx, -20, -18.5, 20, -18.5, 1, D.shade(dhoti, 1.15));
    },
    torsoBox: [-40, -64, 40, 30],
    uArm: (ctx, dim) => {
      D.limb(ctx, s.uArm, s.armR, s.armR * 0.94, [[0, skin]], dim, true, { bulge: 0.28 });
      D.curve(ctx, s.armR * 0.3, s.uArm * 0.55, s.armR * 0.75, s.uArm * 0.72, s.armR * 0.3, s.uArm * 0.9, 1.3, skinDk);
      band(ctx, s.uArm * 0.3, s.armR * 1.02, 5, gold, dim);
    },
    lArm: (ctx, dim) => {
      D.limb(ctx, s.lArm, s.armR * 0.94, s.armR2, [[0, skin]], dim, true, { bulge: 0.24 });
      band(ctx, s.lArm * 0.8, s.armR2 * 1.05, 4.6, gold, dim);
    },
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => {
      D.limb(ctx, s.uLeg, s.legR, s.legR * 0.98, [[0, dhoti]], dim, true, { bulge: 0.18 });
      D.curve(ctx, -s.legR * 0.5, s.uLeg * 0.3, -s.legR * 0.1, s.uLeg * 0.6, -s.legR * 0.4, s.uLeg * 0.9, 1.3, dhotiDk);
    },
    lLeg: (ctx, dim) => {
      D.limb(ctx, s.lLeg, s.legR * 0.8, s.legR2, [[0, skin]], dim, true, { bulge: 0.18 });
      // dhoti hem gathered just below the knee
      const hm = (k) => { k.beginPath(); k.moveTo(-s.legR * 1.02, -4); k.lineTo(s.legR * 1.02, -4); k.lineTo(s.legR * 1.08, s.lLeg * 0.3); k.quadraticCurveTo(0, s.lLeg * 0.38, -s.legR * 1.06, s.lLeg * 0.3); k.closePath(); };
      hm(ctx); ctx.fillStyle = dim ? D.mix(dhoti, '#0b0f1e', dim) : dhoti; ctx.fill();
      ctx.beginPath(); ctx.moveTo(s.legR * 1.02, -4); ctx.lineTo(s.legR * 1.08, s.lLeg * 0.3); ctx.quadraticCurveTo(0, s.lLeg * 0.38, -s.legR * 1.06, s.lLeg * 0.3); ctx.lineTo(-s.legR * 1.02, -4);
      D.fillStroke(ctx, null, LW);
      D.line(ctx, -s.legR * 0.3, 0, -s.legR * 0.2, s.lLeg * 0.28, 1.2, dhotiDk);
    },
    foot: (ctx, dim) => bareFoot(ctx, s, skin, dim),
    behind: [part('trail', B.TORSO, (ctx) => { ribbon(ctx, 40, 12, scarf, 5); }, [-17, -6, 19, 46], { ox: -20, oy: -52, rot: 32, dyn: 'trail' })],
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  bheem: { body: { w: 90, h: 160, crouchH: 106 }, palette: PAL_BHEEM, build: bheem },
};

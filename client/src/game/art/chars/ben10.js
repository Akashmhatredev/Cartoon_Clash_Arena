// Fighter art: Ben 10 and his alien forms (Four Arms, XLR8, Heatblast). Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import { B } from '../rig.js';
import {
  LW, assemble, bareFoot, brows, ear, fist, grit, mk, openMouth, part, shoe, smile, tunicPath, whiteEyes,
} from './kit.js';

const PAL_BEN10 = { primary: '#2fbf4a', secondary: '#16181f', accent: '#7dff4a', skin: '#ffd2ae' };
const PAL_FOURARMS = { primary: '#d8392b', secondary: '#1b1d26', accent: '#ff5a3a', skin: '#d8392b' };
const PAL_XLR8 = { primary: '#2f6bff', secondary: '#14161f', accent: '#22e4ff', skin: '#2f6bff' };
const PAL_HEATBLAST = { primary: '#8a2a14', secondary: '#ffb02e', accent: '#ff8a1f', skin: '#8a2a14' };

// ---- local helpers
const OMNI_GREEN = '#7dff4a';

/** Omnitrix dial: grey bezel, black face, green hourglass (two triangles meeting in the middle) */
function omniDial(ctx, x, y, r, face = '#16181f') {
  D.circle(ctx, x, y, r, '#4a4f60', LW * 0.6);
  D.circle(ctx, x, y, r * 0.74, face, LW * 0.35);
  const a = r * 0.46, b = r * 0.56;
  D.polyPath(ctx, [x - a, y - b, x + a, y - b, x, y, x + a, y + b, x - a, y + b, x, y]);
  ctx.fillStyle = OMNI_GREEN; ctx.fill();
  D.dot(ctx, x - r * 0.38, y - r * 0.42, r * 0.16, 'rgba(255,255,255,0.7)');
}

/** chunky Omnitrix watch on the wrist (lower-arm space, wrist at y) */
function omniWatch(ctx, y, rw) {
  D.roundRectPath(ctx, -rw - 2, y - 4.6, rw * 2 + 4, 9.2, 3.2); D.fillStroke(ctx, '#23262f', LW * 0.6);
  D.line(ctx, -rw - 1, y + 2, rw + 1, y + 2, 0.9, '#4a4f60');
  omniDial(ctx, 2.4, y - 0.4, 5.6);
}

/** black-and-white sneaker: black upper, white sole, white toe cap and side stripe */
function sneaker(ctx, s, dim) {
  const L = s.footL, h = s.footH, r = s.legR2;
  const up = (k) => {
    k.beginPath(); k.moveTo(-r - 1.5, -2.5); k.lineTo(-L * 0.32, h * 0.3); k.quadraticCurveTo(-L * 0.38, h, -L * 0.18, h);
    k.lineTo(L * 0.62, h); k.quadraticCurveTo(L * 0.92, h, L * 0.84, h * 0.38); k.quadraticCurveTo(L * 0.64, -h * 0.3, r * 0.9, -3);
    k.closePath();
  };
  D.shaded(ctx, up, '#1b1d26', (k) => {
    k.fillStyle = '#f4f6fb'; k.fillRect(-L, h * 0.66, L * 2, h);
    D.ellipsePath(k, L * 0.7, h * 0.5, L * 0.24, h * 0.42); k.fillStyle = '#f4f6fb'; k.fill(); D.fillStroke(k, null, LW * 0.45);
    D.line(k, -L, h * 0.66, L, h * 0.66, LW * 0.5);
    D.curve(k, -L * 0.12, h * 0.5, L * 0.12, h * 0.1, L * 0.36, -h * 0.05, LW * 0.8, '#f4f6fb');
    D.line(k, r * 0.4, -h * 0.05, L * 0.3, h * 0.1, 0.9, '#5a5f70');
    k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-L, -h, L * 0.72, h * 3);
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-L, -h, L * 2, h * 3); }
  });
}

// Ben 10 (classic): ten years old (~140 cm), about 3.6 heads tall. Swept brown hair with a forward fringe, green eyes,
// white T-shirt with a black stripe down the middle and a black crew collar, green cargo pants with thigh pockets,
// black-and-white sneakers, the chunky Omnitrix on his left (near) wrist.
function ben10(c) {
  const s = mk({ headW: 46, headH: 47, neck: 3, torsoLen: 50, torsoW: 38, pelvisDrop: 10,
    uArm: 24, lArm: 22, armR: 5.8, armR2: 5, handR: 6.2, uLeg: 29, lLeg: 28, legR: 8.2, legR2: 6, footL: 21, footH: 9,
    shY: 44 });
  const pants = D.mix(D.shade(c.primary, 0.66), '#4d6a2a', 0.3), pocket = D.shade(pants, 0.84), crease = D.shade(pants, 0.72);
  const skin = c.skin, hair = '#74441f', hairDk = D.shade(hair, 0.68), black = '#16181f', white = '#f4f6fb';
  const cuffR = s.legR * 0.86;
  const d = {
    head(ctx, e) {
      const fp = (k) => D.blobPath(k, [4, -1, 18, -3, 24, -14, 24.5, -28, 18, -42, 0, -47, -18, -42, -23, -23, -14, -5]);
      D.shaded(ctx, fp, skin, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.09)'; k.fillRect(-27, -55, 12, 60);
      });
      // swept brown hair: rounded crown, three forward locks over the forehead, sideburn in front of the ear
      const hp = (k) => {
        k.beginPath(); k.moveTo(-19, -9);
        k.quadraticCurveTo(-29, -22, -27.5, -37); k.quadraticCurveTo(-24, -55, -5, -57.5);
        k.quadraticCurveTo(14, -59, 22, -51); k.quadraticCurveTo(29, -46, 30.5, -37.5); k.lineTo(22, -39.5);
        k.lineTo(24.5, -32.5); k.lineTo(15.5, -36.5); k.lineTo(13.5, -31.5); k.lineTo(7, -35.5);
        k.quadraticCurveTo(1.5, -35, -1, -31); k.lineTo(1, -21); k.lineTo(-4.5, -27);
        k.quadraticCurveTo(-11, -31, -13.5, -24); k.lineTo(-14, -14); k.closePath();
      };
      D.shaded(ctx, hp, hair, (k) => {
        D.curve(k, -16, -47, -2, -56, 14, -52, 2.6, 'rgba(255,214,170,0.35)');
        D.curve(k, -20, -36, -14, -47, -4, -51, 1.4, hairDk);
        D.curve(k, -2, -47, 14, -50, 24, -40, 1.3, hairDk);
        D.curve(k, 1, -41, 10, -44, 17, -38, 1.2, hairDk);
        D.line(k, -18, -24, -12, -32, 1.2, hairDk);
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-34, -62, 12, 56);
      });
      ear(ctx, -6.5, -20, skin);
      brows(ctx, e, [[7, -31, 14, -32.2, 2.5], [18, -32.2, 23, -31, 2.2]], hairDk);
      whiteEyes(ctx, e, [[11.4, -24.6, 4.1, 5], [20.4, -24.6, 3.2, 4.6]], '#2fb54d', 0.4, 2);
      D.curve(ctx, 23.2, -21.5, 25.8, -18, 22.6, -16.4, 1.5);
      if (e === 'shout') openMouth(ctx, 17, -10, 10, 7.5);
      else if (e === 'hurt') grit(ctx, 17, -10.5, 9, 4.4);
      else { smile(ctx, 12.5, -10.5, 20.5, -12.2, 3, 2); D.line(ctx, 20, -12.2, 21.6, -14, 1.6); }
    },
    headBox: [-36, -64, 36, 8],
    torso(ctx) {
      // pants waist under the tee hem
      D.roundRectPath(ctx, -20, -14, 40, 24, 6); D.fillStroke(ctx, pants);
      D.line(ctx, 4, -8, 4, 9, LW * 0.45);
      D.line(ctx, -6, -12, -6, -4, 1.6, crease);
      // white tee: slightly loose, flared hem, black stripe down the middle
      const tp = (k) => {
        k.beginPath(); k.moveTo(-16, -51); k.quadraticCurveTo(0, -54, 17, -51);
        k.quadraticCurveTo(21, -32, 21.5, -6); k.quadraticCurveTo(10, -3, 0, -4.5); k.quadraticCurveTo(-11, -3, -21, -6);
        k.quadraticCurveTo(-21, -32, -16, -51); k.closePath();
      };
      D.shaded(ctx, tp, white, (k) => {
        k.fillStyle = black; k.beginPath(); k.moveTo(0, -60); k.lineTo(10, -60); k.lineTo(10.5, 2); k.lineTo(0.5, 2); k.closePath(); k.fill();
        D.line(k, 0, -60, 0.5, 2, LW * 0.45); D.line(k, 10, -60, 10.5, 2, LW * 0.45);
        D.curve(k, -14, -18, -8, -14, -3, -16, 1.1, 'rgba(11,15,30,0.3)');
        D.curve(k, 13, -14, 17, -12, 20, -16, 1.1, 'rgba(255,255,255,0.4)');
        k.fillStyle = 'rgba(11,15,30,0.13)'; k.fillRect(-26, -60, 10, 64);
      });
      // black crew collar
      D.curve(ctx, -11, -50.5, 3, -44, 15, -50.5, 3.4, black);
    },
    torsoBox: [-28, -62, 28, 16],
    uArm: (ctx, dim) => {
      D.limb(ctx, s.uArm, s.armR, s.armR * 0.96, [[0, skin]], dim, true, { bulge: 0.14 });
      // short white T-shirt sleeve, a little wider than the arm
      const L = s.uArm * 0.5, r = s.armR;
      const sp = (k) => { k.beginPath(); k.moveTo(-r * 1.12, 0); k.arc(0, 0, r * 1.12, Math.PI, 0); k.lineTo(r * 1.32, L); k.quadraticCurveTo(0, L + 1.6, -r * 1.3, L); k.closePath(); };
      sp(ctx); ctx.fillStyle = white; ctx.fill();
      ctx.save(); sp(ctx); ctx.clip();
      ctx.fillStyle = 'rgba(11,15,30,0.14)'; ctx.fillRect(-r * 2, -r * 2, r * 1.5, L + r * 3);
      if (dim) { ctx.fillStyle = `rgba(11,15,30,${dim})`; ctx.fillRect(-r * 2, -r * 2, r * 4, L + r * 3); }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(r * 1.12, 0); ctx.lineTo(r * 1.32, L); ctx.quadraticCurveTo(0, L + 1.6, -r * 1.3, L); ctx.lineTo(-r * 1.12, 0);
      D.fillStroke(ctx, null, LW);
    },
    lArm: (ctx, dim, front) => {
      D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, skin]], dim, true, { bulge: 0.12 });
      if (front) omniWatch(ctx, s.lArm * 0.84, s.armR2);
    },
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => {
      D.limb(ctx, s.uLeg, s.legR, s.legR * 0.95, [[0, pants]], dim, true, { bulge: 0.1 });
      // cargo pocket with a flap on the outer thigh
      const r = s.legR, y = s.uLeg * 0.42;
      D.roundRectPath(ctx, -r * 0.35, y, r * 1.15, s.uLeg * 0.4, 2); D.fillStroke(ctx, pocket, LW * 0.5);
      D.roundRectPath(ctx, -r * 0.42, y - 1.5, r * 1.29, 4.2, 1.5); D.fillStroke(ctx, pants, LW * 0.5);
      D.line(ctx, -r * 0.7, s.uLeg * 0.25, -r * 0.4, s.uLeg * 0.36, 1.1, crease);
    },
    lLeg: (ctx, dim) => {
      D.limb(ctx, s.lLeg, s.legR * 0.92, cuffR, [[0, pants]], dim, true, { bulge: 0.06 });
      D.curve(ctx, -s.legR * 0.6, 3, 0, 5.5, s.legR * 0.5, 2.5, 1.2, crease);
      D.line(ctx, -cuffR * 0.5, s.lLeg * 0.6, -cuffR * 0.1, s.lLeg * 0.78, 1.1, crease);
    },
    foot: (ctx, dim) => {
      sneaker(ctx, s, dim);
      // baggy pants hem resting on the sneaker
      const hp = (k) => { k.beginPath(); k.moveTo(-cuffR, -7); k.lineTo(cuffR, -7); k.lineTo(cuffR * 1.12, 0.5); k.quadraticCurveTo(0, 2.6, -cuffR * 1.12, 0.5); k.closePath(); };
      hp(ctx); ctx.fillStyle = dim ? D.mix(pants, '#0b0f1e', dim) : pants; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cuffR, -7); ctx.lineTo(cuffR * 1.12, 0.5); ctx.quadraticCurveTo(0, 2.6, -cuffR * 1.12, 0.5); ctx.lineTo(-cuffR, -7);
      D.fillStroke(ctx, null, LW);
      D.line(ctx, -cuffR * 0.3, -3, cuffR * 0.2, 0.8, 1, crease);
    },
  };
  s.parts = assemble(s, d);
  return s;
}

// Four Arms: towering red Tetramand, about 4.3 heads tall. Small heavy-browed head sunk into huge trapezius muscles,
// four yellow eyes (big pair over a smaller pair), wide jaw, no nose or ears. V-shaped torso with a black one-strap
// wrestling singlet, Omnitrix on the belt, black pants, black wristbands, four massive arms, big bare feet.
function fourarms(c) {
  const s = mk({ headW: 42, headH: 42, neck: -6, torsoLen: 92, torsoW: 88, pelvisDrop: 12,
    uArm: 32, lArm: 30, armR: 13.5, armR2: 11, handR: 13, uLeg: 34, lLeg: 32, legR: 15, legR2: 11.5, footL: 30, footH: 12,
    shY: 76, shY2: 52, shXF: 12, shXB: -18, hipXF: 12, hipXB: -11, fourArms: true });
  const red = c.primary, redDk = D.shade(red, 0.72), black = '#22252f', blackLn = '#3a3e4c', eyeY = '#ffd84a';
  const d = {
    head(ctx, e) {
      // heavy brow ridge (lower and angrier when shouting, raised when hurt)
      const by = e === 'shout' ? 1.5 : e === 'hurt' ? -1.5 : 0;
      const hp = (k) => D.blobPath(k, [-4, 4, 18, 4, 27, -2, 28, -11, 26, -17, 30, -25 + by, 26, -35, 11, -41, -5, -41, -16, -34, -19, -18, -13, -3]);
      D.shaded(ctx, hp, red, (k) => {
        k.fillStyle = D.shade(red, 0.9); k.beginPath(); k.moveTo(2, -35); k.quadraticCurveTo(16, -37, 31, -26 + by); k.lineTo(31, -22.5 + by); k.quadraticCurveTo(16, -27 + by, 4, -26); k.closePath(); k.fill();
        D.curve(k, 5, -26, 16, -27.5 + by, 30.5, -23 + by, 3);
        k.fillStyle = 'rgba(11,15,30,0.18)'; k.fillRect(-26, -48, 12, 54);
        D.curve(k, 4, -11, 3, -5, 8, 0, 1.6, redDk);
        D.curve(k, -12, -35, -4, -40, 9, -39, 2.2, 'rgba(255,255,255,0.18)');
      });
      const eyes = [[13.5, -20.4, 3.9, 2.8], [22.6, -20.1, 3.2, 2.6], [14, -13.9, 3.1, 2.3], [22.3, -13.7, 2.7, 2.1]];
      for (const [x, y, rx, ry] of eyes) {
        if (e === 'blink') D.curve(ctx, x - rx, y, x, y + ry * 0.6, x + rx, y, 1.8);
        else if (e === 'hurt') squeezeLine(ctx, x, y, rx * 0.8, '#0b0f1e');
        else { D.ellipsePath(ctx, x, y, rx, ry); D.fillStroke(ctx, eyeY, LW * 0.5); D.dot(ctx, x + rx * 0.3, y, Math.min(rx, ry) * 0.45, '#2a1a10'); }
      }
      if (e === 'shout') openMouth(ctx, 19.5, -4.5, 14, 8);
      else if (e === 'hurt') grit(ctx, 19.5, -5.5, 12.5, 4.6);
      else {
        D.curve(ctx, 10, -6.5, 18, -8, 27.5, -8.5, 2.6);
        D.curve(ctx, 12.5, -4.5, 19, -1.8, 25.5, -5, 1.6, redDk);
      }
    },
    headBox: [-28, -50, 36, 10],
    torso(ctx) {
      // black pants waist and belt
      D.roundRectPath(ctx, -30, -18, 60, 30, 8); D.fillStroke(ctx, black);
      const tp = (k) => {
        k.beginPath(); k.moveTo(-28, -14);
        k.quadraticCurveTo(-50, -48, -46, -78); k.quadraticCurveTo(-42, -93, -24, -95);
        k.quadraticCurveTo(-6, -102, 10, -100); k.quadraticCurveTo(32, -99, 45, -88);
        k.quadraticCurveTo(56, -72, 49, -57); k.quadraticCurveTo(38, -45, 33, -38);
        k.quadraticCurveTo(30, -26, 31, -14); k.closePath();
      };
      D.shaded(ctx, tp, red, (k) => {
        // trapezius and pec definition
        D.curve(k, -6, -96, -16, -88, -30, -88, 2, redDk);
        D.curve(k, 16, -96, 26, -90, 38, -88, 2, redDk);
        D.curve(k, -40, -74, -24, -62, -8, -70, 2, redDk);
        D.curve(k, -2, -88, -6, -80, -4, -72, 1.8, redDk);
        // one-strap black wrestling singlet: strap over the near shoulder, edge running down to the far armpit
        k.fillStyle = black;
        D.polyPath(k, [20, -106, 40, -106, 64, -84, 64, 12, -62, 12, -62, -40, -50, -46]); k.fill();
        D.line(k, 20, -106, -50, -46, LW * 0.7); D.line(k, 40, -106, 64, -84, LW * 0.7);
        // muscle shapes under the singlet
        D.curve(k, 12, -72, 26, -56, 46, -60, 1.6, blackLn);
        D.line(k, 8, -66, 8, -24, 1.4, blackLn);
        D.curve(k, -4, -46, 8, -43, 22, -46, 1.3, blackLn); D.curve(k, -4, -34, 8, -31, 22, -34, 1.3, blackLn);
        k.fillStyle = 'rgba(11,15,30,0.2)'; k.fillRect(-56, -110, 24, 120);
        k.fillStyle = 'rgba(255,255,255,0.08)'; k.fillRect(34, -100, 10, 90);
      });
      // belt with the Omnitrix buckle
      D.roundRectPath(ctx, -30, -21, 62, 11, 4); D.fillStroke(ctx, '#14151c', LW * 0.8);
      omniDial(ctx, 10, -15.5, 8);
    },
    torsoBox: [-58, -110, 64, 20],
    uArm: (ctx, dim) => {
      const r = s.armR;
      D.limb(ctx, s.uArm, r, r * 0.92, [[0, red]], dim, true, { bulge: 0.28 });
      D.curve(ctx, -r * 0.9, r * 1.6, 0, r * 0.9, r * 0.95, r * 1.1, 1.8, redDk);
      D.curve(ctx, r * 0.45, s.uArm * 0.5, r * 0.6, s.uArm * 0.72, r * 0.2, s.uArm * 0.9, 1.5, redDk);
    },
    lArm: (ctx, dim) => {
      D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, red], [0.74, black]], dim, true, { bulge: 0.24 });
      D.curve(ctx, -s.armR * 0.5, 4, -s.armR * 0.7, s.lArm * 0.35, -s.armR * 0.3, s.lArm * 0.6, 1.4, redDk);
      D.line(ctx, -s.armR2, s.lArm * 0.84, s.armR2, s.lArm * 0.84, 1.2, blackLn);
    },
    hand: (ctx, dim) => fist(ctx, s.handR, red, dim),
    uLeg: (ctx, dim) => {
      D.limb(ctx, s.uLeg, s.legR, s.legR * 0.92, [[0, black]], dim, true, { bulge: 0.18 });
      D.line(ctx, s.legR * 0.35, 4, s.legR * 0.45, s.uLeg - 2, 1.6, blackLn);
    },
    lLeg: (ctx, dim) => {
      D.limb(ctx, s.lLeg, s.legR * 0.9, s.legR2, [[0, black], [0.8, '#121318']], dim, true, { bulge: 0.16 });
      D.curve(ctx, -s.legR * 0.6, 4, 0, 7, s.legR * 0.55, 3, 1.4, blackLn);
    },
    foot: (ctx, dim) => bareFoot(ctx, s, red, dim),
  };
  s.parts = assemble(s, d);
  return s;
}

/** XLR8 wheel foot: a black ball with a blue rim and hub; touches the ground at y = footH */
function wheelFoot(ctx, s, blue, dim) {
  const R = 7.8, cx = 2.5, cy = s.footH - R;
  const wp = (k) => D.ellipsePath(k, cx, cy, R, R);
  D.shaded(ctx, wp, '#14161f', (k) => {
    k.lineWidth = 2.6; k.strokeStyle = blue; k.beginPath(); k.arc(cx, cy, R * 0.62, 0, Math.PI * 2); k.stroke();
    D.dot(k, cx, cy, R * 0.26, D.shade(blue, 1.25));
    D.curve(k, cx - R * 0.5, cy - R * 0.72, cx + R * 0.1, cy - R * 0.95, cx + R * 0.6, cy - R * 0.6, 1.4, 'rgba(255,255,255,0.45)');
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4); }
  });
}

// XLR8: slim blue-and-black Kineceleran (velociraptor) speedster. Blue helmet head with a long swept-back crest and
// black racing stripes, black face behind a dark visor, black body with blue stripes, Omnitrix on the chest,
// thick thighs over thin shins, wheel-ball feet and a long tail banded blue and black.
function xlr8(c) {
  const s = mk({ headW: 44, headH: 40, neck: 4, torsoLen: 48, torsoW: 36, pelvisDrop: 8,
    uArm: 25, lArm: 23, armR: 5.8, armR2: 4.8, handR: 6, uLeg: 31, lLeg: 31, legR: 8.4, legR2: 5.2, footL: 13, footH: 10,
    shY: 42, tail: { x: -15, y: 4, base: -95 } });
  const blue = c.primary, black = '#1e2230', glow = c.accent || '#22e4ff';
  const d = {
    head(ctx, e) {
      const hp = (k) => {
        k.beginPath(); k.moveTo(-5, -1);
        k.quadraticCurveTo(10, 3, 22, -1.5); k.lineTo(27, -10); k.quadraticCurveTo(31.5, -21, 26, -31);
        k.quadraticCurveTo(18, -44, 0, -44.5); k.quadraticCurveTo(-18, -45, -29, -37); k.lineTo(-43, -32);
        k.quadraticCurveTo(-30, -26, -21, -22); k.quadraticCurveTo(-12, -12, -5, -1); k.closePath();
      };
      D.shaded(ctx, hp, blue, (k) => {
        // black face mask and two racing stripes along the crest
        k.fillStyle = black; k.beginPath(); k.moveTo(36, -28); k.lineTo(6, -28); k.quadraticCurveTo(-14, -30, -46, -31);
        k.lineTo(-50, 8); k.lineTo(36, 8); k.closePath(); k.fill();
        D.curve(k, 6, -28, -14, -30, -46, -31, LW * 0.6);
        D.curve(k, 20, -41, 0, -46, -36, -36, 3.2, black);
        D.curve(k, 12, -43, -2, -45.5, -16, -42, 2, 'rgba(255,255,255,0.35)');
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-50, -50, 16, 60);
      });
      // visor glass with the eyes glowing behind it
      const vp = (k) => { k.beginPath(); k.moveTo(4, -33); k.quadraticCurveTo(20, -38, 29, -29); k.quadraticCurveTo(28, -21, 24, -19); k.quadraticCurveTo(12, -18, 3, -22); k.closePath(); };
      D.shaded(ctx, vp, '#0a1634', (k) => {
        const g = e === 'hurt' ? '#ff5a78' : glow;
        if (e === 'blink') { D.line(k, 9, -26, 15, -26, 1.6, g); D.line(k, 20, -26, 25, -26, 1.4, g); }
        else if (e === 'hurt') { squeezeLine(k, 12, -26, 3, g); squeezeLine(k, 22.5, -26, 2.6, g); }
        else {
          const tilt = e === 'shout' ? 1.6 : 0.6;
          D.polyPath(k, [8, -28 + tilt * 0.4, 16, -29 - tilt, 16, -24, 9, -24]); k.fillStyle = g; k.fill();
          D.polyPath(k, [19.5, -29 - tilt, 25.5, -28 + tilt * 0.4, 25, -24, 19.5, -24]); k.fillStyle = g; k.fill();
        }
        D.curve(k, 7, -34, 16, -37, 26, -33, 2, 'rgba(255,255,255,0.35)');
      }, LW * 0.8);
      if (e === 'shout') {
        const mp = (k) => { k.beginPath(); k.moveTo(12, -13); k.lineTo(29, -14); k.lineTo(26, -5); k.lineTo(14, -6); k.closePath(); };
        D.shaded(ctx, mp, '#4a0d1a', (k) => { k.fillStyle = '#f4f6fb'; for (let i = 0; i < 4; i++) { D.polyPath(k, [14 + i * 3.6, -13.5, 17.6 + i * 3.6, -13.5, 15.8 + i * 3.6, -10.5]); k.fill(); } }, LW * 0.6);
      } else D.line(ctx, 14, -10, 25, -11, 1.4, '#3a3e4c');
    },
    headBox: [-50, -52, 38, 10],
    torso(ctx) {
      D.roundRectPath(ctx, -18, -12, 36, 20, 6); D.fillStroke(ctx, black);
      const tp = (k) => {
        k.beginPath(); k.moveTo(-15, -49); k.quadraticCurveTo(2, -53, 18, -48);
        k.quadraticCurveTo(22, -30, 16, -8); k.lineTo(-16, -8); k.quadraticCurveTo(-21, -30, -15, -49); k.closePath();
      };
      D.shaded(ctx, tp, black, (k) => {
        k.fillStyle = blue; D.polyPath(k, [9, -60, 21, -60, 17, 2, 7, 2]); k.fill();
        D.line(k, 9, -60, 7, 2, LW * 0.5); D.line(k, 21, -60, 17, 2, LW * 0.5);
        k.fillStyle = blue; k.fillRect(-26, -60, 8, 62); D.line(k, -18, -60, -18, 2, LW * 0.5);
        D.curve(k, -10, -30, 0, -26, 8, -30, 1.2, '#3a3e4c');
        k.fillStyle = 'rgba(255,255,255,0.1)'; k.fillRect(13, -56, 3, 50);
      });
      omniDial(ctx, 2, -37, 6.4);
    },
    torsoBox: [-26, -58, 26, 14],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, black], [0.55, blue]], dim, true, { bulge: 0.12 }),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, blue], [0.45, black]], dim, true, { bulge: 0.1 }),
    hand: (ctx, dim) => {
      fist(ctx, s.handR, black, dim);
      for (let i = 0; i < 2; i++) { D.polyPath(ctx, [s.handR * (0.55 + i * 0.2), s.handR * (1.35 - i * 0.5), s.handR * (1.25 + i * 0.2), s.handR * (1.7 - i * 0.5), s.handR * (0.8 + i * 0.2), s.handR * (1.05 - i * 0.5)]); D.fillStroke(ctx, '#e8ecf6', LW * 0.35); }
    },
    uLeg: (ctx, dim) => {
      D.limb(ctx, s.uLeg, s.legR, s.legR * 0.78, [[0, black]], dim, true, { bulge: 0.26 });
      D.curve(ctx, s.legR * 0.2, 4, s.legR * 0.75, s.uLeg * 0.45, s.legR * 0.2, s.uLeg * 0.85, 2.6, blue);
    },
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.7, s.legR2, [[0, black], [0.35, blue], [0.8, black]], dim, true, { bulge: 0.06 }),
    foot: (ctx, dim) => wheelFoot(ctx, s, blue, dim),
    tail: part('tail', B.TAIL, (ctx) => {
      const tp = (k) => { k.beginPath(); k.moveTo(-6.5, 2); k.quadraticCurveTo(-13, -30, 1, -64); k.quadraticCurveTo(0, -30, 6.5, 2); k.closePath(); };
      D.shaded(ctx, tp, black, (k) => {
        k.fillStyle = blue;
        for (let i = 0; i < 4; i++) { const y = -10 - i * 13; D.polyPath(k, [-16, y + 3, 12, y - 1, 12, y - 7, -16, y - 3]); k.fill(); }
        k.fillStyle = 'rgba(255,255,255,0.12)'; k.fillRect(0, -60, 3, 58);
      });
    }, [-18, -70, 14, 8]),
  };
  s.parts = assemble(s, d);
  return s;
}

function squeezeLine(k, x, y, r, color) {
  k.beginPath(); k.moveTo(x - r, y - r * 0.6); k.lineTo(x + r * 0.8, y); k.lineTo(x - r, y + r * 0.6);
  k.lineWidth = 1.6; k.strokeStyle = color; k.lineCap = 'round'; k.lineJoin = 'round'; k.stroke();
}

/** open limb outline (no cap at the pivot), matching D.limb */
function limbEdge(ctx, len, r1, r2, bulge) {
  const bx = ((r1 + r2) / 2) * (1 + bulge), by = len * 0.42;
  ctx.beginPath(); ctx.moveTo(r1, 0); ctx.quadraticCurveTo(bx, by, r2, len); ctx.arc(0, len, r2, 0, Math.PI); ctx.quadraticCurveTo(-bx, by, -r1, 0);
  ctx.lineWidth = LW; ctx.strokeStyle = D.OUTLINE; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}

/** glowing magma seam: wide orange line with a hot yellow core (current path) */
function seam(k, w = 3.2) {
  k.lineCap = 'round'; k.lineJoin = 'round';
  k.lineWidth = w; k.strokeStyle = '#ff8a1f'; k.stroke();
  k.lineWidth = w * 0.42; k.strokeStyle = '#fff1a8'; k.stroke();
}

/** rock limb split into plates by glowing seams; cuts = [[fraction, tilt], ...] */
function magmaLimb(ctx, len, r1, r2, rock, dim, cuts, bulge) {
  D.limb(ctx, len, r1, r2, [[0, rock]], 0, false, { bulge });
  const R = Math.max(r1, r2) * 1.4;
  ctx.save(); D.limbPath(ctx, len, r1, r2, bulge); ctx.clip();
  for (let i = 0; i < cuts.length; i++) {
    const y = cuts[i][0] * len, t = cuts[i][1];
    if (i % 2) { ctx.fillStyle = 'rgba(11,15,30,0.14)'; ctx.fillRect(-R, y, R * 2, (i + 1 < cuts.length ? cuts[i + 1][0] * len : len + R) - y); }
  }
  ctx.beginPath();
  for (let i = 0; i < cuts.length; i++) {
    const y = cuts[i][0] * len, t = cuts[i][1];
    ctx.moveTo(-R, y - t); ctx.lineTo(-R * 0.25, y + t * 0.4); ctx.lineTo(R * 0.3, y - t * 0.5); ctx.lineTo(R, y + t);
    if (i + 1 < cuts.length) { const y2 = cuts[i + 1][0] * len; ctx.moveTo(-R * 0.25 + (i % 2 ? 2 : -1), y + t * 0.4); ctx.lineTo(i % 2 ? R * 0.15 : -R * 0.35, (y + y2) / 2); }
  }
  seam(ctx, 3);
  if (dim) { ctx.fillStyle = `rgba(11,15,30,${dim * 0.8})`; ctx.fillRect(-R, -R, R * 2, len + R * 2); }
  ctx.restore();
  limbEdge(ctx, len, r1, r2, bulge);
}

// Heatblast: Pyronite made of magma. Dark red-brown rock plates split by glowing orange-yellow seams, a rocky face mask
// with glowing eyes set inside a head of fire, Omnitrix on the chest, rock fists and feet.
function heatblast(c) {
  const s = mk({ headW: 42, headH: 44, neck: 4, torsoLen: 56, torsoW: 42, pelvisDrop: 9,
    uArm: 26, lArm: 24, armR: 7.2, armR2: 6, handR: 7.6, uLeg: 32, lLeg: 31, legR: 9.4, legR2: 6.6, footL: 20, footH: 9,
    shY: 49 });
  const rock = c.primary, plate = D.shade(c.primary, 0.74), rockLt = D.shade(c.primary, 1.12);
  const d = {
    head(ctx, e) {
      const hp = (k) => D.blobPath(k, [2, -1, 18, -3, 24, -14, 24.5, -28, 20, -39, 2, -43, -14, -40, -21, -27, -20, -10, -10, -2]);
      D.shaded(ctx, hp, rock, (k) => {
        // plates: back-of-head plate and a cheek plate split by glowing seams
        D.polyPath(k, [-30, -50, -6, -50, -2, -26, -6, 4, -30, 4]); k.fillStyle = plate; k.fill();
        D.polyPath(k, [6, -14, 30, -18, 30, 4, 4, 4]); k.fillStyle = D.shade(rock, 0.88); k.fill();
        k.beginPath(); k.moveTo(-6, -50); k.lineTo(-2, -26); k.lineTo(-6, 4);
        k.moveTo(-2, -26); k.lineTo(4, -17); k.lineTo(6, -14); k.lineTo(30, -18);
        seam(k, 2.6);
        k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-28, -50, 10, 56);
      });
      // glowing eyes (no pupils) and a molten mouth
      const eyes = [[12.5, -25.5, 3.8, 2.6], [21, -25.5, 3, 2.3]];
      for (let i = 0; i < 2; i++) {
        const [x, y, rx, ry] = eyes[i];
        if (e === 'blink') D.line(ctx, x - rx, y, x + rx, y, 2, '#fff27a');
        else if (e === 'hurt') squeezeLine(ctx, x, y, rx * 0.9, '#fff27a');
        else { D.ellipsePath(ctx, x, y, rx, ry * (e === 'shout' ? 1.1 : 1)); D.fillStroke(ctx, '#fff27a', LW * 0.55); D.dot(ctx, x + rx * 0.25, y + ry * 0.2, Math.min(rx, ry) * 0.42, '#ffffff'); }
      }
      // heavy rock brow over the eyes (angry slant when shouting)
      const bs = e === 'shout' ? 2.2 : e === 'hurt' ? -1.5 : 0.6;
      const bp = (k) => { k.beginPath(); k.moveTo(6, -31); k.lineTo(25.5, -31); k.lineTo(25, -27.5 - bs * 0.2); k.quadraticCurveTo(17, -27.5 + bs, 16.5, -27 + bs); k.quadraticCurveTo(12, -28.5 + bs, 7, -28.5 - bs * 0.4); k.closePath(); };
      D.shaded(ctx, bp, plate, null, LW * 0.6);
      if (e === 'shout') openMouth(ctx, 16.5, -11.5, 11, 7, '#ffb02e');
      else if (e === 'hurt') { D.line(ctx, 11, -11, 21, -12, 3.6); D.line(ctx, 12, -11.2, 20, -12, 1.4, '#ffb02e'); }
      else { D.line(ctx, 11.5, -12, 21, -12.6, 3.2); D.line(ctx, 12.5, -12.1, 20, -12.5, 1.3, '#ffcf5a'); }
      // flame tongues licking over the brow
      const fr = (k) => {
        k.beginPath(); k.moveTo(-18, -34); k.quadraticCurveTo(-16, -46, -8, -52); k.quadraticCurveTo(-8, -44, -3, -42);
        k.quadraticCurveTo(0, -52, 8, -56); k.quadraticCurveTo(6, -46, 11, -42); k.quadraticCurveTo(15, -48, 22, -48);
        k.quadraticCurveTo(18, -42, 24, -32); k.quadraticCurveTo(10, -38, 2, -36); k.quadraticCurveTo(-8, -38, -18, -34); k.closePath();
      };
      fr(ctx); D.fillStroke(ctx, '#ff6a1a', LW * 0.6);
      ctx.save(); ctx.translate(2, -39); ctx.scale(0.62, 0.62); ctx.translate(-2, 39); fr(ctx); ctx.fillStyle = '#ffc23a'; ctx.fill(); ctx.restore();
    },
    headBox: [-30, -60, 32, 8],
    torso(ctx) {
      // short rock neck under the head
      D.roundRectPath(ctx, -7, -65, 15, 12, 3); D.fillStroke(ctx, plate, LW * 0.8);
      D.line(ctx, -2, -63, 1, -56, 1.6, '#ff9a2a');
      const tp = (k) => tunicPath(k, -57, 38, 36, 8);
      D.shaded(ctx, tp, rock, (k) => {
        D.polyPath(k, [-30, -66, 2, -66, 0, -40, -30, -36]); k.fillStyle = plate; k.fill();
        D.polyPath(k, [6, -30, 30, -34, 30, 12, 4, 12]); k.fillStyle = plate; k.fill();
        D.polyPath(k, [-30, -18, -2, -16, -2, 12, -30, 12]); k.fillStyle = D.shade(rock, 0.88); k.fill();
        k.beginPath();
        k.moveTo(2, -66); k.lineTo(0, -40); k.lineTo(-30, -36);
        k.moveTo(0, -40); k.lineTo(6, -30); k.lineTo(30, -34);
        k.moveTo(6, -30); k.lineTo(-2, -16); k.lineTo(-30, -18);
        k.moveTo(-2, -16); k.lineTo(4, 12);
        seam(k, 3.2);
        D.curve(k, 8, -52, 16, -46, 24, -50, 1.6, D.shade(rock, 0.7));
        k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-30, -66, 11, 80);
        k.fillStyle = 'rgba(255,255,255,0.07)'; k.fillRect(14, -66, 6, 80);
      });
      omniDial(ctx, 12, -44, 6.6);
    },
    torsoBox: [-28, -70, 28, 16],
    uArm: (ctx, dim) => magmaLimb(ctx, s.uArm, s.armR, s.armR * 0.95, rock, dim, [[0.42, 2.5], [0.8, -2]], 0.16),
    lArm: (ctx, dim) => magmaLimb(ctx, s.lArm, s.armR * 0.95, s.armR2, rock, dim, [[0.3, -2], [0.72, 2.5]], 0.12),
    hand: (ctx, dim) => {
      fist(ctx, s.handR, plate, dim);
      D.curve(ctx, -s.handR * 0.4, s.handR * 0.3, s.handR * 0.2, s.handR * 0.6, s.handR * 0.7, s.handR * 0.2, 1.6, '#ffb02e');
    },
    uLeg: (ctx, dim) => magmaLimb(ctx, s.uLeg, s.legR, s.legR * 0.92, plate, dim, [[0.35, 2.5], [0.74, -2.5]], 0.14),
    lLeg: (ctx, dim) => magmaLimb(ctx, s.lLeg, s.legR * 0.9, s.legR2, rock, dim, [[0.28, -2], [0.66, 2.5]], 0.1),
    foot: (ctx, dim) => {
      shoe(ctx, s, plate, '#3a120a', dim);
      D.line(ctx, s.footL * 0.28, s.footH * 0.05, s.footL * 0.36, s.footH * 0.62, 2, '#ff9a2a');
    },
    headBack: [part('flame', B.HEAD, (ctx) => {
      // a big head of fire rising behind the face
      const fl = (k, sc) => {
        k.beginPath(); k.moveTo(-22 * sc, 6); k.quadraticCurveTo(-32 * sc, -14 * sc, -20 * sc, -30 * sc);
        k.quadraticCurveTo(-17 * sc, -20 * sc, -10 * sc, -22 * sc); k.quadraticCurveTo(-14 * sc, -42 * sc, -2 * sc, -58 * sc);
        k.quadraticCurveTo(0, -40 * sc, 6 * sc, -36 * sc); k.quadraticCurveTo(8 * sc, -50 * sc, 18 * sc, -54 * sc);
        k.quadraticCurveTo(14 * sc, -40 * sc, 20 * sc, -30 * sc); k.quadraticCurveTo(26 * sc, -34 * sc, 30 * sc, -36 * sc);
        k.quadraticCurveTo(30 * sc, -16 * sc, 22 * sc, 6); k.closePath();
      };
      fl(ctx, 1); D.fillStroke(ctx, '#ff5a1a', LW * 0.7);
      fl(ctx, 0.74); ctx.fillStyle = '#ffa62e'; ctx.fill();
      fl(ctx, 0.46); ctx.fillStyle = '#fff3b0'; ctx.fill();
    }, [-36, -64, 36, 10], { ox: 0, oy: -30, dyn: 'flame' })],
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  ben10: { body: { w: 70, h: 166, crouchH: 108 }, palette: PAL_BEN10, build: ben10 },
  fourarms: { body: { w: 118, h: 210, crouchH: 138 }, palette: PAL_FOURARMS, build: fourarms },
  xlr8: { body: { w: 70, h: 164, crouchH: 102 }, palette: PAL_XLR8, build: xlr8 },
  heatblast: { body: { w: 78, h: 178, crouchH: 116 }, palette: PAL_HEATBLAST, build: heatblast },
};

// Fighter art: Pikachu. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import { B } from '../rig.js';
import {
  LW, OUT, assemble, ball, dimFill, dotEyes, mk, openMouth, ovalFoot, part,
} from './kit.js';

const PAL_PIKACHU = { primary: '#ffd83a', secondary: '#ff4b3a', accent: '#ffe94a', skin: '#ffd83a' };

// Pikachu: chubby yellow electric mouse, head nearly as big as the pear-shaped body, long pointed ears with black
// tips, big black eyes with one highlight, red cheek pouches, tiny nose and w mouth, two brown back stripes, short
// arms, big feet and a lightning-bolt tail with a brown base (scaled up to fight, as in crossover games).
function pikachu(c) {
  const s = mk({ headW: 72, headH: 60, neck: -8, torsoLen: 40, torsoW: 56, pelvisDrop: 8,
    uArm: 10, lArm: 9, armR: 5.8, armR2: 5, handR: 5.4, uLeg: 9, lLeg: 8, legR: 9, legR2: 7.4, footL: 24, footH: 9,
    shY: 30, shXF: 9, shXB: -9, hipXF: 11, hipXB: -10,
    tail: { x: -22, y: 4, base: -42 } });
  const yel = c.primary, brown = '#8a5a2b';
  const red = c.secondary && c.secondary !== '#c98a1b' ? c.secondary : '#ff4b3a';
  const earDraw = (dim) => (ctx) => {
    const p = (k) => { k.beginPath(); k.moveTo(-9, 2); k.quadraticCurveTo(-15, -24, 0, -58); k.quadraticCurveTo(14, -24, 9, 2); k.closePath(); };
    D.shaded(ctx, p, yel, (k) => {
      k.fillStyle = '#1c1c26'; k.beginPath(); k.moveTo(-14, -34); k.quadraticCurveTo(0, -40, 14, -35); k.lineTo(14, -62); k.lineTo(-14, -62); k.closePath(); k.fill();
      k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-14, -62, 8.5, 66);
      D.line(k, 2.5, -8, 3, -30, 1.6, 'rgba(255,255,255,0.35)');
      dimFill(k, dim, -14, -62, 28, 66);
    });
  };
  const hp = (k) => D.blobPath(k, [8, 3, 30, -2, 39, -18, 37, -37, 24, -53, 2, -60, -18, -56, -31, -43, -35, -24, -29, -7, -12, 2]);
  const d = {
    head(ctx, e) {
      D.shaded(ctx, hp, yel, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.12)'; k.fillRect(-40, -64, 12, 70);
        D.curve(k, -16, -46, 0, -57, 18, -52, 3, 'rgba(255,255,255,0.38)');
        // far cheek pouch peeks out at the far edge of the face (clipped by the head)
        D.circle(k, 38.5, -16.5, 6.6, red, LW * 0.7);
      });
      dotEyes(ctx, e, [[12, -32, 6.2, 7.2], [28.5, -32, 4.6, 6.6]], 2.6);
      if (e === 'shout') { D.line(ctx, 5, -43, 16, -40, 2.4); D.line(ctx, 24, -40, 32, -43, 2.2); }
      D.ellipsePath(ctx, 34.5, -25, 1.9, 1.3); ctx.fillStyle = OUT; ctx.fill();
      D.circle(ctx, 4.5, -17, 8.6, red, LW * 0.7);
      D.dot(ctx, 6.5, -20, 2.2, 'rgba(255,255,255,0.4)');
      if (e === 'shout') openMouth(ctx, 26, -15.5, 11, 9.5);
      else if (e === 'hurt') openMouth(ctx, 26, -16, 8, 6);
      else { D.curve(ctx, 20.5, -20.5, 23.2, -16.5, 26, -19.5, 1.9); D.curve(ctx, 26, -19.5, 28.8, -16.5, 31.5, -20.5, 1.9); }
    },
    headBox: [-42, -66, 46, 10],
    torso(ctx) {
      const tp = (k) => D.blobPath(k, [0, -42, 19, -38, 30, -20, 31, -2, 22, 10, 0, 13, -22, 10, -31, -2, -30, -20, -19, -38]);
      D.shaded(ctx, tp, yel, (k) => {
        D.line(k, -34, -23, -20, -20, 5.5, brown);
        D.line(k, -34, -12, -21, -9, 5.5, brown);
        k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-34, -56, 13, 72);
        D.curve(k, 12, -30, 24, -18, 22, 0, 2, 'rgba(255,255,255,0.32)');
      });
    },
    torsoBox: [-38, -50, 38, 20],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.96, [[0, yel]], dim, false, { bulge: 0.2 }),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, yel]], dim, false, { bulge: 0.14 }),
    hand: (ctx, dim) => ball(ctx, s.handR, yel, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.98, [[0, yel]], dim, false, { bulge: 0.2 }),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.98, s.legR2, [[0, yel]], dim, false, { bulge: 0.12 }),
    foot: (ctx, dim) => ovalFoot(ctx, s, yel, dim),
    tail: part('tail', B.TAIL, (ctx) => {
      const tp = (k) => D.polyPath(k, [-3, 0, -8, -16, 2, -19, -6, -35, 7, -38, -2, -57, 28, -70, 20, -43, 12, -41, 17, -25, 7, -22, 8, -6, 3, 0]);
      D.shaded(ctx, tp, yel, (k) => {
        k.fillStyle = brown; k.fillRect(-12, -13, 30, 18);
        D.line(k, -12, -13, 18, -13, LW * 0.5);
        k.fillStyle = 'rgba(11,15,30,0.12)'; k.fillRect(-12, -76, 10, 82);
      });
    }, [-14, -76, 34, 6]),
    headBack: [part('earB', B.HEAD, earDraw(0.24), [-18, -64, 18, 8], { ox: -14, oy: -50, rot: -30, dyn: 'ear' })],
    headFront: [part('earF', B.HEAD, earDraw(0), [-18, -64, 18, 8], { ox: 10, oy: -53, rot: 22, dyn: 'ear' })],
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  pikachu: { body: { w: 74, h: 120, crouchH: 84 }, palette: PAL_PIKACHU, build: pikachu },
};

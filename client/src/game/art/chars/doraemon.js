// Fighter art: Doraemon. Owns proportions, palette fallback and Canvas2D part drawings.
// body = fallback hurtbox (the engine data in shared/fighters wins); palette = fallback colours.
import * as D from '../draw.js';
import { B } from '../rig.js';
import {
  LW, OUT, assemble, ball, mk, ovalFoot, part, squeeze,
} from './kit.js';

const PAL_DORAEMON = { primary: '#0a9be4', secondary: '#ffffff', accent: '#22e4ff', skin: '#ffffff' };

/** stubby leg segment: flat cap above the joint (no outline, no shading) so it melts into the body above it */
function stub(ctx, len, r1, r2, color, dim) {
  const bx = ((r1 + r2) / 2) * 1.04, by = len * 0.42, R = Math.max(r1, r2) + 2;
  const path = (k) => D.limbPath(k, len, r1, r2, 0.04);
  path(ctx); ctx.fillStyle = color; ctx.fill();
  ctx.save(); path(ctx); ctx.clip();
  ctx.fillStyle = 'rgba(11,15,30,0.16)'; ctx.fillRect(-R, 0, R * 0.8, len + R);
  ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(R * 0.22, 0, R * 0.22, len * 0.85);
  if (dim) { ctx.fillStyle = `rgba(11,15,30,${dim})`; ctx.fillRect(-R, -R, R * 2, len + R * 2); }
  ctx.restore();
  ctx.beginPath(); ctx.moveTo(r1, 0); ctx.quadraticCurveTo(bx, by, r2, len); ctx.arc(0, len, r2, 0, Math.PI);
  ctx.quadraticCurveTo(-bx, by, -r1, 0);
  ctx.lineWidth = LW; ctx.strokeStyle = OUT; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke();
}

// Doraemon: robot cat, 129.3 cm, head nearly as big as the rest of him, stubby legs. Blue with a white face mask
// and belly, two tall touching eyes, red ball nose, philtrum, three whiskers a side, a very wide mouth, red collar
// with a golden bell under the chin, half-moon 4D pocket, white round hands and flat round feet, red ball tail,
// no ears. Three-quarter arms: the near shoulder sits on the left side of the round body (shXF < 0) and the far
// shoulder on the front side (shXB > 0), so a resting near paw leaves the bell and pocket visible and the far paw
// peeks out in front.
function doraemon(c) {
  const s = mk({ headW: 96, headH: 90, neck: -6, torsoLen: 58, torsoW: 72, pelvisDrop: 8,
    uArm: 13, lArm: 12, armR: 8, armR2: 7.2, handR: 10.5, uLeg: 6, lLeg: 5, legR: 11, legR2: 10.4, footL: 31, footH: 10,
    shY: 27, shXF: -19, shXB: 14, hipXF: 11, hipXB: -10, hipDrop: 9,
    tail: { x: -33, y: -6, base: -72 } });
  s.H += 7; // the stubby legs hang from joints 9 below the hip pivot (other rigs use 2), so count the difference
  const blue = c.primary, white = '#ffffff', red = '#e8322b', gold = '#ffd23f';
  const EYE_N = [2, -67, 10.6, 13.6], EYE_F = [21.5, -66, 9.2, 12.8];
  const d = {
    head(ctx, e) {
      const hp = (k) => D.ellipsePath(k, 4, -46, 48, 46);
      D.shaded(ctx, hp, blue, (k) => {
        // white face mask, shifted toward the facing side for the three-quarter turn
        D.ellipsePath(k, 13, -37, 37.5, 36);
        D.fillStroke(k, white, LW * 0.7);
        k.fillStyle = 'rgba(11,15,30,0.12)'; k.fillRect(-50, -95, 21, 100);
        D.curve(k, -30, -68, -12, -86, 12, -87, 3.6, 'rgba(255,255,255,0.3)');
      });
      // eyes: two tall ovals touching above the nose, breaking the top edge of the face mask
      D.ellipsePath(ctx, EYE_F[0], EYE_F[1], EYE_F[2], EYE_F[3]); D.fillStroke(ctx, white, LW * 0.75);
      D.ellipsePath(ctx, EYE_N[0], EYE_N[1], EYE_N[2], EYE_N[3]); D.fillStroke(ctx, white, LW * 0.75);
      if (e === 'blink') {
        // the eye ovals stay (they are his silhouette); the lids close into smiling arcs
        D.curve(ctx, EYE_N[0] - 7.5, EYE_N[1] + 1, EYE_N[0], EYE_N[1] + 6.5, EYE_N[0] + 7.5, EYE_N[1] + 1, 2.4);
        D.curve(ctx, EYE_F[0] - 6.5, EYE_F[1] + 1, EYE_F[0], EYE_F[1] + 6, EYE_F[0] + 6.5, EYE_F[1] + 1, 2.2);
      } else {
        if (e === 'hurt') {
          squeeze(ctx, EYE_N[0] + 1, EYE_N[1] + 2, 5, 6, true, 2.2);
          squeeze(ctx, EYE_F[0] - 1, EYE_F[1] + 2, 4.5, 5.5, false, 2.2);
        } else {
          // small pupils set toward the inner corners, the classic slightly cross-eyed look
          const pr = e === 'shout' ? 2.3 : 3.1;
          D.dot(ctx, EYE_N[0] + 5, EYE_N[1] + 3, pr, OUT); D.dot(ctx, EYE_F[0] - 1.5, EYE_F[1] + 3, pr * 0.92, OUT);
          D.dot(ctx, EYE_N[0] + 5.8, EYE_N[1] + 1.9, pr * 0.34, '#fff'); D.dot(ctx, EYE_F[0] - 0.8, EYE_F[1] + 1.9, pr * 0.3, '#fff');
          if (e === 'shout') {
            D.line(ctx, EYE_N[0] - 7, EYE_N[1] - 13, EYE_N[0] + 7, EYE_N[1] - 7, 2.6);
            D.line(ctx, EYE_F[0] - 5, EYE_F[1] - 7, EYE_F[0] + 6, EYE_F[1] - 12, 2.4);
          }
        }
      }
      // philtrum, then the red ball nose overlapping the bottom of the eyes
      D.line(ctx, 13, -46, 13, -33, 1.8);
      D.circle(ctx, 13, -52, 6.8, red, LW * 0.7);
      D.dot(ctx, 11.2, -54, 2, '#ffffff');
      // whiskers: three per side, fanned (top tilts up, bottom tilts down)
      for (let i = -1; i <= 1; i++) {
        D.line(ctx, -2, -42 + i * 5, -27, -42 + i * 9.5, 1.7);
        D.line(ctx, 28, -42 + i * 5, 48, -42 + i * 8.5, 1.6);
      }
      // mouth: the huge half-moon grin with tongue; wider when shouting; a small wobbly frown when hurt
      if (e === 'hurt') {
        const mp = (k) => { k.beginPath(); k.moveTo(-1, -24); k.quadraticCurveTo(13, -32, 28, -24); k.quadraticCurveTo(24, -13, 13, -14); k.quadraticCurveTo(2, -13, -1, -24); k.closePath(); };
        D.shaded(ctx, mp, '#c4232f', null, LW * 0.7);
      } else {
        const deep = e === 'shout' ? -3 : -7, l = e === 'shout' ? -14 : -11, r = e === 'shout' ? 41 : 38;
        const mp = (k) => {
          k.beginPath(); k.moveTo(l, -33); k.quadraticCurveTo(13, -28, r, -33);
          k.quadraticCurveTo(r - 3, deep, 13, deep); k.quadraticCurveTo(l + 3, deep, l, -33); k.closePath();
        };
        D.shaded(ctx, mp, '#c4232f', (k) => { D.ellipsePath(k, 14, deep - 1, 12, 7); k.fillStyle = '#ff8a8a'; k.fill(); }, LW * 0.7);
      }
    },
    headBox: [-50, -100, 60, 8],
    torso(ctx) {
      // round pear-shaped body, widest low down; the hip pivot sits near its bottom so the stubby legs
      // come out from underneath
      const body = (k) => {
        k.beginPath(); k.moveTo(-26, -58); k.quadraticCurveTo(2, -62, 30, -58);
        k.quadraticCurveTo(47, -32, 40, -4); k.quadraticCurveTo(32, 9, 4, 9); k.quadraticCurveTo(-26, 9, -35, -4);
        k.quadraticCurveTo(-44, -32, -26, -58); k.closePath();
      };
      D.shaded(ctx, body, blue, (k) => {
        k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-46, -66, 15, 80);
        D.curve(k, 32, -46, 41, -30, 38, -10, 2.4, 'rgba(255,255,255,0.22)');
      });
      // white belly with the half-moon 4D pocket
      D.circle(ctx, 9, -23, 22, white, LW * 0.7);
      ctx.beginPath(); ctx.moveTo(-5, -18.5); ctx.lineTo(23, -18.5); ctx.arc(9, -18.5, 14, 0, Math.PI); ctx.closePath();
      D.fillStroke(ctx, white, LW * 0.6);
      // red collar hugging the bottom of the head, golden bell hanging under the chin
      ctx.beginPath(); ctx.moveTo(-31, -56); ctx.quadraticCurveTo(4, -44, 39, -56); ctx.lineTo(39, -48.5);
      ctx.quadraticCurveTo(4, -36.5, -31, -48.5); ctx.closePath();
      D.fillStroke(ctx, red, LW * 0.8);
      D.circle(ctx, 13, -38, 7.4, gold, LW * 0.75);
      D.line(ctx, 6, -40.5, 20, -40.5, 1.5);
      D.dot(ctx, 13, -35.4, 1.8, OUT);
      D.line(ctx, 13, -35.4, 13, -31.6, 1.3);
      D.dot(ctx, 10.4, -41.6, 1.5, 'rgba(255,255,255,0.85)');
    },
    torsoBox: [-48, -68, 50, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.96, [[0, blue]], dim, true, { bulge: 0.14 }),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.96, s.armR2, [[0, blue]], dim, true, { bulge: 0.1 }),
    hand: (ctx, dim) => ball(ctx, s.handR, white, dim),
    uLeg: (ctx, dim) => stub(ctx, s.uLeg, s.legR, s.legR * 0.98, blue, dim),
    lLeg: (ctx, dim) => stub(ctx, s.lLeg, s.legR * 0.98, s.legR2, blue, dim),
    foot: (ctx, dim) => ovalFoot(ctx, s, white, dim),
    tail: part('tail', B.TAIL, (ctx) => {
      // short stalk (blue under the outline) ending in the red ball
      D.line(ctx, 0, 2, 0, -4, 4.6);
      D.line(ctx, 0, 2, 0, -4, 1.8, blue);
      D.circle(ctx, 0, -8, 5.8, red, LW * 0.75);
      D.dot(ctx, 1.6, -9.5, 1.5, 'rgba(255,255,255,0.7)');
    }, [-10, -22, 10, 6], { dyn: 'tailBob' }),
    headFront: [part('prop', B.HEAD, (ctx) => {
      D.roundRectPath(ctx, -2, -12, 4, 13, 1.5); D.fillStroke(ctx, '#ffb02e', LW * 0.6);
      D.ellipsePath(ctx, 0, -13, 26, 3.6); D.fillStroke(ctx, '#ffd23f', LW * 0.7);
      D.circle(ctx, 0, -13, 2.6, '#ff8a1f', LW * 0.5);
    }, [-32, -22, 32, 4], { ox: 4, oy: -89, dyn: 'prop' })],
  };
  s.parts = assemble(s, d);
  return s;
}

export default {
  doraemon: { body: { w: 104, h: 158, crouchH: 112 }, palette: PAL_DORAEMON, build: doraemon },
};

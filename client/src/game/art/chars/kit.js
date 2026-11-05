// Shared drawing kit for the fighter art files in this folder: proportions (mk), hands, feet, cloth,
// expression-aware face helpers (eyes, brows, mouths) and the part assembler. Phaser-free.
import * as D from '../draw.js';
import { B } from '../rig.js';

export const { LW } = D;
export const OUT = D.OUTLINE;
export const DARK = '#1c1c26';
export const EXPRS = ['blink', 'hurt', 'shout'];

export function mk(o) {
  const s = Object.assign({
    neck: 0, shXF: 3, shXB: -7, hipXF: 7, hipXB: -6, hipDrop: 2, pelvisDrop: 8,
    tail: null, fourArms: false, shY2: 0,
  }, o);
  if (s.armR2 === undefined) s.armR2 = s.armR * 0.86;
  if (s.legR2 === undefined) s.legR2 = s.legR * 0.82;
  s.hipH = s.uLeg + s.lLeg + s.footH;
  s.H = s.hipH + s.torsoLen + s.neck + s.headH;
  return s;
}

export const dimFill = (k, dim, x, y, w, h) => { if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(x, y, w, h); } };

/** mitten fist: rounded knuckles, a thumb on the forward side and two finger creases */
export function fist(ctx, r, color, dim) {
  const path = (k) => {
    k.beginPath();
    k.moveTo(-r * 0.9, r * 0.1);
    k.quadraticCurveTo(-r * 1.15, r * 1.25, -r * 0.2, r * 1.6);
    k.quadraticCurveTo(r * 0.9, r * 1.7, r * 1.0, r * 0.8);
    k.quadraticCurveTo(r * 1.05, -r * 0.2, 0, -r * 0.35);
    k.quadraticCurveTo(-r * 0.75, -r * 0.3, -r * 0.9, r * 0.1);
    k.closePath();
  };
  D.shaded(ctx, path, color, (k) => {
    k.fillStyle = 'rgba(11,15,30,0.16)'; k.fillRect(-r * 1.4, -r, r * 0.9, r * 3);
    dimFill(k, dim, -r * 2, -r * 2, r * 4, r * 4);
  }, LW * 0.9);
  D.curve(ctx, -r * 0.55, r * 0.95, -r * 0.1, r * 1.12, r * 0.3, r * 1.0, LW * 0.4);
  D.curve(ctx, -r * 0.6, r * 0.55, -r * 0.15, r * 0.72, r * 0.25, r * 0.6, LW * 0.4);
  const tp = (k) => D.ellipsePath(k, r * 0.62, r * 0.45, r * 0.42, r * 0.6, -0.4);
  D.shaded(ctx, tp, color, (k) => dimFill(k, dim, -r * 2, -r * 2, r * 4, r * 4), LW * 0.7);
}

/** round paw / glove ball */
export function ball(ctx, r, color, dim) {
  const path = (k) => D.ellipsePath(k, 0, r * 0.7, r, r);
  D.shaded(ctx, path, color, (k) => {
    k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-r * 1.2, -r, r * 0.75, r * 3);
    D.dot(k, r * 0.3, r * 0.25, r * 0.3, 'rgba(255,255,255,0.55)');
    dimFill(k, dim, -r - 2, -r - 2, r * 2 + 4, r * 3 + 4);
  });
}

export function shoe(ctx, s, color, sole, dim, stripe = null) {
  const L = s.footL, h = s.footH, r = s.legR2;
  const path = (k) => {
    k.beginPath();
    k.moveTo(-r - 1, -2);
    k.lineTo(-L * 0.3, h * 0.3);
    k.quadraticCurveTo(-L * 0.36, h, -L * 0.18, h);
    k.lineTo(L * 0.6, h);
    k.quadraticCurveTo(L * 0.88, h, L * 0.8, h * 0.4);
    k.quadraticCurveTo(L * 0.62, -h * 0.28, r * 0.8, -2.5);
    k.closePath();
  };
  D.shaded(ctx, path, color, (k) => {
    k.fillStyle = sole; k.fillRect(-L, h * 0.72, L * 2, h);
    D.line(k, -L, h * 0.72, L, h * 0.72, LW * 0.5);
    if (stripe) D.line(k, -L * 0.05, h * 0.55, L * 0.45, -h * 0.1, LW * 0.9, stripe);
    k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-L, -h, L * 0.75, h * 3);
    D.dot(k, L * 0.48, h * 0.15, h * 0.18, 'rgba(255,255,255,0.45)');
    dimFill(k, dim, -L, -h, L * 2, h * 3);
  });
}

export function ovalFoot(ctx, s, color, dim, stripe = null) {
  const L = s.footL, h = s.footH;
  const path = (k) => D.ellipsePath(k, L * 0.22, h * 0.5, L * 0.58, h * 0.64);
  D.shaded(ctx, path, color, (k) => {
    if (stripe) D.line(k, L * 0.05, h * 0.1, L * 0.45, h * 0.1, LW * 0.8, stripe);
    k.fillStyle = 'rgba(11,15,30,0.12)'; k.fillRect(-L, -h, L * 0.7, h * 3);
    dimFill(k, dim, -L, -h, L * 3, h * 3);
  });
}

/** bare foot with toe creases (Bheem) */
export function bareFoot(ctx, s, skin, dim) {
  const L = s.footL, h = s.footH, r = s.legR2;
  const path = (k) => {
    k.beginPath();
    k.moveTo(-r, -2);
    k.quadraticCurveTo(-L * 0.36, h * 0.6, -L * 0.2, h);
    k.lineTo(L * 0.62, h);
    k.quadraticCurveTo(L * 0.92, h * 0.95, L * 0.82, h * 0.42);
    k.quadraticCurveTo(L * 0.5, h * 0.05, r * 0.85, -2.5);
    k.closePath();
  };
  D.shaded(ctx, path, skin, (k) => {
    k.fillStyle = 'rgba(11,15,30,0.14)'; k.fillRect(-L, -h, L * 0.72, h * 3);
    dimFill(k, dim, -L, -h, L * 2, h * 3);
  });
  for (let i = 0; i < 3; i++) D.line(ctx, L * (0.55 + i * 0.09), h * 0.62, L * (0.57 + i * 0.09), h * 0.98, 1);
}

/** simple tunic torso path from hips to shoulders */
export function tunicPath(k, top, wTop, wBot, bot = -8) {
  k.beginPath();
  k.moveTo(-wTop * 0.42, top);
  k.quadraticCurveTo(0, top - 3, wTop * 0.46, top);
  k.quadraticCurveTo(wBot * 0.58, top * 0.55, wBot * 0.5, bot);
  k.lineTo(-wBot * 0.5, bot);
  k.quadraticCurveTo(-wBot * 0.58, top * 0.55, -wTop * 0.42, top);
  k.closePath();
}

export function omnitrix(ctx, x, y, r) {
  D.circle(ctx, x, y, r, '#16181f', LW * 0.6);
  D.circle(ctx, x, y, r * 0.72, '#9dff4a', LW * 0.4);
  D.polyPath(ctx, [x - r * 0.45, y - r * 0.5, x + r * 0.45, y - r * 0.5, x - r * 0.45, y + r * 0.5, x + r * 0.45, y + r * 0.5]);
  ctx.fillStyle = '#16181f'; ctx.fill();
}

export function ear(ctx, x, y, skin, rx = 4.5, ry = 6) {
  D.ellipsePath(ctx, x, y, rx, ry);
  D.fillStroke(ctx, skin, LW * 0.7);
  D.curve(ctx, x + rx * 0.3, y - ry * 0.4, x - rx * 0.3, y, x + rx * 0.2, y + ry * 0.45, LW * 0.4);
}

export function cracks(ctx, len, color = '#ffb02e') {
  ctx.beginPath();
  ctx.moveTo(1, len * 0.12); ctx.lineTo(-2, len * 0.35); ctx.lineTo(2, len * 0.55); ctx.lineTo(-1.5, len * 0.8);
  ctx.lineWidth = 2.2; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

export function staffDraw(from, to) {
  return (ctx) => {
    const w = 6.4;
    D.roundRectPath(ctx, -w / 2, from, w, to - from, 3);
    D.fillStroke(ctx, '#d8261e', LW * 0.8);
    D.line(ctx, w * 0.15, from + 6, w * 0.15, to - 6, 1.4, 'rgba(255,255,255,0.45)');
    D.roundRectPath(ctx, -w / 2 - 0.6, from - 1, w + 1.2, 9, 2.5); D.fillStroke(ctx, '#ffc83a', LW * 0.7);
    D.roundRectPath(ctx, -w / 2 - 0.6, to - 8, w + 1.2, 9, 2.5); D.fillStroke(ctx, '#ffc83a', LW * 0.7);
  };
}

/** cloth ribbon hanging along +y (belt ends, scarves, hood ties) */
export function ribbon(ctx, len, w, color, sway = 4) {
  ctx.beginPath();
  ctx.moveTo(-w / 2, 0);
  ctx.quadraticCurveTo(-w / 2 - sway, len * 0.55, -w * 0.2 + sway * 0.4, len);
  ctx.lineTo(w * 0.6 + sway * 0.4, len - w * 0.4);
  ctx.quadraticCurveTo(w / 2 - sway * 0.6, len * 0.5, w / 2, 0);
  ctx.closePath();
  D.fillStroke(ctx, color, LW * 0.7);
  D.line(ctx, 0, len * 0.15, sway * 0.2, len * 0.8, 1, D.shade(color, 0.72));
}

// ---------------------------------------------------------------- faces (expressions)
export const BLUSH = 'rgba(255,105,120,0.32)';

/** solid eyes; e = expression. list: [[x, y, rx, ry], ...] near eye first */
export function dotEyes(ctx, e, list, lidW = 2.2) {
  for (let i = 0; i < list.length; i++) {
    const [x, y, rx, ry] = list[i];
    if (e === 'blink') D.curve(ctx, x - rx * 1.15, y + ry * 0.05, x, y + ry * 0.55, x + rx * 1.15, y + ry * 0.05, Math.max(1.6, lidW));
    else if (e === 'hurt') squeeze(ctx, x, y, rx, ry, i === 0, lidW);
    else if (e === 'shout') { D.dotEye(ctx, x, y, rx * 0.95, ry * 0.92); }
    else D.dotEye(ctx, x, y, rx, ry);
  }
}

/** white eyes with pupils (and optional coloured iris) */
export function whiteEyes(ctx, e, list, iris = null, pupil = 0.5, lidW = 2) {
  for (let i = 0; i < list.length; i++) {
    const [x, y, rx, ry] = list[i];
    if (e === 'blink') D.curve(ctx, x - rx * 1.1, y + ry * 0.1, x, y + ry * 0.6, x + rx * 1.1, y + ry * 0.1, Math.max(1.6, lidW));
    else if (e === 'hurt') squeeze(ctx, x, y, rx, ry, i === 0, lidW);
    else D.eye(ctx, x, y, rx, ry, OUT, e === 'shout' ? pupil * 0.8 : pupil, 0.28, iris);
  }
}

/** ">" for the near eye, "<" for the far eye */
export function squeeze(ctx, x, y, rx, ry, near, lw) {
  const s = near ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(x - s * rx * 1.05, y - ry * 0.7);
  ctx.lineTo(x + s * rx * 0.85, y);
  ctx.lineTo(x - s * rx * 1.05, y + ry * 0.7);
  ctx.lineWidth = Math.max(1.6, lw); ctx.strokeStyle = OUT; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

/** brows tilt with the expression: angry (inner ends down) when shouting, worried (inner ends up) when hurt */
export function brows(ctx, e, list, color = OUT) {
  for (let i = 0; i < list.length; i++) {
    let [x1, y1, x2, y2, w] = list[i];
    const d = w * 1.1;
    const innerRight = i === 0;
    if (e === 'shout') { if (innerRight) { y2 += d; y1 -= d * 0.3; } else { y1 += d; y2 -= d * 0.3; } }
    else if (e === 'hurt') { if (innerRight) { y2 -= d; y1 += d * 0.2; } else { y1 -= d; y2 += d * 0.2; } }
    D.line(ctx, x1, y1, x2, y2, w, color);
  }
}

/** open mouth (shout / grin) with tongue */
export function openMouth(ctx, x, y, w, h, tongue = '#ff7f8f') {
  const path = (k) => {
    k.beginPath();
    k.moveTo(x - w / 2, y - h * 0.35);
    k.quadraticCurveTo(x, y - h * 0.55, x + w / 2, y - h * 0.35);
    k.quadraticCurveTo(x + w * 0.42, y + h * 0.6, x, y + h * 0.6);
    k.quadraticCurveTo(x - w * 0.42, y + h * 0.6, x - w / 2, y - h * 0.35);
    k.closePath();
  };
  D.shaded(ctx, path, '#6b1020', (k) => { D.ellipsePath(k, x + w * 0.05, y + h * 0.55, w * 0.3, h * 0.32); k.fillStyle = tongue; k.fill(); }, LW * 0.7);
}

/** hurt grimace: clenched teeth */
export function grit(ctx, x, y, w, h) {
  D.roundRectPath(ctx, x - w / 2, y - h / 2, w, h, h * 0.45);
  D.fillStroke(ctx, '#ffffff', LW * 0.6);
  D.line(ctx, x - w / 2 + 1, y, x + w / 2 - 1, y, 1);
  for (let i = 1; i < 4; i++) D.line(ctx, x - w / 2 + (w * i) / 4, y - h / 2 + 1, x - w / 2 + (w * i) / 4, y + h / 2 - 1, 0.8);
}

export function smile(ctx, x1, y1, x2, y2, depth, lw = 2) {
  D.curve(ctx, x1, y1, (x1 + x2) / 2, Math.max(y1, y2) + depth, x2, y2, lw);
}

export const limbBox = (len, r) => [-r * 1.15 - 6, -r - 6, r * 1.15 + 6, len + r + 6];

export function assemble(s, d) {
  const parts = [];
  const add = (name, bone, draw, box, extra) => parts.push(Object.assign({ name, bone, ox: 0, oy: 0, rot: 0, dyn: null, draw, box }, extra));
  const hr = s.handR;
  const handBox = [-hr * 1.3 - 6, -hr - 6, hr * 1.3 + 6, hr * 1.9 + 6];
  const footBox = [-s.footL * 0.45 - 6, -s.legR2 - 7, s.footL * 0.95 + 6, s.footH + 6];
  const ua = (dim) => (c) => d.uArm(c, dim);
  const la = (dim, front) => (c) => d.lArm(c, dim, front);
  const hd = (dim) => (c) => d.hand(c, dim);
  for (const e of d.behind || []) parts.push(e);
  if (s.fourArms) {
    add('armUB2', B.AUB2, ua(0.36), limbBox(s.uArm, s.armR));
    add('armLB2', B.ALB2, la(0.36, false), limbBox(s.lArm, s.armR));
    add('handB2', B.HB2, hd(0.36), handBox);
  }
  add('armUB', B.AUB, ua(0.24), limbBox(s.uArm, s.armR));
  add('armLB', B.ALB, la(0.24, false), limbBox(s.lArm, s.armR));
  add('handB', B.HB, hd(0.24), handBox);
  add('legUB', B.LUB, (c) => d.uLeg(c, 0.22), limbBox(s.uLeg, s.legR));
  add('legLB', B.LLB, (c) => d.lLeg(c, 0.22), limbBox(s.lLeg, s.legR));
  add('footB', B.FB, (c) => d.foot(c, 0.22), footBox);
  if (d.tail) parts.push(d.tail);
  add('torso', B.TORSO, (c) => d.torso(c), d.torsoBox);
  add('legUF', B.LUF, (c) => d.uLeg(c, 0), limbBox(s.uLeg, s.legR));
  add('legLF', B.LLF, (c) => d.lLeg(c, 0), limbBox(s.lLeg, s.legR));
  add('footF', B.FF, (c) => d.foot(c, 0), footBox);
  for (const e of d.torsoFront || []) parts.push(e);
  for (const e of d.headBack || []) parts.push(e);
  add('head', B.HEAD, (c, e) => d.head(c, e || 'normal'), d.headBox, { variants: EXPRS });
  for (const e of d.headFront || []) parts.push(e);
  if (s.fourArms) {
    add('armUF2', B.AUF2, ua(0.1), limbBox(s.uArm, s.armR));
    add('armLF2', B.ALF2, la(0.1, false), limbBox(s.lArm, s.armR));
    add('handF2', B.HF2, hd(0.1), handBox);
  }
  add('armUF', B.AUF, ua(0), limbBox(s.uArm, s.armR));
  add('armLF', B.ALF, la(0, true), limbBox(s.lArm, s.armR));
  for (const e of d.beforeHandF || []) parts.push(e);
  add('handF', B.HF, hd(0), handBox);
  for (const e of d.front || []) parts.push(e);
  return parts;
}

export const part = (name, bone, draw, box, extra) => Object.assign({ name, bone, ox: 0, oy: 0, rot: 0, dyn: null, draw, box }, extra);


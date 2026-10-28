// Phaser-free character definitions: rig proportions + Canvas2D part drawings.
// Original stylized placeholders with recognizable cues. All coordinates in world units,
// each part drawn around its pivot (limbs hang along +y, torso/head extend up along -y).
import * as D from './draw.js';
import { B } from './rig.js';
import { getFighter } from '@shared/index.js';

const { LW } = D;

/** fallback body sizes (CONTRACT section 5) */
export const BODY = {
  shinchan: { w: 70, h: 150, crouchH: 100 },
  doraemon: { w: 95, h: 165, crouchH: 115 },
  hattori: { w: 70, h: 180, crouchH: 115 },
  pikachu: { w: 72, h: 135, crouchH: 95 },
  ben10: { w: 80, h: 175, crouchH: 115 },
  fourarms: { w: 110, h: 205, crouchH: 135 },
  xlr8: { w: 80, h: 175, crouchH: 115 },
  heatblast: { w: 80, h: 175, crouchH: 115 },
  nobita: { w: 75, h: 170, crouchH: 112 },
  goku: { w: 75, h: 160, crouchH: 108 },
  bheem: { w: 95, h: 175, crouchH: 118 },
};

/** fallback palettes; accent drives glows, auras and portrait frames */
export const PALETTE = {
  shinchan: { primary: '#e8322b', secondary: '#ffd23f', accent: '#ff8a1f', skin: '#ffd8b8' },
  doraemon: { primary: '#1b9be8', secondary: '#ffffff', accent: '#22e4ff', skin: '#ffffff' },
  hattori: { primary: '#2f63d8', secondary: '#ffcc33', accent: '#2f6bff', skin: '#ffd8b8' },
  pikachu: { primary: '#ffd83a', secondary: '#ff4b3a', accent: '#ffe94a', skin: '#ffd83a' },
  ben10: { primary: '#2fbf4a', secondary: '#16181f', accent: '#7dff4a', skin: '#ffd2ae' },
  fourarms: { primary: '#d8392b', secondary: '#1b1d26', accent: '#ff5a3a', skin: '#d8392b' },
  xlr8: { primary: '#2f6bff', secondary: '#14161f', accent: '#22e4ff', skin: '#2f6bff' },
  heatblast: { primary: '#8a2a14', secondary: '#ffb02e', accent: '#ff8a1f', skin: '#8a2a14' },
  nobita: { primary: '#ffd84a', secondary: '#2d5dbf', accent: '#22e4ff', skin: '#ffd8b8' },
  goku: { primary: '#ff8a1f', secondary: '#2550c8', accent: '#5fd0ff', skin: '#ffd8b8' },
  bheem: { primary: '#ff7a1a', secondary: '#ffcc33', accent: '#ff8a1f', skin: '#c98552' },
};

const HUMAN = { shinchan: 1, hattori: 1, ben10: 1, nobita: 1, goku: 1, bheem: 1 };
const DARK = '#1c1c26';

function engineFighter(id) {
  try { return getFighter ? getFighter(id) : null; } catch { return null; }
}

/** engine body height for a char/form (falls back to BODY table) */
export function bodyFor(charId, form = null) {
  const key = form || charId;
  const fb = BODY[key] || BODY[charId] || BODY.ben10;
  const f = engineFighter(charId);
  let b = f && f.body;
  if (form && f && f.forms && f.forms[form]) b = f.forms[form].body || null;
  if (form && !b) return fb;
  const h = b && Number.isFinite(b.h) ? b.h : fb.h;
  const w = b && Number.isFinite(b.w) ? b.w : fb.w;
  const crouchH = b && Number.isFinite(b.crouchH) ? b.crouchH : fb.crouchH;
  return { w, h, crouchH };
}

export function paletteFor(charId, form = null) {
  const key = form || charId;
  const base = { ...(PALETTE[key] || PALETTE.ben10) };
  if (!form) {
    const f = engineFighter(charId);
    const p = f && f.palette;
    if (p) {
      if (D.isHex(p.primary)) base.primary = p.primary;
      if (HUMAN[charId] && D.isHex(p.skin)) base.skin = p.skin;
      if (D.isHex(p.accent)) base.accent = p.accent;
    }
  }
  return base;
}

// ---------------------------------------------------------------- shared part drawers
function mk(o) {
  const s = Object.assign({
    neck: 0, shXF: 3, shXB: -7, hipXF: 7, hipXB: -6, hipDrop: 2, pelvisDrop: 8,
    tail: null, fourArms: false, shY2: 0,
  }, o);
  if (s.armR2 === undefined) s.armR2 = s.armR * 0.88;
  if (s.legR2 === undefined) s.legR2 = s.legR * 0.85;
  s.hipH = s.uLeg + s.lLeg + s.footH;
  s.H = s.hipH + s.torsoLen + s.neck + s.headH;
  return s;
}

function fist(ctx, r, color, dim) {
  const path = (k) => D.ellipsePath(k, 0, r * 0.55, r, r * 0.95);
  D.shaded(ctx, path, color, (k) => {
    D.sideShade(k, -r - 2, -r * 0.2, -r, r * 3, 0.2);
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-r - 2, -r - 2, r * 2 + 4, r * 3 + 4); }
  }, LW * 0.9);
  D.curve(ctx, r * 0.1, r * 0.15, r * 0.7, r * 0.45, r * 0.3, r * 1.1, LW * 0.45);
}

function ball(ctx, r, color, dim) {
  const path = (k) => D.ellipsePath(k, 0, r * 0.7, r, r);
  D.shaded(ctx, path, color, (k) => {
    D.sideShade(k, -r - 2, -r * 0.3, -r, r * 3, 0.14);
    D.dot(k, r * 0.3, r * 0.2, r * 0.3, 'rgba(255,255,255,0.5)');
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-r - 2, -r - 2, r * 2 + 4, r * 3 + 4); }
  });
}

function shoe(ctx, s, color, sole, dim, stripe = null) {
  const L = s.footL, h = s.footH, r = s.legR2;
  const path = (k) => {
    k.beginPath();
    k.moveTo(-r - 1, -2);
    k.lineTo(-L * 0.3, h * 0.3);
    k.quadraticCurveTo(-L * 0.36, h, -L * 0.18, h);
    k.lineTo(L * 0.58, h);
    k.quadraticCurveTo(L * 0.84, h, L * 0.78, h * 0.42);
    k.quadraticCurveTo(L * 0.62, -h * 0.25, r * 0.8, -2.5);
    k.closePath();
  };
  D.shaded(ctx, path, color, (k) => {
    k.fillStyle = sole; k.fillRect(-L, h * 0.74, L * 2, h);
    D.line(k, -L, h * 0.74, L, h * 0.74, LW * 0.5);
    if (stripe) D.line(k, -L * 0.05, h * 0.55, L * 0.45, -h * 0.1, LW * 0.9, stripe);
    D.sideShade(k, -L, -L * 0.15, -h, h * 2, 0.16);
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-L, -h, L * 2, h * 3); }
  });
}

function ovalFoot(ctx, s, color, dim, stripe = null) {
  const L = s.footL, h = s.footH;
  const path = (k) => D.ellipsePath(k, L * 0.2, h * 0.5, L * 0.56, h * 0.62);
  D.shaded(ctx, path, color, (k) => {
    if (stripe) D.line(k, L * 0.05, h * 0.1, L * 0.45, h * 0.1, LW * 0.8, stripe);
    D.sideShade(k, -L, -L * 0.1, -h, h * 2, 0.14);
    if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-L, -h, L * 3, h * 3); }
  });
}

/** simple tunic torso path from hips to shoulders */
function tunicPath(k, top, wTop, wBot, bot = -8) {
  k.beginPath();
  k.moveTo(-wTop * 0.42, top);
  k.quadraticCurveTo(0, top - 3, wTop * 0.46, top);
  k.quadraticCurveTo(wBot * 0.56, top * 0.55, wBot * 0.5, bot);
  k.lineTo(-wBot * 0.5, bot);
  k.quadraticCurveTo(-wBot * 0.56, top * 0.55, -wTop * 0.42, top);
  k.closePath();
}

function omnitrix(ctx, x, y, r) {
  D.circle(ctx, x, y, r, '#16181f', LW * 0.6);
  D.circle(ctx, x, y, r * 0.72, '#9dff4a', LW * 0.4);
  D.polyPath(ctx, [x - r * 0.45, y - r * 0.5, x + r * 0.45, y - r * 0.5, x - r * 0.45, y + r * 0.5, x + r * 0.45, y + r * 0.5]);
  ctx.fillStyle = '#16181f'; ctx.fill();
}

function ear(ctx, x, y, skin, rx = 4.5, ry = 6) {
  D.ellipsePath(ctx, x, y, rx, ry);
  D.fillStroke(ctx, skin, LW * 0.7);
  D.curve(ctx, x + rx * 0.3, y - ry * 0.4, x - rx * 0.3, y, x + rx * 0.2, y + ry * 0.45, LW * 0.4);
}

function cracks(ctx, len, color = '#ffb02e') {
  ctx.beginPath();
  ctx.moveTo(1, len * 0.12); ctx.lineTo(-2, len * 0.35); ctx.lineTo(2, len * 0.55); ctx.lineTo(-1.5, len * 0.8);
  ctx.lineWidth = 2.2; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

function staffDraw(from, to) {
  return (ctx) => {
    const w = 6.4;
    D.roundRectPath(ctx, -w / 2, from, w, to - from, 3);
    D.fillStroke(ctx, '#d8261e', LW * 0.8);
    D.line(ctx, w * 0.15, from + 6, w * 0.15, to - 6, 1.4, 'rgba(255,255,255,0.45)');
    D.roundRectPath(ctx, -w / 2 - 0.6, from - 1, w + 1.2, 9, 2.5); D.fillStroke(ctx, '#ffc83a', LW * 0.7);
    D.roundRectPath(ctx, -w / 2 - 0.6, to - 8, w + 1.2, 9, 2.5); D.fillStroke(ctx, '#ffc83a', LW * 0.7);
  };
}

const limbBox = (len, r) => [-r - 6, -r - 6, r + 6, len + r + 6];

function assemble(s, d) {
  const parts = [];
  const add = (name, bone, draw, box, extra) => parts.push(Object.assign({ name, bone, ox: 0, oy: 0, rot: 0, dyn: null, draw, box }, extra));
  const hr = s.handR;
  const handBox = [-hr - 6, -hr - 6, hr + 6, hr * 1.8 + 6];
  const footBox = [-s.footL * 0.45 - 6, -s.legR2 - 7, s.footL * 0.9 + 6, s.footH + 6];
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
  for (const e of d.headBack || []) parts.push(e);
  add('head', B.HEAD, (c) => d.head(c), d.headBox);
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

const part = (name, bone, draw, box, extra) => Object.assign({ name, bone, ox: 0, oy: 0, rot: 0, dyn: null, draw, box }, extra);

// ---------------------------------------------------------------- characters
function shinchan(c) {
  const s = mk({ headW: 64, headH: 62, neck: 2, torsoLen: 40, torsoW: 36, pelvisDrop: 9,
    uArm: 17, lArm: 16, armR: 5.6, handR: 6, uLeg: 19, lLeg: 19, legR: 7, footL: 18, footH: 8,
    shY: 34, shXF: 4, shXB: -6 });
  const red = c.primary, yel = c.secondary, skin = c.skin;
  const headPath = (k) => D.blobPath(k, [4, -1, 31, -7, 35, -31, 25, -57, 0, -64, -25, -57, -33, -35, -26, -9]);
  const d = {
    head(ctx) {
      D.shaded(ctx, headPath, skin, (k) => {
        D.polyPath(k, [-44, -12, -22, -22, -10, -40, 8, -47, 26, -45, 44, -52, 44, -90, -44, -90]);
        k.fillStyle = DARK; k.fill();
        D.curve(k, -22, -52, -8, -60, 8, -56, 2, 'rgba(255,255,255,0.18)');
        D.sideShade(k, -44, -18, -70, 10, 0.1);
      });
      ear(ctx, -9, -27, skin, 5, 6.5);
      D.line(ctx, 6, -42, 15, -44.5, 5.5);
      D.line(ctx, 20.5, -44.5, 27.5, -42, 5);
      D.dotEye(ctx, 11.5, -34, 3.3, 4.5);
      D.dotEye(ctx, 24.5, -33.5, 2.9, 4.3);
      D.dot(ctx, 7, -21, 5.5, 'rgba(255,110,110,0.35)');
      D.curve(ctx, 30, -26, 33, -24, 30, -22, 1.6);
      D.curve(ctx, 18, -16, 23, -12, 28, -16.5, 2.2);
    },
    headBox: [-40, -72, 42, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -19, -11, 38, 20, 6);
      D.fillStroke(ctx, yel);
      D.line(ctx, 1, 2, 1, 9, LW * 0.5);
      const shirt = (k) => tunicPath(k, -41, 30, 38, -8);
      D.shaded(ctx, shirt, red, (k) => D.sideShade(k, -24, -8, -50, 0, 0.18));
      D.curve(ctx, -5, -41.5, 1, -37, 7, -41.5, LW * 0.6);
    },
    torsoBox: [-28, -50, 28, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, red], [0.5, skin]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, skin]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.92, [[0, yel], [0.32, skin]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.9, s.legR2, [[0, skin], [0.66, '#ffffff']], dim),
    foot: (ctx, dim) => shoe(ctx, s, '#fff4d6', '#e8322b', dim),
  };
  s.parts = assemble(s, d);
  return s;
}

function doraemon(c) {
  const s = mk({ headW: 84, headH: 82, neck: -3, torsoLen: 56, torsoW: 62, pelvisDrop: 7,
    uArm: 16, lArm: 14, armR: 7.5, armR2: 7, handR: 10, uLeg: 11, lLeg: 10, legR: 9.5, footL: 26, footH: 9,
    shY: 44, shXF: 8, shXB: -10, hipXF: 10, hipXB: -9,
    tail: { x: -29, y: 14, base: -90 } });
  const blue = c.primary, white = '#ffffff', red = '#e8322b';
  const d = {
    head(ctx) {
      const hp = (k) => D.ellipsePath(k, 0, -41, 42, 41);
      D.shaded(ctx, hp, blue, (k) => {
        D.ellipsePath(k, 9, -35, 32, 30);
        D.fillStroke(k, white, LW * 0.7);
        D.sideShade(k, -50, -22, -90, 10, 0.12);
        D.curve(k, -28, -64, -12, -78, 10, -78, 3, 'rgba(255,255,255,0.25)');
      });
      D.ellipsePath(ctx, 3, -61, 8, 10.5); D.fillStroke(ctx, white, LW * 0.75);
      D.ellipsePath(ctx, 20, -61, 8, 10.5); D.fillStroke(ctx, white, LW * 0.75);
      D.dot(ctx, 7, -58, 2.8, D.OUTLINE); D.dot(ctx, 23.5, -58, 2.8, D.OUTLINE);
      D.dot(ctx, 7.8, -59, 0.9, '#fff'); D.dot(ctx, 24.3, -59, 0.9, '#fff');
      D.line(ctx, 12.5, -43, 12.5, -31, 1.8);
      D.circle(ctx, 12.5, -48.5, 5.6, red, LW * 0.7);
      D.dot(ctx, 11, -50, 1.7, '#ffffff');
      const mouth = (k) => { k.beginPath(); k.moveTo(-6, -31); k.quadraticCurveTo(12, -28, 33, -31); k.quadraticCurveTo(27, -9, 12.5, -9); k.quadraticCurveTo(-2, -9, -6, -31); k.closePath(); };
      D.shaded(ctx, mouth, '#c4232f', (k) => { D.ellipsePath(k, 13, -12, 9, 5); k.fillStyle = '#ff8484'; k.fill(); }, LW * 0.7);
      for (let i = -1; i <= 1; i++) {
        D.line(ctx, -2, -38 + i * 4, -22, -38 + i * 7, 1.6);
        D.line(ctx, 28, -38 + i * 4, 46, -38 + i * 7, 1.6);
      }
    },
    headBox: [-50, -92, 52, 8],
    torso(ctx) {
      const body = (k) => D.ellipsePath(k, 2, -24, 31, 32);
      D.shaded(ctx, body, blue, (k) => {
        D.sideShade(k, -40, -16, -60, 12, 0.16);
      });
      D.circle(ctx, 8, -21, 19, white, LW * 0.7);
      ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(20, -17); ctx.arc(8, -17, 12, 0, Math.PI); ctx.closePath();
      D.fillStroke(ctx, white, LW * 0.6);
      D.roundRectPath(ctx, -25, -53, 52, 8, 4); D.fillStroke(ctx, red, LW * 0.8);
      D.circle(ctx, 11, -44, 6.5, '#ffd23f', LW * 0.75);
      D.line(ctx, 5, -46, 17, -46, 1.4);
      D.dot(ctx, 11, -41.5, 1.6, D.OUTLINE);
      D.line(ctx, 11, -41.5, 11, -38.5, 1.2);
      D.dot(ctx, 9, -46.5, 1.3, 'rgba(255,255,255,0.8)');
    },
    torsoBox: [-36, -64, 40, 14],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, blue]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, blue]], dim),
    hand: (ctx, dim) => ball(ctx, s.handR, white, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.95, [[0, blue]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.95, s.legR2, [[0, blue]], dim),
    foot: (ctx, dim) => ovalFoot(ctx, s, white, dim),
    tail: part('tail', B.TAIL, (ctx) => {
      D.line(ctx, 0, 0, 0, -6, 3);
      D.circle(ctx, 0, -9.5, 5, red, LW * 0.75);
      D.dot(ctx, 1.5, -11, 1.3, 'rgba(255,255,255,0.7)');
    }, [-9, -20, 9, 4]),
    headFront: [part('prop', B.HEAD, (ctx) => {
      D.roundRectPath(ctx, -2, -12, 4, 13, 1.5); D.fillStroke(ctx, '#ffb02e', LW * 0.6);
      D.ellipsePath(ctx, 0, -13, 24, 3.4); D.fillStroke(ctx, '#ffd23f', LW * 0.7);
      D.circle(ctx, 0, -13, 2.5, '#ff8a1f', LW * 0.5);
    }, [-30, -22, 30, 4], { ox: 2, oy: -80, dyn: 'prop' })],
  };
  s.parts = assemble(s, d);
  return s;
}

function hattori(c) {
  const s = mk({ headW: 48, headH: 50, neck: 2, torsoLen: 54, torsoW: 40, pelvisDrop: 10,
    uArm: 26, lArm: 24, armR: 6, handR: 6.5, uLeg: 32, lLeg: 32, legR: 8, footL: 20, footH: 10,
    shY: 48 });
  const blue = c.primary, dblue = D.shade(c.primary, 0.78), wrap = '#dfe4ef', skin = c.skin, sash = c.secondary;
  const hood = (k) => D.blobPath(k, [1, -1, 21, -5, 27, -26, 19, -47, -2, -53, -23, -45, -28, -24, -19, -5]);
  const d = {
    head(ctx) {
      D.shaded(ctx, hood, blue, (k) => D.sideShade(k, -32, -12, -60, 4, 0.16));
      D.ellipsePath(ctx, 9, -22, 14.5, 15); D.fillStroke(ctx, skin, LW * 0.75);
      D.line(ctx, -26, -36, 22, -39, 8.5);
      D.line(ctx, -26, -36, 22, -39, 5, '#e8322b');
      D.circle(ctx, -24, -35, 4.2, '#e8322b', LW * 0.7);
      D.dotEye(ctx, 10, -24, 2.6, 3.4);
      D.dotEye(ctx, 19.5, -24, 2.4, 3.2);
      D.line(ctx, 7, -30, 12.5, -30.5, 1.8); D.line(ctx, 17.5, -30.5, 22, -30, 1.8);
      D.dot(ctx, 5, -16, 3.5, 'rgba(255,110,110,0.38)');
      D.dot(ctx, 21, -16, 3, 'rgba(255,110,110,0.38)');
      D.curve(ctx, 12, -12, 15, -9.5, 18, -12, 1.8);
    },
    headBox: [-36, -62, 34, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -20, -13, 40, 23, 6); D.fillStroke(ctx, dblue);
      D.shaded(ctx, (k) => tunicPath(k, -55, 34, 40, -10), blue, (k) => {
        D.polyPath(k, [-5, -57, 11, -57, 4, -40]); k.fillStyle = '#a9c6ff'; k.fill();
        D.line(k, -5, -57, 4, -40, LW * 0.6); D.line(k, 11, -57, 4, -40, LW * 0.6);
        D.sideShade(k, -26, -10, -60, 0, 0.18);
      });
      D.roundRectPath(ctx, -21, -17, 42, 8, 3); D.fillStroke(ctx, sash, LW * 0.8);
      D.polyPath(ctx, [14, -12, 20, -4, 12, -5]); D.fillStroke(ctx, sash, LW * 0.6);
    },
    torsoBox: [-28, -64, 28, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, blue]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, blue], [0.6, wrap]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.92, [[0, dblue]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.9, s.legR2, [[0, dblue], [0.32, wrap], [0.55, wrap], [0.78, wrap]], dim),
    foot: (ctx, dim) => shoe(ctx, s, '#2a2d3e', '#14161f', dim),
    behind: [
      part('sword', B.TORSO, (ctx) => {
        D.roundRectPath(ctx, -3.6, -26, 7.2, 54, 3); D.fillStroke(ctx, '#2a2230', LW * 0.8);
        D.line(ctx, 1, -22, 1, 24, 1.2, 'rgba(255,255,255,0.25)');
        D.ellipsePath(ctx, 0, -27, 7, 2.4); D.fillStroke(ctx, '#ffc83a', LW * 0.6);
        D.roundRectPath(ctx, -2.6, -44, 5.2, 16, 2); D.fillStroke(ctx, '#f1ece0', LW * 0.6);
        for (let y = -41; y < -30; y += 4) D.line(ctx, -2.4, y, 2.4, y + 2.5, 1, '#3b3550');
      }, [-12, -52, 12, 34], { ox: -8, oy: -34, rot: -38 }),
      part('trail', B.HEAD, (ctx) => {
        const rib = (dx, len) => { ctx.beginPath(); ctx.moveTo(-2.5, 0); ctx.quadraticCurveTo(dx - 5, len * 0.5, dx, len); ctx.lineTo(dx + 4, len - 2); ctx.quadraticCurveTo(dx, len * 0.5, 2.5, 0); ctx.closePath(); D.fillStroke(ctx, '#e8322b', LW * 0.6); };
        rib(-3, 24); rib(5, 19);
      }, [-14, -4, 14, 30], { ox: -24, oy: -35, rot: 70, dyn: 'trail' }),
    ],
  };
  s.parts = assemble(s, d);
  return s;
}

function pikachu(c) {
  const s = mk({ headW: 60, headH: 63, neck: -4, torsoLen: 50, torsoW: 46, pelvisDrop: 6,
    uArm: 11, lArm: 10, armR: 5, handR: 5.5, uLeg: 9, lLeg: 9, legR: 7.5, footL: 20, footH: 8,
    shY: 38, shXF: 7, shXB: -6, hipXF: 9, hipXB: -8,
    tail: { x: -21, y: 10, base: -40 } });
  const yel = c.primary, brown = '#8a5a2b', red = c.secondary || '#ff4b3a';
  const earDraw = (dim) => (ctx) => {
    const p = (k) => { k.beginPath(); k.moveTo(-6.5, 0); k.quadraticCurveTo(-9, -20, -0.5, -36); k.quadraticCurveTo(8, -20, 6.5, 0); k.closePath(); };
    D.shaded(ctx, p, yel, (k) => {
      k.fillStyle = '#1c1c26'; k.fillRect(-12, -40, 24, 16);
      D.sideShade(k, -12, -2, -40, 4, 0.14);
      if (dim) { k.fillStyle = `rgba(11,15,30,${dim})`; k.fillRect(-12, -40, 24, 44); }
    });
  };
  const d = {
    head(ctx) {
      const hp = (k) => D.blobPath(k, [3, -1, 28, -6, 35, -27, 27, -52, 4, -62, -21, -55, -31, -32, -24, -8]);
      D.shaded(ctx, hp, yel, (k) => {
        D.sideShade(k, -36, -14, -70, 6, 0.12);
        D.curve(k, -14, -50, 0, -58, 14, -55, 2.5, 'rgba(255,255,255,0.35)');
      });
      D.dotEye(ctx, 12, -35, 4.6, 5.6);
      D.dotEye(ctx, 27.5, -34, 4, 5.2);
      D.ellipsePath(ctx, 33.5, -27, 1.7, 1.2); ctx.fillStyle = D.OUTLINE; ctx.fill();
      D.curve(ctx, 22, -22.5, 24.5, -19, 27, -22.5, 1.8);
      D.curve(ctx, 27, -22.5, 29.5, -19, 32, -22.5, 1.8);
      D.circle(ctx, 6, -20, 7.5, red, LW * 0.7);
      D.circle(ctx, 31.5, -18.5, 5, red, LW * 0.7);
    },
    headBox: [-38, -72, 42, 8],
    torso(ctx) {
      const tp = (k) => D.blobPath(k, [0, -56, 19, -48, 28, -18, 23, 5, 0, 10, -23, 5, -28, -18, -19, -48]);
      D.shaded(ctx, tp, yel, (k) => {
        D.line(k, -32, -36, -17, -32, 5.5, brown);
        D.line(k, -32, -24, -18, -20, 5.5, brown);
        D.sideShade(k, -32, -12, -60, 12, 0.14);
      });
    },
    torsoBox: [-32, -60, 32, 14],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, yel]], dim, false),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, yel]], dim, false),
    hand: (ctx, dim) => ball(ctx, s.handR, yel, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.95, [[0, yel]], dim, false),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.95, s.legR2, [[0, yel]], dim, false),
    foot: (ctx, dim) => ovalFoot(ctx, s, yel, dim),
    tail: part('tail', B.TAIL, (ctx) => {
      const tp = (k) => D.polyPath(k, [-3, 0, -7, -14, 1, -17, -5, -31, 6, -34, -1, -50, 23, -60, 17, -38, 11, -36, 15, -22, 6, -19, 8, -6, 3, 0]);
      D.shaded(ctx, tp, yel, (k) => { k.fillStyle = brown; k.fillRect(-12, -12, 30, 16); D.sideShade(k, -12, 0, -64, 4, 0.12); });
    }, [-14, -66, 30, 6]),
    headBack: [part('earB', B.HEAD, earDraw(0.24), [-14, -42, 14, 6], { ox: -11, oy: -52, rot: -30, dyn: 'ear' })],
    headFront: [part('earF', B.HEAD, earDraw(0), [-14, -42, 14, 6], { ox: 9, oy: -54, rot: 22, dyn: 'ear' })],
  };
  s.parts = assemble(s, d);
  return s;
}

function ben10(c) {
  const s = mk({ headW: 42, headH: 48, neck: 5, torsoLen: 52, torsoW: 40, pelvisDrop: 10,
    uArm: 25, lArm: 23, armR: 6, handR: 6.5, uLeg: 30, lLeg: 30, legR: 8, footL: 22, footH: 10,
    shY: 46 });
  const green = c.primary, black = '#16181f', skin = c.skin, pants = '#3d4a3a', hair = '#6b3f1f';
  const d = {
    head(ctx) {
      const fp = (k) => D.blobPath(k, [2, -1, 19, -6, 23, -25, 17, -42, 0, -48, -17, -42, -22, -24, -14, -6]);
      D.shaded(ctx, fp, skin, (k) => D.sideShade(k, -26, -10, -56, 4, 0.1));
      const hp = (k) => {
        k.beginPath(); k.moveTo(-22, -16); k.quadraticCurveTo(-27, -42, -8, -51);
        k.quadraticCurveTo(12, -58, 24, -46); k.lineTo(29, -40); k.quadraticCurveTo(18, -39, 12, -35);
        k.lineTo(8, -40); k.quadraticCurveTo(0, -34, -6, -30); k.quadraticCurveTo(-13, -24, -22, -16); k.closePath();
      };
      D.shaded(ctx, hp, hair, (k) => { D.curve(k, -14, -44, 0, -52, 16, -48, 2.4, 'rgba(255,220,180,0.35)'); D.sideShade(k, -30, -12, -60, 0, 0.15); });
      ear(ctx, -6, -21, skin);
      D.eye(ctx, 12, -26, 3.6, 4.3, D.OUTLINE, 0.38, 0.3, '#2fbf4a');
      D.eye(ctx, 21, -26, 3, 4, D.OUTLINE, 0.38, 0.3, '#2fbf4a');
      D.line(ctx, 8, -32.5, 15, -33.5, 2.2, hair); D.line(ctx, 18.5, -33.5, 23.5, -32, 2.2, hair);
      D.curve(ctx, 22, -22, 24, -19, 21.5, -17.5, 1.5);
      D.curve(ctx, 12.5, -12, 17, -10.5, 21, -13.5, 2);
    },
    headBox: [-34, -64, 36, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -20, -13, 40, 23, 6); D.fillStroke(ctx, pants);
      D.shaded(ctx, (k) => tunicPath(k, -53, 34, 40, -8), green, (k) => {
        k.fillStyle = black; k.fillRect(0, -60, 9, 60);
        k.fillStyle = '#ffffff'; k.fillRect(3, -60, 2.2, 60);
        D.line(k, 0, -60, 0, 0, LW * 0.6); D.line(k, 9, -60, 9, 0, LW * 0.6);
        k.fillStyle = black; k.fillRect(-30, -40, 9, 40);
        D.sideShade(k, -26, -10, -60, 0, 0.18);
      });
      D.polyPath(ctx, [-12, -54, -2, -52, -6, -44]); D.fillStroke(ctx, D.shade(green, 0.85), LW * 0.6);
      D.polyPath(ctx, [10, -52, 18, -54, 14, -45]); D.fillStroke(ctx, D.shade(green, 0.85), LW * 0.6);
    },
    torsoBox: [-28, -62, 28, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, green], [0.45, black], [0.62, green]], dim),
    lArm: (ctx, dim, front) => {
      D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, green], [0.74, skin]], dim);
      if (front) {
        const y = s.lArm * 0.9;
        D.roundRectPath(ctx, -s.armR2 - 1.5, y - 4, s.armR2 * 2 + 3, 8, 2.5); D.fillStroke(ctx, black, LW * 0.6);
        omnitrix(ctx, 1.5, y, 4.2);
      }
    },
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.92, [[0, pants]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.9, s.legR2, [[0, pants]], dim),
    foot: (ctx, dim) => shoe(ctx, s, '#1b1d26', '#f0f0f0', dim, green),
  };
  s.parts = assemble(s, d);
  return s;
}

function fourarms(c) {
  const s = mk({ headW: 42, headH: 42, neck: 3, torsoLen: 84, torsoW: 82, pelvisDrop: 12,
    uArm: 30, lArm: 30, armR: 12.5, armR2: 11, handR: 12, uLeg: 32, lLeg: 32, legR: 14, legR2: 11, footL: 28, footH: 12,
    shY: 74, shY2: 50, shXF: 12, shXB: -18, hipXF: 12, hipXB: -11, fourArms: true });
  const red = c.primary, black = '#1b1d26';
  const d = {
    head(ctx) {
      const hp = (k) => D.blobPath(k, [2, 0, 21, -5, 24, -24, 16, -40, -2, -44, -19, -37, -22, -18, -14, -3]);
      D.shaded(ctx, hp, red, (k) => D.sideShade(k, -28, -8, -50, 4, 0.18));
      D.line(ctx, 5, -31, 23, -29.5, 3.2);
      for (const [x, y] of [[10, -25], [19.5, -25], [10, -17.5], [19.5, -17.5]]) {
        D.ellipsePath(ctx, x, y, 2.8, 2.1); D.fillStroke(ctx, '#ffe066', LW * 0.45);
      }
      D.curve(ctx, 11, -7, 17, -9, 23, -7, 2.2);
    },
    headBox: [-30, -54, 32, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -29, -16, 58, 28, 8); D.fillStroke(ctx, black);
      D.line(ctx, 22, -14, 24, 10, 2.5, '#f0f0f0');
      const tp = (k) => { k.beginPath(); k.moveTo(-42, -80); k.quadraticCurveTo(2, -92, 44, -80); k.quadraticCurveTo(50, -58, 30, -14); k.lineTo(-28, -14); k.quadraticCurveTo(-48, -58, -42, -80); k.closePath(); };
      D.shaded(ctx, tp, red, (k) => {
        D.curve(k, -8, -66, 8, -54, 30, -62, 2.2);
        D.line(k, 8, -50, 8, -20, 1.8);
        D.line(k, -2, -38, 18, -38, 1.6); D.line(k, -2, -28, 18, -28, 1.6);
        D.polyPath(k, [26, -88, 38, -82, -24, -14, -36, -20]); k.fillStyle = black; k.fill();
        D.sideShade(k, -50, -22, -95, 0, 0.18);
      });
      omnitrix(ctx, 5, -54, 7.5);
    },
    torsoBox: [-54, -96, 56, 20],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.92, [[0, red]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.92, s.armR2, [[0, red], [0.78, black]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, red, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.9, [[0, black]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.88, s.legR2, [[0, black], [0.86, red]], dim),
    foot: (ctx, dim) => shoe(ctx, s, red, D.shade(red, 0.7), dim),
  };
  s.parts = assemble(s, d);
  return s;
}

function xlr8(c) {
  const s = mk({ headW: 46, headH: 47, neck: 6, torsoLen: 50, torsoW: 36, pelvisDrop: 8,
    uArm: 26, lArm: 24, armR: 5.5, handR: 6, uLeg: 30, lLeg: 32, legR: 7.5, footL: 18, footH: 10,
    shY: 44, tail: { x: -15, y: 4, base: -95 } });
  const blue = c.primary, black = '#14161f';
  const d = {
    head(ctx) {
      const hp = (k) => D.blobPath(k, [4, -1, 23, -8, 25, -26, 14, -43, -8, -47, -33, -40, -38, -29, -16, -11]);
      D.shaded(ctx, hp, blue, (k) => {
        D.polyPath(k, [8, 2, 32, 2, 32, -17, 10, -15]); k.fillStyle = black; k.fill();
        D.curve(k, -34, -34, -14, -46, 8, -44, 3.2, black);
        D.sideShade(k, -40, -14, -56, 4, 0.16);
      });
      const vp = (k) => { k.beginPath(); k.moveTo(3, -32); k.quadraticCurveTo(22, -38, 27, -25); k.quadraticCurveTo(16, -18, 2, -22); k.closePath(); };
      D.shaded(ctx, vp, '#0a1a3a', (k) => D.line(k, 9, -31, 21, -31, 2.2, 'rgba(34,228,255,0.85)'), LW * 0.8);
    },
    headBox: [-46, -56, 36, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -18, -12, 36, 20, 6); D.fillStroke(ctx, black);
      D.shaded(ctx, (k) => tunicPath(k, -51, 30, 34, -8), black, (k) => {
        k.fillStyle = blue; k.fillRect(10, -60, 12, 60); k.fillRect(-24, -60, 8, 60);
        D.line(k, 10, -60, 10, 0, LW * 0.5); D.line(k, -16, -60, -16, 0, LW * 0.5);
      });
      omnitrix(ctx, 4, -38, 5.5);
    },
    torsoBox: [-26, -60, 26, 14],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, black], [0.5, blue]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, blue], [0.5, black]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, black, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.9, [[0, black]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.88, s.legR2, [[0, black], [0.5, blue]], dim),
    foot: (ctx, dim) => ovalFoot(ctx, s, black, dim, blue),
    tail: part('tail', B.TAIL, (ctx) => {
      const tp = (k) => { k.beginPath(); k.moveTo(-5, 0); k.quadraticCurveTo(-15, -26, 1, -54); k.quadraticCurveTo(-4, -26, 5, 0); k.closePath(); };
      D.shaded(ctx, tp, black, (k) => {
        D.line(k, -9, -14, 1, -18, 3, blue); D.line(k, -8, -30, 0, -32, 3, blue); D.line(k, -4, -44, 1, -45, 2.5, blue);
      });
    }, [-18, -60, 12, 6]),
  };
  s.parts = assemble(s, d);
  return s;
}

function heatblast(c) {
  const s = mk({ headW: 42, headH: 47, neck: 4, torsoLen: 54, torsoW: 42, pelvisDrop: 9,
    uArm: 25, lArm: 23, armR: 7, handR: 7.5, uLeg: 30, lLeg: 30, legR: 9, footL: 20, footH: 10,
    shY: 47 });
  const rock = c.primary, plate = D.shade(c.primary, 0.7), glow = c.secondary || '#ffb02e';
  const d = {
    head(ctx) {
      const hp = (k) => D.polyPath(k, [2, -1, 18, -4, 23, -20, 19, -38, 6, -46, -12, -44, -21, -30, -20, -10, -10, -2]);
      D.shaded(ctx, hp, rock, (k) => {
        D.polyPath(k, [-20, -30, -6, -36, -10, -16, -20, -12]); k.fillStyle = plate; k.fill();
        D.line(k, -6, -36, -10, -16, 1.6, glow);
        D.sideShade(k, -26, -10, -50, 4, 0.12);
      });
      D.ellipsePath(ctx, 12, -26, 3.4, 2.5); D.fillStroke(ctx, '#fff27a', LW * 0.5);
      D.ellipsePath(ctx, 20.5, -26, 2.9, 2.3); D.fillStroke(ctx, '#fff27a', LW * 0.5);
      D.line(ctx, 11, -12, 20, -12.5, 3);
      D.line(ctx, 12, -12, 19, -12.4, 1.2, glow);
    },
    headBox: [-28, -54, 30, 8],
    torso(ctx) {
      const tp = (k) => tunicPath(k, -55, 36, 38, 8);
      D.shaded(ctx, tp, rock, (k) => {
        D.polyPath(k, [-18, -50, 2, -54, -2, -30, -20, -26]); k.fillStyle = plate; k.fill();
        D.polyPath(k, [6, -26, 22, -30, 18, -6, 2, -4]); k.fillStyle = plate; k.fill();
        k.beginPath(); k.moveTo(-2, -54); k.lineTo(2, -36); k.lineTo(-4, -18); k.lineTo(0, 6);
        k.moveTo(2, -36); k.lineTo(16, -32); k.moveTo(-4, -18); k.lineTo(-18, -14);
        k.lineWidth = 2.2; k.strokeStyle = glow; k.lineCap = 'round'; k.lineJoin = 'round'; k.stroke();
        D.sideShade(k, -28, -10, -60, 10, 0.16);
      });
      omnitrix(ctx, 8, -42, 5.5);
    },
    torsoBox: [-28, -64, 28, 16],
    uArm: (ctx, dim) => { D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, rock]], dim, false); cracks(ctx, s.uArm, glow); },
    lArm: (ctx, dim) => { D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, rock], [0.7, plate]], dim); cracks(ctx, s.lArm * 0.7, glow); },
    hand: (ctx, dim) => { fist(ctx, s.handR, rock, dim); D.dot(ctx, 2, s.handR * 0.9, 2, glow); },
    uLeg: (ctx, dim) => { D.limb(ctx, s.uLeg, s.legR, s.legR * 0.92, [[0, plate]], dim, false); cracks(ctx, s.uLeg, glow); },
    lLeg: (ctx, dim) => { D.limb(ctx, s.lLeg, s.legR * 0.9, s.legR2, [[0, rock]], dim, false); cracks(ctx, s.lLeg, glow); },
    foot: (ctx, dim) => shoe(ctx, s, plate, '#3a120a', dim),
    headBack: [part('flame', B.HEAD, (ctx) => {
      const fl = (k, sc) => {
        k.beginPath(); k.moveTo(-18 * sc, 4); k.quadraticCurveTo(-25 * sc, -14 * sc, -12 * sc, -26 * sc);
        k.quadraticCurveTo(-10 * sc, -16 * sc, -4 * sc, -20 * sc); k.quadraticCurveTo(-7 * sc, -38 * sc, 5 * sc, -50 * sc);
        k.quadraticCurveTo(6 * sc, -32 * sc, 12 * sc, -30 * sc); k.quadraticCurveTo(15 * sc, -40 * sc, 22 * sc, -42 * sc);
        k.quadraticCurveTo(26 * sc, -18 * sc, 18 * sc, 4); k.closePath();
      };
      fl(ctx, 1); D.fillStroke(ctx, '#ff5a1a', LW * 0.7);
      fl(ctx, 0.7); ctx.fillStyle = '#ffb02e'; ctx.fill();
      fl(ctx, 0.42); ctx.fillStyle = '#fff3b0'; ctx.fill();
    }, [-30, -58, 30, 8], { ox: 1, oy: -36, dyn: 'flame' })],
  };
  s.parts = assemble(s, d);
  return s;
}

function nobita(c) {
  const s = mk({ headW: 46, headH: 50, neck: 4, torsoLen: 50, torsoW: 38, pelvisDrop: 10,
    uArm: 23, lArm: 21, armR: 5.5, handR: 6, uLeg: 28, lLeg: 28, legR: 7.5, footL: 20, footH: 10,
    shY: 44 });
  const yel = c.primary, blue = '#2d5dbf', skin = c.skin;
  const d = {
    head(ctx) {
      const fp = (k) => D.blobPath(k, [2, -1, 20, -6, 24, -25, 18, -43, 0, -49, -18, -44, -23, -24, -16, -6]);
      D.shaded(ctx, fp, skin, (k) => D.sideShade(k, -28, -10, -56, 4, 0.1));
      const hp = (k) => {
        k.beginPath(); k.moveTo(-23, -18); k.quadraticCurveTo(-28, -47, -2, -53); k.quadraticCurveTo(21, -55, 26, -36);
        k.quadraticCurveTo(22, -32, 18, -37); k.quadraticCurveTo(10, -41, 1, -37); k.quadraticCurveTo(-7, -34, -10, -27);
        k.quadraticCurveTo(-16, -21, -23, -18); k.closePath();
      };
      D.shaded(ctx, hp, DARK, (k) => D.curve(k, -16, -46, -2, -52, 14, -49, 2, 'rgba(255,255,255,0.2)'));
      D.curve(ctx, -9, -50, -14, -58, -7, -56, 2.4);
      ear(ctx, -6, -23, skin);
      D.dot(ctx, 11.5, -24, 1.9, D.OUTLINE); D.dot(ctx, 24.5, -24, 1.7, D.OUTLINE);
      D.line(ctx, 3, -26, -7, -28, 2.2);
      D.circle(ctx, 10.5, -25, 7.2, 'rgba(190,225,255,0.42)', LW * 0.85);
      D.circle(ctx, 24, -25, 6.3, 'rgba(190,225,255,0.42)', LW * 0.85);
      D.line(ctx, 7, -28.5, 10, -30.5, 1.4, 'rgba(255,255,255,0.9)');
      D.line(ctx, 21, -28.5, 23.5, -30, 1.4, 'rgba(255,255,255,0.9)');
      D.curve(ctx, 26, -21, 28, -19, 25.5, -17, 1.5);
      D.curve(ctx, 14, -11, 17.5, -9.5, 21, -11.5, 1.9);
    },
    headBox: [-34, -66, 36, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -19, -13, 38, 23, 6); D.fillStroke(ctx, blue);
      D.shaded(ctx, (k) => tunicPath(k, -51, 32, 38, -8), yel, (k) => D.sideShade(k, -24, -9, -58, 0, 0.16));
      D.polyPath(ctx, [-7, -52, 3, -51, -2, -44]); D.fillStroke(ctx, '#ffffff', LW * 0.6);
      D.polyPath(ctx, [3, -51, 13, -52, 8, -44]); D.fillStroke(ctx, '#ffffff', LW * 0.6);
    },
    torsoBox: [-26, -60, 26, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, yel], [0.48, skin]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, skin]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.92, [[0, blue], [0.32, skin]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.9, s.legR2, [[0, skin], [0.68, '#ffffff']], dim),
    foot: (ctx, dim) => shoe(ctx, s, '#3b4a6b', '#f0f0f0', dim),
  };
  s.parts = assemble(s, d);
  return s;
}

function goku(c) {
  const s = mk({ headW: 46, headH: 51, neck: 3, torsoLen: 46, torsoW: 40, pelvisDrop: 10,
    uArm: 21, lArm: 20, armR: 6, handR: 6.5, uLeg: 25, lLeg: 25, legR: 8, footL: 21, footH: 10,
    shY: 40, tail: { x: -18, y: 6, base: -70 } });
  const gi = c.primary, blue = c.secondary || '#2550c8', skin = c.skin, boot = '#24306e';
  const d = {
    head(ctx) {
      D.polyPath(ctx, [14, -40, 24, -58, 4, -48, 1, -70, -10, -51, -26, -66, -21, -45, -42, -51, -27, -34, -44, -27, -25, -22, -35, -9, -15, -14]);
      D.fillStroke(ctx, DARK);
      const fp = (k) => D.blobPath(k, [2, -1, 19, -6, 23, -23, 18, -39, 0, -45, -17, -40, -22, -22, -15, -5]);
      D.shaded(ctx, fp, skin, (k) => D.sideShade(k, -26, -10, -50, 4, 0.1));
      D.polyPath(ctx, [-10, -38, 0, -29, 4, -39, 11, -27, 15, -38, 25, -29, 24, -44, 6, -50, -12, -46]);
      D.fillStroke(ctx, DARK);
      D.curve(ctx, -2, -46, 8, -50, 18, -44, 1.8, 'rgba(255,255,255,0.22)');
      ear(ctx, -5, -21, skin);
      D.eye(ctx, 11, -24, 3.6, 4.6, D.OUTLINE, 0.62, 0.25);
      D.eye(ctx, 20, -24, 3.1, 4.3, D.OUTLINE, 0.62, 0.25);
      D.line(ctx, 7, -30.5, 14, -29.5, 2.4); D.line(ctx, 17.5, -29.5, 23, -31, 2.4);
      D.curve(ctx, 21, -20, 23, -17.5, 20.5, -16, 1.4);
      D.curve(ctx, 11.5, -11.5, 16, -8, 21, -11.5, 2);
    },
    headBox: [-50, -78, 36, 8],
    torso(ctx) {
      D.roundRectPath(ctx, -20, -13, 40, 23, 6); D.fillStroke(ctx, gi);
      D.shaded(ctx, (k) => tunicPath(k, -47, 34, 40, -8), gi, (k) => {
        D.polyPath(k, [-5, -49, 12, -49, 4, -32]); k.fillStyle = blue; k.fill();
        D.line(k, -5, -49, 4, -32, LW * 0.6); D.line(k, 12, -49, 4, -32, LW * 0.6);
        D.sideShade(k, -26, -10, -56, 0, 0.18);
      });
      D.roundRectPath(ctx, -21, -16, 42, 7, 3); D.fillStroke(ctx, blue, LW * 0.8);
      D.roundRectPath(ctx, 12, -12, 4, 11, 1.5); D.fillStroke(ctx, blue, LW * 0.6);
      D.roundRectPath(ctx, 16, -12, 4, 9, 1.5); D.fillStroke(ctx, blue, LW * 0.6);
    },
    torsoBox: [-28, -58, 28, 16],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.95, [[0, gi], [0.22, blue], [0.48, skin]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.95, s.armR2, [[0, skin], [0.7, blue]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.94, [[0, gi]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.92, s.legR2, [[0, gi], [0.72, boot]], dim),
    foot: (ctx, dim) => shoe(ctx, s, boot, '#e8b45a', dim),
    tail: part('tail', B.TAIL, (ctx) => {
      const path = () => { ctx.beginPath(); ctx.moveTo(0, 0); ctx.bezierCurveTo(-14, -16, -14, -38, 2, -40); ctx.quadraticCurveTo(12, -40, 9, -31); };
      path(); ctx.lineWidth = 9.5; ctx.strokeStyle = D.OUTLINE; ctx.lineCap = 'round'; ctx.stroke();
      path(); ctx.lineWidth = 6; ctx.strokeStyle = '#8a5a2b'; ctx.stroke();
    }, [-20, -48, 18, 8]),
    behind: [part('staffBack', B.TORSO, staffDraw(-58, 58), [-10, -66, 10, 66], { ox: -10, oy: -30, rot: 42, dyn: 'staffBack' })],
    beforeHandF: [part('staffHand', B.HF, staffDraw(-26, 104), [-10, -34, 10, 112], { oy: 4, dyn: 'staffHand' })],
  };
  s.parts = assemble(s, d);
  return s;
}

function bheem(c) {
  const s = mk({ headW: 46, headH: 48, neck: 3, torsoLen: 62, torsoW: 56, pelvisDrop: 14,
    uArm: 25, lArm: 23, armR: 9, armR2: 7.5, handR: 8.5, uLeg: 26, lLeg: 26, legR: 11, legR2: 7, footL: 22, footH: 10,
    shY: 54, shXF: 5, shXB: -11, hipXF: 9, hipXB: -8 });
  const dhoti = c.primary, scarf = c.secondary || '#ffcc33', skin = c.skin, gold = '#ffc83a', sash = '#d8392b';
  const d = {
    head(ctx) {
      const fp = (k) => D.blobPath(k, [2, -1, 21, -6, 25, -24, 18, -41, 0, -47, -18, -42, -23, -22, -16, -5]);
      D.shaded(ctx, fp, skin, (k) => D.sideShade(k, -28, -10, -54, 4, 0.12));
      const hp = (k) => {
        k.beginPath(); k.moveTo(-23, -17); k.quadraticCurveTo(-27, -45, -2, -49); k.quadraticCurveTo(19, -51, 24, -36);
        k.quadraticCurveTo(15, -40, 6, -38); k.quadraticCurveTo(-4, -36, -10, -29); k.quadraticCurveTo(-16, -22, -23, -17); k.closePath();
      };
      D.shaded(ctx, hp, DARK, null);
      D.ellipsePath(ctx, -5, -52, 6.5, 5); D.fillStroke(ctx, DARK, LW * 0.8);
      D.curve(ctx, -9, -56, -15, -62, -19, -57, 3);
      ear(ctx, -7, -22, skin);
      D.eye(ctx, 11, -27, 3.8, 4.6);
      D.eye(ctx, 21, -27, 3.4, 4.4);
      D.line(ctx, 6.5, -34, 15, -35.5, 3); D.line(ctx, 18, -35.5, 24.5, -34, 3);
      D.curve(ctx, 22, -22, 24.5, -19, 21.5, -17.5, 1.6);
      D.curve(ctx, 11, -14, 17, -8, 23, -14, 2.3);
    },
    headBox: [-34, -66, 36, 8],
    torso(ctx) {
      const dp = (k) => { k.beginPath(); k.moveTo(-25, -18); k.lineTo(25, -18); k.quadraticCurveTo(31, 0, 23, 15); k.quadraticCurveTo(11, 19, 1, 12); k.quadraticCurveTo(-11, 19, -24, 15); k.quadraticCurveTo(-31, 0, -25, -18); k.closePath(); };
      D.shaded(ctx, dp, dhoti, (k) => { D.line(k, -10, -14, -14, 10, 1.6, D.shade(dhoti, 0.7)); D.line(k, 10, -14, 14, 10, 1.6, D.shade(dhoti, 0.7)); D.sideShade(k, -32, -14, -20, 20, 0.16); });
      const cp = (k) => { k.beginPath(); k.moveTo(-25, -60); k.quadraticCurveTo(0, -67, 27, -60); k.quadraticCurveTo(33, -44, 21, -18); k.lineTo(-21, -18); k.quadraticCurveTo(-33, -44, -25, -60); k.closePath(); };
      D.shaded(ctx, cp, skin, (k) => {
        D.curve(k, 0, -48, 9, -40, 22, -47, 1.8);
        D.line(k, 4, -36, 4, -22, 1.4);
        D.line(k, -2, -30, 10, -30, 1.2, 'rgba(11,15,30,0.5)');
        D.sideShade(k, -34, -14, -70, 0, 0.16);
        D.polyPath(k, [14, -66, 28, -58, -14, -16, -30, -24]); k.fillStyle = scarf; k.fill();
        D.line(k, 14, -66, -30, -24, LW * 0.7); D.line(k, 28, -58, -14, -16, LW * 0.7);
        D.line(k, 18, -58, -18, -24, 1.2, D.shade(scarf, 0.75));
      });
      D.roundRectPath(ctx, -25, -22, 50, 8, 3); D.fillStroke(ctx, sash, LW * 0.8);
    },
    torsoBox: [-36, -72, 36, 22],
    uArm: (ctx, dim) => D.limb(ctx, s.uArm, s.armR, s.armR * 0.92, [[0, skin], [0.2, gold], [0.36, skin]], dim),
    lArm: (ctx, dim) => D.limb(ctx, s.lArm, s.armR * 0.9, s.armR2, [[0, skin], [0.76, gold]], dim),
    hand: (ctx, dim) => fist(ctx, s.handR, skin, dim),
    uLeg: (ctx, dim) => D.limb(ctx, s.uLeg, s.legR, s.legR * 0.95, [[0, dhoti]], dim),
    lLeg: (ctx, dim) => D.limb(ctx, s.lLeg, s.legR * 0.8, s.legR2, [[0, dhoti], [0.28, skin]], dim),
    foot: (ctx, dim) => shoe(ctx, s, skin, D.shade(skin, 0.75), dim),
    behind: [part('trail', B.TORSO, (ctx) => {
      ctx.beginPath(); ctx.moveTo(-5, 0); ctx.quadraticCurveTo(-10, 20, -3, 38); ctx.lineTo(7, 35); ctx.quadraticCurveTo(2, 18, 6, 0); ctx.closePath();
      D.fillStroke(ctx, scarf, LW * 0.8);
      D.line(ctx, 0, 6, 1, 30, 1.2, D.shade(scarf, 0.75));
    }, [-16, -6, 14, 44], { ox: -18, oy: -58, rot: 35, dyn: 'trail' })],
  };
  s.parts = assemble(s, d);
  return s;
}

const BUILDERS = { shinchan, doraemon, hattori, pikachu, ben10, fourarms, xlr8, heatblast, nobita, goku, bheem };
export const FORMS = { ben10: ['fourarms', 'xlr8', 'heatblast'] };

const specCache = new Map();
/** rig spec for a fighter (form = null for base). Cached. */
export function getSpec(charId, form = null) {
  const id = BUILDERS[charId] ? charId : 'ben10';
  const fkey = form && BUILDERS[form] ? form : null;
  const key = id + '|' + (fkey || '');
  let s = specCache.get(key);
  if (s) return s;
  const pal = paletteFor(id, fkey);
  s = BUILDERS[fkey || id](pal);
  const body = bodyFor(id, fkey);
  s.id = id; s.form = fkey; s.pal = pal; s.body = body;
  s.k = body.h / s.H;           // uniform scale so art height matches the engine hurtbox
  specCache.set(key, s);
  return s;
}

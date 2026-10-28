// Phaser-free skeleton: joint/bone indices, forward kinematics and ground snapping.
// Angles in poses are degrees, "forward-positive": a positive value moves the free end of the
// part toward the facing direction. Limbs hang down at 0; torso/head/tail point up at 0.

export const J = {
  RX: 0, RY: 1, ROT: 2, TOR: 3, HEAD: 4,
  AUF: 5, ALF: 6, AUB: 7, ALB: 8,
  LUF: 9, LLF: 10, LUB: 11, LLB: 12,
  FTF: 13, FTB: 14, TAIL: 15, SX: 16, SY: 17,
};
export const NJ = 18;
export const JOINT_KEYS = ['rx', 'ry', 'rot', 'tor', 'head', 'auf', 'alf', 'aub', 'alb', 'luf', 'llf', 'lub', 'llb', 'ftf', 'ftb', 'tail', 'sx', 'sy'];

export const B = {
  HIP: 0, TORSO: 1, HEAD: 2,
  AUF: 3, ALF: 4, HF: 5,
  AUB: 6, ALB: 7, HB: 8,
  LUF: 9, LLF: 10, FF: 11,
  LUB: 12, LLB: 13, FB: 14,
  TAIL: 15,
  AUF2: 16, ALF2: 17, HF2: 18,
  AUB2: 19, ALB2: 20, HB2: 21,
};
export const NB = 22;
export const D2R = Math.PI / 180;

function setBone(out, i, x, y, r) {
  const o = i * 3;
  out[o] = x; out[o + 1] = y; out[o + 2] = r;
}

function arm(out, s, bi, shX, shY, tor, aU, aL) {
  const hx = out[0], hy = out[1];
  const c = Math.cos(tor), sn = Math.sin(tor);
  const sx = hx + shX * c + shY * sn;
  const sy = hy + shX * sn - shY * c;
  const ua = tor - aU * D2R;
  setBone(out, bi, sx, sy, ua);
  const ex = sx - Math.sin(ua) * s.uArm;
  const ey = sy + Math.cos(ua) * s.uArm;
  const la = ua - aL * D2R;
  setBone(out, bi + 1, ex, ey, la);
  setBone(out, bi + 2, ex - Math.sin(la) * s.lArm, ey + Math.cos(la) * s.lArm, la);
}

function leg(out, s, bi, hipX, b, lU, lL, ft) {
  const hx = out[0], hy = out[1];
  const c = Math.cos(b), sn = Math.sin(b);
  const jx = hx + hipX * c - s.hipDrop * sn;
  const jy = hy + hipX * sn + s.hipDrop * c;
  const ul = b - lU * D2R;
  setBone(out, bi, jx, jy, ul);
  const kx = jx - Math.sin(ul) * s.uLeg;
  const ky = jy + Math.cos(ul) * s.uLeg;
  const ll = ul - lL * D2R;
  setBone(out, bi + 1, kx, ky, ll);
  setBone(out, bi + 2, kx - Math.sin(ll) * s.lLeg, ky + Math.cos(ll) * s.lLeg, b - ft * D2R);
}

/** Forward kinematics into out (Float32Array(NB*3)), body space, hip at (0,-hipH). */
export function solveRig(s, p, out) {
  const b = p[J.ROT] * D2R;
  setBone(out, B.HIP, 0, -s.hipH, b);
  const tor = b + p[J.TOR] * D2R;
  setBone(out, B.TORSO, 0, -s.hipH, tor);
  const nl = s.torsoLen + s.neck;
  setBone(out, B.HEAD, Math.sin(tor) * nl, -s.hipH - Math.cos(tor) * nl, tor + p[J.HEAD] * D2R);
  arm(out, s, B.AUB, s.shXB, s.shY, tor, p[J.AUB], p[J.ALB]);
  arm(out, s, B.AUF, s.shXF, s.shY, tor, p[J.AUF], p[J.ALF]);
  if (s.fourArms) {
    arm(out, s, B.AUB2, s.shXB * 0.9, s.shY2, tor, p[J.AUB] - 30, p[J.ALB] * 0.7 + 12);
    arm(out, s, B.AUF2, s.shXF * 0.9, s.shY2, tor, p[J.AUF] - 26, p[J.ALF] * 0.75 + 10);
  }
  leg(out, s, B.LUB, s.hipXB, b, p[J.LUB], p[J.LLB], p[J.FTB]);
  leg(out, s, B.LUF, s.hipXF, b, p[J.LUF], p[J.LLF], p[J.FTF]);
  if (s.tail) {
    const c = Math.cos(b), sn = Math.sin(b);
    const tx = s.tail.x, ty = s.tail.y;
    setBone(out, B.TAIL, tx * c - ty * sn, -s.hipH + tx * sn + ty * c, b + (p[J.TAIL] + s.tail.base) * D2R);
  }
}

function footLow(s, out, i) {
  const o = i * 3;
  const y = out[o + 1], r = out[o + 2];
  const sn = Math.sin(r), c = Math.cos(r);
  const toe = y + s.footL * 0.72 * sn + s.footH * c;
  const heel = y - s.footL * 0.32 * sn + s.footH * c;
  return toe > heel ? toe : heel;
}

/** lowest body point (max y) for ground snapping */
export function lowestY(s, out) {
  let m = footLow(s, out, B.FF);
  let v = footLow(s, out, B.FB); if (v > m) m = v;
  v = out[B.LLF * 3 + 1] + s.legR * 0.9; if (v > m) m = v;
  v = out[B.LLB * 3 + 1] + s.legR * 0.9; if (v > m) m = v;
  v = out[B.HF * 3 + 1] + s.handR * 1.4; if (v > m) m = v;
  v = out[B.HB * 3 + 1] + s.handR * 1.4; if (v > m) m = v;
  const hr = out[B.HEAD * 3 + 2];
  v = out[B.HEAD * 3 + 1] - Math.cos(hr) * s.headH * 0.5 + s.headH * 0.45; if (v > m) m = v;
  const tr = out[B.TORSO * 3 + 2];
  v = out[1] - Math.cos(tr) * s.torsoLen * 0.5 + s.torsoW * 0.42; if (v > m) m = v;
  v = out[1] + s.pelvisDrop; if (v > m) m = v;
  return m;
}

/** top of head (min y), approximate */
export function highestY(s, out) {
  const hr = out[B.HEAD * 3 + 2];
  return out[B.HEAD * 3 + 1] - Math.cos(hr) * s.headH;
}

/** build a pose Float32Array from a partial object, falling back to base */
export function makePose(obj, base) {
  const p = new Float32Array(NJ);
  if (base) p.set(base); else { p[J.SX] = 1; p[J.SY] = 1; }
  for (let i = 0; i < NJ; i++) {
    const k = JOINT_KEYS[i];
    if (obj && obj[k] !== undefined) p[i] = obj[k];
  }
  return p;
}

// Seven procedural stages. Each def: { layers: [{ f, top, h, d, soft, draw(c, rnd, marks, perf) }], amb(B, marks) }
// Layer canvases are drawn in world coordinates; floor top at y = 640. Fighter zone (y 440-640) is kept calm.
import {
  W, X0, X1, LW, TAU, rgba, mix, vgrad, hgrad, fillAll, glow, rrect, circle, ellipse, neon, ridge, cloud, stars, floor, haze,
  windows, rope, between,
} from './paint.js';
import * as S from './sprites.js';
import { twinkle, drift, fall, flock, sway, pulse, blink, flames, embers } from './ambient.js';

const C = {
  navy: '#070b1a', navy2: '#0d1530', cyan: '#22e4ff', blue: '#2f6bff', orange: '#ff8a1f', magenta: '#ff2fa6',
  text: '#eaf2ff', gold: '#ffd24a',
};

const inCenter = (x) => x > 300 && x < 980;
function mark(m, k, v) {
  (m[k] || (m[k] = [])).push(v);
}

function palm(c, x, base, h, lean, col, lw, rim) {
  const tx = x + lean;
  const ty = base - h;
  c.lineCap = 'round';
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.beginPath();
  c.moveTo(x, base);
  c.quadraticCurveTo(x + lean * 0.05, base - h * 0.55, tx, ty);
  c.stroke();
  if (rim) {
    c.strokeStyle = rgba(rim, 0.35);
    c.lineWidth = Math.max(1, lw * 0.18);
    c.beginPath();
    c.moveTo(x + lw * 0.35, base);
    c.quadraticCurveTo(x + lean * 0.05 + lw * 0.35, base - h * 0.55, tx + lw * 0.3, ty);
    c.stroke();
  }
  // trunk rings
  c.strokeStyle = rgba('#000000', 0.3);
  c.lineWidth = 1.5;
  for (let i = 1; i < 12; i++) {
    const t = i / 12;
    const px = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + lean * 0.05) + t * t * tx;
    const py = (1 - t) * (1 - t) * base + 2 * (1 - t) * t * (base - h * 0.55) + t * t * ty;
    c.beginPath();
    c.moveTo(px - lw * 0.5, py);
    c.lineTo(px + lw * 0.5, py + 2);
    c.stroke();
  }
  c.fillStyle = col;
  const len = h * 0.42;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.98 + (i * 1.04) / 7);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + Math.abs(Math.cos(a)) * len * 0.55;
    const mx = (tx + ex) / 2;
    const my = (ty + ey) / 2;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(mx, my - len * 0.3, ex, ey);
    c.quadraticCurveTo(mx, my - len * 0.08, tx, ty + 4);
    c.fill();
  }
  circle(c, tx, ty + 4, lw * 0.7, mix(col, '#000000', 0.2));
}

/* ------------------------------------------------------------------ NEON CITY */
const neon_city = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        const sky = vgrad(c, 0, 700, [[0, '#03051a'], [0.42, '#0b1145'], [0.68, '#25135c'], [0.85, '#5a1a72'], [1, '#b42a86']]);
        fillAll(c, sky);
        glow(c, 640, 690, 820, C.magenta, 0.5, 0.3);
        glow(c, 160, 600, 460, C.cyan, 0.16, 0.45);
        glow(c, 1120, 610, 460, C.blue, 0.28, 0.45);
        stars(c, r, 80, 0, 380, '#eaf2ff', 1.1);
        circle(c, 1030, 118, 36, '#eaf4ff');
        c.fillStyle = sky;
        c.beginPath();
        c.arc(1046, 106, 32, 0, TAU);
        c.fill();
        glow(c, 1030, 118, 170, '#8fd0ff', 0.25);
        for (let i = 0; i < 6; i++) {
          glow(c, between(r, 0, W), between(r, 260, 470), between(r, 160, 320), i % 2 ? C.magenta : C.blue, 0.1, 0.12);
        }
      },
    },
    {
      f: -0.02, top: 160, h: 500,
      draw(c, r, m) {
        let x = X0 - 10;
        while (x < X1) {
          const w = between(r, 36, 84);
          const hh = between(r, 120, 330);
          const top = 620 - hh;
          c.fillStyle = '#1d1952';
          c.fillRect(x, top, w, 660 - top);
          if (r() < 0.3) {
            const sx = x + w / 2;
            const sh = between(r, 30, 70);
            c.fillRect(sx - 1.5, top - sh, 3, sh);
            mark(m, 'blink', { x: sx, y: top - sh, f: -0.02, d: 1.5, s: 0.26 });
          } else if (r() < 0.4) {
            c.fillRect(x + w * 0.2, top - 16, w * 0.6, 16);
          }
          windows(c, r, x, top, w, hh - 40, [C.cyan, '#8a7bff', C.magenta], 0.18, 0.45, 3, 4, 5, 7);
          x += w + between(r, 2, 10);
        }
        haze(c, 360, 660, '#7a2a8a', 0, 0.45);
        x = X0 - 10;
        while (x < X1) {
          const w = between(r, 50, 110);
          const hh = between(r, 70, 200);
          const top = 640 - hh;
          c.fillStyle = '#120f38';
          c.fillRect(x, top, w, 660 - top);
          c.fillStyle = rgba(C.magenta, 0.35);
          c.fillRect(x, top, w, 2);
          windows(c, r, x, top, w, hh - 20, [C.cyan, C.orange, '#ffd27a'], inCenter(x) ? 0.08 : 0.22, 0.6, 4, 5, 6, 8);
          x += w + between(r, 0, 6);
        }
        haze(c, 520, 660, C.magenta, 0, 0.2);
      },
    },
    {
      f: -0.05, top: 30, h: 630,
      draw(c, r, m) {
        const bldg = (x, w, top, fill) => {
          c.fillStyle = fill;
          c.fillRect(x, top, w, 680 - top);
          c.fillStyle = rgba(C.cyan, 0.3);
          c.fillRect(x + w - 2, top, 2, 680 - top);
          c.fillStyle = rgba('#000000', 0.35);
          c.fillRect(x, top, 4, 680 - top);
          c.fillStyle = rgba(C.cyan, 0.45);
          c.fillRect(x, top, w, 2);
        };
        let x = 296;
        while (x < 990) {
          const w = between(r, 70, 130);
          const top = between(r, 505, 548);
          bldg(x, w, top, '#0b0e2c');
          windows(c, r, x, top, w, 640 - top, ['#6a7bff', C.cyan], 0.1, 0.35, 5, 6, 8, 10);
          if (r() < 0.5) {
            c.fillStyle = '#0b0e2c';
            c.fillRect(x + w * 0.3, top - 14, 22, 14);
          }
          x += w + between(r, 4, 14);
        }
        bldg(-70, 200, 110, '#0a0d2a');
        bldg(120, 190, 240, '#0d1134');
        bldg(980, 180, 210, '#0d1134');
        bldg(1150, 200, 90, '#0a0d2a');
        const wc = [C.cyan, C.orange, '#ffd27a', C.magenta];
        windows(c, r, -60, 440, 120, 200, wc, 0.25, 0.7, 7, 9, 10, 12);
        windows(c, r, 130, 330, 170, 300, wc, 0.22, 0.6, 8, 10, 10, 12);
        windows(c, r, 990, 330, 160, 300, wc, 0.22, 0.6, 8, 10, 10, 12);
        windows(c, r, 1160, 270, 180, 360, wc, 0.25, 0.7, 7, 9, 10, 12);
        // rooftop antennas
        c.fillStyle = '#0a0d2a';
        c.fillRect(18, 40, 4, 70);
        c.fillRect(4, 64, 32, 3);
        mark(m, 'blink', { x: 20, y: 40, f: -0.05, d: 2.6, s: 0.32 });
        c.fillRect(1268, 24, 4, 66);
        c.fillRect(1254, 46, 32, 3);
        mark(m, 'blink', { x: 1270, y: 24, f: -0.05, d: 2.6, s: 0.32 });
        // vertical sign (left tower)
        c.fillStyle = '#14082c';
        rrect(c, 40, 170, 54, 250, 10);
        c.fill();
        neon(c, C.magenta, 4, 18, () => rrect(c, 40, 170, 54, 250, 10));
        neon(c, C.cyan, 4, 14, () => {
          c.beginPath();
          c.arc(67, 208, 13, 0, TAU);
          c.moveTo(53, 246);
          c.lineTo(81, 246);
          c.moveTo(53, 262);
          c.lineTo(81, 262);
          c.moveTo(67, 290);
          c.lineTo(81, 320);
          c.lineTo(53, 320);
          c.closePath();
          c.moveTo(80, 372);
          c.arc(67, 372, 13, 0, TAU);
        });
        mark(m, 'signs', { x: 67, y: 295, w: 90, h: 290, color: C.magenta, f: -0.05 });
        // horizontal sign (second tower)
        c.fillStyle = '#061428';
        rrect(c, 140, 280, 150, 46, 12);
        c.fill();
        neon(c, C.cyan, 4, 16, () => rrect(c, 140, 280, 150, 46, 12));
        neon(c, C.orange, 3.5, 12, () => {
          c.beginPath();
          c.moveTo(158, 303);
          for (let i = 0; i < 7; i++) c.lineTo(170 + i * 16, i % 2 ? 293 : 313);
        });
        mark(m, 'signs', { x: 215, y: 303, w: 190, h: 80, color: C.cyan, f: -0.05 });
        // round sign (right tower)
        neon(c, C.orange, 5, 18, () => {
          c.beginPath();
          c.arc(1065, 300, 40, 0, TAU);
        });
        neon(c, C.magenta, 3.5, 14, () => {
          c.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const rr = i % 2 ? 11 : 26;
            if (i === 0) c.moveTo(1065 + Math.cos(a) * rr, 300 + Math.sin(a) * rr);
            else c.lineTo(1065 + Math.cos(a) * rr, 300 + Math.sin(a) * rr);
          }
          c.closePath();
        });
        mark(m, 'signs', { x: 1065, y: 300, w: 120, h: 120, color: C.orange, f: -0.05 });
        // billboard (far right tower)
        c.fillStyle = vgrad(c, 150, 246, [[0, '#2a0f4a'], [1, '#0d0a2a']]);
        rrect(c, 1170, 150, 150, 96, 10);
        c.fill();
        neon(c, C.cyan, 4, 16, () => rrect(c, 1170, 150, 150, 96, 10));
        c.save();
        c.shadowColor = C.orange;
        c.shadowBlur = 16 * (c.getTransform ? c.getTransform().a : 1);
        c.fillStyle = C.orange;
        c.beginPath();
        c.moveTo(1212, 162);
        c.lineTo(1192, 202);
        c.lineTo(1208, 202);
        c.lineTo(1198, 236);
        c.lineTo(1230, 190);
        c.lineTo(1214, 190);
        c.lineTo(1226, 162);
        c.closePath();
        c.fill();
        c.restore();
        neon(c, C.magenta, 4, 10, () => {
          c.beginPath();
          c.moveTo(1248, 178);
          c.lineTo(1302, 178);
          c.moveTo(1248, 198);
          c.lineTo(1290, 198);
          c.moveTo(1248, 218);
          c.lineTo(1302, 218);
        });
        mark(m, 'signs', { x: 1245, y: 198, w: 190, h: 130, color: C.cyan, f: -0.05 });
        haze(c, 540, 660, '#0a0620', 0, 0.55);
      },
    },
    {
      f: -0.08, top: 360, h: 300,
      draw(c, r, m) {
        const dark = '#070a1f';
        const rim = C.cyan;
        // railing along the roof edge
        c.fillStyle = '#0a0e26';
        c.fillRect(X0, 590, LW, 5);
        c.fillRect(X0, 614, LW, 3);
        for (let x = X0 + 10; x < X1; x += 64) c.fillRect(x, 590, 5, 50);
        c.fillStyle = rgba(rim, 0.55);
        c.fillRect(X0, 590, LW, 1.5);
        c.fillStyle = rgba(C.magenta, 0.25);
        c.fillRect(X0, 614, LW, 1);
        // water tower (left)
        c.strokeStyle = dark;
        c.lineWidth = 6;
        c.beginPath();
        c.moveTo(-20, 640);
        c.lineTo(0, 520);
        c.moveTo(130, 640);
        c.lineTo(110, 520);
        c.moveTo(55, 640);
        c.lineTo(55, 520);
        c.moveTo(-10, 592);
        c.lineTo(120, 560);
        c.moveTo(120, 592);
        c.lineTo(-10, 560);
        c.stroke();
        c.fillStyle = dark;
        rrect(c, -20, 430, 150, 95, 8);
        c.fill();
        c.beginPath();
        c.moveTo(-28, 434);
        c.lineTo(55, 388);
        c.lineTo(138, 434);
        c.closePath();
        c.fill();
        c.strokeStyle = rgba('#2a3a7a', 0.55);
        c.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          c.beginPath();
          c.moveTo(-5 + i * 25, 440);
          c.lineTo(-5 + i * 25, 520);
          c.stroke();
        }
        c.strokeStyle = rgba(rim, 0.6);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(130, 438);
        c.lineTo(130, 520);
        c.moveTo(56, 389);
        c.lineTo(137, 433);
        c.stroke();
        // AC units
        for (let i = 0; i < 2; i++) {
          const ax = 160 + i * 78;
          c.fillStyle = '#0c1130';
          rrect(c, ax, 594, 70, 46, 5);
          c.fill();
          c.strokeStyle = rgba(rim, 0.3);
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(ax + 35, 617, 15, 0, TAU);
          c.moveTo(ax + 20, 617);
          c.lineTo(ax + 50, 617);
          c.moveTo(ax + 35, 602);
          c.lineTo(ax + 35, 632);
          c.stroke();
          c.fillStyle = rgba(rim, 0.45);
          c.fillRect(ax, 594, 70, 2);
        }
        // stairwell (right)
        c.fillStyle = dark;
        c.fillRect(1120, 490, 240, 160);
        c.fillStyle = '#0c1130';
        c.fillRect(1112, 482, 256, 12);
        c.fillStyle = rgba(rim, 0.55);
        c.fillRect(1112, 482, 256, 2);
        c.fillStyle = '#1a0f22';
        c.fillRect(1170, 548, 56, 92);
        c.fillStyle = vgrad(c, 548, 640, [[0, rgba(C.orange, 0.3)], [1, rgba(C.orange, 0)]]);
        c.fillRect(1170, 548, 56, 92);
        glow(c, 1198, 536, 70, C.orange, 0.5);
        circle(c, 1198, 534, 5, '#ffd27a');
        mark(m, 'signs', { x: 1198, y: 536, w: 80, h: 80, color: C.orange, f: -0.08 });
        c.fillStyle = dark;
        c.fillRect(1270, 440, 16, 50);
        c.fillRect(1262, 434, 32, 10);
        c.fillRect(1318, 380, 4, 110);
        c.fillRect(1300, 410, 40, 3);
        c.fillRect(1306, 430, 28, 3);
        mark(m, 'blink', { x: 1320, y: 380, f: -0.08, d: 3.5, s: 0.36 });
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c) {
        floor(c, {
          c0: '#1b2050', c1: '#0a0d26', c2: '#05071a', line: C.cyan, lineA: 0.18, edge: C.cyan, edgeA: 0.8,
          pool: C.blue, poolA: 0.25, spacing: 110, rows: 4,
          decor(cc) {
            glow(cc, 230, 676, 240, C.magenta, 0.28, 0.16);
            glow(cc, 1090, 676, 240, C.cyan, 0.2, 0.16);
            glow(cc, 1198, 660, 90, C.orange, 0.25, 0.22);
          },
        });
      },
    },
  ],
  amb(B, m) {
    const P = B.perf;
    twinkle(B, P ? 12 : 36, S.star(B), { y0: 8, y1: 360, depth: 0.2, s0: 0.25, s1: 0.75, a0: 0.05, a1: 0.95 });
    drift(B, P ? 2 : 4, S.cloud(B, 'neon', '#4a2a86', '#1c1248'), {
      y0: 150, y1: 330, depth: 0.5, f: -0.01, vx0: 5, vx1: 12, s0: 0.9, s1: 1.6, a0: 0.25, a1: 0.5, wrap: 300, flip: true,
    });
    if (m.blink) blink(B, P ? m.blink.slice(0, 4) : m.blink, S.dot(B, '#ff3b5c'), { add: true, speed: 0.0007 });
    if (!P) {
      const beams = [];
      const bx = [360, 930];
      const bc = [C.cyan, C.magenta];
      for (let i = 0; i < 2; i++) {
        const b = B.img(S.beam(B, bc[i]), bx[i], 640, 0.6, -0.02, 0.5, 1);
        b.ph = i * 2.1;
        b.o.alpha = 0.09;
        B.add(b);
        beams.push(b);
      }
      B.tick((dt, t) => {
        for (let i = 0; i < beams.length; i++) beams[i].o.rotation = Math.sin(t * 0.00035 + beams[i].ph) * 0.42;
      });
      const glows = [];
      const signs = m.signs || [];
      for (let i = 0; i < signs.length; i++) {
        const s = signs[i];
        const g = B.img(S.dot(B, s.color), s.x, s.y, s.f < -0.06 ? 3.5 : 2.5, s.f);
        g.o.setScale((g.k * s.w) / 42, (g.k * s.h) / 42);
        g.ph = i * 1.7;
        B.add(g);
        glows.push(g);
      }
      pulse(B, glows, { a0: 0.3, a1: 0.55, speed: 0.003, flick: 0.1 });
    }
  },
};

/* ------------------------------------------------------------------ SUBURB */
const suburb = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        fillAll(c, vgrad(c, 0, 640, [[0, '#121a4e'], [0.3, '#35287a'], [0.55, '#a33c80'], [0.75, '#ff6f45'], [0.9, '#ffab55'], [1, '#ffd88a']]));
        stars(c, r, 30, 0, 160, '#ffe9ff', 0.9);
        glow(c, 900, 520, 560, '#ff8a1f', 0.5);
        glow(c, 900, 520, 170, '#ffe2a0', 0.85);
        circle(c, 900, 520, 62, '#fff0c4');
        for (let i = 0; i < 8; i++) {
          c.fillStyle = rgba(i % 2 ? '#ff7aa8' : '#ffb36a', 0.2 + r() * 0.15);
          rrect(c, between(r, -60, 1300), between(r, 170, 440), between(r, 180, 380), between(r, 6, 14), 7);
          c.fill();
        }
      },
    },
    {
      f: -0.02, top: 360, h: 300,
      draw(c, r) {
        ridge(c, r, { base: 560, amp: 110, step: 140, fill: '#6a2c6e' });
        haze(c, 440, 640, '#ff7a4a', 0, 0.25);
        ridge(c, r, { base: 592, amp: 50, step: 90, fill: '#4a2058' });
        let x = X0;
        while (x < X1) {
          const w = between(r, 30, 60);
          const h = between(r, 16, 30);
          const y = 606 - between(r, 0, 18);
          c.fillStyle = '#3a1a4c';
          c.fillRect(x, y - h, w, h + 60);
          c.beginPath();
          c.moveTo(x - 4, y - h);
          c.lineTo(x + w / 2, y - h - w * 0.35);
          c.lineTo(x + w + 4, y - h);
          c.fill();
          if (r() < 0.45) {
            c.fillStyle = rgba('#ffcf6a', 0.65);
            c.fillRect(x + w * 0.3, y - h + 6, 4, 4);
          }
          x += w + between(r, 10, 60);
        }
        for (let i = 0; i < 16; i++) circle(c, between(r, X0, X1), between(r, 590, 612) - 14, between(r, 12, 22), '#33163f');
        haze(c, 560, 660, '#2a1240', 0, 0.5);
      },
    },
    {
      f: -0.05, top: 260, h: 400,
      draw(c, r) {
        const body = '#2a1840';
        const roof = '#1c1030';
        const rimC = '#ffb35a';
        const house = (x, w, bodyH, roofH, base) => {
          const top = base - bodyH;
          c.fillStyle = body;
          c.fillRect(x, top, w, bodyH + 60);
          if (r() < 0.6) {
            c.fillStyle = roof;
            c.fillRect(x + w * 0.68, top - roofH * 0.8, 14, roofH * 0.6);
          }
          c.fillStyle = roof;
          c.beginPath();
          c.moveTo(x - 12, top + 4);
          c.lineTo(x + w / 2, top - roofH);
          c.lineTo(x + w + 12, top + 4);
          c.closePath();
          c.fill();
          c.strokeStyle = rgba(rimC, 0.85);
          c.lineWidth = 2.5;
          c.beginPath();
          c.moveTo(x + w / 2, top - roofH);
          c.lineTo(x + w + 12, top + 4);
          c.stroke();
          c.fillStyle = rgba('#ff8a4a', 0.25);
          c.fillRect(x + w - 4, top + 4, 4, bodyH);
          const dim = inCenter(x + w / 2) ? 0.45 : 1;
          const nw = w > 140 ? 3 : 2;
          for (let i = 0; i < nw; i++) {
            const wx = x + ((i + 0.5) * w) / nw - 9;
            const wy = top + 18;
            const lit = r() < 0.75;
            if (lit) glow(c, wx + 9, wy + 10, 28, '#ffb347', 0.35 * dim);
            c.fillStyle = lit ? rgba('#ffcf6a', 0.9 * dim) : '#1a0e28';
            c.fillRect(wx, wy, 18, 20);
            c.fillStyle = roof;
            c.fillRect(wx + 8, wy, 2, 20);
            c.fillRect(wx, wy + 9, 18, 2);
          }
          c.fillStyle = '#160c22';
          c.fillRect(x + w * 0.42, base - 34, 18, 34);
        };
        const tree = (x, base, rad) => {
          c.fillStyle = '#1e1030';
          c.fillRect(x - 4, base - rad, 8, rad + 20);
          circle(c, x, base - rad * 1.4, rad, '#26143a');
          circle(c, x - rad * 0.55, base - rad * 1.1, rad * 0.7, '#26143a');
          circle(c, x + rad * 0.55, base - rad * 1.15, rad * 0.75, '#26143a');
          c.strokeStyle = rgba(rimC, 0.45);
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, base - rad * 1.4, rad, -1.2, 0.2);
          c.stroke();
        };
        let x = X0 - 10;
        while (x < X1) {
          const w = between(r, 120, 180);
          house(x, w, between(r, 70, 100), between(r, 46, 66), 604);
          x += w + 26;
          if (r() < 0.6) {
            tree(x + 6, 604, between(r, 24, 34));
            x += 40;
          }
        }
        // power poles + wires
        const poles = [100, 640, 1180];
        for (let i = 0; i < poles.length; i++) {
          const px = poles[i];
          c.fillStyle = '#170c24';
          c.fillRect(px - 4, 300, 8, 340);
          c.fillRect(px - 36, 318, 72, 6);
          c.fillRect(px - 26, 340, 52, 5);
          c.fillStyle = rgba(rimC, 0.5);
          c.fillRect(px + 2, 300, 2, 300);
          c.fillStyle = '#3a2a4a';
          for (let k = -1; k <= 1; k++) c.fillRect(px + k * 28 - 2, 312, 4, 6);
        }
        const wire = 'rgba(20,10,30,0.85)';
        const ends = [X0 - 20, 100, 640, 1180, X1 + 20];
        for (let i = 0; i < ends.length - 1; i++) {
          for (let k = -1; k <= 1; k++) {
            rope(c, ends[i] + k * 28, 314 + (i === 0 ? 10 : 0), ends[i + 1] + k * 28, 314 + (i === ends.length - 2 ? 10 : 0), 16, wire, 1.6);
          }
          rope(c, ends[i] - 20, 342, ends[i + 1] - 20, 342, 12, wire, 1.4);
        }
        haze(c, 560, 660, '#1a0c28', 0, 0.45);
      },
    },
    {
      f: -0.08, top: 520, h: 140,
      draw(c) {
        const wood = '#2a1834';
        const rimC = '#ffb35a';
        c.fillStyle = wood;
        c.fillRect(X0, 584, LW, 7);
        c.fillRect(X0, 618, LW, 7);
        for (let x = X0; x < X1; x += 26) {
          c.fillStyle = wood;
          c.beginPath();
          c.moveTo(x, 640);
          c.lineTo(x, 566);
          c.lineTo(x + 9, 556);
          c.lineTo(x + 18, 566);
          c.lineTo(x + 18, 640);
          c.closePath();
          c.fill();
          c.fillStyle = rgba(rimC, 0.5);
          c.beginPath();
          c.moveTo(x + 9, 556);
          c.lineTo(x + 18, 566);
          c.lineTo(x + 18, 604);
          c.lineTo(x + 16, 604);
          c.lineTo(x + 16, 567);
          c.closePath();
          c.fill();
        }
        c.fillStyle = rgba('#000000', 0.25);
        c.fillRect(X0, 625, LW, 15);
        const bush = (x, y, rad) => {
          circle(c, x, y, rad, '#1e1030');
          circle(c, x - rad * 0.7, y + rad * 0.25, rad * 0.75, '#1e1030');
          circle(c, x + rad * 0.7, y + rad * 0.2, rad * 0.8, '#1e1030');
          c.strokeStyle = rgba(rimC, 0.45);
          c.lineWidth = 2;
          c.beginPath();
          c.arc(x, y, rad, -1.3, 0.1);
          c.stroke();
        };
        bush(-10, 620, 34);
        bush(60, 628, 26);
        bush(1240, 622, 32);
        bush(1310, 616, 36);
        // mailbox
        c.fillStyle = '#1e1030';
        c.fillRect(170, 590, 6, 50);
        rrect(c, 150, 566, 46, 28, 10);
        c.fill();
        c.fillStyle = C.magenta;
        c.fillRect(194, 556, 4, 18);
        c.fillRect(194, 556, 12, 7);
        c.fillStyle = rgba(rimC, 0.6);
        c.fillRect(150, 566, 46, 2);
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c) {
        floor(c, {
          c0: '#4a2f55', c1: '#1e1230', c2: '#0c0818', line: '#ffb36a', lineA: 0.16, edge: '#ffc47a', edgeA: 0.7,
          pool: '#ff8a1f', poolA: 0.22, spacing: 130, rows: 3,
          decor(cc) {
            glow(cc, 900, 670, 300, '#ffb35a', 0.18, 0.16);
          },
        });
      },
    },
  ],
  amb(B) {
    const P = B.perf;
    drift(B, P ? 2 : 4, S.cloud(B, 'sunset', '#ffc0b0', '#c45a8a'), {
      y0: 110, y1: 300, depth: 0.5, f: -0.01, vx0: 6, vx1: 12, s0: 0.7, s1: 1.3, a0: 0.55, a1: 0.85, wrap: 300, flip: true,
    });
    flock(B, P ? 2 : 5, S.bird(B, '#2a1238'), { y0: 150, y1: 280, speed: 42, depth: 0.7, f: -0.02, s0: 0.7, s1: 1.1 });
    if (!P) {
      const sun = B.img(S.dot(B, '#ffcf8a'), 900, 520, 0.3, 0);
      sun.s = 6;
      sun.o.setScale(sun.k * 6);
      B.add(sun);
      pulse(B, [sun], { a0: 0.18, a1: 0.32, speed: 0.0012 });
      fall(B, 10, S.dot(B, '#ffe27a'), {
        y0: 470, y1: 640, vy0: -6, vy1: -14, sway: 18, swayF: 0.0015, s0: 0.1, s1: 0.18, a0: 0.6, a1: 0.9, depth: 3.5, f: -0.08, add: true,
      });
    }
  },
};

/* ------------------------------------------------------------------ DOJO */
function pagoda(c, x, base, col) {
  c.fillStyle = col;
  let y = base;
  for (let i = 0; i < 4; i++) {
    const w = 72 - i * 13;
    c.fillRect(x - w * 0.32, y - 26, w * 0.64, 26);
    c.beginPath();
    c.moveTo(x - w * 0.78, y - 22);
    c.quadraticCurveTo(x - w * 0.42, y - 28, x - w * 0.3, y - 40);
    c.lineTo(x + w * 0.3, y - 40);
    c.quadraticCurveTo(x + w * 0.42, y - 28, x + w * 0.78, y - 22);
    c.closePath();
    c.fill();
    y -= 40;
  }
  c.fillRect(x - 1.5, y - 30, 3, 34);
}

function bambooStalk(c, r, x, top, bottom, w, col, rim) {
  c.fillStyle = col;
  c.fillRect(x, top, w, bottom - top);
  for (let y = top + 30; y < bottom - 10; y += between(r, 48, 72)) {
    c.fillStyle = rgba('#000000', 0.35);
    c.fillRect(x - 1, y, w + 2, 3);
    c.fillStyle = rgba(rim, 0.35);
    c.fillRect(x - 1, y + 3, w + 2, 1);
  }
  c.fillStyle = rgba(rim, 0.3);
  c.fillRect(x + w - 2, top, 2, bottom - top);
}

function leafClump(c, r, cx, cy, n, col, spread = 30) {
  c.fillStyle = col;
  for (let i = 0; i < n; i++) {
    c.save();
    c.translate(cx + between(r, -spread, spread), cy + between(r, -spread * 0.6, spread * 0.6));
    c.rotate(between(r, -0.9, 0.9) + (r() < 0.5 ? Math.PI : 0));
    c.beginPath();
    c.ellipse(16, 0, 20, 4.5, 0, 0, TAU);
    c.fill();
    c.restore();
  }
}

function stoneLantern(c, x, col, rim) {
  c.fillStyle = col;
  rrect(c, x - 30, 618, 60, 22, 3);
  c.fill();
  c.fillRect(x - 10, 560, 20, 60);
  rrect(c, x - 32, 548, 64, 14, 4);
  c.fill();
  c.fillRect(x - 24, 512, 48, 36);
  c.fillStyle = rgba('#ffcf6a', 0.9);
  c.fillRect(x - 12, 520, 24, 20);
  glow(c, x, 530, 56, C.orange, 0.4);
  c.fillStyle = col;
  c.fillRect(x - 1.5, 520, 3, 20);
  c.beginPath();
  c.moveTo(x - 46, 516);
  c.quadraticCurveTo(x, 482, x + 46, 516);
  c.closePath();
  c.fill();
  circle(c, x, 490, 7, col);
  c.fillStyle = rgba(rim, 0.45);
  c.fillRect(x + 22, 512, 2, 36);
  c.fillRect(x + 8, 560, 2, 58);
}

const dojo = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        fillAll(c, vgrad(c, 0, 640, [[0, '#04071a'], [0.45, '#0c1a42'], [0.8, '#1b2f66'], [1, '#2c4a86']]));
        stars(c, r, 90, 0, 420, '#dff0ff', 1.1);
        glow(c, 960, 150, 320, '#7fd8ff', 0.3);
        circle(c, 960, 150, 58, '#eef8ff');
        for (let i = 0; i < 6; i++) {
          const a = r() * TAU;
          const d = r() * 38;
          circle(c, 960 + Math.cos(a) * d, 150 + Math.sin(a) * d, between(r, 4, 10), rgba('#b8d0ec', 0.45));
        }
        glow(c, 960, 150, 96, '#ffffff', 0.22);
        c.fillStyle = rgba('#2a4a86', 0.55);
        rrect(c, 820, 172, 260, 10, 5);
        c.fill();
        rrect(c, 890, 192, 200, 8, 4);
        c.fill();
      },
    },
    {
      f: -0.02, top: 200, h: 460,
      draw(c, r) {
        ridge(c, r, { base: 520, amp: 240, step: 150, fill: '#16244e', peaks: true });
        haze(c, 300, 560, '#3a5a9a', 0, 0.3);
        ridge(c, r, { base: 584, amp: 100, step: 80, fill: '#101a3c' });
        pagoda(c, 300, 540, '#0c1430');
        haze(c, 520, 660, '#9ab8ff', 0, 0.16);
      },
    },
    {
      f: -0.05, top: 160, h: 500,
      draw(c, r) {
        // bamboo groves (sides)
        for (let i = 0; i < 10; i++) bambooStalk(c, r, between(r, X0, 180), between(r, 170, 300), 660, between(r, 8, 14), i % 2 ? '#123228' : '#0f2a24', '#8fe0b0');
        for (let i = 0; i < 10; i++) bambooStalk(c, r, between(r, 1100, X1), between(r, 170, 300), 660, between(r, 8, 14), i % 2 ? '#123228' : '#0f2a24', '#8fe0b0');
        for (let i = 0; i < 7; i++) leafClump(c, r, between(r, X0, 190), between(r, 180, 330), 9, i % 2 ? '#164034' : '#0e2a22');
        for (let i = 0; i < 7; i++) leafClump(c, r, between(r, 1090, X1), between(r, 180, 330), 9, i % 2 ? '#164034' : '#0e2a22');
        // dojo hall
        const wood = '#1a1020';
        c.fillStyle = wood;
        c.fillRect(210, 340, 860, 320);
        const bays = 5;
        const bx0 = 240;
        const bw = (1040 - 240) / bays;
        for (let i = 0; i < bays; i++) {
          const x = bx0 + i * bw + 10;
          const w = bw - 20;
          const y = 384;
          const h = 146;
          c.fillStyle = vgrad(c, y, y + h, [[0, '#6a4e48'], [1, '#3a2a36']]);
          c.fillRect(x, y, w, h);
          glow(c, x + w / 2, y + h / 2, w * 0.7, '#ffb35a', 0.16, 0.8);
          c.strokeStyle = rgba('#140c14', 0.7);
          c.lineWidth = 2;
          c.beginPath();
          for (let k = 1; k < 4; k++) {
            c.moveTo(x + (w * k) / 4, y);
            c.lineTo(x + (w * k) / 4, y + h);
          }
          for (let k = 1; k < 5; k++) {
            c.moveTo(x, y + (h * k) / 5);
            c.lineTo(x + w, y + (h * k) / 5);
          }
          c.stroke();
          c.strokeStyle = '#24161f';
          c.lineWidth = 5;
          c.strokeRect(x, y, w, h);
        }
        c.fillStyle = '#140c18';
        c.fillRect(210, 532, 860, 130);
        c.strokeStyle = rgba('#000000', 0.35);
        c.lineWidth = 1.5;
        for (let y = 548; y < 640; y += 16) {
          c.beginPath();
          c.moveTo(210, y);
          c.lineTo(1070, y);
          c.stroke();
        }
        for (let i = 0; i <= bays; i++) {
          const x = bx0 + i * bw - 7;
          c.fillStyle = '#2a1820';
          c.fillRect(x, 345, 14, 300);
          c.fillStyle = rgba('#7fd8ff', 0.22);
          c.fillRect(x + 11, 345, 3, 300);
        }
        c.fillStyle = '#2a1a1e';
        c.fillRect(190, 602, 900, 14);
        c.fillStyle = rgba('#ffcf8a', 0.25);
        c.fillRect(190, 602, 900, 2);
        // roof
        c.fillStyle = '#0d1226';
        c.beginPath();
        c.moveTo(150, 352);
        c.quadraticCurveTo(230, 342, 290, 300);
        c.lineTo(400, 238);
        c.lineTo(880, 238);
        c.lineTo(990, 300);
        c.quadraticCurveTo(1050, 342, 1130, 352);
        c.lineTo(1130, 364);
        c.lineTo(150, 364);
        c.closePath();
        c.fill();
        c.strokeStyle = rgba('#000000', 0.3);
        c.lineWidth = 1.5;
        for (let x = 410; x < 880; x += 22) {
          c.beginPath();
          c.moveTo(x, 242);
          c.lineTo(640 + (x - 640) * 1.6, 356);
          c.stroke();
        }
        c.fillStyle = '#18213f';
        c.fillRect(380, 228, 520, 12);
        c.beginPath();
        c.moveTo(372, 240);
        c.quadraticCurveTo(366, 218, 382, 208);
        c.lineTo(392, 228);
        c.closePath();
        c.moveTo(908, 240);
        c.quadraticCurveTo(914, 218, 898, 208);
        c.lineTo(888, 228);
        c.closePath();
        c.fill();
        c.strokeStyle = rgba('#9fe6ff', 0.6);
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(880, 238);
        c.lineTo(990, 300);
        c.quadraticCurveTo(1050, 342, 1130, 352);
        c.moveTo(380, 228);
        c.lineTo(900, 228);
        c.stroke();
        c.fillStyle = vgrad(c, 364, 404, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0)']]);
        c.fillRect(200, 364, 880, 40);
        // name plaque
        c.fillStyle = '#1a0c10';
        rrect(c, 588, 286, 104, 36, 4);
        c.fill();
        c.strokeStyle = rgba(C.gold, 0.75);
        c.lineWidth = 2;
        rrect(c, 592, 290, 96, 28, 3);
        c.stroke();
        c.fillStyle = rgba(C.gold, 0.7);
        c.fillRect(612, 298, 14, 12);
        c.fillRect(633, 298, 14, 12);
        c.fillRect(654, 298, 14, 12);
        haze(c, 560, 660, '#05060f', 0, 0.35);
      },
    },
    {
      f: -0.08, top: 0, h: 660,
      draw(c, r, m) {
        for (let i = 0; i < 4; i++) bambooStalk(c, r, between(r, X0, 50), -10, 660, between(r, 16, 24), '#0b231c', '#9ff0c0');
        for (let i = 0; i < 4; i++) bambooStalk(c, r, between(r, 1214, X1 - 10), -10, 660, between(r, 16, 24), '#0b231c', '#9ff0c0');
        leafClump(c, r, 40, 40, 14, '#0e3026', 50);
        leafClump(c, r, 1240, 30, 14, '#0e3026', 50);
        leafClump(c, r, 10, 260, 8, '#0b2820', 30);
        leafClump(c, r, 1270, 300, 8, '#0b2820', 30);
        stoneLantern(c, 150, '#1b2238', '#9fe6ff');
        stoneLantern(c, 1130, '#1b2238', '#9fe6ff');
        rope(c, X0, 36, X1, 36, 44, '#2a1a14', 2.5, (x, y) => mark(m, 'lanterns', { x, y }), 7);
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c) {
        floor(c, {
          c0: '#5a3a2a', c1: '#2a1812', c2: '#120a0a', line: '#140a06', lineA: 0.6, lineW: 2, edge: '#ffcf8a', edgeA: 0.55,
          pool: '#7fd8ff', poolA: 0.1, spacing: 64, rows: 0,
          decor(cc) {
            glow(cc, 960, 684, 220, '#9fe6ff', 0.14, 0.2);
            glow(cc, 150, 662, 130, C.orange, 0.22, 0.2);
            glow(cc, 1130, 662, 130, C.orange, 0.22, 0.2);
          },
        });
      },
    },
  ],
  amb(B, m) {
    const P = B.perf;
    twinkle(B, P ? 8 : 24, S.star(B, '#dff0ff'), { y0: 10, y1: 380, depth: 0.2, s0: 0.25, s1: 0.6, a0: 0.05, a1: 0.9 });
    drift(B, P ? 1 : 3, S.cloud(B, 'night', '#3a5288', '#18264e'), {
      y0: 120, y1: 260, depth: 0.5, f: -0.01, vx0: 6, vx1: 10, s0: 0.8, s1: 1.4, a0: 0.5, a1: 0.75, wrap: 300, flip: true,
    });
    const pts = m.lanterns || [];
    const lan = [];
    const glows = [];
    const lk = [S.lantern(B, '#ff4a3a'), S.lantern(B, '#ff8a1f')];
    const gk = S.dot(B, '#ffb347');
    for (let i = 0; i < pts.length; i++) {
      if (P && i % 2) continue;
      const l = B.img(lk[i % 2], pts[i].x, pts[i].y - 1, 3.6, -0.08, 0.5, 0);
      l.ph = i * 0.9;
      lan.push(l);
      if (!P) {
        const g = B.img(gk, pts[i].x, pts[i].y + 41, 3.55, -0.08);
        g.s = 1.5;
        g.o.setScale(g.k * 1.5);
        g.o.alpha = 0.55;
        B.add(g);
        glows.push(g);
      }
    }
    sway(B, lan, { amp: 0.06, speed: 0.0014 });
    if (glows.length) {
      B.tick((dt, t) => {
        for (let i = 0; i < glows.length; i++) {
          const l = lan[i];
          const g = glows[i];
          const a = l.o.rotation;
          g.x = l.x - Math.sin(a) * 41;
          g.o.y = l.o.y + Math.cos(a) * 41;
          g.o.alpha = 0.45 + 0.12 * Math.sin(t * 0.004 + l.ph);
        }
      });
    }
    fall(B, P ? 6 : 18, [S.leaf(B, '#4f9a5a', 'g'), S.leaf(B, '#a8c25a', 'y'), S.petal(B)], {
      y0: -20, y1: 700, vy0: 26, vy1: 54, vx: 12, sway: 40, swayF: 0.0018, spin: 2.4, flutter: 0.006,
      s0: 0.8, s1: 1.3, depth: 3.7, f: -0.08, a0: 0.8, a1: 1,
    });
  },
};

/* ------------------------------------------------------------------ FOREST */
function pine(c, x, base, h, w, col) {
  c.fillStyle = col;
  c.fillRect(x - w * 0.06, base - h * 0.2, w * 0.12, h * 0.2 + 60);
  for (let k = 0; k < 4; k++) {
    const ty = base - h * 0.16 - k * h * 0.2;
    const tw = w * (1 - k * 0.2);
    c.beginPath();
    c.moveTo(x - tw / 2, ty);
    c.lineTo(x, ty - h * 0.36);
    c.lineTo(x + tw / 2, ty);
    c.closePath();
    c.fill();
  }
}

const forest = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        fillAll(c, vgrad(c, 0, 640, [[0, '#04060e'], [0.4, '#0d1430'], [0.75, '#1c2750'], [1, '#2b3a68']]));
        glow(c, 420, 220, 320, '#5f8cff', 0.18);
        glow(c, 1000, 150, 260, C.cyan, 0.08);
        for (let i = 0; i < 18; i++) {
          cloud(c, between(r, -200, 1300), between(r, 40, 320), between(r, 260, 460), between(r, 90, 160), i % 3 ? '#26315e' : '#34427a', '#0c1228', 0.88);
        }
        haze(c, 380, 640, '#3a4a80', 0, 0.35);
      },
    },
    {
      f: -0.02, top: 280, h: 380,
      draw(c, r) {
        for (let x = X0; x < X1; x += between(r, 22, 40)) pine(c, x, 600, between(r, 120, 220), between(r, 50, 80), '#141d3c');
        haze(c, 420, 640, '#3a4a80', 0, 0.3);
        for (let x = X0; x < X1; x += between(r, 30, 56)) pine(c, x, 632, between(r, 90, 170), between(r, 50, 80), '#0d142c');
        haze(c, 560, 660, '#0a0f22', 0, 0.6);
      },
    },
    {
      f: -0.05, top: 60, h: 600,
      draw(c, r) {
        const col = '#0a1022';
        const rim = '#6fa0ff';
        const tree = (x, w, dir) => {
          c.fillStyle = col;
          c.beginPath();
          c.moveTo(x - w / 2 - 16, 660);
          c.quadraticCurveTo(x - w / 2, 560, x - w / 2 + 6, 300);
          c.lineTo(x + w / 2 - 6, 300);
          c.quadraticCurveTo(x + w / 2, 560, x + w / 2 + 16, 660);
          c.closePath();
          c.fill();
          c.strokeStyle = col;
          c.lineWidth = 12;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(x, 380);
          c.quadraticCurveTo(x + dir * 70, 320, x + dir * 150, 270);
          c.moveTo(x, 340);
          c.quadraticCurveTo(x - dir * 40, 290, x - dir * 90, 250);
          c.stroke();
          for (let k = 0; k < 10; k++) {
            const bx = x + between(r, -150, 170) * dir;
            const by = between(r, 110, 290);
            const br = between(r, 50, 92);
            circle(c, bx, by, br, k % 3 ? col : '#0c1428');
            if (k % 2 === 0) {
              c.strokeStyle = rgba(rim, 0.35);
              c.lineWidth = 2.5;
              c.beginPath();
              c.arc(bx, by, br - 2, Math.PI * 1.05, Math.PI * 1.55);
              c.stroke();
            }
          }
          c.fillStyle = rgba(rim, 0.35);
          c.fillRect(x - w / 2 + 6, 310, 3, 320);
          c.strokeStyle = col;
          c.lineWidth = 2;
          for (let k = 0; k < 6; k++) {
            const vx = x + dir * between(r, 20, 200);
            c.beginPath();
            c.moveTo(vx, between(r, 250, 300));
            c.quadraticCurveTo(vx + 8, 360, vx - 4, between(r, 380, 470));
            c.stroke();
          }
        };
        tree(60, 64, 1);
        tree(1225, 72, -1);
        for (let i = 0; i < 22; i++) {
          const bx = between(r, X0, X1);
          const by = between(r, 618, 640);
          const br = between(r, 18, 40);
          circle(c, bx, by, br, i % 2 ? '#0b1428' : '#0d182e');
          c.strokeStyle = rgba(rim, 0.22);
          c.lineWidth = 2;
          c.beginPath();
          c.arc(bx, by, br - 1, Math.PI * 1.1, Math.PI * 1.6);
          c.stroke();
        }
      },
    },
    {
      f: -0.08, top: 0, h: 660,
      draw(c, r) {
        const col = '#05080f';
        const rim = '#7fb2ff';
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(X0, 0);
        c.lineTo(46, 0);
        c.quadraticCurveTo(22, 300, 70, 660);
        c.lineTo(X0, 660);
        c.closePath();
        c.fill();
        c.beginPath();
        c.moveTo(X1, 0);
        c.lineTo(1236, 0);
        c.quadraticCurveTo(1262, 320, 1206, 660);
        c.lineTo(X1, 660);
        c.closePath();
        c.fill();
        c.strokeStyle = rgba(rim, 0.4);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(44, 0);
        c.quadraticCurveTo(20, 300, 68, 660);
        c.moveTo(1238, 0);
        c.quadraticCurveTo(1264, 320, 1208, 660);
        c.stroke();
        // roots
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(40, 600);
        c.quadraticCurveTo(110, 610, 150, 642);
        c.lineTo(30, 642);
        c.closePath();
        c.moveTo(1220, 600);
        c.quadraticCurveTo(1160, 612, 1120, 642);
        c.lineTo(1240, 642);
        c.closePath();
        c.fill();
        // overhanging foliage
        for (let i = 0; i < 16; i++) circle(c, between(r, X0, 280), between(r, -50, 70) + i * 1.2, between(r, 28, 58), i % 3 ? col : '#08101e');
        for (let i = 0; i < 16; i++) circle(c, between(r, 1000, X1), between(r, -50, 70) + i * 1.2, between(r, 28, 58), i % 3 ? col : '#08101e');
        // ferns
        const fern = (x, dir) => {
          c.strokeStyle = '#08140f';
          c.fillStyle = '#08140f';
          c.lineWidth = 3;
          for (let k = 0; k < 6; k++) {
            const len = between(r, 60, 110);
            const a = -Math.PI / 2 + dir * (0.2 + k * 0.22);
            const ex = x + Math.cos(a) * len;
            const ey = 640 + Math.sin(a) * len * 0.8;
            c.beginPath();
            c.moveTo(x, 642);
            c.quadraticCurveTo((x + ex) / 2, ey - 10, ex, ey + 10);
            c.stroke();
            for (let j = 1; j < 6; j++) {
              const t = j / 6;
              const px = x + (ex - x) * t;
              const py = 642 + (ey - 642) * t;
              c.beginPath();
              c.ellipse(px, py, 9 * (1 - t * 0.5), 2.5, a + 0.9, 0, TAU);
              c.ellipse(px, py, 9 * (1 - t * 0.5), 2.5, a - 0.9, 0, TAU);
              c.fill();
            }
          }
        };
        fern(120, 1);
        fern(1160, -1);
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c, r) {
        floor(c, {
          c0: '#1f2a3a', c1: '#0c121c', c2: '#05070c', line: '#6fa0ff', lineA: 0.1, edge: '#7fb2ff', edgeA: 0.45,
          pool: C.blue, poolA: 0.18, spacing: 140, rows: 3,
          decor(cc) {
            ellipse(cc, 380, 690, 90, 8, rgba('#6fa0ff', 0.18));
            ellipse(cc, 900, 704, 120, 9, rgba('#6fa0ff', 0.14));
          },
        });
        c.fillStyle = '#0c1a22';
        for (let x = X0; x < X1; x += between(r, 8, 22)) {
          const h = between(r, 5, 15);
          c.beginPath();
          c.moveTo(x - 3, 642);
          c.lineTo(x + between(r, -3, 3), 642 - h);
          c.lineTo(x + 3, 642);
          c.closePath();
          c.fill();
        }
      },
    },
  ],
  amb(B) {
    const P = B.perf;
    const rnd = B.rnd;
    drift(B, P ? 2 : 4, S.cloud(B, 'storm', '#2a3666', '#0c1228'), {
      y0: 60, y1: 260, vx0: 18, vx1: 30, depth: 0.5, f: -0.01, s0: 1, s1: 1.8, a0: 0.7, a1: 0.9, wrap: 340, flip: true,
    });
    const skyFlash = B.rect(0xa8c0ff, 0, 0.4);
    const bolt = B.img(S.bolt(B), 400, -10, 0.45, -0.01, 0.5, 0);
    bolt.o.alpha = 0;
    const flash = B.rect(0xd8e6ff, 0, 8);
    if (!P) {
      flash.setBlendMode(1);
      fall(B, 8, S.leaf(B, '#1f4a3a', 'storm'), {
        y0: -20, y1: 700, vy0: 40, vy1: 80, vx: -90, sway: 50, swayF: 0.003, spin: 4, flutter: 0.01, s0: 0.8, s1: 1.2, depth: 7.2, f: -0.08,
      });
    }
    fall(B, P ? 24 : 70, S.rain(B), {
      x0: X0, x1: X1 + 220, y0: -60, y1: 760, vy0: 950, vy1: 1250, vx: -190, rot: 0.18, s0: 0.7, s1: 1.1, a0: 0.2, a1: 0.45, depth: 7, f: 0,
    });
    let next = 2200;
    let ft = -1;
    B.tick((dt) => {
      next -= dt;
      if (next <= 0) {
        ft = 0;
        next = 3500 + rnd() * 5000;
        bolt.x = 150 + rnd() * 980;
        bolt.o.flipX = rnd() < 0.5;
        bolt.o.setScale(bolt.k * (0.8 + rnd() * 0.5));
      }
      if (ft >= 0) {
        ft += dt;
        let a = 0;
        if (ft < 80) a = 1;
        else if (ft < 140) a = 0.25;
        else if (ft < 220) a = 0.85;
        else if (ft < 720) a = 0.85 * (1 - (ft - 220) / 500);
        else ft = -1;
        flash.alpha = a * (P ? 0.12 : 0.2);
        skyFlash.alpha = a * 0.5;
        bolt.o.alpha = a > 0.5 ? a : a * 0.5;
      }
    });
  },
};

/* ------------------------------------------------------------------ VILLAGE */
function temple(c, x, base, col, rim) {
  c.fillStyle = col;
  c.fillRect(x - 100, base - 30, 200, 40);
  c.fillRect(x - 60, base - 92, 120, 64);
  c.beginPath();
  c.moveTo(x - 150, base - 30);
  c.lineTo(x - 150, base - 66);
  c.quadraticCurveTo(x - 120, base - 112, x - 90, base - 66);
  c.lineTo(x - 90, base - 30);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(x - 58, base - 90);
  c.bezierCurveTo(x - 62, base - 170, x - 30, base - 236, x - 8, base - 252);
  c.lineTo(x + 8, base - 252);
  c.bezierCurveTo(x + 30, base - 236, x + 62, base - 170, x + 58, base - 90);
  c.closePath();
  c.fill();
  c.beginPath();
  c.ellipse(x, base - 256, 18, 7, 0, 0, TAU);
  c.fill();
  c.fillRect(x - 2, base - 290, 4, 34);
  c.strokeStyle = rgba('#000000', 0.2);
  c.lineWidth = 2;
  for (let k = 1; k < 8; k++) {
    const y = base - 90 - k * 20;
    const hw = 58 - k * 6.2;
    c.beginPath();
    c.moveTo(x - hw, y);
    c.lineTo(x + hw, y);
    c.stroke();
  }
  c.strokeStyle = rgba(rim, 0.55);
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(x + 58, base - 90);
  c.bezierCurveTo(x + 62, base - 170, x + 30, base - 236, x + 8, base - 252);
  c.stroke();
  c.fillStyle = C.orange;
  c.beginPath();
  c.moveTo(x + 2, base - 290);
  c.lineTo(x + 36, base - 280);
  c.lineTo(x + 2, base - 270);
  c.closePath();
  c.fill();
}

function pot(c, x, base, rad) {
  c.fillStyle = vgrad(c, base - rad * 2, base, [[0, '#c4643a'], [1, '#6a2a18']]);
  c.beginPath();
  c.ellipse(x, base - rad, rad, rad * 0.95, 0, 0, TAU);
  c.fill();
  c.fillStyle = '#5a2414';
  rrect(c, x - rad * 0.45, base - rad * 2.05, rad * 0.9, rad * 0.3, 3);
  c.fill();
  c.strokeStyle = rgba('#ffe9c8', 0.55);
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(x, base - rad, rad * 0.98, rad * 0.25, 0, 0, Math.PI);
  c.stroke();
  c.fillStyle = rgba('#ffe2b0', 0.3);
  c.beginPath();
  c.ellipse(x - rad * 0.4, base - rad * 1.3, rad * 0.22, rad * 0.35, -0.4, 0, TAU);
  c.fill();
}

const village = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        fillAll(c, vgrad(c, 0, 640, [[0, '#1e1446'], [0.32, '#5a2868'], [0.58, '#c4505e'], [0.8, '#ff8a1f'], [1, '#ffcf70']]));
        glow(c, 880, 450, 520, C.orange, 0.5);
        glow(c, 880, 450, 150, '#ffe6a0', 0.85);
        circle(c, 880, 450, 54, '#fff1c8');
        for (let i = 0; i < 6; i++) {
          c.fillStyle = rgba(i % 2 ? '#ff7aa8' : '#ffc07a', 0.22 + r() * 0.15);
          rrect(c, between(r, -60, 1300), between(r, 150, 420), between(r, 160, 340), between(r, 6, 12), 6);
          c.fill();
        }
      },
    },
    {
      f: -0.02, top: 300, h: 360,
      draw(c, r) {
        ridge(c, r, { base: 570, amp: 80, step: 160, fill: '#7a3450' });
        temple(c, 600, 600, '#5a2442', '#ffb35a');
        palm(c, 380, 612, 130, -18, '#4a1e3a', 7);
        palm(c, 430, 612, 104, 14, '#4a1e3a', 6);
        palm(c, 1060, 612, 120, 16, '#4a1e3a', 7);
        palm(c, 1290, 612, 140, -14, '#4a1e3a', 7);
        haze(c, 460, 640, '#ff9a5a', 0, 0.28);
        ridge(c, r, { base: 614, amp: 26, step: 100, fill: '#4a1e3a' });
        haze(c, 580, 660, '#2a0e1e', 0, 0.4);
      },
    },
    {
      f: -0.05, top: 100, h: 560,
      draw(c, r) {
        const bark = '#2a1a1a';
        // banyan aerial roots
        c.strokeStyle = bark;
        c.lineCap = 'round';
        for (let i = 0; i < 14; i++) {
          const x = between(r, -40, 320);
          c.lineWidth = between(r, 1.5, 4);
          c.beginPath();
          c.moveTo(x, between(r, 250, 320));
          c.quadraticCurveTo(x + between(r, -12, 12), 480, x + between(r, -6, 6), 640);
          c.stroke();
        }
        // trunk
        c.fillStyle = bark;
        c.beginPath();
        c.moveTo(70, 640);
        c.quadraticCurveTo(120, 560, 116, 300);
        c.lineTo(196, 300);
        c.quadraticCurveTo(190, 560, 250, 640);
        c.closePath();
        c.fill();
        c.fillStyle = rgba('#ffb35a', 0.35);
        c.fillRect(190, 320, 3, 280);
        c.strokeStyle = bark;
        c.lineWidth = 16;
        c.beginPath();
        c.moveTo(150, 330);
        c.quadraticCurveTo(260, 270, 380, 250);
        c.moveTo(140, 320);
        c.quadraticCurveTo(60, 270, -20, 260);
        c.stroke();
        // canopy
        for (let k = 0; k < 24; k++) {
          const cx = between(r, -60, 500);
          const cy = between(r, 130, 280) + Math.abs(cx - 200) * 0.1;
          const rad = between(r, 50, 92);
          circle(c, cx, cy, rad, k % 3 ? '#1c3826' : '#132a1c');
          if (k % 2 === 0) {
            c.strokeStyle = rgba('#ffb35a', 0.4);
            c.lineWidth = 3;
            c.beginPath();
            c.arc(cx, cy, rad - 2, -1.1, 0.3);
            c.stroke();
          }
        }
        // chabutra (platform) around trunk
        c.fillStyle = '#7a4430';
        rrect(c, 30, 604, 260, 40, 6);
        c.fill();
        c.fillStyle = rgba('#ffcf8a', 0.5);
        c.fillRect(34, 604, 252, 2);
        c.fillStyle = '#c4302a';
        rrect(c, 222, 580, 22, 26, 8);
        c.fill();
        // low mud wall in the center
        c.fillStyle = '#6a3424';
        rrect(c, 300, 604, 700, 40, 6);
        c.fill();
        c.fillStyle = rgba('#ffcf8a', 0.4);
        c.fillRect(304, 604, 692, 2);
        c.fillStyle = rgba('#ffe9c8', 0.35);
        for (let x = 316; x < 990; x += 18) {
          c.beginPath();
          c.arc(x, 624, 2.5, 0, TAU);
          c.fill();
        }
        pot(c, 380, 606, 16);
        pot(c, 760, 606, 13);
        // huts
        const hut = (x, w, h, base) => {
          c.fillStyle = vgrad(c, base - h, base, [[0, '#8a4228'], [1, '#5a2a1c']]);
          c.fillRect(x, base - h, w, h + 40);
          c.fillStyle = '#1e0e0c';
          rrect(c, x + w * 0.38, base - h * 0.68, w * 0.24, h * 0.68 + 30, w * 0.12);
          c.fill();
          c.fillStyle = '#2a120c';
          c.fillRect(x + w * 0.12, base - h * 0.62, w * 0.14, h * 0.2);
          c.fillStyle = rgba('#ffcf6a', 0.5);
          c.fillRect(x + w * 0.13, base - h * 0.6, w * 0.12, h * 0.16);
          c.fillStyle = rgba('#ffe9c8', 0.6);
          for (let i = 0; i < w - 6; i += 12) {
            c.beginPath();
            c.arc(x + 6 + i, base - 10, 3, 0, TAU);
            c.fill();
          }
          c.fillStyle = vgrad(c, base - h - 80, base - h + 10, [[0, '#d49a4a'], [1, '#8a5a24']]);
          c.beginPath();
          c.moveTo(x - 24, base - h + 12);
          c.quadraticCurveTo(x + w / 2, base - h - 96, x + w + 24, base - h + 12);
          c.closePath();
          c.fill();
          c.strokeStyle = rgba('#5a3410', 0.5);
          c.lineWidth = 1.5;
          for (let k = 0; k <= 12; k++) {
            c.beginPath();
            c.moveTo(x + w / 2 + (k - 6) * 3, base - h - 38);
            c.lineTo(x - 24 + ((w + 48) * k) / 12, base - h + 12);
            c.stroke();
          }
          c.strokeStyle = rgba('#ffd27a', 0.7);
          c.lineWidth = 2.5;
          c.beginPath();
          c.moveTo(x - 24, base - h + 12);
          c.quadraticCurveTo(x + w / 2, base - h - 96, x + w / 2, base - h - 42);
          c.stroke();
        };
        hut(1010, 140, 104, 616);
        hut(1170, 170, 126, 630);
        // market stall
        c.fillStyle = '#2a140e';
        c.fillRect(1062, 548, 5, 92);
        c.fillRect(1196, 548, 5, 92);
        for (let i = 0; i < 7; i++) {
          c.fillStyle = i % 2 ? C.magenta : C.orange;
          c.beginPath();
          c.moveTo(1052 + i * 22, 540);
          c.lineTo(1074 + i * 22, 540);
          c.lineTo(1074 + i * 22, 560);
          c.quadraticCurveTo(1063 + i * 22, 570, 1052 + i * 22, 560);
          c.closePath();
          c.fill();
        }
        c.fillStyle = '#5a2e1a';
        c.fillRect(1058, 600, 148, 40);
        const fruit = ['#ffd24a', '#ff6a2a', '#7ad04a', '#ff2f5a'];
        for (let i = 0; i < 14; i++) circle(c, 1068 + i * 9.5, 596 - (i % 3) * 3, 6, fruit[i % 4]);
        haze(c, 590, 660, '#1a0a08', 0, 0.35);
      },
    },
    {
      f: -0.08, top: 0, h: 660,
      draw(c, r, m) {
        rope(c, X0, 28, 700, 46, 34, '#3a1a14', 2, (x, y) => mark(m, 'flags', { x, y }), 12);
        rope(c, 580, 44, X1, 22, 30, '#3a1a14', 2, (x, y) => mark(m, 'flags', { x, y }), 12);
        pot(c, 30, 640, 30);
        pot(c, 92, 640, 24);
        pot(c, 58, 584, 22);
        // cart wheel (right)
        const wx = 1262;
        const wy = 598;
        c.strokeStyle = '#3a1e10';
        c.lineWidth = 7;
        c.beginPath();
        c.arc(wx, wy, 44, 0, TAU);
        c.stroke();
        c.lineWidth = 4;
        c.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8;
          c.moveTo(wx, wy);
          c.lineTo(wx + Math.cos(a) * 42, wy + Math.sin(a) * 42);
        }
        c.stroke();
        circle(c, wx, wy, 8, '#3a1e10');
        c.strokeStyle = rgba('#ffcf8a', 0.45);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(wx, wy, 47, -1.6, -0.2);
        c.stroke();
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c) {
        floor(c, {
          c0: '#9a5a34', c1: '#5a2e1c', c2: '#2a140c', line: '#3a1a0c', lineA: 0.3, edge: '#ffcf8a', edgeA: 0.6,
          pool: '#ffb35a', poolA: 0.22, spacing: 150, rows: 3,
        });
        c.save();
        c.translate(640, 692);
        c.scale(1, 0.2);
        for (let i = 0; i < 12; i++) {
          c.save();
          c.rotate((i * TAU) / 12);
          c.fillStyle = i % 2 ? rgba(C.magenta, 0.5) : rgba(C.orange, 0.55);
          c.beginPath();
          c.ellipse(122, 0, 52, 22, 0, 0, TAU);
          c.fill();
          c.restore();
        }
        c.lineWidth = 10;
        c.strokeStyle = rgba(C.cyan, 0.5);
        c.beginPath();
        c.arc(0, 0, 70, 0, TAU);
        c.stroke();
        c.lineWidth = 8;
        c.strokeStyle = rgba('#ffe9c8', 0.4);
        c.beginPath();
        c.arc(0, 0, 184, 0, TAU);
        c.stroke();
        circle(c, 0, 0, 40, rgba(C.gold, 0.6));
        c.restore();
      },
    },
  ],
  amb(B, m) {
    const P = B.perf;
    drift(B, P ? 2 : 3, S.cloud(B, 'dusk', '#ffc8a0', '#c4506a'), {
      y0: 100, y1: 260, depth: 0.5, f: -0.01, vx0: 5, vx1: 10, s0: 0.7, s1: 1.2, a0: 0.5, a1: 0.8, wrap: 300, flip: true,
    });
    flock(B, P ? 2 : 4, S.bird(B, '#3a1430'), { y0: 140, y1: 260, speed: 36, depth: 0.7, f: -0.02, s0: 0.7, s1: 1 });
    const fk = [C.orange, C.magenta, C.cyan, C.gold, '#3ad16a'].map((col) => S.flag(B, col));
    const flags = [];
    const pts = m.flags || [];
    for (let i = 0; i < pts.length; i++) {
      if (P && i % 2) continue;
      const f = B.img(fk[i % fk.length], pts[i].x, pts[i].y - 1, 3.6, -0.08, 0.5, 0);
      f.ph = i * 0.7;
      flags.push(f);
    }
    sway(B, flags, { amp: 0.16, speed: 0.0026, flutter: 0.25 });
    const kites = [];
    const kpos = [[440, 150, C.magenta, C.gold], [1040, 110, C.cyan, C.orange]];
    for (let i = 0; i < (P ? 1 : 2); i++) {
      const k = B.img(S.kite(B, kpos[i][2], kpos[i][3]), kpos[i][0], kpos[i][1], 0.8, -0.02);
      k.s = 0.7;
      k.o.setScale(k.k * 0.7);
      k.bx = kpos[i][0];
      k.by = kpos[i][1];
      k.ph = i * 2.3;
      kites.push(k);
    }
    B.tick((dt, t) => {
      for (let i = 0; i < kites.length; i++) {
        const k = kites[i];
        k.x = k.bx + Math.sin(t * 0.0006 + k.ph) * 34;
        k.o.y = k.by + Math.sin(t * 0.0012 + k.ph) * 16;
        k.o.rotation = Math.sin(t * 0.0013 + k.ph) * 0.22;
      }
    });
    if (!P) {
      fall(B, 14, S.dot(B, '#ffd27a'), {
        y0: 300, y1: 640, vy0: -6, vy1: -16, sway: 14, s0: 0.06, s1: 0.12, a0: 0.4, a1: 0.8, add: true, depth: 3.7, f: -0.08,
      });
      const sun = B.img(S.dot(B, '#ffcf8a'), 880, 450, 0.3, 0);
      sun.s = 5;
      sun.o.setScale(sun.k * 5);
      B.add(sun);
      pulse(B, [sun], { a0: 0.18, a1: 0.3, speed: 0.0012 });
    }
  },
};

/* ------------------------------------------------------------------ ISLAND */
const HZ = 468;
const island = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        fillAll(c, vgrad(c, 0, HZ, [[0, '#0f1d5c'], [0.45, '#2a62e6'], [0.78, '#58c4ff'], [0.94, '#ffd8a8'], [1, '#ffbf80']]), -40, HZ);
        glow(c, 1010, 300, 360, '#ffe2a0', 0.5);
        circle(c, 1010, 300, 46, '#fff6dc');
        cloud(c, 40, 210, 420, 140, '#ffffff', '#9ec8ff', 0.95);
        cloud(c, 640, 160, 360, 110, '#ffffff', '#a8d0ff', 0.9);
        cloud(c, 360, 410, 300, 70, '#ffe8d0', '#ffb8a0', 0.8);
        cloud(c, 1080, 430, 260, 56, '#ffe8d0', '#ffb8a0', 0.75);
        c.fillStyle = vgrad(c, HZ, 660, [[0, '#2fb8e8'], [0.25, '#1a7fd4'], [1, '#0a2a7a']]);
        c.fillRect(X0 - 2, HZ, LW + 4, 300);
        for (let i = 0; i < 18; i++) {
          const y = HZ + 6 + i * 9;
          const w = 20 + i * 6 + r() * 30;
          c.fillStyle = rgba('#fff2c8', 0.5 - i * 0.022);
          rrect(c, 1010 - w / 2 + (r() - 0.5) * 20, y, w, 3, 1.5);
          c.fill();
        }
        for (let i = 0; i < 34; i++) {
          c.fillStyle = rgba('#0a2a7a', 0.25);
          rrect(c, between(r, X0, X1), between(r, HZ + 20, 650), between(r, 40, 140), 2, 1);
          c.fill();
        }
        c.fillStyle = rgba('#ffffff', 0.55);
        c.fillRect(X0, HZ - 1, LW, 2);
      },
    },
    {
      f: -0.02, top: 320, h: 160,
      draw(c, r) {
        const isl = () => {
          c.beginPath();
          c.moveTo(40, HZ + 1);
          c.quadraticCurveTo(170, 452, 222, 382);
          c.lineTo(286, 380);
          c.quadraticCurveTo(340, 452, 480, HZ + 1);
          c.closePath();
        };
        c.fillStyle = '#2b4f9e';
        isl();
        c.fill();
        c.fillStyle = vgrad(c, 380, HZ, [[0, rgba('#9fd8ff', 0)], [1, rgba('#9fd8ff', 0.5)]]);
        isl();
        c.fill();
        cloud(c, 206, 372, 80, 36, '#c8d8f0', '#8a9ac8', 0.75);
        c.fillStyle = '#2f58a8';
        c.beginPath();
        c.ellipse(1190, HZ, 100, 14, 0, Math.PI, TAU);
        c.fill();
        palm(c, 1170, HZ - 8, 46, -6, '#2f58a8', 3);
        palm(c, 1206, HZ - 8, 38, 8, '#2f58a8', 3);
        c.fillStyle = rgba('#ffffff', 0.4);
        c.fillRect(X0, HZ - 1, LW, 1.5);
        void r;
      },
    },
    {
      f: -0.05, top: 180, h: 480,
      draw(c) {
        // low ring wall
        c.fillStyle = vgrad(c, 608, 644, [[0, '#9aa4c8'], [1, '#4a5484']]);
        c.fillRect(X0, 608, LW, 40);
        c.fillStyle = rgba('#ffffff', 0.7);
        c.fillRect(X0, 608, LW, 2);
        c.strokeStyle = rgba('#2a3460', 0.45);
        c.lineWidth = 1.5;
        for (let x = X0; x < X1; x += 56) {
          c.beginPath();
          c.moveTo(x, 610);
          c.lineTo(x, 644);
          c.stroke();
        }
        const pillar = (x, w) => {
          c.fillStyle = hgrad(c, x, x + w, [[0, '#6a72a0'], [0.4, '#e8ecff'], [0.7, '#b8c0e0'], [1, '#4a5284']]);
          c.fillRect(x, 270, w, 380);
          c.strokeStyle = rgba('#2a3460', 0.25);
          c.lineWidth = 2;
          for (let k = 1; k < 5; k++) {
            c.beginPath();
            c.moveTo(x + (w * k) / 5, 280);
            c.lineTo(x + (w * k) / 5, 640);
            c.stroke();
          }
          c.fillStyle = '#8a92c0';
          rrect(c, x - 12, 252, w + 24, 22, 4);
          c.fill();
          c.fillStyle = '#5a628e';
          c.beginPath();
          c.moveTo(x - 18, 252);
          c.lineTo(x + w + 18, 252);
          c.lineTo(x + w + 6, 236);
          c.lineTo(x - 6, 236);
          c.closePath();
          c.fill();
          glow(c, x + w / 2, 226, 70, C.orange, 0.35);
          // banner
          const bc = x < 640 ? C.cyan : C.orange;
          c.fillStyle = vgrad(c, 300, 520, [[0, bc], [1, mix(bc, '#000000', 0.45)]]);
          c.beginPath();
          c.moveTo(x + 6, 298);
          c.lineTo(x + w - 6, 298);
          c.lineTo(x + w - 6, 510);
          c.lineTo(x + w / 2, 490);
          c.lineTo(x + 6, 510);
          c.closePath();
          c.fill();
          c.strokeStyle = rgba('#ffffff', 0.85);
          c.lineWidth = 3;
          c.beginPath();
          c.arc(x + w / 2, 370, w * 0.25, 0, TAU);
          c.stroke();
          circle(c, x + w / 2, 370, w * 0.1, '#ffffff');
        };
        pillar(118, 64);
        pillar(1098, 64);
      },
    },
    {
      f: -0.08, top: 0, h: 660,
      draw(c) {
        palm(c, -40, 660, 520, 130, '#0d2a3a', 18, C.cyan);
        palm(c, 1330, 660, 500, -120, '#0d2a3a', 18, C.cyan);
        palm(c, 30, 660, 330, 70, '#0a2230', 12, C.cyan);
        c.fillStyle = '#0a2230';
        for (let i = 0; i < 9; i++) {
          c.beginPath();
          c.moveTo(-40 + i * 18, 642);
          c.quadraticCurveTo(-30 + i * 20, 600 - (i % 3) * 10, -20 + i * 22, 590 - (i % 4) * 8);
          c.quadraticCurveTo(-26 + i * 20, 610, -28 + i * 18, 642);
          c.fill();
          c.beginPath();
          c.moveTo(1320 - i * 18, 642);
          c.quadraticCurveTo(1310 - i * 20, 600 - (i % 3) * 10, 1300 - i * 22, 590 - (i % 4) * 8);
          c.quadraticCurveTo(1306 - i * 20, 610, 1308 - i * 18, 642);
          c.fill();
        }
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c) {
        floor(c, {
          c0: '#b9c3e0', c1: '#7380ad', c2: '#3a4470', line: '#2a3460', lineA: 0.4, edge: '#ffffff', edgeA: 0.75,
          pool: '#ffffff', poolA: 0.15, spacing: 120, rows: 3, shadow: '#0a1a4a',
        });
      },
    },
  ],
  amb(B) {
    const P = B.perf;
    drift(B, P ? 2 : 3, S.cloud(B, 'day', '#ffffff', '#b8d8ff'), {
      y0: 70, y1: 230, depth: 0.3, f: -0.01, vx0: 6, vx1: 12, s0: 0.6, s1: 1.1, a0: 0.75, a1: 0.95, wrap: 300, flip: true,
    });
    const waves = drift(B, P ? 4 : 10, S.wave(B), {
      y0: HZ + 14, y1: 632, vx0: 8, vx1: 22, dir: -1, bob: 3, depth: 0.5, f: 0, wrap: 300, flip: true,
    });
    for (let i = 0; i < waves.length; i++) {
      const w = waves[i];
      w.s = 0.3 + ((w.by - HZ) / 170) * 0.9;
      w.o.setScale(w.k * w.s);
    }
    pulse(B, waves, { a0: 0.12, a1: 0.7, speed: 0.0016 });
    twinkle(B, P ? 6 : 18, S.star(B, '#fff6dc'), {
      x0: 640, x1: 1340, y0: HZ + 6, y1: 600, s0: 0.3, s1: 0.7, a0: 0, a1: 1, sp0: 0.003, sp1: 0.007, depth: 0.55, add: true, sharp: 6,
    });
    flock(B, P ? 1 : 3, S.bird(B, '#1a2a5a'), { y0: 130, y1: 300, speed: 46, depth: 0.7, f: -0.02, s0: 0.8, s1: 1.1, dir: 1 });
    flames(B, [{ x: 150, y: 240, s: 0.8, f: -0.05, d: 2.5 }, { x: 1130, y: 240, s: 0.8, f: -0.05, d: 2.5 }], S.flame(B), S.dot(B, C.orange));
  },
};

/* ------------------------------------------------------------------ FINAL (COLOSSEUM) */
const topAt = (x) => {
  const u = (x - 640) / 720;
  return 330 + 44 * (1 - u * u);
};

const final = {
  layers: [
    {
      f: 0, top: -30, h: 780, soft: true,
      draw(c, r) {
        fillAll(c, vgrad(c, 0, 620, [[0, '#050716'], [0.35, '#1c1046'], [0.6, '#56205e'], [0.82, '#c43a58'], [1, '#ff8a1f']]));
        stars(c, r, 60, 0, 220, '#ffe9ff', 1);
        glow(c, 640, 470, 640, '#ff6a2a', 0.45, 0.6);
        glow(c, 640, 470, 230, '#ffd27a', 0.5, 0.7);
        for (let i = 0; i < 7; i++) {
          c.fillStyle = rgba(i % 2 ? C.magenta : '#ff9a5a', 0.18 + r() * 0.14);
          rrect(c, between(r, -60, 1300), between(r, 140, 330), between(r, 180, 380), between(r, 5, 11), 5);
          c.fill();
        }
      },
    },
    {
      f: -0.02, top: 260, h: 400,
      draw(c, r, m) {
        c.fillStyle = vgrad(c, 320, 660, [[0, '#2e1838'], [1, '#160c22']]);
        c.beginPath();
        c.moveTo(X0 - 10, 660);
        for (let x = X0 - 10; x <= X1 + 10; x += 20) c.lineTo(x, topAt(x));
        c.lineTo(X1 + 10, 660);
        c.closePath();
        c.fill();
        // crown crenellation + rim
        c.fillStyle = '#2e1838';
        for (let x = X0; x < X1; x += 30) c.fillRect(x, topAt(x + 9) - 10, 18, 12);
        c.strokeStyle = rgba('#ff9a5a', 0.5);
        c.lineWidth = 2;
        c.beginPath();
        for (let x = X0 - 10; x <= X1 + 10; x += 20) {
          if (x === X0 - 10) c.moveTo(x, topAt(x) + 2);
          else c.lineTo(x, topAt(x) + 2);
        }
        c.stroke();
        // arch tiers
        for (let x = X0; x < X1; x += 44) {
          const ty = topAt(x + 22);
          for (let k = 0; k < 3; k++) {
            const ay = ty + 16 + k * 70;
            const aw = 26;
            const ah = 46;
            const ax = x + 9;
            c.beginPath();
            c.moveTo(ax, ay + ah);
            c.lineTo(ax, ay + aw / 2);
            c.arc(ax + aw / 2, ay + aw / 2, aw / 2, Math.PI, 0);
            c.lineTo(ax + aw, ay + ah);
            c.closePath();
            if (k === 0) c.fillStyle = vgrad(c, ay, ay + ah, [[0, rgba('#ff8a4a', 0.75)], [1, '#5a2050']]);
            else c.fillStyle = '#120818';
            c.fill();
            if (k > 0) {
              c.fillStyle = '#24122e';
              for (let h = 0; h < 3; h++) circle(c, ax + 5 + h * 8, ay + ah - 6 - (h % 2) * 2, 4.2, '#24122e');
              if (r() < 0.35) mark(m, 'crowd', { x: ax + 13, y: ay + ah - 10 });
            }
          }
        }
        c.strokeStyle = rgba('#ff9a5a', 0.22);
        c.lineWidth = 3;
        for (let k = 1; k < 3; k++) {
          c.beginPath();
          for (let x = X0 - 10; x <= X1 + 10; x += 20) {
            const y = topAt(x) + 8 + k * 70;
            if (x === X0 - 10) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
        // static far banners
        for (let i = 0; i < 6; i++) {
          const bx = 110 + i * 212;
          const by = topAt(bx) + 2;
          const col = i % 2 ? C.magenta : C.blue;
          c.fillStyle = vgrad(c, by, by + 100, [[0, col], [1, mix(col, '#000000', 0.5)]]);
          c.beginPath();
          c.moveTo(bx - 16, by);
          c.lineTo(bx + 16, by);
          c.lineTo(bx + 16, by + 96);
          c.lineTo(bx, by + 84);
          c.lineTo(bx - 16, by + 96);
          c.closePath();
          c.fill();
          circle(c, bx, by + 34, 7, rgba(C.gold, 0.8));
        }
        haze(c, 420, 660, '#ff6a3a', 0, 0.22);
        haze(c, 540, 660, '#12081e', 0, 0.65);
      },
    },
    {
      f: -0.05, top: 70, h: 590,
      draw(c, r, m) {
        const col = (x, w, top) => {
          c.fillStyle = hgrad(c, x, x + w, [[0, '#3a2034'], [0.35, '#8a4a52'], [0.6, '#5a2c40'], [1, '#22121e']]);
          c.fillRect(x, top + 30, w, 660 - top);
          c.strokeStyle = rgba('#000000', 0.25);
          c.lineWidth = 2;
          for (let i = 1; i < 5; i++) {
            c.beginPath();
            c.moveTo(x + (w * i) / 5, top + 34);
            c.lineTo(x + (w * i) / 5, 640);
            c.stroke();
          }
          c.fillStyle = '#4a2a3a';
          rrect(c, x - 14, top, w + 28, 32, 4);
          c.fill();
          c.fillStyle = rgba('#ffb35a', 0.55);
          c.fillRect(x - 14, top, w + 28, 2);
          c.fillStyle = '#3a2030';
          c.fillRect(x - 10, 604, w + 20, 60);
        };
        c.fillStyle = '#2a1426';
        c.fillRect(X0, 80, 260, 34);
        c.fillRect(1080, 80, 260, 34);
        c.fillStyle = rgba('#ffb35a', 0.45);
        c.fillRect(X0, 112, 260, 2);
        c.fillRect(1080, 112, 260, 2);
        col(30, 80, 114);
        col(1170, 80, 114);
        const stand = (x) => {
          c.fillStyle = '#1a0e14';
          c.fillRect(x - 3, 446, 6, 160);
          c.strokeStyle = '#1a0e14';
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(x, 596);
          c.lineTo(x - 20, 640);
          c.moveTo(x, 596);
          c.lineTo(x + 20, 640);
          c.moveTo(x, 596);
          c.lineTo(x, 640);
          c.stroke();
          c.fillStyle = '#2a1418';
          c.beginPath();
          c.moveTo(x - 22, 432);
          c.lineTo(x + 22, 432);
          c.lineTo(x + 12, 450);
          c.lineTo(x - 12, 450);
          c.closePath();
          c.fill();
          c.fillStyle = rgba('#ffb35a', 0.6);
          c.fillRect(x - 22, 432, 44, 2);
          glow(c, x, 420, 100, C.orange, 0.3);
          mark(m, 'torches', { x, y: 436, s: 0.8, f: -0.05, d: 2.5 });
        };
        stand(250);
        stand(1030);
        mark(m, 'banners', { x: 170, y: 114, c1: C.magenta, c2: C.gold });
        mark(m, 'banners', { x: 1110, y: 114, c1: C.blue, c2: C.cyan });
        void r;
      },
    },
    {
      f: -0.08, top: 440, h: 220,
      draw(c, r, m) {
        c.fillStyle = vgrad(c, 586, 640, [[0, '#4a2632'], [1, '#22101a']]);
        c.fillRect(X0, 586, LW, 60);
        c.fillStyle = '#5a2e3a';
        c.fillRect(X0, 580, LW, 8);
        c.fillStyle = rgba('#ffb35a', 0.6);
        c.fillRect(X0, 580, LW, 2);
        c.strokeStyle = rgba('#000000', 0.35);
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(X0, 614);
        c.lineTo(X1, 614);
        for (let x = X0; x < X1; x += 70) {
          c.moveTo(x, 588);
          c.lineTo(x, 614);
          c.moveTo(x + 35, 614);
          c.lineTo(x + 35, 640);
        }
        c.stroke();
        circle(c, 640, 612, 16, '#3a1a22');
        c.strokeStyle = rgba(C.gold, 0.6);
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(640, 612, 13, 0, TAU);
        c.stroke();
        const brazier = (x) => {
          c.fillStyle = '#2a1418';
          c.fillRect(x - 12, 560, 24, 80);
          rrect(c, x - 22, 620, 44, 20, 3);
          c.fill();
          c.beginPath();
          c.moveTo(x - 38, 536);
          c.lineTo(x + 38, 536);
          c.quadraticCurveTo(x + 30, 566, x, 566);
          c.quadraticCurveTo(x - 30, 566, x - 38, 536);
          c.fill();
          c.fillStyle = rgba('#ffb35a', 0.7);
          c.fillRect(x - 38, 535, 76, 2.5);
          glow(c, x, 520, 120, C.orange, 0.35);
          mark(m, 'torches', { x, y: 542, s: 1.25, f: -0.08, d: 3.5 });
        };
        brazier(40);
        brazier(1240);
        void r;
      },
    },
    {
      f: 0, top: 600, h: 160, d: 4,
      draw(c) {
        floor(c, {
          c0: '#8a5440', c1: '#4a2a28', c2: '#1e0e14', line: '#2a1218', lineA: 0.3, edge: '#ffb36a', edgeA: 0.65,
          pool: C.orange, poolA: 0.26, spacing: 130, rows: 3,
        });
        c.save();
        c.translate(640, 690);
        c.scale(1, 0.18);
        c.strokeStyle = rgba(C.gold, 0.35);
        c.lineWidth = 10;
        c.beginPath();
        c.arc(0, 0, 200, 0, TAU);
        c.stroke();
        c.lineWidth = 5;
        c.beginPath();
        c.arc(0, 0, 150, 0, TAU);
        c.stroke();
        c.fillStyle = rgba(C.gold, 0.25);
        c.beginPath();
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? 50 : 120;
          if (i === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
          else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
        }
        c.closePath();
        c.fill();
        c.restore();
      },
    },
  ],
  amb(B, m) {
    const P = B.perf;
    twinkle(B, P ? 8 : 22, S.star(B, '#ffe9ff'), { y0: 8, y1: 230, depth: 0.2, s0: 0.25, s1: 0.6, a0: 0.05, a1: 0.9 });
    drift(B, P ? 1 : 2, S.cloud(B, 'colo', '#ff9a8a', '#7a2a6a'), {
      y0: 150, y1: 290, depth: 0.5, f: -0.01, vx0: 5, vx1: 9, s0: 0.7, s1: 1.1, a0: 0.45, a1: 0.7, wrap: 300, flip: true,
    });
    const crowd = m.crowd || [];
    if (crowd.length) {
      twinkle(B, P ? 6 : 18, S.star(B), {
        pts: crowd.slice(0).sort((a, b) => (a.x * 7 + a.y) % 13 - (b.x * 7 + b.y) % 13), y0: 0, y1: 1, depth: 1.5, f: -0.02,
        s0: 0.3, s1: 0.5, a0: 0, a1: 1, sp0: 0.002, sp1: 0.006, sharp: 14, add: true,
      });
    }
    const banners = [];
    const bl = m.banners || [];
    for (let i = 0; i < bl.length; i++) {
      const b = B.img(S.banner(B, bl[i].c1, bl[i].c2), bl[i].x, bl[i].y, 2.4, -0.05, 0.5, 0);
      b.ph = i * 1.4;
      banners.push(b);
    }
    sway(B, banners, { amp: 0.025, speed: 0.0011, flutter: 0.06 });
    const torches = m.torches || [];
    flames(B, torches, S.flame(B), S.dot(B, C.orange));
    if (torches.length) {
      embers(B, P ? 6 : 26, S.dot(B, '#ffb347'), torches, {
        depth: 3.7, s0: 0.06, s1: 0.13, vy0: 40, vy1: 110, spread: 26, life0: 1000, life1: 2200, add: true, a0: 0.7, a1: 1,
      });
    }
  },
};

export const STAGE_DEFS = { neon_city, suburb, dojo, forest, village, island, final };

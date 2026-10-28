// Small procedural textures for ambient stage objects. Each returns a texture key (cached per stage build).
import { TAU, rgba, vgrad, glow, cloud as cloudShape, rrect, mix } from './paint.js';

export function dot(B, color) {
  return B.tex('dot' + color, 64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, rgba(color, 1));
    g.addColorStop(0.22, rgba(color, 0.65));
    g.addColorStop(0.55, rgba(color, 0.18));
    g.addColorStop(1, rgba(color, 0));
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
}

export function star(B, color = '#ffffff') {
  return B.tex('star' + color, 24, 24, (c) => {
    glow(c, 12, 12, 9, color, 0.5);
    c.fillStyle = rgba(color, 1);
    c.beginPath();
    c.moveTo(12, 0);
    c.quadraticCurveTo(13, 11, 24, 12);
    c.quadraticCurveTo(13, 13, 12, 24);
    c.quadraticCurveTo(11, 13, 0, 12);
    c.quadraticCurveTo(11, 11, 12, 0);
    c.fill();
  });
}

export function cloud(B, name, top, bottom, w = 300, h = 100) {
  return B.tex('cloud' + name, w, h, (c) => {
    cloudShape(c, 6, h * 0.72, w - 12, h * 0.8, top, bottom, 1);
  });
}

export function leaf(B, color, name = color) {
  return B.tex('leaf' + name, 18, 10, (c) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(1, 5);
    c.quadraticCurveTo(9, -2, 17, 5);
    c.quadraticCurveTo(9, 12, 1, 5);
    c.fill();
    c.strokeStyle = rgba('#000000', 0.25);
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(2, 5);
    c.lineTo(16, 5);
    c.stroke();
  });
}

export function petal(B, color = '#ffb3d9') {
  return B.tex('petal' + color, 12, 10, (c) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(6, 1);
    c.bezierCurveTo(12, 1, 12, 9, 6, 9);
    c.bezierCurveTo(0, 9, 0, 1, 6, 1);
    c.fill();
    c.fillStyle = rgba('#ffffff', 0.5);
    c.beginPath();
    c.ellipse(5, 4, 2, 1.4, 0, 0, TAU);
    c.fill();
  });
}

export function rain(B, color = '#9fc4ff') {
  return B.tex('rain' + color, 4, 40, (c) => {
    c.fillStyle = vgrad(c, 0, 40, [[0, rgba(color, 0)], [1, rgba(color, 0.9)]]);
    rrect(c, 1, 0, 2, 40, 1);
    c.fill();
  });
}

// Flame with origin at bottom center.
export function flame(B) {
  return B.tex('flame', 36, 64, (c) => {
    const tear = (w, h, fill) => {
      c.fillStyle = fill;
      c.beginPath();
      c.moveTo(18, 64 - h);
      c.bezierCurveTo(18 + w * 0.2, 64 - h * 0.6, 18 + w, 64 - h * 0.45, 18 + w * 0.8, 64 - h * 0.18);
      c.bezierCurveTo(18 + w * 0.6, 63, 18 - w * 0.6, 63, 18 - w * 0.8, 64 - h * 0.18);
      c.bezierCurveTo(18 - w, 64 - h * 0.45, 18 - w * 0.2, 64 - h * 0.6, 18, 64 - h);
      c.fill();
    };
    tear(17, 62, vgrad(c, 2, 64, [[0, '#ff2f4a'], [0.5, '#ff6a1f'], [1, '#ff8a1f']]));
    tear(11, 44, vgrad(c, 20, 64, [[0, '#ffb43a'], [1, '#ffd36a']]));
    tear(6, 24, '#fff4c8');
  });
}

export function bird(B, color = '#1a1030') {
  return B.tex('bird' + color, 26, 12, (c) => {
    c.strokeStyle = color;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(1, 3);
    c.quadraticCurveTo(7, 0, 13, 8);
    c.quadraticCurveTo(19, 0, 25, 3);
    c.stroke();
  });
}

export function bolt(B) {
  return B.tex('bolt', 160, 440, (c) => {
    const pts = [92, 0, 70, 120, 96, 130, 58, 260, 84, 268, 40, 440, 120, 230, 92, 224, 128, 118, 102, 112, 118, 0];
    const path = () => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
    };
    const s = c.getTransform ? c.getTransform().a : 1;
    c.save();
    c.shadowColor = '#7fb2ff';
    c.shadowBlur = 24 * s;
    c.fillStyle = '#cfe2ff';
    path();
    c.fill();
    c.restore();
    c.fillStyle = '#ffffff';
    c.save();
    c.translate(80, 220);
    c.scale(0.7, 0.98);
    c.translate(-80, -220);
    path();
    c.fill();
    c.restore();
  });
}

// Paper lantern hanging from origin (0.5, 0).
export function lantern(B, color) {
  return B.tex('lantern' + color, 40, 76, (c) => {
    c.strokeStyle = '#1a1210';
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(20, 0);
    c.lineTo(20, 14);
    c.stroke();
    glow(c, 20, 42, 20, '#ffcf6a', 0.5);
    c.fillStyle = '#1a1210';
    rrect(c, 12, 13, 16, 5, 2);
    c.fill();
    rrect(c, 12, 63, 16, 5, 2);
    c.fill();
    c.fillStyle = vgrad(c, 16, 64, [[0, mix(color, '#ffd27a', 0.35)], [0.5, mix(color, '#ffe9b0', 0.55)], [1, mix(color, '#000000', 0.25)]]);
    c.beginPath();
    c.ellipse(20, 41, 15, 24, 0, 0, TAU);
    c.fill();
    c.strokeStyle = rgba('#3a120c', 0.45);
    c.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = 26 + i * 10;
      c.beginPath();
      c.ellipse(20, y, 14 * Math.sin(Math.PI * (0.18 + i * 0.21)), 2.2, 0, 0, TAU);
      c.stroke();
    }
    c.strokeStyle = '#1a1210';
    c.beginPath();
    c.moveTo(20, 68);
    c.lineTo(20, 75);
    c.stroke();
  });
}

// Triangular pennant hanging from origin (0.5, 0).
export function flag(B, color) {
  return B.tex('flag' + color, 26, 32, (c) => {
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(1, 1);
    c.lineTo(25, 1);
    c.lineTo(13, 31);
    c.closePath();
    c.fill();
    c.fillStyle = rgba('#ffffff', 0.28);
    c.beginPath();
    c.moveTo(1, 1);
    c.lineTo(25, 1);
    c.lineTo(23, 6);
    c.lineTo(3, 6);
    c.closePath();
    c.fill();
    c.fillStyle = rgba('#000000', 0.18);
    c.beginPath();
    c.moveTo(13, 31);
    c.lineTo(19, 15);
    c.lineTo(25, 1);
    c.closePath();
    c.fill();
  });
}

export function kite(B, c1, c2) {
  return B.tex('kite' + c1 + c2, 60, 120, (c) => {
    c.strokeStyle = rgba('#3a1a2a', 0.8);
    c.lineWidth = 1.4;
    c.beginPath();
    c.moveTo(30, 60);
    c.bezierCurveTo(22, 80, 40, 95, 28, 119);
    c.stroke();
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i % 2 ? c1 : c2;
      c.beginPath();
      const y = 76 + i * 14;
      c.moveTo(30 - 5, y);
      c.lineTo(30 + 5, y + 4);
      c.lineTo(30 - 5, y + 8);
      c.fill();
    }
    c.fillStyle = c1;
    c.beginPath();
    c.moveTo(30, 2);
    c.lineTo(56, 30);
    c.lineTo(30, 62);
    c.lineTo(4, 30);
    c.closePath();
    c.fill();
    c.fillStyle = c2;
    c.beginPath();
    c.moveTo(30, 2);
    c.lineTo(56, 30);
    c.lineTo(30, 30);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(4, 30);
    c.lineTo(30, 30);
    c.lineTo(30, 62);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#000000', 0.35);
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(30, 2);
    c.lineTo(30, 62);
    c.moveTo(4, 30);
    c.lineTo(56, 30);
    c.stroke();
  });
}

export function wave(B, color = '#e8fbff') {
  return B.tex('wave' + color, 280, 22, (c) => {
    c.fillStyle = vgrad(c, 4, 22, [[0, rgba(color, 0.85)], [1, rgba(color, 0)]]);
    c.beginPath();
    c.moveTo(0, 20);
    for (let x = 0; x <= 280; x += 35) {
      c.quadraticCurveTo(x + 17, 2, x + 35, 12);
    }
    c.lineTo(280, 22);
    c.lineTo(0, 22);
    c.closePath();
    c.fill();
    c.strokeStyle = rgba('#ffffff', 0.9);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 20);
    for (let x = 0; x <= 280; x += 35) c.quadraticCurveTo(x + 17, 2, x + 35, 12);
    c.stroke();
  });
}

// Searchlight beam, origin (0.5, 1) at the lamp.
export function beam(B, color) {
  return B.tex('beam' + color, 220, 760, (c) => {
    c.fillStyle = vgrad(c, 0, 760, [[0, rgba(color, 0)], [0.6, rgba(color, 0.35)], [1, rgba(color, 0.9)]]);
    c.beginPath();
    c.moveTo(104, 760);
    c.lineTo(0, 0);
    c.lineTo(220, 0);
    c.lineTo(116, 760);
    c.closePath();
    c.fill();
  });
}

// Hanging banner with swallowtail and emblem, origin (0.5, 0).
export function banner(B, c1, c2, w = 84, h = 230) {
  return B.tex('banner' + c1 + c2 + w, w, h, (c) => {
    c.fillStyle = '#2a1a12';
    rrect(c, 0, 0, w, 8, 3);
    c.fill();
    c.fillStyle = vgrad(c, 8, h, [[0, c1], [1, mix(c1, '#000000', 0.45)]]);
    c.beginPath();
    c.moveTo(5, 8);
    c.lineTo(w - 5, 8);
    c.lineTo(w - 5, h - 2);
    c.lineTo(w / 2, h - 34);
    c.lineTo(5, h - 2);
    c.closePath();
    c.fill();
    c.fillStyle = c2;
    c.fillRect(5, 16, w - 10, 6);
    c.fillRect(5, h - 64, w - 10, 4);
    const cx = w / 2;
    const cy = h * 0.4;
    c.strokeStyle = c2;
    c.lineWidth = 4;
    c.beginPath();
    c.arc(cx, cy, w * 0.28, 0, TAU);
    c.stroke();
    c.fillStyle = c2;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 ? w * 0.08 : w * 0.2;
      if (i === 0) c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      else c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.fillStyle = rgba('#000000', 0.18);
    c.fillRect(w - 16, 8, 11, h - 40);
  });
}

// Plain white soft-edged rectangle used for flashes.
export function soft(B) {
  return B.tex('soft', 16, 16, (c) => {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, 16, 16);
  });
}

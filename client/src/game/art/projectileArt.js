// Generated textures for projectiles and stage entities.
import { canvasTexture, ensureCommonTextures } from '../fx/textures.js';
import { OUTLINE, LW, polyPath, roundRectPath, ellipsePath, fillStroke, line, circle, dot } from './draw.js';

export const PT = {
  shuriken: 'ccp_shuriken', beam: 'ccp_beam', pellet: 'ccp_pellet', missile: 'ccp_missile', wave: 'ccp_wave',
  dome: 'ccp_dome', hand: 'ccp_hand', trap: 'ccp_trap', warn: 'ccp_warn', lightning: 'ccp_lightning',
  door: 'ccp_door', cracks: 'ccp_cracks',
};

export function preloadProjectileArt(scene) {
  ensureCommonTextures(scene);
  if (scene.textures.exists(PT.cracks)) return;
  canvasTexture(scene, PT.shuriken, 40, 40, (c) => {
    c.translate(20, 20);
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 17 : 5.5;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    fillStroke(c, '#c9d3e6', 2.4);
    c.beginPath();
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; c.moveTo(0, 0); c.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); }
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 1.2; c.stroke();
    circle(c, 0, 0, 3.2, '#2a2d3e', 1.6);
  });
  canvasTexture(scene, PT.beam, 128, 32, (c) => {
    const g = c.createLinearGradient(0, 0, 0, 32);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
    g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 32);
  });
  canvasTexture(scene, PT.pellet, 18, 18, (c) => {
    circle(c, 9, 9, 6, '#8a8f9e', 2.2);
    dot(c, 7, 7, 2, 'rgba(255,255,255,0.75)');
  });
  canvasTexture(scene, PT.missile, 56, 24, (c) => {
    polyPath(c, [10, 4, 4, -2, 4, 6]); fillStroke(c, '#ff2fa6', 2);
    polyPath(c, [10, 20, 4, 26, 4, 18]); fillStroke(c, '#ff2fa6', 2);
    c.beginPath(); c.moveTo(6, 7); c.lineTo(38, 6); c.quadraticCurveTo(54, 12, 38, 18); c.lineTo(6, 17); c.closePath();
    fillStroke(c, '#e8ecf6', 2.4);
    c.save(); c.clip(); c.fillStyle = '#ff2fa6'; c.fillRect(38, 0, 20, 24); c.restore();
    c.beginPath(); c.moveTo(6, 7); c.lineTo(38, 6); c.quadraticCurveTo(54, 12, 38, 18); c.lineTo(6, 17); c.closePath();
    c.lineWidth = 2.4; c.strokeStyle = OUTLINE; c.stroke();
    circle(c, 26, 12, 3.2, '#22e4ff', 1.4);
  });
  canvasTexture(scene, PT.wave, 96, 64, (c) => {
    const g = c.createLinearGradient(0, 0, 96, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.65, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(0, 64); c.quadraticCurveTo(60, 60, 78, 6); c.quadraticCurveTo(96, 30, 92, 64); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(30, 62); c.quadraticCurveTo(70, 56, 80, 12); c.stroke();
  });
  canvasTexture(scene, PT.dome, 128, 128, (c) => {
    const g = c.createRadialGradient(64, 64, 10, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0.05)'); g.addColorStop(0.8, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0.65)');
    c.fillStyle = g; c.beginPath(); c.arc(64, 64, 62, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.85)'; c.lineWidth = 2.5; c.beginPath(); c.arc(64, 64, 61, 0, Math.PI * 2); c.stroke();
    c.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const r0 = i % 3 === 0 ? 44 : 50;
      c.beginPath(); c.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); c.lineTo(64 + Math.cos(a) * 56, 64 + Math.sin(a) * 56); c.stroke();
    }
  });
  canvasTexture(scene, PT.hand, 12, 64, (c) => {
    c.fillStyle = '#fff'; roundRectPath(c, 3, 4, 6, 30, 3); c.fill();
    c.beginPath(); c.arc(6, 32, 4.5, 0, Math.PI * 2); c.fill();
  });
  canvasTexture(scene, PT.trap, 56, 30, (c) => {
    roundRectPath(c, 4, 12, 48, 14, 5); fillStroke(c, '#5a6380', 2.4);
    c.beginPath(); c.moveTo(8, 12); for (let i = 0; i < 6; i++) { c.lineTo(11 + i * 7, 3); c.lineTo(14.5 + i * 7, 12); }
    fillStroke(c, '#c9d3e6', 2);
    roundRectPath(c, 22, 16, 12, 6, 2); fillStroke(c, '#ffd23f', 1.4);
  });
  canvasTexture(scene, PT.warn, 44, 40, (c) => {
    polyPath(c, [22, 3, 41, 37, 3, 37]); fillStroke(c, '#ffe94a', 3);
    line(c, 22, 14, 22, 26, 4.5); dot(c, 22, 31.5, 2.6, OUTLINE);
  });
  canvasTexture(scene, PT.lightning, 64, 256, (c) => {
    const pts = [34, 0, 20, 60, 36, 66, 14, 140, 32, 146, 18, 256, 50, 128, 34, 122, 52, 58, 38, 52, 46, 0];
    c.shadowColor = 'rgba(255,240,150,1)'; c.shadowBlur = 12;
    polyPath(c, pts); c.fillStyle = '#ffffff'; c.fill();
    c.shadowBlur = 0;
    c.globalAlpha = 0.6; polyPath(c, pts); c.lineWidth = 2; c.strokeStyle = '#fff6a0'; c.stroke();
  });
  canvasTexture(scene, PT.door, 72, 120, (c) => {
    roundRectPath(c, 6, 4, 60, 112, 6); fillStroke(c, '#ff6fb5', LW);
    roundRectPath(c, 14, 12, 44, 44, 4); fillStroke(c, '#ff92c8', 2);
    roundRectPath(c, 14, 62, 44, 46, 4); fillStroke(c, '#ff92c8', 2);
    circle(c, 54, 62, 3.6, '#ffd23f', 1.8);
    line(c, 10, 8, 10, 112, 2, 'rgba(255,255,255,0.4)');
  });
  canvasTexture(scene, PT.cracks, 160, 40, (c) => {
    c.strokeStyle = OUTLINE; c.lineCap = 'round'; c.lineJoin = 'round';
    const crack = (pts, w) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.lineWidth = w; c.stroke(); };
    crack([80, 20, 60, 14, 44, 22, 22, 12, 4, 18], 4);
    crack([80, 20, 100, 26, 118, 16, 138, 24, 156, 20], 4);
    crack([60, 14, 54, 4], 2.5); crack([118, 16, 124, 6], 2.5); crack([44, 22, 40, 34], 2.5); crack([100, 26, 104, 36], 2.5);
    c.strokeStyle = 'rgba(255,170,60,0.85)';
    crack([80, 20, 60, 14, 44, 22, 22, 12], 1.4); crack([80, 20, 100, 26, 118, 16, 138, 24], 1.4);
    ellipsePath(c, 80, 20, 12, 5); c.fillStyle = 'rgba(11,15,30,0.55)'; c.fill();
  });
}

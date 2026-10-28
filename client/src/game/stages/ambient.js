// Pooled ambient-motion kits. Everything is allocated at build time; tick callbacks only mutate.
// rec = { o: Phaser Image, x: base x (before parallax), f: parallax factor, k: 1/textureRes, s: scale }
import { X0, X1, LW, TAU, between } from './paint.js';

function scatter(B, n, keys, o) {
  const r = B.rnd;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const key = Array.isArray(keys) ? keys[i % keys.length] : keys;
    const rec = B.img(key, between(r, o.x0 ?? X0, o.x1 ?? X1), between(r, o.y0, o.y1), o.depth, o.f ?? 0, o.ox ?? 0.5, o.oy ?? 0.5);
    rec.s = between(r, o.s0 ?? 1, o.s1 ?? 1);
    rec.o.setScale(rec.k * rec.s);
    rec.ph = r() * TAU;
    rec.a = between(r, o.a0 ?? 1, o.a1 ?? 1);
    rec.o.alpha = rec.a;
    if (o.add) B.add(rec);
    out[i] = rec;
  }
  return out;
}

// Twinkling points (stars, sparkles, crowd flashes). Optional pts: [{x, y}] fixed positions.
export function twinkle(B, n, keys, o) {
  const recs = scatter(B, n, keys, o);
  const r = B.rnd;
  if (o.pts) {
    for (let i = 0; i < n; i++) {
      const p = o.pts[i % o.pts.length];
      recs[i].x = p.x;
      recs[i].o.y = p.y;
    }
  }
  for (let i = 0; i < n; i++) recs[i].sp = between(r, o.sp0 ?? 0.0012, o.sp1 ?? 0.004);
  const a0 = o.a0 ?? 0.1;
  const a1 = o.a1 ?? 1;
  const sharp = o.sharp ?? 3;
  B.tick((dt, t) => {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const v = 0.5 + 0.5 * Math.sin(t * rec.sp + rec.ph);
      rec.o.alpha = a0 + (a1 - a0) * Math.pow(v, sharp);
    }
  });
  return recs;
}

// Horizontally drifting objects with wraparound (clouds, haze, boats).
export function drift(B, n, keys, o) {
  const recs = scatter(B, n, keys, { ...o, x0: X0 - (o.wrap ?? 200), x1: X1 + (o.wrap ?? 200) });
  const r = B.rnd;
  const wrap = o.wrap ?? 200;
  const span = LW + wrap * 2;
  for (let i = 0; i < n; i++) {
    recs[i].vx = between(r, o.vx0 ?? 6, o.vx1 ?? 14) * (o.dir ?? 1);
    if (o.flip && r() < 0.5) recs[i].o.flipX = true;
    recs[i].by = recs[i].o.y;
  }
  const bob = o.bob ?? 0;
  B.tick((dt, t) => {
    const s = dt * 0.001;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      rec.x += rec.vx * s;
      if (rec.x > X1 + wrap) rec.x -= span;
      else if (rec.x < X0 - wrap) rec.x += span;
      if (bob) rec.o.y = rec.by + Math.sin(t * 0.0012 + rec.ph) * bob;
    }
  });
  return recs;
}

// Falling (vy > 0) or rising (vy < 0) particles with sway, spin and optional flutter.
export function fall(B, n, keys, o) {
  const recs = scatter(B, n, keys, o);
  const r = B.rnd;
  const x0 = o.x0 ?? X0;
  const x1 = o.x1 ?? X1;
  for (let i = 0; i < n; i++) {
    const rec = recs[i];
    rec.vy = between(r, o.vy0, o.vy1);
    rec.vx = o.vx ?? 0;
    rec.spin = (r() - 0.5) * 2 * (o.spin ?? 0);
    rec.y = rec.o.y;
    if (o.rot != null) rec.o.rotation = o.rot;
    else rec.o.rotation = r() * TAU * (o.spin ? 1 : 0);
  }
  const sway = o.sway ?? 0;
  const swayF = o.swayF ?? 0.002;
  const flutter = o.flutter ?? 0;
  B.tick((dt, t) => {
    const s = dt * 0.001;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      rec.y += rec.vy * s;
      rec.x += (rec.vx + (sway ? Math.sin(t * swayF + rec.ph) * sway : 0)) * s;
      if (rec.vy > 0 ? rec.y > o.y1 : rec.y < o.y0) {
        rec.y = rec.vy > 0 ? o.y0 : o.y1;
        rec.x = between(r, x0, x1);
      }
      if (rec.x > X1 + 60) rec.x -= LW + 120;
      else if (rec.x < X0 - 60) rec.x += LW + 120;
      rec.o.y = rec.y;
      if (rec.spin) rec.o.rotation += rec.spin * s;
      if (flutter) rec.o.scaleY = rec.k * rec.s * (0.25 + 0.75 * Math.abs(Math.sin(t * flutter + rec.ph)));
    }
  });
  return recs;
}

// Flapping birds crossing the sky occasionally.
export function flock(B, n, key, o) {
  const recs = scatter(B, n, key, { ...o, x0: X0 - 400, x1: X1 + 400 });
  const r = B.rnd;
  const dir = o.dir ?? -1;
  const span = LW + 900;
  for (let i = 0; i < n; i++) {
    const rec = recs[i];
    rec.vx = dir * between(r, o.speed * 0.8, o.speed * 1.2);
    rec.by = rec.o.y;
    rec.fl = between(r, 0.008, 0.014);
    rec.o.flipX = dir > 0;
  }
  B.tick((dt, t) => {
    const s = dt * 0.001;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      rec.x += rec.vx * s;
      if (rec.x < X0 - 450) rec.x += span;
      else if (rec.x > X1 + 450) rec.x -= span;
      rec.o.y = rec.by + Math.sin(t * 0.0015 + rec.ph) * 8;
      rec.o.scaleY = rec.k * rec.s * (0.3 + 0.7 * Math.abs(Math.sin(t * rec.fl + rec.ph)));
    }
  });
  return recs;
}

// Pendulum sway for hanging things (lanterns, flags, banners). recs need .ph.
export function sway(B, recs, o) {
  const amp = o.amp ?? 0.08;
  const speed = o.speed ?? 0.0016;
  const flutter = o.flutter ?? 0;
  B.tick((dt, t) => {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const v = Math.sin(t * speed + rec.ph) + 0.35 * Math.sin(t * speed * 2.7 + rec.ph * 1.3);
      rec.o.rotation = (rec.rot0 || 0) + v * amp;
      if (flutter) rec.o.scaleX = rec.k * rec.s * (1 - flutter * (0.5 + 0.5 * Math.sin(t * speed * 3.1 + rec.ph)));
    }
  });
}

// Breathing / flickering glows. Occasional deterministic dropouts when flick > 0.
export function pulse(B, recs, o) {
  const a0 = o.a0 ?? 0.4;
  const a1 = o.a1 ?? 0.8;
  const speed = o.speed ?? 0.002;
  const flick = o.flick ?? 0;
  B.tick((dt, t) => {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      let a = a0 + (a1 - a0) * (0.5 + 0.5 * Math.sin(t * speed + rec.ph));
      if (flick && Math.sin(t * 0.0021 + rec.ph) * Math.sin(t * 0.0057 + rec.ph * 1.3) > 1 - flick) a *= 0.15;
      rec.o.alpha = a;
    }
  });
}

// On/off beacon lights.
export function blink(B, pts, key, o = {}) {
  const recs = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const rec = B.img(key, p.x, p.y, p.d, p.f);
    rec.s = p.s ?? o.s ?? 0.35;
    rec.o.setScale(rec.k * rec.s);
    rec.ph = i * 0.37;
    if (o.add) B.add(rec);
    recs.push(rec);
  }
  const speed = o.speed ?? 0.0008;
  B.tick((dt, t) => {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const v = (t * speed + rec.ph) % 1;
      rec.o.alpha = v < 0.12 ? 1 : v < 0.35 ? 1 - (v - 0.12) / 0.23 : 0.08;
    }
  });
  return recs;
}

// Torch / brazier flames with optional additive glow.
export function flames(B, pts, flameKey, glowKey, o = {}) {
  const recs = [];
  const glows = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    if (glowKey && !B.perf) {
      const g = B.img(glowKey, p.x, p.y - 18 * p.s, p.d - 0.01, p.f);
      g.s = p.s * (o.glow ?? 3.2);
      g.o.setScale(g.k * g.s);
      g.ph = i * 1.9;
      B.add(g);
      glows.push(g);
    }
    const rec = B.img(flameKey, p.x, p.y, p.d, p.f, 0.5, 1);
    rec.s = p.s;
    rec.ph = i * 1.9;
    rec.o.setScale(rec.k * rec.s);
    recs.push(rec);
  }
  B.tick((dt, t) => {
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      const n = Math.sin(t * 0.017 + rec.ph) * 0.5 + Math.sin(t * 0.043 + rec.ph * 1.7) * 0.3 + Math.sin(t * 0.091 + rec.ph * 2.3) * 0.2;
      rec.o.setScale(rec.k * rec.s * (1 - n * 0.07), rec.k * rec.s * (1 + n * 0.16));
      rec.o.rotation = Math.sin(t * 0.009 + rec.ph) * 0.05;
      rec.o.alpha = 0.92 + n * 0.08;
    }
    for (let i = 0; i < glows.length; i++) {
      const g = glows[i];
      const n = Math.sin(t * 0.019 + g.ph) * 0.6 + Math.sin(t * 0.047 + g.ph) * 0.4;
      g.o.alpha = 0.5 + n * 0.15;
      g.o.setScale(g.k * g.s * (1 + n * 0.06));
    }
  });
  return recs;
}

// Rising embers / motes spawned from source points [{x, y, f}].
export function embers(B, n, key, pts, o) {
  const r = B.rnd;
  const recs = scatter(B, n, key, { ...o, y0: 0, y1: 1 });
  const spawn = (rec, i, age) => {
    const p = pts[(i + Math.floor(r() * pts.length)) % pts.length];
    rec.x = p.x + (r() - 0.5) * (o.spread ?? 20);
    rec.y = p.y;
    rec.f = p.f ?? rec.f;
    rec.vx = (r() - 0.5) * (o.vx ?? 24);
    rec.vy = -between(r, o.vy0 ?? 40, o.vy1 ?? 90);
    rec.life = between(r, o.life0 ?? 1200, o.life1 ?? 2400);
    rec.age = age;
  };
  for (let i = 0; i < n; i++) spawn(recs[i], i, r() * 1500);
  B.tick((dt, t) => {
    const s = dt * 0.001;
    for (let i = 0; i < recs.length; i++) {
      const rec = recs[i];
      rec.age += dt;
      if (rec.age >= rec.life) spawn(rec, i, 0);
      rec.x += (rec.vx + Math.sin(t * 0.004 + rec.ph) * 12) * s;
      rec.y += rec.vy * s;
      rec.o.y = rec.y;
      const u = rec.age / rec.life;
      rec.o.alpha = rec.a * (u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85);
    }
  });
  return recs;
}

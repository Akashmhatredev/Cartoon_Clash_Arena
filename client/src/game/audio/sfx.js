// Synthesized arcade SFX (Web Audio only, no files).
// Every call is a safe no-op before unlock() or when AudioContext is unavailable.

const MAX_VOICES = 12;
const THROTTLE = 0.03; // seconds between identical sounds

let ctx = null;
let master = null;
let comp = null;
let noiseBuf = null;
let volume = 0.8;
let muted = false;
let counter = 0;
const voices = [];
const lastPlay = Object.create(null);

function Ctor() {
  if (typeof window === 'undefined') return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

function masterLevel() {
  return muted ? 0 : volume * 0.75;
}

/* ---------------------------------------------------------------- primitives */

function env(param, t0, a, peak, dur, hold = 0) {
  param.setValueAtTime(0.0001, t0);
  param.linearRampToValueAtTime(peak, t0 + a);
  if (hold > 0) param.setValueAtTime(peak, t0 + a + hold);
  param.exponentialRampToValueAtTime(0.0001, t0 + Math.max(dur, a + hold + 0.01));
}

function filt(v, type, f0, f1, t0, dur, q = 1, dest = null) {
  const b = ctx.createBiquadFilter();
  b.type = type;
  b.frequency.setValueAtTime(f0, t0);
  if (f1 && f1 !== f0) b.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  b.Q.value = q;
  b.connect(dest || v.g);
  return b;
}

function osc(v, type, f0, f1, t0, dur, peak, o = {}) {
  const n = ctx.createOscillator();
  n.type = type;
  n.frequency.setValueAtTime(Math.max(1, f0), t0);
  if (f1 && f1 !== f0) n.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + (o.sweep ?? dur));
  if (o.detune) n.detune.setValueAtTime(o.detune, t0);
  const g = ctx.createGain();
  env(g.gain, t0, o.a ?? 0.004, peak, dur, o.hold ?? 0);
  n.connect(g);
  g.connect(o.dest || v.g);
  n.start(t0);
  n.stop(t0 + dur + 0.03);
  v.srcs.push(n);
  return n;
}

function noise(v, t0, dur, peak, type, f0, f1, q = 1, a = 0.002) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const b = filt(v, type, f0, f1, t0, dur, q);
  const g = ctx.createGain();
  env(g.gain, t0, a, peak, dur);
  s.connect(g);
  g.connect(b);
  const off = ((counter * 0.1373) % 0.7) || 0;
  s.start(t0, off, dur + 0.05);
  v.srcs.push(s);
  return s;
}

/* ---------------------------------------------------------------- voices */

function stopVoice(v, t) {
  try {
    v.g.gain.cancelScheduledValues(t);
    v.g.gain.setValueAtTime(v.g.gain.value, t);
    v.g.gain.linearRampToValueAtTime(0, t + 0.012);
    for (let i = 0; i < v.srcs.length; i++) {
      try {
        v.srcs[i].stop(t + 0.015);
      } catch (e) {
        /* already stopped */
      }
    }
  } catch (e) {
    /* ignore */
  }
  v.end = t + 0.02;
}

function reap(now) {
  for (let i = voices.length - 1; i >= 0; i--) {
    const v = voices[i];
    if (v.end < now) {
      try {
        v.g.disconnect();
      } catch (e) {
        /* ignore */
      }
      voices.splice(i, 1);
    }
  }
}

function newVoice(dur, gain) {
  const now = ctx.currentTime;
  reap(now);
  while (voices.length >= MAX_VOICES) {
    const old = voices.shift();
    stopVoice(old, now);
    setTimeout(() => {
      try {
        old.g.disconnect();
      } catch (e) {
        /* ignore */
      }
    }, 60);
  }
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(master);
  const v = { g, srcs: [], end: now + dur + 0.08 };
  voices.push(v);
  return v;
}

/* ---------------------------------------------------------------- sound designs */
// [duration seconds, gain, fn(voice, t, pitch)]

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

const SOUNDS = {
  hit: [0.16, 0.9, (v, t, p) => {
    noise(v, t, 0.09, 0.8, 'bandpass', 2400 * p, 700 * p, 1.1);
    osc(v, 'triangle', 280 * p, 70 * p, t, 0.12, 0.65);
    osc(v, 'square', 170 * p, 60 * p, t, 0.05, 0.18, { dest: filt(v, 'lowpass', 1400, 400, t, 0.05) });
  }],
  heavyHit: [0.3, 1, (v, t, p) => {
    noise(v, t, 0.04, 0.6, 'highpass', 2500, 2500, 0.7);
    noise(v, t, 0.2, 0.9, 'lowpass', 3200 * p, 220, 0.9);
    osc(v, 'sine', 170 * p, 38 * p, t, 0.26, 1.0);
    osc(v, 'sawtooth', 120 * p, 45 * p, t, 0.16, 0.32, { dest: filt(v, 'lowpass', 900, 200, t, 0.16) });
  }],
  block: [0.12, 0.8, (v, t, p) => {
    noise(v, t, 0.05, 0.45, 'highpass', 2600 * p, 1800, 0.8);
    osc(v, 'square', 950 * p, 720 * p, t, 0.06, 0.13);
    osc(v, 'triangle', 1480 * p, 1400 * p, t + 0.004, 0.1, 0.16);
    osc(v, 'sine', 220 * p, 140 * p, t, 0.05, 0.3);
  }],
  whiff: [0.18, 0.7, (v, t, p) => {
    noise(v, t, 0.16, 0.42, 'bandpass', 500 * p, 2600 * p, 1.4, 0.035);
  }],
  jump: [0.14, 0.6, (v, t, p) => {
    osc(v, 'square', 300 * p, 640 * p, t, 0.12, 0.22, { dest: filt(v, 'lowpass', 2200, 2200, t, 0.12) });
    osc(v, 'sine', 300 * p, 640 * p, t, 0.1, 0.2);
  }],
  land: [0.1, 0.6, (v, t, p) => {
    noise(v, t, 0.08, 0.4, 'lowpass', 500 * p, 120, 0.8);
    osc(v, 'sine', 130 * p, 55 * p, t, 0.08, 0.35);
  }],
  dash: [0.18, 0.7, (v, t, p) => {
    noise(v, t, 0.16, 0.5, 'bandpass', 1600 * p, 380 * p, 1.6, 0.01);
    osc(v, 'sine', 220 * p, 110 * p, t, 0.1, 0.18);
  }],
  throw: [0.32, 1, (v, t, p) => {
    noise(v, t, 0.06, 0.45, 'bandpass', 600 * p, 400 * p, 1.2);
    osc(v, 'square', 200 * p, 260 * p, t, 0.06, 0.12, { dest: filt(v, 'lowpass', 900, 900, t, 0.06) });
    osc(v, 'sine', 150 * p, 40 * p, t + 0.09, 0.22, 0.95);
    noise(v, t + 0.09, 0.16, 0.7, 'lowpass', 1400 * p, 160, 0.8);
  }],
  ko: [1.1, 1, (v, t, p) => {
    noise(v, t, 0.06, 0.8, 'highpass', 2200, 2200, 0.7);
    osc(v, 'sine', 240 * p, 28 * p, t, 0.95, 1.0, { sweep: 0.8 });
    noise(v, t, 0.85, 0.75, 'lowpass', 2600 * p, 90, 0.8);
    osc(v, 'sawtooth', 110 * p, 36 * p, t, 0.7, 0.3, { dest: filt(v, 'lowpass', 1200, 120, t, 0.7) });
    noise(v, t + 0.14, 0.5, 0.35, 'lowpass', 1200, 100, 0.8);
    osc(v, 'sine', 120 * p, 30 * p, t + 0.14, 0.6, 0.45);
  }],
  roundStart: [0.5, 0.75, (v, t, p) => {
    const lp = filt(v, 'lowpass', 3000, 3000, t, 0.5, 0.7);
    osc(v, 'square', NOTE(67) * p, 0, t, 0.14, 0.2, { dest: lp });
    osc(v, 'square', NOTE(72) * p, 0, t + 0.13, 0.32, 0.22, { dest: lp, hold: 0.08 });
    osc(v, 'triangle', NOTE(84) * p, 0, t + 0.13, 0.32, 0.18, { hold: 0.06 });
    noise(v, t + 0.13, 0.2, 0.15, 'highpass', 5000, 5000, 0.7);
  }],
  fight: [0.95, 1, (v, t, p) => {
    const lp = filt(v, 'lowpass', 700, 5200, t, 0.35, 1.2);
    const notes = [43, 50, 55, 62];
    for (let i = 0; i < notes.length; i++) {
      osc(v, 'sawtooth', NOTE(notes[i]) * p, 0, t, 0.85, 0.16, { dest: lp, hold: 0.25, a: 0.01, detune: (i % 2 ? 6 : -6) });
    }
    osc(v, 'sine', NOTE(31) * p, 0, t, 0.8, 0.6, { hold: 0.2 });
    noise(v, t, 0.6, 0.45, 'highpass', 3500, 1500, 0.6);
    noise(v, t, 0.08, 0.7, 'lowpass', 1800, 300, 0.8);
  }],
  select: [0.08, 0.6, (v, t, p) => {
    osc(v, 'square', 880 * p, 1180 * p, t, 0.06, 0.16, { dest: filt(v, 'lowpass', 4000, 4000, t, 0.06) });
  }],
  confirm: [0.22, 0.65, (v, t, p) => {
    const lp = filt(v, 'lowpass', 4500, 4500, t, 0.22);
    osc(v, 'square', NOTE(76) * p, 0, t, 0.08, 0.17, { dest: lp });
    osc(v, 'square', NOTE(83) * p, 0, t + 0.07, 0.15, 0.17, { dest: lp, hold: 0.03 });
    osc(v, 'triangle', NOTE(88) * p, 0, t + 0.07, 0.15, 0.12);
  }],
  back: [0.14, 0.6, (v, t, p) => {
    osc(v, 'square', 560 * p, 300 * p, t, 0.11, 0.16, { dest: filt(v, 'lowpass', 2600, 1200, t, 0.11) });
  }],
  special: [0.34, 0.8, (v, t, p) => {
    const bp = filt(v, 'bandpass', 600, 2400, t, 0.28, 2);
    osc(v, 'sawtooth', 280 * p, 900 * p, t, 0.3, 0.45, { dest: bp, a: 0.01 });
    osc(v, 'triangle', 560 * p, 1800 * p, t, 0.28, 0.14, { a: 0.01 });
    noise(v, t + 0.02, 0.24, 0.2, 'highpass', 4000, 7000, 0.7, 0.03);
  }],
  ultimate: [0.75, 1, (v, t, p) => {
    const lp = filt(v, 'lowpass', 400, 6000, t, 0.4, 3);
    osc(v, 'sawtooth', 110 * p, 440 * p, t, 0.6, 0.38, { dest: lp, sweep: 0.4, a: 0.02, hold: 0.1 });
    osc(v, 'sawtooth', 112 * p, 446 * p, t, 0.6, 0.3, { dest: lp, sweep: 0.4, a: 0.02, hold: 0.1, detune: 9 });
    osc(v, 'square', 55 * p, 55 * p, t, 0.55, 0.28, { dest: filt(v, 'lowpass', 300, 300, t, 0.55), hold: 0.2 });
    noise(v, t + 0.38, 0.32, 0.6, 'highpass', 2500, 900, 0.6);
    osc(v, 'sine', 200 * p, 40 * p, t + 0.38, 0.3, 0.8);
  }],
  electric: [0.2, 0.75, (v, t, p) => {
    for (let i = 0; i < 5; i++) {
      const f = (700 + ((counter + i * 3) % 4) * 380) * p;
      osc(v, 'square', f, f * 0.6, t + i * 0.028, 0.03, 0.13);
    }
    noise(v, t, 0.17, 0.35, 'bandpass', 4200 * p, 2200 * p, 3);
    osc(v, 'sawtooth', 60 * p, 60 * p, t, 0.15, 0.18, { dest: filt(v, 'lowpass', 500, 500, t, 0.15) });
  }],
  fire: [0.34, 0.8, (v, t, p) => {
    noise(v, t, 0.3, 0.55, 'lowpass', 1800 * p, 350, 0.9, 0.04);
    noise(v, t, 0.26, 0.25, 'bandpass', 3200 * p, 1800 * p, 4, 0.01);
    osc(v, 'sine', 160 * p, 60 * p, t, 0.18, 0.3);
  }],
  projectile: [0.18, 0.7, (v, t, p) => {
    osc(v, 'square', 1400 * p, 280 * p, t, 0.14, 0.15, { dest: filt(v, 'lowpass', 3500, 1200, t, 0.14) });
    osc(v, 'sine', 760 * p, 200 * p, t, 0.14, 0.25);
    noise(v, t, 0.1, 0.18, 'bandpass', 2000 * p, 900 * p, 1.5);
  }],
  win: [1.15, 0.85, (v, t, p) => {
    const lp = filt(v, 'lowpass', 3800, 3800, t, 1.1, 0.7);
    const seq = [60, 64, 67, 72];
    for (let i = 0; i < seq.length; i++) {
      const last = i === seq.length - 1;
      const st = t + i * 0.11;
      osc(v, 'square', NOTE(seq[i]) * p, 0, st, last ? 0.75 : 0.13, 0.15, { dest: lp, hold: last ? 0.3 : 0.04 });
      osc(v, 'triangle', NOTE(seq[i] + 12) * p, 0, st, last ? 0.75 : 0.13, 0.12, { hold: last ? 0.3 : 0.04 });
    }
    osc(v, 'sine', NOTE(48) * p, 0, t + 0.33, 0.7, 0.35, { hold: 0.25 });
    noise(v, t + 0.33, 0.45, 0.18, 'highpass', 6000, 4000, 0.6);
  }],
  lose: [1.1, 0.8, (v, t, p) => {
    const lp = filt(v, 'lowpass', 2000, 900, t, 1.05, 0.7);
    const seq = [67, 66, 65, 62];
    for (let i = 0; i < seq.length; i++) {
      const last = i === seq.length - 1;
      const st = t + i * 0.2;
      osc(v, 'triangle', NOTE(seq[i]) * p, last ? NOTE(seq[i] - 1) * p : 0, st, last ? 0.5 : 0.22, 0.28, { dest: lp, hold: last ? 0.2 : 0.06 });
      osc(v, 'square', NOTE(seq[i] - 12) * p, 0, st, last ? 0.5 : 0.22, 0.08, { dest: lp, hold: last ? 0.2 : 0.06 });
    }
  }],
  tick: [0.06, 0.6, (v, t, p) => {
    osc(v, 'square', 1500 * p, 1500 * p, t, 0.03, 0.15, { dest: filt(v, 'lowpass', 5000, 5000, t, 0.03) });
    osc(v, 'sine', 3000 * p, 3000 * p, t, 0.025, 0.08);
  }],
  teleport: [0.28, 0.7, (v, t, p) => {
    osc(v, 'sine', 240 * p, 2200 * p, t, 0.11, 0.3, { a: 0.006 });
    osc(v, 'sine', 2200 * p, 380 * p, t + 0.1, 0.14, 0.26, { a: 0.004 });
    osc(v, 'triangle', 480 * p, 3200 * p, t, 0.11, 0.1);
    noise(v, t, 0.24, 0.15, 'highpass', 5000, 8000, 0.8, 0.02);
  }],
  charge: [0.36, 0.7, (v, t, p) => {
    osc(v, 'sawtooth', 80 * p, 260 * p, t, 0.32, 0.3, { dest: filt(v, 'lowpass', 500, 2200, t, 0.32, 4), a: 0.05 });
    osc(v, 'sine', 160 * p, 520 * p, t, 0.32, 0.22, { a: 0.05 });
    noise(v, t, 0.3, 0.12, 'bandpass', 800, 3000, 2, 0.08);
  }],
};

/* ---------------------------------------------------------------- public API */

function play(name, gain = 1) {
  if (!ctx || !master || !noiseBuf || ctx.state === 'closed') return;
  const def = SOUNDS[name];
  if (!def) return;
  try {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    const last = lastPlay[name];
    if (last !== undefined && now - last < THROTTLE) return;
    lastPlay[name] = now;
    counter = (counter + 1) % 100000;
    const pitch = 1 + (((counter * 7) % 9) - 4) * 0.012;
    const v = newVoice(def[0], def[1] * Math.max(0, gain));
    def[2](v, now + 0.005, pitch);
  } catch (e) {
    /* never let audio break the game loop */
  }
}

function unlock() {
  const C = Ctor();
  if (!C) return;
  try {
    if (!ctx) {
      try {
        ctx = new C({ latencyHint: 'interactive' });
      } catch (e) {
        ctx = new C();
      }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.knee.value = 10;
      comp.ratio.value = 5;
      comp.attack.value = 0.002;
      comp.release.value = 0.14;
      master = ctx.createGain();
      master.gain.value = masterLevel();
      master.connect(comp);
      comp.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 0x2545f491;
      for (let i = 0; i < len; i++) {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        d[i] = ((s >>> 0) / 4294967296) * 2 - 1;
      }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (e) {
    ctx = null;
    master = null;
    comp = null;
    noiseBuf = null;
  }
}

function setLevel() {
  if (!ctx || !master) return;
  try {
    master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.02);
  } catch (e) {
    master.gain.value = masterLevel();
  }
}

function setVolume(v) {
  const n = Number(v);
  volume = Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : volume;
  setLevel();
}

function setMuted(b) {
  muted = !!b;
  setLevel();
}

function handleEvents(events) {
  if (!ctx || !events) return;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (!e) continue;
    switch (e.type) {
      case 'hit':
        play((e.strength | 0) >= 2 ? 'heavyHit' : 'hit');
        if (e.effect === 'electric') play('electric', 0.8);
        else if (e.effect === 'fire') play('fire', 0.8);
        break;
      case 'block':
      case 'tech':
        play('block');
        break;
      case 'whiff':
        play('whiff', 0.8);
        break;
      case 'throw':
        play('throw');
        break;
      case 'jump':
        play('jump', 0.7);
        break;
      case 'land':
        play('land', 0.4);
        break;
      case 'dash':
        play('dash', 0.8);
        break;
      case 'projectile':
        play('projectile');
        break;
      case 'superFlash':
        play('ultimate');
        break;
      case 'form':
        play('special');
        break;
      case 'teleport':
        play('teleport');
        break;
      case 'charge':
        play('charge', 0.8);
        break;
      case 'ko':
        play('ko');
        break;
      case 'roundStart':
        play('roundStart');
        break;
      case 'fight':
        play('fight');
        break;
      case 'timeUp':
        play('tick');
        break;
      case 'matchEnd':
        play('win');
        break;
      default:
        break;
    }
  }
}

export const SFX_NAMES = Object.keys(SOUNDS);

export const sfx = { unlock, play, handleEvents, setVolume, setMuted };

export default sfx;

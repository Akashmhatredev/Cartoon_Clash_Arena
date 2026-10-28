<script setup>
// Fight HUD. Rendered once by Vue; afterwards update(state, stats) is called every render frame by the
// scene and only touches DOM nodes whose values changed. No reactive state is written per frame.
import { onMounted, ref } from 'vue';
import { METER_MAX } from '@shared/constants.js';
import { fighterName } from '@/lib/fighters.js';
import { portrait } from '@/lib/portraits.js';

const props = defineProps({
  config: { type: Object, required: true },
  localSide: { type: Number, default: null },
});
const emit = defineEmits(['ready']);

const cfg = props.config;
const mode = cfg.mode;
const training = mode === 'training';
const online = mode === 'online';
const rtw = cfg.roundsToWin || 2;
const ids = [cfg.p1, cfg.p2];
const names = ids.map(fighterName);
const portraits = ids.map((id) => portrait(id, 128));
const you = online ? (props.localSide ?? 0) : mode === 'arcade' || training ? 0 : null;
const tags =
  mode === 'versus'
    ? ['P1', 'P2']
    : mode === 'arcade'
      ? ['YOU', 'CPU']
      : training
        ? ['YOU', 'DUMMY']
        : you === 0
          ? ['YOU', 'RIVAL']
          : ['RIVAL', 'YOU'];
const meterMax = METER_MAX || 100;

const root = ref(null);
const el = { ok: false, side: [], hp: [], trail: [], meter: [], meterBox: [], pips: [], combo: [], comboN: [], comboD: [] };

function mkCache() {
  return { hp: -1, trail: 1, trailShown: -1, hitAt: 0, low: null, meter: -1, full: null, wins: -1, combo: 0, comboDmg: -1, shown: false, hideAt: 0 };
}
const cache = [mkCache(), mkCache()];
let timerShown = null;
let timerLow = null;
let lastPhase = null;
let lastRound = -1;
let annHideAt = 0;
let lastNow = 0;
const tr = { hits: -1, dmg: -1, max: -1, move: null, lastHits: 0, lastDmg: 0 };
let pingShown = -1;
let pingAt = 0;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function pop(node) {
  node.animate?.([{ transform: 'scale(1.45)' }, { transform: 'scale(1)' }], { duration: 170, easing: 'cubic-bezier(.2,.8,.2,1)' });
}

function announce(text, sub, now, ms, variant) {
  el.annText.textContent = text;
  el.annSub.textContent = sub || '';
  el.ann.className = 'announce show' + (variant ? ' ' + variant : '');
  el.annText.animate?.(
    [
      { transform: 'scale(1.6)', opacity: 0, letterSpacing: '0.3em' },
      { transform: 'scale(1)', opacity: 1, letterSpacing: '0.04em' },
    ],
    { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' },
  );
  annHideAt = ms ? now + ms : 0;
}

function onPhase(st, now) {
  const p = st.phase;
  if (training) {
    if (lastPhase === null) announce('TRAINING', 'Free practice', now, 1400, 'fight');
    return;
  }
  if (p === 'intro') {
    const final = st.wins[0] === rtw - 1 && st.wins[1] === rtw - 1;
    announce(final ? 'FINAL ROUND' : 'ROUND ' + st.round, '', now, 0, '');
  } else if (p === 'fight') {
    if (lastPhase === 'intro' || lastPhase === null) announce('FIGHT!', '', now, 850, 'fight');
  } else if (p === 'roundEnd') {
    const w = st.roundWinner;
    const ko = st.fighters[0].hp <= 0 || st.fighters[1].hp <= 0;
    const big = w === 'draw' ? (ko ? 'DOUBLE K.O.' : 'DRAW') : ko ? 'K.O.' : 'TIME';
    const sub = w === 0 || w === 1 ? names[w] + ' takes the round' : '';
    announce(big, sub, now, 0, ko ? 'ko' : '');
  } else if (p === 'matchEnd') {
    const w = st.matchWinner;
    let big;
    let variant = 'win';
    if (w !== 0 && w !== 1) big = 'DRAW GAME';
    else if (you != null) {
      big = w === you ? 'YOU WIN' : 'YOU LOSE';
      if (w !== you) variant = 'lose';
    } else big = (w === 0 ? 'P1' : 'P2') + ' WINS';
    announce(big, w === 0 || w === 1 ? names[w] : '', now, 0, variant);
  }
}

function updateTraining(st) {
  const f = st.fighters[0];
  const hits = f.comboHits | 0;
  if (hits > 0) {
    tr.lastHits = hits;
    tr.lastDmg = Math.round(f.comboDamage || 0);
  }
  if (tr.lastHits !== tr.hits) {
    tr.hits = tr.lastHits;
    el.trHits.textContent = tr.hits;
  }
  if (tr.lastDmg !== tr.dmg) {
    tr.dmg = tr.lastDmg;
    el.trDmg.textContent = tr.dmg;
  }
  const max = st.stats?.maxCombo?.[0] | 0;
  if (max !== tr.max) {
    tr.max = max;
    el.trMax.textContent = max;
  }
  const mv = f.lastMoveName || '—';
  if (mv !== tr.move) {
    tr.move = mv;
    el.trMove.textContent = mv;
  }
}

function update(st, stats) {
  if (!el.ok || !st) return;
  const now = performance.now();
  const dt = lastNow ? Math.min(100, now - lastNow) : 16;
  lastNow = now;
  const F = st.fighters;

  for (let s = 0; s < 2; s++) {
    const f = F[s];
    const k = cache[s];
    const hp = f.maxHp > 0 ? clamp01(f.hp / f.maxHp) : 0;
    if (hp !== k.hp) {
      if (hp < k.hp) k.hitAt = now;
      if (k.hp < 0 || hp > k.trail) k.trail = hp;
      k.hp = hp;
      el.hp[s].style.transform = 'scaleX(' + hp + ')';
      const low = hp <= 0.25;
      if (low !== k.low) {
        k.low = low;
        el.side[s].classList.toggle('low', low);
      }
    }
    if (k.trail > k.hp && now - k.hitAt > 420) {
      const gap = k.trail - k.hp;
      k.trail = Math.max(k.hp, k.trail - Math.max(0.0005 * dt, gap * 0.006 * dt));
    }
    if (k.trail !== k.trailShown) {
      k.trailShown = k.trail;
      el.trail[s].style.transform = 'scaleX(' + k.trail + ')';
    }

    const meter = clamp01((f.meter || 0) / meterMax);
    if (meter !== k.meter) {
      k.meter = meter;
      el.meter[s].style.transform = 'scaleX(' + meter + ')';
      const full = meter >= 1;
      if (full !== k.full) {
        k.full = full;
        el.meterBox[s].classList.toggle('full', full);
      }
    }

    const w = st.wins[s] | 0;
    if (w !== k.wins) {
      k.wins = w;
      const pips = el.pips[s];
      for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('won', i < w);
    }

    const hits = f.comboHits | 0;
    if (hits >= 2) {
      if (hits !== k.combo) {
        k.combo = hits;
        el.comboN[s].textContent = hits;
        pop(el.comboN[s]);
      }
      const d = Math.round(f.comboDamage || 0);
      if (d !== k.comboDmg) {
        k.comboDmg = d;
        el.comboD[s].textContent = d + ' DMG';
      }
      if (!k.shown) {
        k.shown = true;
        el.combo[s].classList.add('show');
      }
      k.hideAt = now + 1100;
    } else if (k.shown && now > k.hideAt) {
      k.shown = false;
      k.combo = 0;
      k.comboDmg = -1;
      el.combo[s].classList.remove('show');
    }
  }

  if (!training) {
    const secs = Math.max(0, Math.ceil((st.timer | 0) / 60));
    if (secs !== timerShown) {
      timerShown = secs;
      el.timer.textContent = secs;
    }
    const low = secs <= 10 && st.phase === 'fight';
    if (low !== timerLow) {
      timerLow = low;
      el.timerBox.classList.toggle('low', low);
    }
  }

  if (st.phase !== lastPhase || st.round !== lastRound) {
    onPhase(st, now);
    lastPhase = st.phase;
    lastRound = st.round;
  }
  if (annHideAt && now > annHideAt) {
    annHideAt = 0;
    el.ann.classList.remove('show');
  }

  if (training) updateTraining(st);

  if (online && stats && now - pingAt > 500) {
    pingAt = now;
    const p = Math.round(stats.ping || 0);
    if (p !== pingShown) {
      pingShown = p;
      el.ping.textContent = p + ' ms';
      el.net.className = 'net ' + (p < 90 ? 'good' : p < 170 ? 'ok' : 'bad');
    }
  }
}

function reset() {
  cache[0] = mkCache();
  cache[1] = mkCache();
  timerShown = null;
  timerLow = null;
  lastPhase = null;
  lastRound = -1;
  annHideAt = 0;
  tr.hits = tr.dmg = tr.max = -1;
  tr.move = null;
  tr.lastHits = tr.lastDmg = 0;
  if (!el.ok) return;
  for (let s = 0; s < 2; s++) el.combo[s].classList.remove('show');
  el.ann.classList.remove('show');
}

onMounted(() => {
  const r = root.value;
  const q = (sel) => r.querySelector(sel);
  for (let s = 0; s < 2; s++) {
    el.side[s] = q(`[data-side="${s}"]`);
    el.hp[s] = q(`[data-hp="${s}"]`);
    el.trail[s] = q(`[data-trail="${s}"]`);
    el.meter[s] = q(`[data-meter="${s}"]`);
    el.meterBox[s] = q(`[data-meterbox="${s}"]`);
    el.pips[s] = Array.from(r.querySelectorAll(`[data-pip="${s}"]`));
    el.combo[s] = q(`[data-combo="${s}"]`);
    el.comboN[s] = q(`[data-combon="${s}"]`);
    el.comboD[s] = q(`[data-combod="${s}"]`);
  }
  el.timer = q('[data-timer]');
  el.timerBox = q('.timer');
  el.ann = q('.announce');
  el.annText = q('.announce-text');
  el.annSub = q('.announce-sub');
  el.trHits = q('[data-tr="hits"]');
  el.trDmg = q('[data-tr="dmg"]');
  el.trMax = q('[data-tr="max"]');
  el.trMove = q('[data-tr="move"]');
  el.ping = q('[data-ping]');
  el.net = q('.net');
  el.ok = true;
  emit('ready', { update, reset });
});

defineExpose({ update, reset });
</script>

<template>
  <div ref="root" class="hud" :class="{ 'is-training': training }" aria-hidden="true">
    <div class="hud-top">
      <div v-for="s in [0, 1]" :key="s" class="side" :class="'s' + s" :data-side="s" :style="{ gridColumn: s ? 3 : 1 }">
        <div class="portrait">
          <img v-if="portraits[s]" :src="portraits[s]" alt="" draggable="false" />
        </div>
        <div class="bars">
          <div class="nameline">
            <span class="name">{{ names[s] }}</span>
            <span class="tag">{{ tags[s] }}</span>
          </div>
          <div class="hp">
            <div class="hp-trail" :data-trail="s" />
            <div class="hp-fill" :data-hp="s" />
            <div class="hp-gloss" />
          </div>
          <div class="row2">
            <div class="meter" :data-meterbox="s">
              <div class="meter-fill" :data-meter="s" />
              <span class="meter-label">SUPER</span>
            </div>
            <div class="pips">
              <span v-for="i in rtw" :key="i" class="pip" :data-pip="s" />
            </div>
          </div>
        </div>
      </div>
      <div class="timer" style="grid-column: 2">
        <span data-timer>{{ training ? '∞' : Math.ceil((cfg.roundFrames || 5940) / 60) }}</span>
      </div>
    </div>

    <div v-for="s in [0, 1]" :key="'c' + s" class="combo" :class="'c' + s" :data-combo="s">
      <b :data-combon="s">0</b>
      <span>HITS</span>
      <small :data-combod="s" />
    </div>

    <div v-if="training" class="readout">
      <span>Combo</span><b data-tr="hits">0</b>
      <span>Damage</span><b data-tr="dmg">0</b>
      <span>Best</span><b data-tr="max">0</b>
      <span>Move</span><b data-tr="move" class="mv">—</b>
    </div>

    <div v-if="online" class="net good"><i /> <span data-ping>-- ms</span></div>

    <div class="announce">
      <div class="announce-text" />
      <div class="announce-sub" />
    </div>
  </div>
</template>

<style scoped>
.hud {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
  color: var(--text);
  font-family: var(--font-display);
  -webkit-user-select: none;
  user-select: none;
}
.hud-top {
  position: absolute;
  top: 2.4cqh;
  left: 2.2cqw;
  right: 2.2cqw;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.4cqw;
  align-items: start;
}
.hud-top > * {
  grid-row: 1;
}
.side {
  --pc: var(--p1);
  display: flex;
  gap: 0.9cqw;
  align-items: flex-start;
  min-width: 0;
}
.side.s1 {
  --pc: var(--p2);
  flex-direction: row-reverse;
}
.portrait {
  flex: none;
  width: 6cqw;
  aspect-ratio: 1;
  border-radius: 0.9cqw;
  overflow: hidden;
  border: 0.22cqw solid var(--pc);
  background: radial-gradient(circle at 50% 35%, rgba(255, 255, 255, 0.12), transparent 70%), var(--bg-1);
  box-shadow: 0 0 1.2cqw color-mix(in srgb, var(--pc) 55%, transparent);
}
.portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.s1 .portrait img {
  transform: scaleX(-1);
}
.bars {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45cqw;
}
.nameline {
  display: flex;
  align-items: baseline;
  gap: 0.7cqw;
  font-size: 1.45cqw;
  letter-spacing: 0.05em;
  line-height: 1;
  white-space: nowrap;
  text-shadow: 0 0.15cqw 0 rgba(0, 0, 0, 0.6);
}
.s1 .nameline {
  flex-direction: row-reverse;
}
.name {
  overflow: hidden;
  text-overflow: ellipsis;
}
.tag {
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 0.95cqw;
  padding: 0.12cqw 0.5cqw;
  border-radius: 99px;
  color: var(--pc);
  border: 0.1cqw solid var(--pc);
  letter-spacing: 0.1em;
}
.hp {
  position: relative;
  height: 2.3cqw;
  border-radius: 0.4cqw;
  overflow: hidden;
  background: rgba(5, 8, 20, 0.88);
  border: 0.18cqw solid rgba(234, 242, 255, 0.85);
  box-shadow:
    0 0 1cqw color-mix(in srgb, var(--pc) 45%, transparent),
    inset 0 0 0.6cqw rgba(0, 0, 0, 0.8);
  transform: skewX(-14deg);
}
.s1 .hp {
  transform: skewX(14deg);
}
.hp-trail,
.hp-fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  will-change: transform;
}
.s1 .hp-trail,
.s1 .hp-fill {
  transform-origin: right center;
}
.hp-trail {
  background: linear-gradient(180deg, #ffd1dc, #ff4d6d 60%, #c8193f);
}
.hp-fill {
  background: linear-gradient(180deg, #fff3a8 0%, #ffd23f 45%, #ff9f1c 100%);
  transition: background 0.3s;
}
.side.low .hp-fill {
  background: linear-gradient(180deg, #ffb3a1, #ff5a36 55%, #c4241a);
  animation: hp-low 0.7s ease-in-out infinite alternate;
}
.hp-gloss {
  position: absolute;
  inset: 0 0 55% 0;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.42), rgba(255, 255, 255, 0));
}
@keyframes hp-low {
  to {
    filter: brightness(1.35);
  }
}
.row2 {
  display: flex;
  align-items: center;
  gap: 1cqw;
}
.s1 .row2 {
  flex-direction: row-reverse;
}
.meter {
  position: relative;
  width: 62%;
  height: 1.15cqw;
  border-radius: 0.3cqw;
  overflow: hidden;
  background: rgba(5, 8, 20, 0.88);
  border: 0.12cqw solid rgba(47, 107, 255, 0.8);
  transform: skewX(-14deg);
}
.s1 .meter {
  transform: skewX(14deg);
}
.meter::after {
  content: '';
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(90deg, transparent 0 calc(25% - 0.1cqw), rgba(5, 8, 20, 0.9) calc(25% - 0.1cqw) 25%);
}
.meter-fill {
  position: absolute;
  inset: 0;
  transform-origin: left center;
  background: linear-gradient(90deg, var(--blue), var(--cyan));
  will-change: transform;
}
.s1 .meter-fill {
  transform-origin: right center;
  background: linear-gradient(270deg, var(--blue), var(--magenta));
}
.meter-label {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-size: 0.8cqw;
  letter-spacing: 0.3em;
  color: #1c0c00;
  opacity: 0;
  z-index: 1;
}
.meter.full {
  border-color: #ffd7a8;
  box-shadow:
    0 0 1.2cqw rgba(255, 138, 31, 0.95),
    0 0 2.4cqw rgba(255, 47, 166, 0.5);
  animation: meter-pulse 0.7s ease-in-out infinite alternate;
}
.meter.full .meter-fill {
  background: linear-gradient(90deg, #ff8a1f, #ffe08a, #ff8a1f, #ff2fa6, #ff8a1f);
  background-size: 300% 100%;
  animation: meter-shine 1.2s linear infinite;
}
.meter.full .meter-label {
  opacity: 1;
}
@keyframes meter-pulse {
  to {
    filter: brightness(1.25);
  }
}
@keyframes meter-shine {
  to {
    background-position: 300% 0;
  }
}
.pips {
  display: flex;
  gap: 0.6cqw;
}
.pip {
  width: 1cqw;
  height: 1cqw;
  transform: rotate(45deg);
  border: 0.16cqw solid rgba(234, 242, 255, 0.55);
  background: rgba(5, 8, 20, 0.8);
  transition:
    background 0.2s,
    box-shadow 0.2s;
}
.pip.won {
  background: var(--orange);
  border-color: #ffe0c2;
  box-shadow: 0 0 0.9cqw rgba(255, 138, 31, 0.9);
}
.timer {
  min-width: 7.2cqw;
  padding: 0.35cqw 0.9cqw 0.15cqw;
  border-radius: 0.9cqw;
  text-align: center;
  font-size: 4.1cqw;
  line-height: 1;
  background: rgba(7, 11, 26, 0.78);
  border: 0.18cqw solid rgba(34, 228, 255, 0.65);
  box-shadow:
    0 0 1.2cqw rgba(34, 228, 255, 0.35),
    inset 0 0 1cqw rgba(34, 228, 255, 0.15);
  text-shadow: 0 0 1cqw rgba(34, 228, 255, 0.8);
}
.timer.low {
  color: var(--orange);
  border-color: var(--orange);
  text-shadow: 0 0 1cqw rgba(255, 138, 31, 0.9);
  animation: timer-pulse 0.5s ease-in-out infinite alternate;
}
@keyframes timer-pulse {
  to {
    transform: scale(1.06);
  }
}
.combo {
  position: absolute;
  top: 21cqh;
  left: 2.6cqw;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  opacity: 0;
  transform: translateX(-3cqw);
  transition:
    opacity 0.2s,
    transform 0.25s var(--ease);
}
.combo.c1 {
  left: auto;
  right: 2.6cqw;
  align-items: flex-end;
  transform: translateX(3cqw);
}
.is-training .combo {
  top: 37cqh;
}
.combo.show {
  opacity: 1;
  transform: none;
}
.combo b {
  display: block;
  font-weight: 400;
  font-size: 5.6cqw;
  line-height: 0.95;
  color: var(--orange);
  -webkit-text-stroke: 0.12cqw #2a0f00;
  text-shadow:
    0 0 1.4cqw rgba(255, 138, 31, 0.7),
    0.3cqw 0.3cqw 0 var(--magenta);
}
.combo span {
  font-size: 1.6cqw;
  letter-spacing: 0.18em;
  text-shadow: 0 0 0.8cqw rgba(34, 228, 255, 0.8);
}
.combo small {
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 1.15cqw;
  color: var(--cyan);
  letter-spacing: 0.08em;
}
.readout {
  position: absolute;
  top: 16cqh;
  left: 2.2cqw;
  display: grid;
  grid-template-columns: auto auto;
  gap: 0.25cqw 1.1cqw;
  padding: 0.8cqw 1.1cqw;
  border-radius: 0.8cqw;
  background: rgba(7, 11, 26, 0.72);
  border: 0.12cqw solid rgba(34, 228, 255, 0.4);
  font-family: var(--font-body);
  font-size: 1.15cqw;
  min-width: 15cqw;
}
.readout span {
  color: var(--muted);
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.readout b {
  font-weight: 800;
  text-align: right;
  color: var(--text);
}
.readout b.mv {
  color: var(--cyan);
  max-width: 14cqw;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.net {
  position: absolute;
  bottom: 1.6cqh;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 0.5cqw;
  padding: 0.25cqw 0.8cqw;
  border-radius: 99px;
  background: rgba(7, 11, 26, 0.75);
  border: 0.1cqw solid currentColor;
  font-family: var(--font-body);
  font-weight: 800;
  font-size: 1.05cqw;
  color: var(--good);
}
.net i {
  width: 0.7cqw;
  height: 0.7cqw;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0.6cqw currentColor;
}
.net.ok {
  color: var(--orange);
}
.net.bad {
  color: var(--bad);
}
.announce {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1cqh;
  opacity: 0;
  transition: opacity 0.25s;
  text-align: center;
}
.announce.show {
  opacity: 1;
}
.announce-text {
  font-size: 8.6cqw;
  line-height: 1;
  letter-spacing: 0.04em;
  color: #fff;
  -webkit-text-stroke: 0.16cqw #0b0f1e;
  text-shadow:
    0 0 2cqw rgba(34, 228, 255, 0.85),
    0.45cqw 0.45cqw 0 var(--blue),
    -0.25cqw -0.25cqw 0 var(--magenta);
  white-space: nowrap;
}
.announce.fight .announce-text {
  color: var(--cyan);
}
.announce.ko .announce-text {
  color: var(--orange);
  text-shadow:
    0 0 2.4cqw rgba(255, 138, 31, 0.9),
    0.45cqw 0.45cqw 0 var(--magenta),
    -0.25cqw -0.25cqw 0 var(--blue);
}
.announce.win .announce-text {
  color: var(--gold);
}
.announce.lose .announce-text {
  color: #c9d3f0;
  text-shadow:
    0 0 2cqw rgba(255, 47, 166, 0.7),
    0.45cqw 0.45cqw 0 #3a1030;
}
.announce-sub {
  font-size: 2cqw;
  letter-spacing: 0.08em;
  color: var(--text);
  text-shadow: 0 0.2cqw 0 rgba(0, 0, 0, 0.7);
}
</style>

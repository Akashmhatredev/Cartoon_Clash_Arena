<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { useUi } from '@/stores/ui.js';
import { useMatch } from '@/stores/match.js';
import { useProgress } from '@/stores/progress.js';
import { fighter, fighterName, stageName, STAGE_SWATCH } from '@/lib/fighters.js';
import { portrait } from '@/lib/portraits.js';
import { arcadeConfig } from '@/lib/matchConfig.js';
import { useMenuNav } from '@/lib/menuNav.js';

const ui = useUi();
const match = useMatch();
const progress = useProgress();
const root = ref(null);
useMenuNav(root, { onBack: () => ui.go('menu') });

const run = computed(() => progress.run);
const len = computed(() => run.value?.ladder.length || 0);
const current = computed(() => run.value?.ladder[run.value.index] || null);
const rungs = computed(() => {
  const r = run.value;
  if (!r) return [];
  return r.ladder
    .map((rung, i) => ({
      ...rung,
      i,
      state: i < r.index ? 'done' : i === r.index ? 'current' : 'next',
      img: portrait(rung.opponent, 96),
      name: fighterName(rung.opponent),
    }))
    .reverse();
});
const accent = (id) => fighter(id)?.palette?.primary || '#22e4ff';

const armed = ref(false);
let armTimer = 0;
function abandon() {
  if (!armed.value) {
    armed.value = true;
    clearTimeout(armTimer);
    armTimer = setTimeout(() => (armed.value = false), 3000);
    return;
  }
  const p1 = run.value?.p1;
  progress.abandonRun();
  ui.go('select', { mode: 'arcade', p1 });
}
onBeforeUnmount(() => clearTimeout(armTimer));

function fight() {
  if (!run.value) return;
  match.start(arcadeConfig(run.value));
}

function modsText(m) {
  if (!m) return '';
  const parts = [];
  if (m.hpMult && m.hpMult !== 1) parts.push(`HP ×${m.hpMult}`);
  if (m.dmgMult && m.dmgMult !== 1) parts.push(`DMG ×${m.dmgMult}`);
  return parts.join(' · ');
}
</script>

<template>
  <div ref="root" class="screen ladder-screen">
    <div class="screen-inner">
      <header class="screen-header">
        <button type="button" class="back-btn" @click="ui.go('menu')">Menu</button>
        <div class="head-text">
          <p class="eyebrow">Arcade{{ run ? ' · ' + run.difficulty : '' }}</p>
          <h1 class="title">The Ladder</h1>
        </div>
        <span v-if="run" class="badge orange">Continues {{ run.continues }}</span>
      </header>

      <div v-if="!run" class="panel empty">
        <h2 class="subtitle">No run in progress</h2>
        <p class="muted">Pick a fighter and a difficulty to climb seven fights to the final boss.</p>
        <div class="btn-row">
          <button type="button" class="btn primary" data-autofocus @click="ui.go('select', { mode: 'arcade' })">Start a run</button>
        </div>
      </div>

      <div v-else class="ladder-layout">
        <section class="vs-card panel neon" :class="{ boss: current?.boss }">
          <div class="vs-stage" :style="{ background: STAGE_SWATCH[current?.stage] || STAGE_SWATCH.random }" />
          <div class="vs-side you" :style="{ '--accent': accent(run.p1) }">
            <div class="vs-portrait"><img :src="portrait(run.p1, 320)" alt="" draggable="false" /></div>
            <b class="vs-name">{{ fighterName(run.p1) }}</b>
            <span class="badge">You</span>
          </div>
          <div class="vs-mid">
            <span class="vs">VS</span>
            <span class="fight-no">Fight {{ run.index + 1 }} / {{ len }}</span>
            <span class="muted stage-label">{{ stageName(current?.stage) }}</span>
          </div>
          <div class="vs-side them" :style="{ '--accent': current?.boss ? '#ff2fa6' : accent(current?.opponent) }">
            <div class="vs-portrait"><img :src="portrait(current?.opponent, 320)" alt="" draggable="false" /></div>
            <b class="vs-name">{{ fighterName(current?.opponent) }}</b>
            <span class="badge magenta">{{ current?.boss ? 'Final boss' : 'Challenger' }}</span>
            <small v-if="current?.title" class="muted rung-title">{{ current.title }}</small>
            <small v-if="modsText(current?.mods)" class="mods">{{ modsText(current?.mods) }}</small>
          </div>
          <div class="vs-actions btn-row center">
            <button type="button" class="btn primary fight-btn" data-autofocus @click="fight">Fight!</button>
          </div>
        </section>

        <ol class="tower" aria-label="Ladder">
          <li
            v-for="r in rungs"
            :key="r.i"
            class="rung"
            :class="[r.state, { boss: r.boss }]"
            :style="{ '--swatch': STAGE_SWATCH[r.stage] || STAGE_SWATCH.random }"
          >
            <span class="rung-no">{{ r.boss ? '★' : r.i + 1 }}</span>
            <img class="rung-portrait" :src="r.img" alt="" draggable="false" />
            <span class="rung-text">
              <b>{{ r.name }}</b>
              <small>{{ r.title || stageName(r.stage) }}</small>
            </span>
            <span class="rung-state">{{ r.state === 'done' ? '✓' : r.state === 'current' ? 'NEXT' : '' }}</span>
          </li>
        </ol>
      </div>

      <div v-if="run" class="btn-row">
        <button type="button" class="btn danger small" @click="abandon">{{ armed ? 'Tap again to abandon' : 'Abandon run' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head-text {
  flex: 1 1 auto;
}
.empty {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 560px;
}
.ladder-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(280px, 1fr);
  gap: var(--gap);
  align-items: start;
}
.vs-card {
  position: relative;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  grid-template-areas:
    'you mid them'
    'act act act';
  gap: 18px 10px;
  align-items: center;
  padding-top: clamp(20px, 4vw, 40px);
}
.vs-card.boss {
  border-color: rgba(255, 47, 166, 0.7);
  box-shadow:
    var(--shadow),
    0 0 40px rgba(255, 47, 166, 0.3);
}
.vs-stage {
  position: absolute;
  inset: 0;
  opacity: 0.32;
  z-index: 0;
  -webkit-mask-image: linear-gradient(180deg, #000, transparent 85%);
  mask-image: linear-gradient(180deg, #000, transparent 85%);
}
.vs-side,
.vs-mid,
.vs-actions {
  position: relative;
  z-index: 1;
}
.vs-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}
.you {
  grid-area: you;
}
.them {
  grid-area: them;
}
.vs-mid {
  grid-area: mid;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.vs-actions {
  grid-area: act;
}
.vs-portrait {
  width: clamp(96px, 16vw, 200px);
  aspect-ratio: 1;
  border-radius: 20px;
  overflow: hidden;
  border: 3px solid var(--accent);
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%), var(--bg-1);
  box-shadow: 0 0 26px color-mix(in srgb, var(--accent) 45%, transparent);
}
.vs-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.them .vs-portrait img {
  transform: scaleX(-1);
}
.vs-name {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(16px, 0.8rem + 1vw, 26px);
}
.vs {
  font-family: var(--font-display);
  font-size: clamp(34px, 1rem + 4vw, 70px);
  line-height: 1;
  color: var(--orange);
  text-shadow:
    0 0 20px rgba(255, 138, 31, 0.7),
    3px 3px 0 var(--magenta);
  font-style: italic;
}
.fight-no {
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  letter-spacing: 0.08em;
}
.stage-label {
  font-size: var(--fs-xs);
  font-weight: 700;
}
.rung-title {
  font-size: var(--fs-xs);
  max-width: 220px;
}
.mods {
  color: var(--magenta);
  font-weight: 800;
  font-size: var(--fs-xs);
}
.fight-btn {
  min-width: min(280px, 70vw);
  min-height: 60px;
  font-size: var(--fs-lg);
}
.tower {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rung {
  position: relative;
  display: grid;
  grid-template-columns: 34px 48px 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 6px 12px 6px 8px;
  min-height: 60px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: linear-gradient(90deg, rgba(5, 8, 20, 0.85), rgba(5, 8, 20, 0.55)), var(--swatch);
  overflow: hidden;
}
.rung-no {
  font-family: var(--font-display);
  text-align: center;
  color: var(--muted);
}
.rung-portrait {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  object-fit: cover;
  background: var(--bg-1);
  border: 1px solid var(--line-2);
}
.rung-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.rung-text b {
  font-weight: 800;
}
.rung-text small {
  font-size: var(--fs-xs);
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rung-state {
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.08em;
}
.rung.done {
  opacity: 0.6;
}
.rung.done .rung-state {
  color: var(--good);
  font-size: 18px;
}
.rung.next .rung-portrait {
  filter: grayscale(0.7) brightness(0.7);
}
.rung.current {
  border-color: var(--cyan);
  box-shadow: var(--glow-cyan);
  transform: translateX(-6px);
}
.rung.current .rung-state {
  color: var(--cyan);
  animation: blink 0.9s steps(2) infinite;
}
.rung.boss {
  border-color: rgba(255, 47, 166, 0.65);
  background: linear-gradient(90deg, rgba(40, 4, 24, 0.85), rgba(40, 4, 24, 0.4)), var(--swatch);
}
.rung.boss .rung-no {
  color: var(--orange);
  font-size: 20px;
  text-shadow: 0 0 12px rgba(255, 138, 31, 0.8);
}
.rung.boss.current {
  box-shadow: var(--glow-magenta);
}
@keyframes blink {
  50% {
    opacity: 0.3;
  }
}
@media (max-width: 820px) {
  .ladder-layout {
    grid-template-columns: 1fr;
  }
  .rung.current {
    transform: none;
  }
}
</style>

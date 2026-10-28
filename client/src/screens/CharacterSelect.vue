<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { STAGES } from '@shared/index.js';
import { buildLadder } from '@shared/arcade.js';
import { useUi } from '@/stores/ui.js';
import { useMatch } from '@/stores/match.js';
import { useSettings } from '@/stores/settings.js';
import { useProgress, DIFFICULTIES } from '@/stores/progress.js';
import { ROSTER, fighter, fighterName, STAGE_SWATCH } from '@/lib/fighters.js';
import { portrait } from '@/lib/portraits.js';
import { keyLabel } from '@/lib/keys.js';
import { randomSeed, trainingConfig, versusConfig } from '@/lib/matchConfig.js';
import { sfx } from '@/game/audio/sfx.js';
import FighterDetail from '@/components/FighterDetail.vue';

const ui = useUi();
const match = useMatch();
const settings = useSettings();
const progress = useProgress();

const mode = ['training', 'arcade', 'versus'].includes(ui.params.mode) ? ui.params.mode : 'versus';
const dual = mode === 'versus';
const ids = ROSTER;
const COLS = 4;
const last = progress.last?.[mode] || {};
const p = ui.params || {};

function indexOf(id, fallback) {
  const i = ids.indexOf(id);
  return i >= 0 ? i : fallback;
}

const cursor = reactive([indexOf(p.p1 ?? last.p1, 0), indexOf(p.p2 ?? last.p2, 1)]);
const locked = reactive([false, false]);
const difficulty = ref(DIFFICULTIES.includes(last.difficulty) ? last.difficulty : 'normal');
const stage = ref(p.stage ?? last.stage ?? 'random');
const dummy = ref(ids.includes(last.dummy) ? last.dummy : ids[1]);
const dummyMode = ref(['stationary', 'invincible', 'ai'].includes(last.dummyMode) ? last.dummyMode : 'stationary');
const infiniteMeter = ref(last.infiniteMeter ?? true);

const pick = (s) => ids[cursor[s]];
const active = computed(() => (!dual ? 0 : !locked[0] ? 0 : !locked[1] ? 1 : -1));
const bothLocked = computed(() => locked[0] && locked[1]);

const heading = { training: 'Training', arcade: 'Arcade', versus: 'Local Versus' }[mode];
const eyebrow = { training: 'Pick your fighter', arcade: 'Choose your champion', versus: 'Both players choose' }[mode];

const stages = [{ id: 'random', name: 'Random' }, ...STAGES];
const diffInfo = {
  easy: 'Relaxed opponents with slow reactions. Great for learning.',
  normal: 'Opponents space, block and combo. The intended challenge.',
  hard: 'Punishes unsafe moves. The boss hits harder.',
};

const tiles = ids.map((id) => ({
  id,
  name: fighterName(id),
  img: portrait(id, 192),
  accent: fighter(id)?.palette?.primary || '#22e4ff',
}));

function clears(id) {
  const c = progress.clearsFor(id);
  return DIFFICULTIES.filter((d) => c[d] > 0);
}

const startLabel = computed(() => {
  if (mode === 'arcade') return 'Start Arcade';
  if (mode === 'training') return 'Start Training';
  if (!locked[0]) return 'Lock in P1';
  if (!locked[1]) return 'Lock in P2';
  return 'Fight!';
});

const hint = computed(() => {
  const k1 = settings.keymaps.p1;
  const k2 = settings.keymaps.p2;
  if (!dual) return `Move ${keyLabel(k1.up)}${keyLabel(k1.left)}${keyLabel(k1.down)}${keyLabel(k1.right)} or arrows · ${keyLabel(k1.light)} / Enter to start · Esc back`;
  return `P1: ${keyLabel(k1.left)}/${keyLabel(k1.right)} + ${keyLabel(k1.light)} lock, ${keyLabel(k1.heavy)} undo · P2: arrows + ${keyLabel(k2.light)} lock, ${keyLabel(k2.heavy)} undo`;
});

function play(name) {
  try {
    sfx.play(name);
  } catch {
    /* ignore */
  }
}

function move(s, action) {
  if (dual && locked[s]) return;
  const n = ids.length;
  let i = cursor[s];
  if (action === 'left') i = (i - 1 + n) % n;
  else if (action === 'right') i = (i + 1) % n;
  else if (action === 'up') i = (i - COLS + n) % n;
  else if (action === 'down') i = (i + COLS) % n;
  else return;
  if (i !== cursor[s]) {
    cursor[s] = i;
    play('select');
  }
}

function lock(s) {
  if (locked[s]) return;
  locked[s] = true;
  play('confirm');
}
function unlock(s) {
  if (!locked[s]) return;
  locked[s] = false;
  play('back');
}

function confirm(s) {
  if (!dual) return start();
  if (!locked[s]) return lock(s);
  if (bothLocked.value) start();
}

function tap(i) {
  if (!dual) {
    cursor[0] = i;
    return;
  }
  const s = active.value;
  if (s < 0) return;
  if (cursor[s] === i) lock(s);
  else cursor[s] = i;
}

function primaryAction() {
  if (dual && !bothLocked.value) {
    lock(active.value);
    return;
  }
  start();
}

function start() {
  if (mode === 'training') {
    const picks = { p1: pick(0), dummy: dummy.value, stage: stage.value, dummyMode: dummyMode.value, infiniteMeter: infiniteMeter.value };
    progress.remember('training', picks);
    match.start(trainingConfig(picks));
  } else if (mode === 'arcade') {
    const seed = randomSeed();
    let ladder;
    try {
      ladder = buildLadder(pick(0), difficulty.value, seed);
    } catch (err) {
      console.error(err);
      ui.toast('Could not build the arcade ladder.', 'error');
      return;
    }
    if (!Array.isArray(ladder) || !ladder.length) {
      ui.toast('Could not build the arcade ladder.', 'error');
      return;
    }
    progress.remember('arcade', { p1: pick(0), difficulty: difficulty.value });
    progress.startRun(pick(0), difficulty.value, JSON.parse(JSON.stringify(ladder)), seed);
    ui.go('ladder');
  } else {
    if (!bothLocked.value) return;
    const picks = { p1: pick(0), p2: pick(1), stage: stage.value };
    progress.remember('versus', picks);
    match.start(versusConfig(picks));
  }
}

function back() {
  if (dual && (locked[0] || locked[1])) {
    unlock(locked[1] ? 1 : 0);
    return;
  }
  ui.back();
}

function onKey(e) {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
  const code = e.code;
  if (code === 'Escape') {
    e.preventDefault();
    back();
    return;
  }
  if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') {
    if (t && t.tagName === 'BUTTON' && !t.classList.contains('tile')) return; // let focused buttons activate natively
    e.preventDefault();
    primaryAction();
    return;
  }
  const hit = settings.codeLookup[code];
  if (!hit) return;
  e.preventDefault();
  const s = dual ? (hit.player === 'p1' ? 0 : 1) : 0;
  const a = hit.action;
  if (a === 'left' || a === 'right' || a === 'up' || a === 'down') move(s, a);
  else if (a === 'light') confirm(s);
  else if (a === 'heavy') {
    if (dual) unlock(s);
    else ui.back();
  }
}

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <div class="screen select-screen" :class="['mode-' + mode, { dual }]">
    <div class="screen-inner">
      <header class="screen-header">
        <button type="button" class="back-btn" @click="ui.back()">Back</button>
        <div class="head-text">
          <p class="eyebrow">{{ eyebrow }}</p>
          <h1 class="title">{{ heading }}</h1>
        </div>
        <span v-if="dual" class="badge" :class="active === 1 ? 'magenta' : active === 0 ? '' : 'gold'">
          {{ active === 0 ? 'P1 choosing' : active === 1 ? 'P2 choosing' : 'Ready!' }}
        </span>
      </header>

      <div class="select-layout">
        <FighterDetail
          class="detail d0"
          :id="pick(0)"
          :side="0"
          :locked="dual && locked[0]"
          :label="dual ? 'P1' : ''"
          :compact="dual"
          @change="unlock(0)"
        />

        <section class="roster" aria-label="Fighters">
          <button
            v-for="(t, i) in tiles"
            :key="t.id"
            type="button"
            class="tile"
            :class="{
              c0: cursor[0] === i,
              c1: dual && cursor[1] === i,
              l0: dual && locked[0] && cursor[0] === i,
              l1: dual && locked[1] && cursor[1] === i,
            }"
            :style="{ '--accent': t.accent }"
            :aria-pressed="cursor[0] === i || (dual && cursor[1] === i)"
            :aria-label="t.name"
            data-sfx="select"
            @click="tap(i)"
          >
            <span class="tile-bg" />
            <img v-if="t.img" :src="t.img" alt="" draggable="false" />
            <span class="tile-name">{{ t.name }}</span>
            <span v-if="cursor[0] === i" class="tag t0">{{ dual ? '1P' : 'YOU' }}</span>
            <span v-if="dual && cursor[1] === i" class="tag t1">2P</span>
            <span v-if="clears(t.id).length" class="clears">
              <i v-for="d in clears(t.id)" :key="d" :class="d" :title="`Cleared on ${d}`" />
            </span>
          </button>
        </section>

        <FighterDetail
          v-if="dual"
          class="detail d1"
          :id="pick(1)"
          :side="1"
          :locked="locked[1]"
          label="P2"
          compact
          @change="unlock(1)"
        />
      </div>

      <section class="options">
        <div v-if="mode === 'arcade'" class="panel opt">
          <h2>Difficulty</h2>
          <div class="seg" role="group" aria-label="Difficulty">
            <button v-for="d in DIFFICULTIES" :key="d" type="button" :aria-pressed="difficulty === d" @click="difficulty = d">
              {{ d }}
            </button>
          </div>
          <p class="muted opt-note">{{ diffInfo[difficulty] }}</p>
        </div>

        <div v-if="mode === 'training'" class="panel opt">
          <h2>Training dummy</h2>
          <div class="dummy-row" role="group" aria-label="Dummy fighter">
            <button
              v-for="t in tiles"
              :key="t.id"
              type="button"
              class="dummy-chip"
              :aria-pressed="dummy === t.id"
              :aria-label="t.name"
              :title="t.name"
              :style="{ '--accent': t.accent }"
              @click="dummy = t.id"
            >
              <img v-if="t.img" :src="t.img" alt="" draggable="false" />
            </button>
          </div>
          <p class="muted opt-note">Dummy: <b>{{ fighterName(dummy) }}</b></p>
          <div class="row wrap">
            <div class="seg" role="group" aria-label="Dummy behavior">
              <button type="button" :aria-pressed="dummyMode === 'stationary'" @click="dummyMode = 'stationary'">Stationary</button>
              <button type="button" :aria-pressed="dummyMode === 'invincible'" @click="dummyMode = 'invincible'">Invincible</button>
              <button type="button" :aria-pressed="dummyMode === 'ai'" @click="dummyMode = 'ai'">Basic AI</button>
            </div>
            <label class="row switch-row">
              <button type="button" role="switch" class="switch" :aria-checked="infiniteMeter" @click="infiniteMeter = !infiniteMeter" />
              <span>Infinite meter</span>
            </label>
          </div>
        </div>

        <div v-if="mode !== 'arcade'" class="panel opt">
          <h2>Stage</h2>
          <div class="stage-row" role="group" aria-label="Stage">
            <button
              v-for="s in stages"
              :key="s.id"
              type="button"
              class="stage-chip"
              :aria-pressed="stage === s.id"
              :style="{ '--swatch': STAGE_SWATCH[s.id] || STAGE_SWATCH.random }"
              @click="stage = s.id"
            >
              <span class="swatch" />
              <span class="stage-name">{{ s.name }}</span>
            </button>
          </div>
        </div>
      </section>

      <div class="action-bar">
        <p class="hint muted">{{ hint }}</p>
        <button
          type="button"
          class="btn primary start-btn"
          :class="{ ready: !dual || bothLocked }"
          @click="primaryAction"
        >
          {{ startLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.head-text {
  flex: 1 1 auto;
  min-width: 0;
}
.select-layout {
  display: grid;
  gap: var(--gap);
  grid-template-columns: minmax(0, 1.3fr) minmax(300px, 1fr);
  grid-template-areas: 'roster d0';
  align-items: start;
}
.dual .select-layout {
  grid-template-columns: minmax(250px, 1fr) minmax(0, 1.25fr) minmax(250px, 1fr);
  grid-template-areas: 'd0 roster d1';
}
.d0 {
  grid-area: d0;
}
.d1 {
  grid-area: d1;
}
.roster {
  grid-area: roster;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(8px, 1.2vw, 14px);
  align-content: start;
}
.tile {
  --accent: var(--cyan);
  position: relative;
  aspect-ratio: 4 / 5;
  padding: 0;
  border-radius: 14px;
  border: 2px solid rgba(118, 156, 255, 0.25);
  background: var(--bg-1);
  overflow: hidden;
  cursor: pointer;
  isolation: isolate;
  transition:
    transform 0.14s var(--ease),
    border-color 0.14s,
    box-shadow 0.18s;
}
.tile-bg {
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 65%),
    linear-gradient(180deg, #16224f, #0a1029);
}
.tile img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 30%;
  transition: transform 0.2s var(--ease);
}
.tile:hover img {
  transform: scale(1.05);
}
.tile-name {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 18px 6px 6px;
  font-family: var(--font-display);
  font-size: clamp(10px, 0.55rem + 0.6vw, 15px);
  letter-spacing: 0.03em;
  text-align: center;
  background: linear-gradient(180deg, transparent, rgba(5, 8, 20, 0.92) 55%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tile.c0 {
  border-color: var(--p1);
  box-shadow: var(--glow-cyan);
  transform: translateY(-2px);
}
.tile.c1 {
  border-color: var(--p2);
  box-shadow: var(--glow-magenta);
  transform: translateY(-2px);
}
.tile.c0.c1 {
  border-color: var(--p1) var(--p2) var(--p2) var(--p1);
  box-shadow:
    -4px 0 16px rgba(34, 228, 255, 0.4),
    4px 0 16px rgba(255, 47, 166, 0.4);
}
.tile.l0,
.tile.l1 {
  animation: locked-pulse 1s ease-in-out infinite alternate;
}
@keyframes locked-pulse {
  to {
    filter: brightness(1.18);
  }
}
.tag {
  position: absolute;
  top: 6px;
  padding: 2px 7px;
  border-radius: 6px;
  font-family: var(--font-display);
  font-size: 11px;
  color: #04121a;
}
.t0 {
  left: 6px;
  background: var(--p1);
}
.t1 {
  right: 6px;
  background: var(--p2);
  color: #1d0010;
}
.clears {
  position: absolute;
  right: 6px;
  bottom: 30px;
  display: flex;
  gap: 3px;
}
.clears i {
  width: 9px;
  height: 9px;
  transform: rotate(45deg);
  border: 1px solid #fff;
}
.clears i.easy {
  background: var(--good);
}
.clears i.normal {
  background: var(--cyan);
}
.clears i.hard {
  background: var(--orange);
}
.options {
  display: grid;
  gap: var(--gap);
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
}
.opt {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.opt h2 {
  margin: 0;
}
.opt-note {
  font-size: var(--fs-sm);
}
.dummy-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dummy-chip {
  width: 48px;
  height: 48px;
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid rgba(118, 156, 255, 0.25);
  background: var(--bg-1);
  cursor: pointer;
}
.dummy-chip img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.dummy-chip[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 60%, transparent);
}
.switch-row {
  gap: 10px;
  font-weight: 700;
  font-size: var(--fs-sm);
  cursor: pointer;
}
.stage-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
  gap: 8px;
}
.stage-chip {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  min-height: 48px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid rgba(118, 156, 255, 0.22);
  background: var(--bg-1);
  cursor: pointer;
  text-align: left;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.stage-chip .swatch {
  height: 34px;
  background: var(--swatch);
}
.stage-chip .stage-name {
  padding: 6px 8px;
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.04em;
}
.stage-chip[aria-pressed='true'] {
  border-color: var(--cyan);
  box-shadow: var(--glow-cyan);
}
.action-bar {
  position: sticky;
  bottom: 0;
  margin: 0 calc(-1 * var(--pad)) calc(-1 * (var(--pad) + var(--safe-b)));
  padding: 16px var(--pad) calc(var(--pad) + var(--safe-b));
  display: flex;
  align-items: center;
  gap: 14px;
  background: linear-gradient(180deg, rgba(7, 11, 26, 0), rgba(7, 11, 26, 0.94) 35%);
  z-index: 3;
}
.hint {
  flex: 1;
  font-size: var(--fs-xs);
}
.start-btn {
  min-width: min(240px, 50vw);
  min-height: 56px;
  font-size: var(--fs-lg);
}
.start-btn.ready {
  animation: ready-glow 1.1s ease-in-out infinite alternate;
}
@keyframes ready-glow {
  to {
    box-shadow:
      0 0 0 2px rgba(255, 210, 166, 0.9),
      0 0 34px rgba(255, 138, 31, 0.7);
  }
}
@media (max-width: 1080px) {
  .dual .select-layout {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'roster roster'
      'd0 d1';
  }
}
@media (max-width: 760px) {
  .select-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'roster'
      'd0';
  }
  .dual .select-layout {
    grid-template-columns: 1fr 1fr;
    grid-template-areas:
      'roster roster'
      'd0 d1';
    gap: 8px;
  }
  .hint {
    display: none;
  }
  .start-btn {
    flex: 1;
  }
}
@media (max-width: 520px) {
  .dual .select-layout {
    grid-template-columns: 1fr;
    grid-template-areas:
      'roster'
      'd0'
      'd1';
  }
}
@media (pointer: coarse) {
  .hint {
    display: none;
  }
}
</style>

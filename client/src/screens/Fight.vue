<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw } from 'vue';
import { useMatch } from '@/stores/match.js';
import { useUi } from '@/stores/ui.js';
import { useSettings } from '@/stores/settings.js';
import HUD from '@/components/HUD.vue';
import TouchControls from '@/components/TouchControls.vue';
import MoveList from '@/components/MoveList.vue';
import { isBound } from '@/game/input/keyboard.js';
import { resetTouch } from '@/game/input/touch.js';
import { fighterName } from '@/lib/fighters.js';

const match = useMatch();
const ui = useUi();
const settings = useSettings();

// Plain (non-reactive) copy of the config handed to the game.
const cfg = match.config ? JSON.parse(JSON.stringify(toRaw(match.config))) : null;
const mode = cfg?.mode;
const online = mode === 'online';
const isTraining = mode === 'training';
const localSide = online ? (cfg?.online?.localSide ?? 0) : null;
const ids = cfg ? [cfg.p1, cfg.p2] : [];
const names = ids.map(fighterName);
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const canFullscreen = typeof document !== 'undefined' && !!document.documentElement.requestFullscreen;

const host = ref(null);
const debugEl = ref(null);
const pauseMenu = ref(null);
const loading = ref(true);
const error = ref('');
const paused = ref(false);
const moveListFor = ref(null);
const debugOn = ref(settings.showDebug);
const quitArmed = ref(false);
const trainingOpen = ref(!coarse);
const dummyMode = ref(cfg?.training?.dummyMode || 'stationary');
const infiniteMeter = ref(!!cfg?.training?.infiniteMeter);

const showTouch = computed(
  () => (settings.touch === 'on' || (settings.touch === 'auto' && coarse)) && !!cfg?.controllers?.includes('p1'),
);
const moveListSides = computed(() => (mode === 'versus' ? [0, 1] : [online ? localSide : 0]));

let ctl = null; // { game, destroy } from createGame (never reactive)
let api = null; // scene control API
let disposed = false;
let portraitMq = null;

const hooks = {
  hud: null,
  onReady(a) {
    if (disposed) return;
    api = a;
    loading.value = false;
  },
  onMatchEnd(result) {
    if (disposed) return;
    match.finish(result);
  },
  onDebug(fps, ping, drift, perf, res) {
    const node = debugEl.value;
    if (!debugOn.value || !node) return;
    node.textContent = `FPS ${fps.toFixed(0)}  PING ${Math.round(ping)}ms  DRIFT ${Number(drift).toFixed(1)}  ${res}x${perf ? ' PERF' : ''}`;
  },
  onToast(msg) {
    if (!disposed) ui.toast(msg, 'warn');
  },
  onError(err) {
    if (disposed) return;
    loading.value = false;
    error.value = err?.message || String(err);
  },
};

function onHudReady(hudApi) {
  hooks.hud = hudApi;
}

function settingsSnapshot() {
  return {
    keymaps: JSON.parse(JSON.stringify(toRaw(settings.keymaps))),
    perfMode: settings.perfMode,
    showDebug: settings.showDebug,
    gamepad: { ...toRaw(settings.gamepad) },
  };
}

function setPause(open) {
  if (loading.value || error.value) return;
  paused.value = open;
  quitArmed.value = false;
  if (online) api?.setInputLocked(open);
  else api?.setPaused(open || moveListFor.value !== null);
  if (open) nextTick(() => pauseMenu.value?.querySelector('.btn')?.focus({ preventScroll: true }));
}
function togglePause() {
  setPause(!paused.value);
}

function openMoveList(side) {
  moveListFor.value = side;
  if (!online) api?.setPaused(true);
}
function closeMoveList() {
  moveListFor.value = null;
  if (!online && !paused.value) api?.setPaused(false);
}

function restart() {
  if (online) return;
  api?.restart();
  setPause(false);
}

function quit() {
  if (online && !quitArmed.value) {
    quitArmed.value = true;
    return;
  }
  if (online) ui.go('online');
  else if (mode === 'arcade') ui.go('ladder');
  else ui.go('menu');
}

function toggleDebug() {
  debugOn.value = !debugOn.value;
}

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else
      document.documentElement
        .requestFullscreen?.({ navigationUI: 'hide' })
        ?.then(() => screen.orientation?.lock?.('landscape').catch(() => {}))
        .catch(() => {});
  } catch {
    /* not supported */
  }
}

function setDummy(m) {
  dummyMode.value = m;
  api?.setTraining({ dummyMode: m, infiniteMeter: infiniteMeter.value });
}
function toggleMeter() {
  infiniteMeter.value = !infiniteMeter.value;
  api?.setTraining({ dummyMode: dummyMode.value, infiniteMeter: infiniteMeter.value });
}
function resetTraining() {
  api?.restart();
}

function onKey(e) {
  if (e.code === 'F3') {
    e.preventDefault();
    toggleDebug();
    return;
  }
  if (e.code === 'Escape' || (e.code === 'KeyP' && !isBound('KeyP'))) {
    e.preventDefault();
    if (moveListFor.value !== null) closeMoveList();
    else togglePause();
    return;
  }
  if (paused.value && (e.code === 'ArrowUp' || e.code === 'ArrowDown')) {
    const list = Array.from(pauseMenu.value?.querySelectorAll('.btn:not(:disabled)') || []);
    if (!list.length) return;
    const i = list.indexOf(document.activeElement);
    const dir = e.code === 'ArrowUp' ? -1 : 1;
    list[(i + dir + list.length) % list.length].focus();
  }
}

function onVisibility() {
  if (document.hidden && !online && !paused.value) setPause(true);
}
function onOrientation() {
  if (portraitMq?.matches && !online && !paused.value) setPause(true);
}

onMounted(async () => {
  if (!cfg) {
    ui.go('menu');
    return;
  }
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);
  if (typeof matchMedia !== 'undefined') {
    portraitMq = matchMedia('(orientation: portrait) and (pointer: coarse)');
    portraitMq.addEventListener?.('change', onOrientation);
  }
  try {
    const { createGame } = await import('@/game/createGame.js');
    if (disposed) return;
    ctl = createGame(host.value, { config: cfg, settings: settingsSnapshot(), hooks });
  } catch (err) {
    hooks.onError(err);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('visibilitychange', onVisibility);
  portraitMq?.removeEventListener?.('change', onOrientation);
  hooks.hud = null;
  api = null;
  ctl?.destroy();
  ctl = null;
  resetTouch();
});
</script>

<template>
  <div class="screen fight-screen" :class="{ 'has-touch': showTouch }" @contextmenu.prevent>
    <div class="fight-box">
      <div ref="host" class="game-host" />
      <HUD v-if="cfg" :config="cfg" :local-side="localSide" @ready="onHudReady" />

      <div v-show="debugOn" ref="debugEl" class="debug">FPS --</div>

      <button v-if="!loading && !error" type="button" class="pause-btn" aria-label="Pause" data-sfx="none" @click="togglePause">
        <span /><span />
      </button>

      <div v-if="isTraining && !loading && !error" class="training-panel" :class="{ open: trainingOpen }">
        <button type="button" class="tp-toggle" :aria-expanded="trainingOpen" @click="trainingOpen = !trainingOpen">
          Training {{ trainingOpen ? '▾' : '▸' }}
        </button>
        <template v-if="trainingOpen">
          <div class="seg" role="group" aria-label="Dummy behavior">
            <button type="button" :aria-pressed="dummyMode === 'stationary'" @click="setDummy('stationary')">Stand</button>
            <button type="button" :aria-pressed="dummyMode === 'invincible'" @click="setDummy('invincible')">Invincible</button>
            <button type="button" :aria-pressed="dummyMode === 'ai'" @click="setDummy('ai')">Basic AI</button>
          </div>
          <button type="button" class="chip" :aria-pressed="infiniteMeter" @click="toggleMeter">∞ Meter</button>
          <button type="button" class="chip" @click="openMoveList(0)">Moves</button>
          <button type="button" class="chip" @click="resetTraining">Reset</button>
        </template>
      </div>

      <Transition name="fade">
        <div v-if="loading && !error" class="loading">
          <div class="spinner" />
          <p class="loading-vs">
            <span class="neon-cyan">{{ names[0] }}</span>
            <em>vs</em>
            <span class="neon-magenta">{{ names[1] }}</span>
          </p>
          <p class="muted">Warming up the arena…</p>
        </div>
      </Transition>

      <div v-if="error" class="fight-error panel">
        <h2 class="subtitle">Couldn't start the fight</h2>
        <p class="muted">{{ error }}</p>
        <div class="btn-row">
          <button type="button" class="btn primary" @click="ui.go(online ? 'online' : 'menu')">Back</button>
        </div>
      </div>
    </div>

    <TouchControls v-if="showTouch && !loading && !error" />

    <Transition name="fade">
      <div v-if="paused" class="overlay" @click.self="setPause(false)">
        <div ref="pauseMenu" class="pause-menu panel neon" role="dialog" aria-label="Pause menu">
          <h2 class="title">{{ online ? 'Menu' : 'Paused' }}</h2>
          <p v-if="online" class="muted small">The online match keeps running.</p>
          <button type="button" class="btn primary block" @click="setPause(false)">Resume</button>
          <button type="button" class="btn block" @click="openMoveList(moveListSides[0])">Move List</button>
          <button v-if="!online" type="button" class="btn block" @click="restart">Restart</button>
          <button v-if="canFullscreen && coarse" type="button" class="btn block" @click="toggleFullscreen">Fullscreen</button>
          <button type="button" class="btn danger block" @click="quit">
            {{ quitArmed ? 'Tap again to forfeit' : online ? 'Leave match' : 'Quit' }}
          </button>
          <p class="pause-hint muted">Esc / P to resume · F3 debug</p>
        </div>
      </div>
    </Transition>

    <Transition name="pop">
      <div v-if="moveListFor !== null" class="overlay" @click.self="closeMoveList">
        <div class="movelist-panel panel neon" role="dialog" aria-label="Move list">
          <div class="row between">
            <h2 class="subtitle">{{ names[moveListFor] }}</h2>
            <button type="button" class="back-btn" @click="closeMoveList">Close</button>
          </div>
          <div v-if="moveListSides.length > 1" class="seg">
            <button v-for="s in moveListSides" :key="s" type="button" :aria-pressed="moveListFor === s" @click="moveListFor = s">
              P{{ s + 1 }} · {{ names[s] }}
            </button>
          </div>
          <div class="movelist-scroll">
            <MoveList :char-id="ids[moveListFor]" />
          </div>
        </div>
      </div>
    </Transition>

    <div class="rotate-overlay" aria-live="polite">
      <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true">
        <rect x="20" y="8" width="24" height="44" rx="4" fill="none" stroke="#22e4ff" stroke-width="3" />
        <path d="M48 40a16 16 0 0 1-12 14" fill="none" stroke="#ff8a1f" stroke-width="3" stroke-linecap="round" />
        <path d="M33 50l3 4 4-3" fill="none" stroke="#ff8a1f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      <p class="subtitle">Rotate your device</p>
      <p class="muted">Fights are played in landscape.</p>
    </div>
  </div>
</template>

<style scoped>
.fight-screen {
  padding: 0;
  gap: 0;
  display: grid;
  place-items: center;
  background: #000;
  overflow: hidden;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  overscroll-behavior: none;
}
.fight-box {
  --aw: calc(100vw - var(--safe-l) - var(--safe-r));
  --ah: calc(100vh - var(--safe-t) - var(--safe-b));
  position: relative;
  width: min(var(--aw), calc(var(--ah) * 16 / 9));
  height: min(var(--ah), calc(var(--aw) * 9 / 16));
  container-type: size;
  background: var(--bg-0);
  overflow: hidden;
  box-shadow: 0 0 60px rgba(47, 107, 255, 0.18);
}
@supports (height: 100dvh) {
  .fight-box {
    --ah: calc(100dvh - var(--safe-t) - var(--safe-b));
  }
}
.game-host {
  position: absolute;
  inset: 0;
}
.game-host :deep(canvas) {
  display: block;
  touch-action: none;
}
.debug {
  position: absolute;
  z-index: 8;
  top: 16cqh;
  right: 2.2cqw;
  padding: 4px 8px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(61, 255, 168, 0.5);
  color: var(--good);
  font: 700 11px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre;
  pointer-events: none;
}
.pause-btn {
  position: absolute;
  z-index: 9;
  top: 12.5cqh;
  left: 50%;
  transform: translateX(-50%);
  width: 48px;
  height: 48px;
  min-width: 48px;
  border-radius: 50%;
  border: 1px solid rgba(34, 228, 255, 0.5);
  background: rgba(7, 11, 26, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  opacity: 0.75;
}
.pause-btn:hover,
.pause-btn:focus-visible {
  opacity: 1;
  box-shadow: var(--glow-cyan);
  outline: none;
}
.pause-btn span {
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: var(--text);
}
.training-panel {
  position: absolute;
  z-index: 9;
  top: 17cqh;
  right: 2cqw;
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  max-width: 46cqw;
  padding: 6px;
  border-radius: 14px;
  background: rgba(7, 11, 26, 0.72);
  border: 1px solid var(--line-2);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.has-touch .training-panel {
  top: 21cqh;
  max-width: 56cqw;
}
.tp-toggle {
  min-height: 42px;
  padding: 0 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--cyan);
  font-family: var(--font-display);
  font-size: 12px;
  letter-spacing: 0.08em;
  cursor: pointer;
}
.training-panel .chip {
  min-height: 42px;
}
.loading {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  background: radial-gradient(circle at 50% 45%, rgba(47, 107, 255, 0.25), transparent 60%), var(--bg-0);
  text-align: center;
  padding: 16px;
}
.loading-vs {
  display: flex;
  gap: 14px;
  align-items: baseline;
  font-family: var(--font-display);
  font-size: clamp(18px, 3.4cqw, 42px);
}
.loading-vs em {
  font-style: normal;
  color: var(--orange);
  font-size: 0.7em;
}
.spinner {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  border: 4px solid rgba(34, 228, 255, 0.18);
  border-top-color: var(--cyan);
  border-right-color: var(--magenta);
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.fight-error {
  position: absolute;
  z-index: 11;
  inset: auto 50% 50% auto;
  transform: translate(50%, 50%);
  width: min(520px, 90%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: calc(16px + var(--safe-t)) calc(16px + var(--safe-r)) calc(16px + var(--safe-b)) calc(16px + var(--safe-l));
  background: rgba(3, 5, 14, 0.72);
  -webkit-backdrop-filter: blur(4px);
  backdrop-filter: blur(4px);
  touch-action: manipulation;
}
.pause-menu {
  width: min(360px, 100%);
  max-height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: center;
}
.pause-menu .title {
  margin-bottom: 6px;
}
.pause-hint,
.small {
  font-size: var(--fs-xs);
}
.movelist-panel {
  width: min(720px, 100%);
  max-height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.movelist-scroll {
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}
.rotate-overlay {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 60;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
  background: radial-gradient(circle at 50% 40%, rgba(47, 107, 255, 0.3), transparent 60%), var(--bg-0);
}
.rotate-overlay svg {
  animation: tilt 1.6s ease-in-out infinite;
}
@keyframes tilt {
  0%,
  30% {
    transform: rotate(0);
  }
  60%,
  100% {
    transform: rotate(-90deg);
  }
}
@media (orientation: portrait) and (pointer: coarse) {
  .rotate-overlay {
    display: flex;
  }
}
</style>

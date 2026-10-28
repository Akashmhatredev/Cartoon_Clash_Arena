<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useUi } from '@/stores/ui.js';
import { useSettings, ACTIONS, ACTION_LABELS } from '@/stores/settings.js';
import { useProgress } from '@/stores/progress.js';
import { keyLabel, RESERVED_CODES } from '@/lib/keys.js';
import { fighterName } from '@/lib/fighters.js';
import { GAMEPAD_LEGEND, listGamepads } from '@/game/input/gamepad.js';
import { sfx } from '@/game/audio/sfx.js';

const ui = useUi();
const settings = useSettings();
const progress = useProgress();

const tab = ref('p1');
const listening = ref(null); // { player, action }
const pads = ref([]);
const resetArmed = ref(false);
let resetTimer = 0;

const volumePct = computed({
  get: () => Math.round(settings.volume * 100),
  set: (v) => {
    settings.volume = Math.min(1, Math.max(0, Number(v) / 100));
  },
});

const stats = computed(() => {
  const s = progress.stats;
  return [
    ['Matches', s.matches],
    ['Arcade wins / losses', `${s.wins} / ${s.losses}`],
    ['Arcade clears', s.arcadeClears],
    ['Versus matches', s.versusMatches],
    ['Best combo', s.bestCombo],
    ['Favorite', progress.favorite ? fighterName(progress.favorite) : '—'],
  ];
});

function previewVolume() {
  try {
    sfx.play('hit');
  } catch {
    /* ignore */
  }
}

function listen(player, action) {
  const l = listening.value;
  listening.value = l && l.player === player && l.action === action ? null : { player, action };
}

function owner(code) {
  for (const p of ['p1', 'p2']) for (const a of ACTIONS) if (settings.keymaps[p][a] === code) return { p, a };
  return null;
}

function onKeyCapture(e) {
  if (!listening.value) {
    const t = e.target;
    if (e.code === 'Escape' && !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) {
      e.preventDefault();
      ui.back();
    }
    return;
  }
  e.preventDefault();
  e.stopPropagation();
  if (e.code === 'Escape') {
    listening.value = null;
    return;
  }
  if (RESERVED_CODES.has(e.code)) {
    ui.toast(`${keyLabel(e.code)} is reserved`, 'warn');
    return;
  }
  const { player, action } = listening.value;
  const prev = owner(e.code);
  settings.bindKey(player, action, e.code);
  listening.value = null;
  if (prev && !(prev.p === player && prev.a === action)) {
    ui.toast(`Swapped with ${prev.p.toUpperCase()} ${ACTION_LABELS[prev.a]}`);
  }
}

function onPointerDown(e) {
  if (listening.value && !e.target.closest?.('.key-btn')) listening.value = null;
}

function refreshPads() {
  pads.value = listGamepads();
}

function resetProgress() {
  if (!resetArmed.value) {
    resetArmed.value = true;
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => (resetArmed.value = false), 3000);
    return;
  }
  resetArmed.value = false;
  progress.resetAll();
  ui.toast('Progress reset');
}

onMounted(() => {
  window.addEventListener('keydown', onKeyCapture, true);
  window.addEventListener('pointerdown', onPointerDown, true);
  window.addEventListener('gamepadconnected', refreshPads);
  window.addEventListener('gamepaddisconnected', refreshPads);
  refreshPads();
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyCapture, true);
  window.removeEventListener('pointerdown', onPointerDown, true);
  window.removeEventListener('gamepadconnected', refreshPads);
  window.removeEventListener('gamepaddisconnected', refreshPads);
  clearTimeout(resetTimer);
});
</script>

<template>
  <div class="screen settings-screen">
    <div class="screen-inner">
      <header class="screen-header">
        <button type="button" class="back-btn" @click="ui.back()">Back</button>
        <h1 class="title">Settings</h1>
      </header>

      <div class="settings-grid">
        <section class="panel">
          <h2>Audio</h2>
          <div class="setting">
            <label class="label" for="vol">Volume <b>{{ volumePct }}%</b></label>
            <input
              id="vol"
              v-model.number="volumePct"
              class="range"
              type="range"
              min="0"
              max="100"
              step="1"
              :style="{ '--pct': volumePct + '%' }"
              @change="previewVolume"
            />
          </div>
          <div class="setting row between">
            <span>Mute all sound</span>
            <button type="button" role="switch" class="switch" :aria-checked="settings.muted" aria-label="Mute" @click="settings.muted = !settings.muted" />
          </div>
        </section>

        <section class="panel">
          <h2>Display</h2>
          <div class="setting row between">
            <span>
              Clean mode
              <small class="muted">Hides the scanline overlay</small>
            </span>
            <button type="button" role="switch" class="switch" :aria-checked="settings.cleanMode" aria-label="Clean mode" @click="settings.cleanMode = !settings.cleanMode" />
          </div>
          <div class="setting">
            <span>Performance mode <small class="muted">Fewer particles, no glow, 1x resolution. Auto turns on when FPS drops.</small></span>
            <div class="seg" role="group" aria-label="Performance mode">
              <button v-for="o in ['auto', 'on', 'off']" :key="o" type="button" :aria-pressed="settings.perfMode === o" @click="settings.perfMode = o">{{ o }}</button>
            </div>
          </div>
          <div class="setting">
            <span>Touch controls <small class="muted">Auto shows them on touch screens</small></span>
            <div class="seg" role="group" aria-label="Touch controls">
              <button v-for="o in ['auto', 'on', 'off']" :key="o" type="button" :aria-pressed="settings.touch === o" @click="settings.touch = o">{{ o }}</button>
            </div>
          </div>
          <div class="setting row between">
            <span>
              Debug overlay
              <small class="muted">FPS, ping, tick drift (F3 in a fight)</small>
            </span>
            <button type="button" role="switch" class="switch" :aria-checked="settings.showDebug" aria-label="Debug overlay" @click="settings.showDebug = !settings.showDebug" />
          </div>
        </section>

        <section class="panel">
          <h2>Profile</h2>
          <div class="setting">
            <label class="label" for="pname">Player name</label>
            <input id="pname" v-model="settings.playerName" class="input" type="text" maxlength="20" placeholder="Player" autocomplete="nickname" />
          </div>
          <div class="stat-grid">
            <div v-for="[k, v] in stats" :key="k" class="stat">
              <span class="muted">{{ k }}</span>
              <b>{{ v }}</b>
            </div>
          </div>
          <div class="btn-row">
            <button type="button" class="btn danger small" @click="resetProgress">{{ resetArmed ? 'Tap again to confirm' : 'Reset progress' }}</button>
          </div>
        </section>

        <section class="panel keys-panel">
          <div class="row between wrap">
            <h2>Keyboard</h2>
            <div class="seg" role="group" aria-label="Player">
              <button type="button" :aria-pressed="tab === 'p1'" @click="tab = 'p1'">Player 1</button>
              <button type="button" :aria-pressed="tab === 'p2'" @click="tab = 'p2'">Player 2</button>
            </div>
          </div>
          <p class="muted small">Click an action, then press a key. Esc cancels. A key already in use swaps places.</p>
          <ul class="key-list">
            <li v-for="a in ACTIONS" :key="a">
              <span>{{ ACTION_LABELS[a] }}</span>
              <button
                type="button"
                class="key-btn"
                :class="{ listening: listening && listening.player === tab && listening.action === a }"
                @click="listen(tab, a)"
              >
                {{ listening && listening.player === tab && listening.action === a ? 'Press a key…' : keyLabel(settings.keymaps[tab][a]) }}
              </button>
            </li>
          </ul>
          <div class="btn-row">
            <button type="button" class="btn small ghost" @click="settings.resetKeys(tab)">Reset {{ tab.toUpperCase() }} keys</button>
          </div>
        </section>

        <section class="panel">
          <h2>Gamepads</h2>
          <div class="setting row between">
            <span>Enable gamepads</span>
            <button
              type="button"
              role="switch"
              class="switch"
              :aria-checked="settings.gamepad.enabled"
              aria-label="Enable gamepads"
              @click="settings.gamepad.enabled = !settings.gamepad.enabled"
            />
          </div>
          <div class="setting row between">
            <span>
              Swap pads
              <small class="muted">First pad controls P2</small>
            </span>
            <button type="button" role="switch" class="switch" :aria-checked="settings.gamepad.swap" aria-label="Swap pads" @click="settings.gamepad.swap = !settings.gamepad.swap" />
          </div>
          <ul class="pad-list">
            <li v-if="!pads.length" class="muted">No gamepad detected. Connect one and press any button.</li>
            <li v-for="(pad, i) in pads.slice(0, 2)" :key="pad.index">
              <span class="badge" :class="(i === 0) !== settings.gamepad.swap ? '' : 'magenta'">{{ (i === 0) !== settings.gamepad.swap ? 'P1' : 'P2' }}</span>
              <span class="pad-id">{{ pad.id }}</span>
            </li>
          </ul>
          <dl class="legend">
            <template v-for="[k, v] in GAMEPAD_LEGEND" :key="k">
              <dt>{{ k }}</dt>
              <dd>{{ v }}</dd>
            </template>
          </dl>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-grid {
  display: grid;
  gap: var(--gap);
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr));
  align-items: start;
}
.panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.panel h2 {
  margin: 0;
}
.setting {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 700;
  font-size: var(--fs-sm);
}
.setting.row {
  flex-direction: row;
}
.setting small {
  display: block;
  font-weight: 500;
  font-size: var(--fs-xs);
}
.label b {
  color: var(--cyan);
}
.small {
  font-size: var(--fs-xs);
}
.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.stat {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(5, 8, 20, 0.5);
  font-size: var(--fs-xs);
}
.stat b {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: var(--fs-md);
}
.key-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
}
.key-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-weight: 700;
  font-size: var(--fs-sm);
}
.key-btn {
  min-width: 112px;
  min-height: 44px;
  padding: 0 14px;
  border-radius: 10px;
  border: 1px solid var(--line-2);
  border-bottom-width: 3px;
  background: rgba(5, 8, 20, 0.85);
  color: var(--text);
  font-weight: 800;
  cursor: pointer;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.key-btn:hover,
.key-btn:focus-visible {
  border-color: var(--cyan);
  outline: none;
}
.key-btn.listening {
  border-color: var(--orange);
  color: var(--orange);
  box-shadow: var(--glow-orange);
  animation: listen 0.8s ease-in-out infinite alternate;
}
@keyframes listen {
  to {
    box-shadow: 0 0 0 1px rgba(255, 138, 31, 0.3);
  }
}
.pad-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: var(--fs-sm);
}
.pad-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.pad-id {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.legend {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 14px;
  margin: 0;
  font-size: var(--fs-xs);
}
.legend dt {
  font-weight: 800;
  color: var(--cyan);
}
.legend dd {
  margin: 0;
  color: var(--muted);
}
@media (min-width: 1100px) {
  .keys-panel {
    grid-row: span 2;
  }
}
</style>

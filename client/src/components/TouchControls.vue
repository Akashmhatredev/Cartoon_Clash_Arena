<script setup>
// Virtual D-pad + action buttons. Multi-touch via pointer events with pointer capture.
// Writes a bitmask into touchInput (merged into P1 by the input manager). No reactive state per touch.
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { BTN } from '@shared/input.js';
import { touchInput } from '@/game/input/touch.js';

// x/y: right/bottom offsets in button units (--b); size in button units.
const BUTTONS = [
  { id: 'light', label: 'L', name: 'Light', bit: BTN.LIGHT, x: 1.3, y: 0, size: 1.15, tone: 'cyan' },
  { id: 'heavy', label: 'H', name: 'Heavy', bit: BTN.HEAVY, x: 0, y: 0.75, size: 1.15, tone: 'blue' },
  { id: 'special', label: 'SP', name: 'Special', bit: BTN.SPECIAL, x: 1.45, y: 1.3, size: 1, tone: 'orange' },
  { id: 'jump', label: 'JUMP', name: 'Jump', bit: BTN.UP, x: 0.1, y: 2.05, size: 0.9, tone: 'cyan' },
  { id: 'block', label: 'BLK', name: 'Block', bit: BTN.BLOCK, x: 2.65, y: 0.15, size: 0.95, tone: 'white' },
  { id: 'throw', label: 'THR', name: 'Throw', bit: BTN.THROW, x: 2.75, y: 1.35, size: 0.85, tone: 'magenta' },
  { id: 'ult', label: 'ULT', name: 'Ultimate', bit: BTN.ULT, x: 1.4, y: 2.5, size: 0.9, tone: 'ult' },
];

const dpad = ref(null);
const knob = ref(null);
const btnPointers = new Map(); // pointerId -> { bit, el }
let padPointer = -1;
let padBits = 0;
let padRect = null;
let dirEls = null;

function recompute() {
  let m = padBits;
  for (const v of btnPointers.values()) m |= v.bit;
  touchInput.mask = m;
}

function btnDown(e, bit) {
  e.preventDefault();
  const el = e.currentTarget;
  try {
    el.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  btnPointers.set(e.pointerId, { bit, el });
  el.classList.add('on');
  recompute();
}

function btnUp(e) {
  const rec = btnPointers.get(e.pointerId);
  if (!rec) return;
  btnPointers.delete(e.pointerId);
  let still = false;
  for (const v of btnPointers.values()) if (v.el === rec.el) still = true;
  if (!still) rec.el.classList.remove('on');
  recompute();
}

function setDirClasses(bits) {
  if (!dirEls) return;
  dirEls.up.classList.toggle('on', !!(bits & BTN.UP));
  dirEls.down.classList.toggle('on', !!(bits & BTN.DOWN));
  dirEls.left.classList.toggle('on', !!(bits & BTN.LEFT));
  dirEls.right.classList.toggle('on', !!(bits & BTN.RIGHT));
}

function padDown(e) {
  e.preventDefault();
  if (padPointer !== -1) return;
  padPointer = e.pointerId;
  try {
    dpad.value.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  padRect = dpad.value.getBoundingClientRect();
  padMove(e);
}

function padMove(e) {
  if (e.pointerId !== padPointer || !padRect) return;
  const R = padRect.width / 2;
  const dx = e.clientX - (padRect.left + R);
  const dy = e.clientY - (padRect.top + padRect.height / 2);
  const dist = Math.hypot(dx, dy);
  let bits = 0;
  if (dist > R * 0.2) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    // 8 sectors of 45 degrees (tan 22.5 = 0.414)
    if (ax > ay * 0.414) bits |= dx < 0 ? BTN.LEFT : BTN.RIGHT;
    if (ay > ax * 0.414) bits |= dy < 0 ? BTN.UP : BTN.DOWN;
  }
  if (bits !== padBits) {
    padBits = bits;
    setDirClasses(bits);
    recompute();
  }
  const k = dist > R * 0.45 ? (R * 0.45) / dist : 1;
  if (knob.value) knob.value.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
}

function padUp(e) {
  if (e.pointerId !== padPointer) return;
  padPointer = -1;
  padBits = 0;
  padRect = null;
  setDirClasses(0);
  if (knob.value) knob.value.style.transform = '';
  recompute();
}

function releaseAll() {
  btnPointers.forEach((v) => v.el.classList.remove('on'));
  btnPointers.clear();
  padPointer = -1;
  padBits = 0;
  setDirClasses(0);
  if (knob.value) knob.value.style.transform = '';
  touchInput.mask = 0;
}

onMounted(() => {
  const d = dpad.value;
  dirEls = {
    up: d.querySelector('.dir.up'),
    down: d.querySelector('.dir.down'),
    left: d.querySelector('.dir.left'),
    right: d.querySelector('.dir.right'),
  };
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', releaseAll);
});
onBeforeUnmount(() => {
  window.removeEventListener('blur', releaseAll);
  document.removeEventListener('visibilitychange', releaseAll);
  releaseAll();
});
</script>

<template>
  <div class="touch" @contextmenu.prevent>
    <div
      ref="dpad"
      class="dpad"
      role="group"
      aria-label="Movement pad"
      @pointerdown="padDown"
      @pointermove="padMove"
      @pointerup="padUp"
      @pointercancel="padUp"
      @lostpointercapture="padUp"
    >
      <span class="dir up" /><span class="dir down" /><span class="dir left" /><span class="dir right" />
      <span ref="knob" class="knob" />
    </div>

    <div class="cluster">
      <button
        v-for="b in BUTTONS"
        :key="b.id"
        type="button"
        class="tbtn"
        :class="'t-' + b.tone"
        :aria-label="b.name"
        data-sfx="none"
        :style="{
          right: `calc(var(--b) * ${b.x})`,
          bottom: `calc(var(--b) * ${b.y})`,
          width: `calc(var(--b) * ${b.size})`,
          height: `calc(var(--b) * ${b.size})`,
        }"
        @pointerdown="btnDown($event, b.bit)"
        @pointerup="btnUp"
        @pointercancel="btnUp"
        @lostpointercapture="btnUp"
      >
        {{ b.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.touch {
  --b: clamp(50px, 8.6vmin, 74px);
  position: fixed;
  inset: 0;
  z-index: 20;
  pointer-events: none;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
.dpad {
  pointer-events: auto;
  touch-action: none;
  position: absolute;
  left: calc(var(--safe-l) + max(14px, 2.4vw));
  bottom: calc(var(--safe-b) + max(14px, 3vh));
  width: calc(var(--b) * 2.6);
  height: calc(var(--b) * 2.6);
  border-radius: 50%;
  background: radial-gradient(circle, rgba(13, 21, 48, 0.25) 0 40%, rgba(13, 21, 48, 0.5) 70%);
  border: 2px solid rgba(34, 228, 255, 0.4);
  box-shadow:
    0 0 18px rgba(34, 228, 255, 0.18),
    inset 0 0 26px rgba(34, 228, 255, 0.12);
  opacity: 0.88;
}
.dir {
  position: absolute;
  width: 0;
  height: 0;
  border: calc(var(--b) * 0.16) solid transparent;
  opacity: 0.55;
  transition:
    opacity 0.08s,
    filter 0.08s;
}
.dir.up {
  top: 8%;
  left: 50%;
  translate: -50% 0;
  border-bottom-color: var(--cyan);
  border-top-width: 0;
}
.dir.down {
  bottom: 8%;
  left: 50%;
  translate: -50% 0;
  border-top-color: var(--cyan);
  border-bottom-width: 0;
}
.dir.left {
  left: 8%;
  top: 50%;
  translate: 0 -50%;
  border-right-color: var(--cyan);
  border-left-width: 0;
}
.dir.right {
  right: 8%;
  top: 50%;
  translate: 0 -50%;
  border-left-color: var(--cyan);
  border-right-width: 0;
}
.dir.on {
  opacity: 1;
  filter: drop-shadow(0 0 8px var(--cyan));
}
.knob {
  position: absolute;
  left: 50%;
  top: 50%;
  width: calc(var(--b) * 0.95);
  height: calc(var(--b) * 0.95);
  margin: calc(var(--b) * -0.475) 0 0 calc(var(--b) * -0.475);
  border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, rgba(234, 242, 255, 0.35), rgba(34, 228, 255, 0.18) 60%, rgba(13, 21, 48, 0.4));
  border: 2px solid rgba(34, 228, 255, 0.7);
  box-shadow: 0 0 14px rgba(34, 228, 255, 0.35);
  pointer-events: none;
}
.cluster {
  position: absolute;
  right: calc(var(--safe-r) + max(14px, 2.4vw));
  bottom: calc(var(--safe-b) + max(12px, 3vh));
  width: calc(var(--b) * 3.6);
  height: calc(var(--b) * 3.4);
  pointer-events: none;
}
.tbtn {
  --tone: var(--cyan);
  --tone-a: rgba(34, 228, 255, 0.4);
  pointer-events: auto;
  touch-action: none;
  position: absolute;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  border: 2px solid var(--tone);
  background: rgba(13, 21, 48, 0.42);
  color: var(--text);
  font-family: var(--font-display);
  font-size: calc(var(--b) * 0.24);
  letter-spacing: 0.04em;
  box-shadow:
    0 0 12px var(--tone-a),
    inset 0 0 14px var(--tone-a);
  opacity: 0.86;
  transition:
    transform 0.06s,
    background 0.06s,
    box-shadow 0.06s;
  cursor: pointer;
}
.tbtn.on {
  transform: scale(0.92);
  background: var(--tone-a);
  box-shadow:
    0 0 24px var(--tone),
    inset 0 0 18px var(--tone);
  opacity: 1;
}
.t-blue {
  --tone: #6f9bff;
  --tone-a: rgba(47, 107, 255, 0.45);
}
.t-orange {
  --tone: var(--orange);
  --tone-a: rgba(255, 138, 31, 0.42);
}
.t-magenta {
  --tone: var(--magenta);
  --tone-a: rgba(255, 47, 166, 0.42);
}
.t-white {
  --tone: #dfe8ff;
  --tone-a: rgba(223, 232, 255, 0.3);
}
.t-ult {
  --tone: #ffb36b;
  --tone-a: rgba(255, 47, 166, 0.45);
  background: linear-gradient(135deg, rgba(255, 138, 31, 0.3), rgba(255, 47, 166, 0.3));
}
</style>

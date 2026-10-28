<script setup>
import { computed } from 'vue';
import { fighter } from '@/lib/fighters.js';
import { portrait } from '@/lib/portraits.js';
import MoveList from './MoveList.vue';

const props = defineProps({
  id: { type: String, required: true },
  side: { type: Number, default: 0 },
  locked: { type: Boolean, default: false },
  label: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});
defineEmits(['change']);

const f = computed(() => fighter(props.id) || { name: props.id, title: '', stats: {} });
const accent = computed(() => f.value.palette?.primary || (props.side ? '#ff2fa6' : '#22e4ff'));
const img = computed(() => portrait(props.id, 320));

function hpPips(hp) {
  if (!hp) return 3;
  return Math.max(1, Math.min(5, Math.round(((hp - 85) / 30) * 4 + 1)));
}
const stats = computed(() => {
  const s = f.value.stats || {};
  return [
    { key: 'hp', label: 'HP', value: hpPips(f.value.hp), extra: f.value.hp },
    { key: 'speed', label: 'Speed', value: s.speed || 0 },
    { key: 'power', label: 'Power', value: s.power || 0 },
    { key: 'defense', label: 'Defense', value: s.defense || 0 },
  ];
});
</script>

<template>
  <article class="fd panel" :class="['side-' + side, { locked, compact }]" :style="{ '--accent': accent }">
    <div class="fd-head">
      <div class="fd-portrait">
        <img v-if="img" :src="img" alt="" draggable="false" />
      </div>
      <div class="fd-id">
        <span v-if="label" class="badge" :class="side ? 'magenta' : ''">{{ label }} · {{ locked ? 'Ready' : 'Choosing' }}</span>
        <h2 class="fd-name">{{ f.name }}</h2>
        <p v-if="f.title" class="fd-title">{{ f.title }}</p>
      </div>
    </div>
    <p v-if="f.bio && !compact" class="fd-bio muted">{{ f.bio }}</p>
    <div class="fd-stats">
      <div v-for="s in stats" :key="s.key" class="fd-stat">
        <span class="fd-stat-label">{{ s.label }}<em v-if="s.extra"> {{ s.extra }}</em></span>
        <span class="fd-bar" :aria-label="`${s.label} ${s.value} of 5`">
          <i v-for="n in 5" :key="n" :class="{ on: n <= s.value }" />
        </span>
      </div>
    </div>
    <div v-if="f.passive" class="fd-passive">
      <span class="eyebrow">Passive</span>
      <b>{{ f.passive.name }}</b>
      <span class="muted">{{ f.passive.desc }}</span>
    </div>
    <details class="fd-moves" :open="!compact">
      <summary>Move list</summary>
      <MoveList :char-id="id" :compact="compact" />
    </details>
    <button v-if="locked && label" type="button" class="btn small ghost" @click="$emit('change')">Change fighter</button>
  </article>
</template>

<style scoped>
.fd {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  border-color: color-mix(in srgb, var(--accent) 40%, transparent);
  transition:
    box-shadow 0.25s,
    border-color 0.25s;
}
.fd.locked {
  border-color: var(--accent);
  box-shadow:
    var(--shadow),
    0 0 0 1px var(--accent),
    0 0 26px color-mix(in srgb, var(--accent) 40%, transparent);
}
.fd-head {
  display: flex;
  gap: 14px;
  align-items: center;
}
.side-1 .fd-head {
  flex-direction: row-reverse;
  text-align: right;
}
.fd-portrait {
  flex: none;
  width: clamp(76px, 11vw, 132px);
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 70%),
    var(--bg-1);
  border: 2px solid var(--accent);
  box-shadow: 0 0 18px color-mix(in srgb, var(--accent) 35%, transparent);
}
.fd-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.side-1 .fd-portrait img {
  transform: scaleX(-1);
}
.fd-id {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.side-1 .fd-id {
  align-items: flex-end;
}
.fd-name {
  font-family: var(--font-display);
  font-size: clamp(20px, 1rem + 1.4vw, 32px);
  line-height: 1;
  text-shadow: 0 0 16px color-mix(in srgb, var(--accent) 55%, transparent);
}
.fd-title {
  color: var(--accent);
  font-weight: 800;
  font-size: var(--fs-sm);
  letter-spacing: 0.04em;
}
.fd-bio {
  font-size: var(--fs-sm);
}
.fd-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 16px;
}
.fd-stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.fd-stat-label {
  font-size: var(--fs-xs);
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}
.fd-stat-label em {
  font-style: normal;
  color: var(--text);
}
.fd-bar {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 3px;
}
.fd-bar i {
  height: 8px;
  border-radius: 2px;
  background: rgba(118, 156, 255, 0.18);
  transform: skewX(-18deg);
}
.fd-bar i.on {
  background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 60%, white));
  box-shadow: 0 0 8px color-mix(in srgb, var(--accent) 50%, transparent);
}
.fd-passive {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(5, 8, 20, 0.5);
  border-left: 3px solid var(--accent);
  font-size: var(--fs-sm);
}
.fd-moves summary {
  cursor: pointer;
  min-height: 40px;
  display: flex;
  align-items: center;
  font-family: var(--font-display);
  font-size: var(--fs-sm);
  letter-spacing: 0.06em;
  color: var(--cyan);
  list-style: none;
}
.fd-moves summary::-webkit-details-marker {
  display: none;
}
.fd-moves summary::after {
  content: '+';
  margin-left: auto;
  font-size: 18px;
}
.fd-moves[open] summary::after {
  content: '–';
}
.fd-moves[open] summary {
  margin-bottom: 8px;
}
.compact .fd-stats {
  gap: 6px 12px;
}
</style>

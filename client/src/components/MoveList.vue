<script setup>
import { computed } from 'vue';
import { fighter, MOVE_GROUPS } from '@/lib/fighters.js';
import { keyLabel } from '@/lib/keys.js';
import { useSettings } from '@/stores/settings.js';

const props = defineProps({
  charId: { type: String, required: true },
  compact: { type: Boolean, default: false },
});

const settings = useSettings();
const f = computed(() => fighter(props.charId));

const groups = computed(() => {
  const moves = f.value?.moves || {};
  return MOVE_GROUPS.map((g) => ({
    label: g.label,
    moves: g.slots.map((slot) => moves[slot] && { slot, ...moves[slot] }).filter(Boolean),
  })).filter((g) => g.moves.length);
});

const forms = computed(() => {
  const fm = f.value?.forms;
  if (!fm || typeof fm !== 'object') return [];
  return Object.entries(fm).map(([key, v]) => ({
    key,
    name: v?.name || key.replace(/^\w/, (c) => c.toUpperCase()),
    desc: v?.desc || '',
  }));
});

const legend = computed(() => {
  const k = settings.keymaps.p1;
  return [
    ['L', 'Light', k.light],
    ['H', 'Heavy', k.heavy],
    ['Sp', 'Special', k.special],
    ['Throw', 'Throw', k.throw],
    ['Ult', 'Ultimate', k.ult],
  ].map(([tok, name, code]) => ({ tok, name, key: keyLabel(code) }));
});
</script>

<template>
  <div class="movelist" :class="{ compact }">
    <p v-if="!groups.length" class="muted">Move data unavailable.</p>
    <section v-for="g in groups" :key="g.label" class="ml-group">
      <h4 class="eyebrow">{{ g.label }}</h4>
      <ul class="ml-list">
        <li v-for="m in g.moves" :key="m.slot" :class="'k-' + (m.kind || 'normal')">
          <span class="ml-input"><span class="kbd">{{ m.input || m.slot }}</span></span>
          <span class="ml-text">
            <b>{{ m.name || m.slot }}</b>
            <small v-if="m.desc && !compact">{{ m.desc }}</small>
          </span>
          <span v-if="m.meterCost" class="badge orange">{{ m.meterCost }}%</span>
        </li>
      </ul>
    </section>
    <section v-if="forms.length" class="ml-group">
      <h4 class="eyebrow">Forms</h4>
      <div class="ml-forms">
        <span v-for="fm in forms" :key="fm.key" class="badge blue" :title="fm.desc">{{ fm.name }}</span>
      </div>
    </section>
    <p class="ml-legend">
      <span v-for="l in legend" :key="l.tok"><b>{{ l.tok }}</b> {{ l.name }} <span class="kbd">{{ l.key }}</span></span>
      <span><b>→ / ←</b> toward / away from the rival</span>
    </p>
  </div>
</template>

<style scoped>
.movelist {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.ml-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ml-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ml-list li {
  display: grid;
  grid-template-columns: minmax(64px, auto) 1fr auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(5, 8, 20, 0.5);
  border: 1px solid transparent;
}
.ml-list li.k-special {
  border-color: rgba(34, 228, 255, 0.22);
}
.ml-list li.k-ultimate {
  border-color: rgba(255, 138, 31, 0.45);
  background: linear-gradient(90deg, rgba(255, 138, 31, 0.12), rgba(255, 47, 166, 0.06));
}
.ml-input .kbd {
  min-width: 56px;
  color: var(--cyan);
}
.k-ultimate .ml-input .kbd {
  color: var(--orange);
}
.ml-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.ml-text b {
  font-weight: 800;
  font-size: var(--fs-sm);
}
.ml-text small {
  color: var(--muted);
  font-size: var(--fs-xs);
  line-height: 1.35;
}
.compact .ml-list li {
  padding: 6px 8px;
}
.ml-forms {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ml-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  font-size: var(--fs-xs);
  color: var(--muted);
}
.ml-legend b {
  color: var(--text);
}
.ml-legend .kbd {
  height: 20px;
  min-width: 22px;
  font-size: 11px;
}
</style>

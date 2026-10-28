<script setup>
import { computed, ref } from 'vue';
import * as net from '@/net/config.js';
import { useUi } from '@/stores/ui.js';
import { useProgress } from '@/stores/progress.js';
import { useSettings } from '@/stores/settings.js';
import { ROSTER, fighter } from '@/lib/fighters.js';
import { portrait } from '@/lib/portraits.js';
import { keyLabel } from '@/lib/keys.js';
import { useMenuNav } from '@/lib/menuNav.js';

const ui = useUi();
const progress = useProgress();
const settings = useSettings();
const root = ref(null);
useMenuNav(root);

const onlineOk = !!net.onlineConfigured;
const accountsOk = !!net.supabaseConfigured;

const items = computed(() => {
  const run = progress.run;
  return [
    {
      id: 'arcade',
      label: 'Arcade',
      desc: run ? `Run in progress · fight ${run.index + 1} of ${run.ladder.length}` : 'Seven fights. One final boss.',
      badge: run ? 'Resume' : '',
      primary: true,
      go: () => (run ? ui.go('ladder') : ui.go('select', { mode: 'arcade' })),
    },
    { id: 'versus', label: 'Local Versus', desc: 'Two players, one device', go: () => ui.go('select', { mode: 'versus' }) },
    { id: 'training', label: 'Training', desc: 'Practice combos against a dummy', go: () => ui.go('select', { mode: 'training' }) },
    {
      id: 'online',
      label: 'Online',
      desc: 'Private room with a short code',
      disabled: !onlineOk,
      reason: net.onlineDisabledReason || 'Online play is not configured on this build.',
      go: () => ui.go('online'),
    },
    {
      id: 'leaderboard',
      label: 'Leaderboard',
      desc: 'Top ranked players',
      disabled: !accountsOk,
      reason: net.accountsDisabledReason || 'Accounts are not configured on this build.',
      go: () => ui.go('leaderboard'),
    },
    {
      id: 'account',
      label: 'Account',
      desc: 'Sign in, name, match history',
      disabled: !accountsOk,
      reason: net.accountsDisabledReason || 'Accounts are not configured on this build.',
      go: () => ui.go('account'),
    },
    { id: 'settings', label: 'Settings', desc: 'Audio, display, controls', go: () => ui.go('settings') },
  ];
});

const roster = ROSTER.map((id) => ({ id, img: portrait(id, 128), color: fighter(id)?.palette?.primary || '#22e4ff' }));
const p1Keys = computed(() => {
  const k = settings.keymaps.p1;
  return [k.up, k.left, k.down, k.right].map(keyLabel).join('') + ' + ' + [k.light, k.heavy, k.special].map(keyLabel).join(' ');
});
</script>

<template>
  <div ref="root" class="screen menu-screen">
    <div class="menu-layout">
      <section class="hero">
        <div class="sun" aria-hidden="true" />
        <h1 class="logo">
          <span class="logo-top">Cartoon</span>
          <span class="logo-bottom">Clash</span>
        </h1>
        <p class="logo-sub">Legends of Childhood</p>
        <div class="roster-strip" aria-hidden="true">
          <span v-for="(r, i) in roster" :key="r.id" class="rs" :style="{ '--c': r.color, '--i': i }">
            <img v-if="r.img" :src="r.img" alt="" draggable="false" />
          </span>
        </div>
      </section>

      <nav class="menu" aria-label="Main menu">
        <div v-for="(it, i) in items" :key="it.id" class="menu-item" :style="{ '--i': i }">
          <button
            type="button"
            class="btn menu-btn"
            :class="{ primary: it.primary }"
            :disabled="it.disabled"
            :data-autofocus="i === 0 ? '' : null"
            @click="it.go()"
          >
            <span class="mb-label">{{ it.label }}</span>
            <span v-if="it.badge" class="badge mb-badge">{{ it.badge }}</span>
          </button>
          <p class="mb-desc" :class="{ reason: it.disabled }">{{ it.disabled ? it.reason : it.desc }}</p>
        </div>
      </nav>
    </div>

    <footer class="menu-foot">
      <span class="badge blue">{{ settings.displayName }}</span>
      <span class="badge gold">Clears {{ progress.totalClears }}</span>
      <span class="foot-keys muted">P1 <span class="kbd">{{ p1Keys }}</span> · P2 arrows + Num 1–6 · Esc pause</span>
    </footer>
  </div>
</template>

<style scoped>
.menu-screen {
  justify-content: center;
}
.menu-layout {
  width: 100%;
  max-width: 1180px;
  margin: auto;
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(300px, 420px);
  gap: clamp(20px, 5vw, 72px);
  align-items: center;
}
.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
  isolation: isolate;
}
.sun {
  position: absolute;
  z-index: -1;
  width: min(54vw, 440px);
  aspect-ratio: 1;
  left: 8%;
  top: 50%;
  translate: 0 -58%;
  border-radius: 50%;
  background: linear-gradient(180deg, #ffd166 0%, var(--orange) 42%, var(--magenta) 100%);
  opacity: 0.38;
  filter: blur(0.3px) drop-shadow(0 0 40px rgba(255, 47, 166, 0.6));
  -webkit-mask-image: linear-gradient(to bottom, #000 0 50%, transparent 50% 54%, #000 54% 62%, transparent 62% 67%, #000 67% 74%, transparent 74% 80%, #000 80% 86%, transparent 86% 93%, #000 93%);
  mask-image: linear-gradient(to bottom, #000 0 50%, transparent 50% 54%, #000 54% 62%, transparent 62% 67%, #000 67% 74%, transparent 74% 80%, #000 80% 86%, transparent 86% 93%, #000 93%);
}
.logo {
  display: flex;
  flex-direction: column;
  font-family: var(--font-display);
  font-size: var(--fs-hero);
  line-height: 0.88;
  letter-spacing: 0.01em;
  margin: 0;
  transform: skewY(-4deg);
  animation: logo-in 0.7s var(--ease) both;
}
.logo span {
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  -webkit-text-stroke: 2px rgba(11, 15, 30, 0.9);
  paint-order: stroke fill;
}
.logo-top {
  background-image: linear-gradient(180deg, #e9fdff 0%, var(--cyan) 45%, var(--blue) 100%);
  filter: drop-shadow(0 0 18px rgba(34, 228, 255, 0.55)) drop-shadow(4px 4px 0 #1a2b80);
}
.logo-bottom {
  background-image: linear-gradient(180deg, #fff1c9 0%, var(--orange) 45%, var(--magenta) 100%);
  filter: drop-shadow(0 0 22px rgba(255, 47, 166, 0.55)) drop-shadow(4px 4px 0 #5a0d3a);
  font-size: 1.12em;
}
.logo-sub {
  font-family: var(--font-display);
  font-size: var(--fs-lg);
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text);
  text-shadow: 0 0 14px rgba(34, 228, 255, 0.6);
  margin-top: 6px;
}
@keyframes logo-in {
  from {
    opacity: 0;
    transform: skewY(-4deg) translateY(18px) scale(0.96);
  }
}
.roster-strip {
  display: flex;
  margin-top: clamp(14px, 3vw, 30px);
  padding-left: 10px;
}
.rs {
  width: clamp(44px, 6.4vw, 74px);
  aspect-ratio: 1;
  margin-left: -10px;
  border-radius: 14px;
  overflow: hidden;
  border: 2px solid var(--c);
  background: var(--bg-1);
  box-shadow:
    0 0 14px color-mix(in srgb, var(--c) 45%, transparent),
    0 8px 18px rgba(0, 0, 0, 0.5);
  transform: skewX(-8deg);
  animation: rs-in 0.5s var(--ease) both;
  animation-delay: calc(var(--i) * 45ms + 200ms);
}
.rs img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: skewX(8deg) scale(1.12);
}
@keyframes rs-in {
  from {
    opacity: 0;
    transform: skewX(-8deg) translateY(16px);
  }
}
.menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.menu-item {
  display: flex;
  flex-direction: column;
  gap: 3px;
  animation: item-in 0.45s var(--ease) both;
  animation-delay: calc(var(--i) * 40ms + 120ms);
}
@keyframes item-in {
  from {
    opacity: 0;
    transform: translateX(18px);
  }
}
.menu-btn {
  width: 100%;
  min-height: 56px;
  justify-content: space-between;
  font-size: var(--fs-lg);
  clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px));
  border-radius: 4px;
}
.menu-btn.primary {
  min-height: 64px;
}
.mb-badge {
  color: #1c0c00;
  border-color: #1c0c00;
  background: rgba(255, 255, 255, 0.25);
}
.menu-btn:not(.primary) .mb-badge {
  color: var(--cyan);
  border-color: currentColor;
}
.mb-desc {
  font-size: var(--fs-xs);
  color: var(--muted);
  padding-left: 14px;
}
.mb-desc.reason {
  color: var(--orange);
  opacity: 0.85;
}
.menu-foot {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  font-size: var(--fs-xs);
}
.foot-keys {
  margin-left: auto;
}
.foot-keys .kbd {
  height: 22px;
  font-size: 11px;
}
@media (max-width: 820px) {
  .menu-layout {
    grid-template-columns: 1fr;
    gap: 22px;
    margin: 0 auto;
  }
  .hero {
    align-items: center;
    text-align: center;
    padding-top: 8px;
  }
  .logo {
    align-items: center;
  }
  .sun {
    left: 50%;
    translate: -50% -58%;
  }
  .foot-keys {
    margin-left: 0;
  }
}
@media (pointer: coarse) {
  .foot-keys {
    display: none;
  }
}
</style>

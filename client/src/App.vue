<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, watch } from 'vue';
import { useUi } from '@/stores/ui.js';
import { useSettings } from '@/stores/settings.js';
import { sfx } from '@/game/audio/sfx.js';
import MainMenu from '@/screens/MainMenu.vue';
import CharacterSelect from '@/screens/CharacterSelect.vue';
import Ladder from '@/screens/Ladder.vue';
import Results from '@/screens/Results.vue';
import Settings from '@/screens/Settings.vue';

const Fight = defineAsyncComponent(() => import('@/screens/Fight.vue'));
const OnlineLobby = defineAsyncComponent(() => import('@/screens/OnlineLobby.vue'));
const Account = defineAsyncComponent(() => import('@/screens/Account.vue'));
const Leaderboard = defineAsyncComponent(() => import('@/screens/Leaderboard.vue'));

const SCREEN_COMPONENTS = {
  menu: MainMenu,
  select: CharacterSelect,
  ladder: Ladder,
  fight: Fight,
  results: Results,
  settings: Settings,
  online: OnlineLobby,
  account: Account,
  leaderboard: Leaderboard,
};

const ui = useUi();
const settings = useSettings();
const current = computed(() => SCREEN_COMPONENTS[ui.screen] || MainMenu);
const screenKey = computed(() => `${ui.screen}:${ui.nav}`);

function safe(fn) {
  try {
    fn();
  } catch {
    /* audio must never break the UI */
  }
}

let unlocked = false;
function unlockAudio() {
  if (unlocked) return;
  unlocked = true;
  safe(() => sfx.unlock());
  safe(() => sfx.setVolume(settings.volume));
  safe(() => sfx.setMuted(settings.muted));
  window.removeEventListener('pointerdown', unlockAudio, true);
  window.removeEventListener('keydown', unlockAudio, true);
  window.removeEventListener('touchend', unlockAudio, true);
}

// Delegated menu sounds: .btn -> confirm, .back-btn -> back, other buttons -> select (override with data-sfx).
function onClickSound(e) {
  const el = e.target?.closest?.('button, [data-sfx]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  let name = el.dataset.sfx;
  if (name === 'none') return;
  if (!name) name = el.classList.contains('back-btn') ? 'back' : el.classList.contains('btn') ? 'confirm' : 'select';
  safe(() => sfx.play(name));
}

watch(
  () => settings.volume,
  (v) => safe(() => sfx.setVolume(v)),
);
watch(
  () => settings.muted,
  (m) => safe(() => sfx.setMuted(m)),
);
watch(
  () => settings.cleanMode,
  (c) => document.documentElement.classList.toggle('clean', !!c),
  { immediate: true },
);

onMounted(() => {
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);
  window.addEventListener('touchend', unlockAudio, true);
  document.addEventListener('click', onClickSound, true);
});
onBeforeUnmount(() => {
  unlockAudio();
  document.removeEventListener('click', onClickSound, true);
});
</script>

<template>
  <div class="app" :class="'on-' + ui.screen">
    <div v-show="ui.screen !== 'fight'" class="app-bg" aria-hidden="true">
      <div class="horizon" />
      <div class="floor" />
    </div>

    <Transition name="screen" mode="out-in">
      <component :is="current" :key="screenKey" />
    </Transition>

    <TransitionGroup tag="div" name="toast" class="toasts" aria-live="polite">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.kind">{{ t.text }}</div>
    </TransitionGroup>

    <div v-if="!settings.cleanMode" class="scanlines" aria-hidden="true" />
  </div>
</template>

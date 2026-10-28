import { defineStore } from 'pinia';
import { toRaw } from 'vue';
import { useUi } from './ui.js';
import { useProgress } from './progress.js';

export const useMatch = defineStore('match', {
  state: () => ({ config: null, result: null }),
  actions: {
    start(config) {
      this.config = JSON.parse(JSON.stringify(toRaw(config)));
      this.result = null;
      useUi().go('fight');
    },
    finish(result) {
      const cfg = toRaw(this.config) || result?.config || {};
      const clean = {
        winner: result?.winner ?? null,
        wins: Array.isArray(result?.wins) ? [result.wins[0] | 0, result.wins[1] | 0] : [0, 0],
        stats: {
          maxCombo: [result?.stats?.maxCombo?.[0] | 0, result?.stats?.maxCombo?.[1] | 0],
          damage: [Math.round(result?.stats?.damage?.[0] || 0), Math.round(result?.stats?.damage?.[1] || 0)],
        },
        outcome: null,
      };
      if (cfg.mode === 'arcade' || cfg.mode === 'versus') {
        clean.outcome = useProgress().recordMatch(cfg, clean);
      }
      this.result = clean;
      useUi().go('results');
    },
    clear() {
      this.config = null;
      this.result = null;
    },
  },
});

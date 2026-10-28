import { defineStore } from 'pinia';
import { loadJSON } from '@/lib/storage.js';

export const PROGRESS_KEY = 'cc.progress.v1';
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

function defaultStats() {
  return {
    matches: 0,
    wins: 0,
    losses: 0,
    arcadeRuns: 0,
    arcadeClears: 0,
    arcadeFightsWon: 0,
    versusMatches: 0,
    bestCombo: 0,
    totalDamage: 0,
    fighterUse: {},
  };
}

function defaults() {
  return {
    clears: {}, // { [fighterId]: { easy: n, normal: n, hard: n } }
    run: null, // { p1, difficulty, seed, ladder, index, continues, startedAt }
    stats: defaultStats(),
    last: {}, // last picks per mode, so select screens remember choices
  };
}

function sanitize(saved) {
  const d = defaults();
  if (!saved || typeof saved !== 'object') return d;
  if (saved.clears && typeof saved.clears === 'object') {
    for (const [id, v] of Object.entries(saved.clears)) {
      if (!v || typeof v !== 'object') continue;
      d.clears[id] = { easy: v.easy | 0, normal: v.normal | 0, hard: v.hard | 0 };
    }
  }
  const r = saved.run;
  if (r && typeof r === 'object' && Array.isArray(r.ladder) && r.ladder.length && typeof r.p1 === 'string') {
    d.run = {
      p1: r.p1,
      difficulty: DIFFICULTIES.includes(r.difficulty) ? r.difficulty : 'normal',
      seed: r.seed | 0,
      ladder: r.ladder,
      index: Math.min(Math.max(0, r.index | 0), r.ladder.length - 1),
      continues: r.continues | 0,
      startedAt: Number(r.startedAt) || 0,
    };
  }
  if (saved.stats && typeof saved.stats === 'object') {
    for (const k of Object.keys(d.stats)) {
      if (k === 'fighterUse') continue;
      if (Number.isFinite(saved.stats[k])) d.stats[k] = saved.stats[k];
    }
    if (saved.stats.fighterUse && typeof saved.stats.fighterUse === 'object') {
      for (const [id, n] of Object.entries(saved.stats.fighterUse)) if (Number.isFinite(n)) d.stats.fighterUse[id] = n;
    }
  }
  if (saved.last && typeof saved.last === 'object') d.last = saved.last;
  return d;
}

export const useProgress = defineStore('progress', {
  state: () => sanitize(loadJSON(PROGRESS_KEY, null)),
  getters: {
    totalClears(state) {
      let n = 0;
      for (const v of Object.values(state.clears)) n += (v.easy ? 1 : 0) + (v.normal ? 1 : 0) + (v.hard ? 1 : 0);
      return n;
    },
    favorite(state) {
      let best = null;
      let n = 0;
      for (const [id, c] of Object.entries(state.stats.fighterUse)) if (c > n) { n = c; best = id; }
      return best;
    },
  },
  actions: {
    clearsFor(id) {
      return this.clears[id] || { easy: 0, normal: 0, hard: 0 };
    },
    remember(mode, picks) {
      this.last[mode] = { ...(this.last[mode] || {}), ...picks };
    },
    startRun(p1, difficulty, ladder, seed) {
      this.run = { p1, difficulty, seed, ladder, index: 0, continues: 0, startedAt: Date.now() };
      this.stats.arcadeRuns++;
    },
    abandonRun() {
      this.run = null;
    },
    /** Records a finished offline match. Returns 'next' | 'champion' | 'lost' for arcade, 'done' for versus. */
    recordMatch(cfg, result) {
      const s = this.stats;
      s.matches++;
      s.bestCombo = Math.max(s.bestCombo, result.stats.maxCombo[0], cfg.mode === 'versus' ? result.stats.maxCombo[1] : 0);
      s.totalDamage += result.stats.damage[0];
      s.fighterUse[cfg.p1] = (s.fighterUse[cfg.p1] || 0) + 1;
      if (cfg.mode === 'versus') {
        s.versusMatches++;
        s.fighterUse[cfg.p2] = (s.fighterUse[cfg.p2] || 0) + 1;
        return 'done';
      }
      const won = result.winner === 0;
      if (won) s.wins++;
      else s.losses++;
      const run = this.run;
      if (!run || cfg.arcade?.index !== run.index || run.p1 !== cfg.p1) return won ? 'next' : 'lost';
      if (!won) {
        run.continues++;
        return 'lost';
      }
      s.arcadeFightsWon++;
      if (run.index >= run.ladder.length - 1) {
        const c = this.clears[run.p1] || { easy: 0, normal: 0, hard: 0 };
        c[run.difficulty] = (c[run.difficulty] | 0) + 1;
        this.clears[run.p1] = c;
        s.arcadeClears++;
        this.run = null;
        return 'champion';
      }
      run.index++;
      return 'next';
    },
    resetAll() {
      this.$patch((st) => {
        const d = defaults();
        st.clears = d.clears;
        st.run = null;
        st.stats = d.stats;
        st.last = {};
      });
    },
  },
});

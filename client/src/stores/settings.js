import { defineStore } from 'pinia';
import { loadJSON } from '@/lib/storage.js';
import { RESERVED_CODES } from '@/lib/keys.js';

export const SETTINGS_KEY = 'cc.settings.v1';

export const ACTIONS = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'block', 'throw', 'ult'];
export const ACTION_LABELS = {
  left: 'Move left',
  right: 'Move right',
  up: 'Jump',
  down: 'Crouch',
  light: 'Light',
  heavy: 'Heavy',
  special: 'Special',
  block: 'Block',
  throw: 'Throw',
  ult: 'Ultimate',
};

export const DEFAULT_KEYMAPS = Object.freeze({
  p1: Object.freeze({
    left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS',
    light: 'KeyJ', heavy: 'KeyK', special: 'KeyL', block: 'KeyU', throw: 'KeyI', ult: 'KeyO',
  }),
  p2: Object.freeze({
    left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown',
    light: 'Numpad1', heavy: 'Numpad2', special: 'Numpad3', block: 'Numpad4', throw: 'Numpad5', ult: 'Numpad6',
  }),
});

const TRI = ['auto', 'on', 'off'];

function defaults() {
  return {
    volume: 0.8,
    muted: false,
    cleanMode: false,
    perfMode: 'auto',
    showDebug: false,
    keymaps: { p1: { ...DEFAULT_KEYMAPS.p1 }, p2: { ...DEFAULT_KEYMAPS.p2 } },
    touch: 'auto',
    gamepad: { enabled: true, swap: false },
    playerName: '',
  };
}

function sanitize(saved) {
  const d = defaults();
  if (!saved || typeof saved !== 'object') return d;
  if (Number.isFinite(saved.volume)) d.volume = Math.min(1, Math.max(0, saved.volume));
  if (typeof saved.muted === 'boolean') d.muted = saved.muted;
  if (typeof saved.cleanMode === 'boolean') d.cleanMode = saved.cleanMode;
  if (TRI.includes(saved.perfMode)) d.perfMode = saved.perfMode;
  if (typeof saved.showDebug === 'boolean') d.showDebug = saved.showDebug;
  if (TRI.includes(saved.touch)) d.touch = saved.touch;
  if (saved.gamepad && typeof saved.gamepad === 'object') {
    if (typeof saved.gamepad.enabled === 'boolean') d.gamepad.enabled = saved.gamepad.enabled;
    if (typeof saved.gamepad.swap === 'boolean') d.gamepad.swap = saved.gamepad.swap;
  }
  if (typeof saved.playerName === 'string') d.playerName = saved.playerName.slice(0, 20);
  for (const p of ['p1', 'p2']) {
    const src = saved.keymaps?.[p];
    if (!src || typeof src !== 'object') continue;
    for (const a of ACTIONS) {
      if (typeof src[a] === 'string' && src[a] && !RESERVED_CODES.has(src[a])) d.keymaps[p][a] = src[a];
    }
  }
  return d;
}

export const useSettings = defineStore('settings', {
  state: () => sanitize(loadJSON(SETTINGS_KEY, null)),
  getters: {
    /** event.code -> { player: 'p1'|'p2', action } for menu navigation. */
    codeLookup(state) {
      const out = {};
      for (const p of ['p2', 'p1']) {
        for (const a of ACTIONS) out[state.keymaps[p][a]] = { player: p, action: a };
      }
      return out;
    },
    displayName(state) {
      return state.playerName.trim() || 'Player';
    },
  },
  actions: {
    /** Bind `code` to player/action. If another action already uses it, the two swap keys. */
    bindKey(player, action, code) {
      if (!code || RESERVED_CODES.has(code)) return false;
      const maps = this.keymaps;
      const old = maps[player][action];
      if (old === code) return true;
      for (const p of ['p1', 'p2']) {
        for (const a of ACTIONS) {
          if (maps[p][a] === code && !(p === player && a === action)) maps[p][a] = old;
        }
      }
      maps[player][action] = code;
      return true;
    },
    resetKeys(player) {
      const players = player ? [player] : ['p1', 'p2'];
      for (const p of players) Object.assign(this.keymaps[p], DEFAULT_KEYMAPS[p]);
      // Resetting one side could duplicate a key the other side had swapped in; fix by resetting both if so.
      const used = new Set();
      let dup = false;
      for (const p of ['p1', 'p2']) for (const a of ACTIONS) {
        const c = this.keymaps[p][a];
        if (used.has(c)) dup = true;
        used.add(c);
      }
      if (dup) for (const p of ['p1', 'p2']) Object.assign(this.keymaps[p], DEFAULT_KEYMAPS[p]);
    },
    resetAll() {
      this.$patch(defaults());
    },
  },
});

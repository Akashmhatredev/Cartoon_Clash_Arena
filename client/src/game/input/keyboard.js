// Window-level keyboard state keyed by event.code. No per-tick allocations.
import { BTN } from '@shared/input.js';

export const ACTION_BITS = {
  left: BTN.LEFT,
  right: BTN.RIGHT,
  up: BTN.UP,
  down: BTN.DOWN,
  light: BTN.LIGHT,
  heavy: BTN.HEAVY,
  special: BTN.SPECIAL,
  block: BTN.BLOCK,
  throw: BTN.THROW,
  ult: BTN.ULT,
};

const ALWAYS_PREVENT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
const held = new Set();
const bound = new Set();
const codes = [[], []];
const bits = [[], []];
let attached = false;

function isTyping(e) {
  const t = e.target;
  if (!t || t === window || t === document.body) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

function onDown(e) {
  if (isTyping(e)) return;
  if (bound.has(e.code) || ALWAYS_PREVENT.has(e.code)) e.preventDefault();
  held.add(e.code);
}
function onUp(e) {
  held.delete(e.code);
  if (bound.has(e.code)) e.preventDefault();
}
function clearHeld() {
  held.clear();
}
function onVisibility() {
  if (document.hidden) held.clear();
}

export function setKeymaps(keymaps) {
  bound.clear();
  ['p1', 'p2'].forEach((p, i) => {
    codes[i].length = 0;
    bits[i].length = 0;
    const map = keymaps?.[p] || {};
    for (const action of Object.keys(ACTION_BITS)) {
      const code = map[action];
      if (!code) continue;
      codes[i].push(code);
      bits[i].push(ACTION_BITS[action]);
      bound.add(code);
    }
  });
}

export function attachKeyboard(keymaps) {
  if (keymaps) setKeymaps(keymaps);
  if (attached) return;
  attached = true;
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', clearHeld);
  document.addEventListener('visibilitychange', onVisibility);
}

export function detachKeyboard() {
  if (!attached) return;
  attached = false;
  window.removeEventListener('keydown', onDown);
  window.removeEventListener('keyup', onUp);
  window.removeEventListener('blur', clearHeld);
  document.removeEventListener('visibilitychange', onVisibility);
  held.clear();
}

/** Mask for keymap index 0 (P1) or 1 (P2). */
export function keyboardMask(i) {
  const c = codes[i];
  const b = bits[i];
  let m = 0;
  for (let k = 0; k < c.length; k++) if (held.has(c[k])) m |= b[k];
  return m;
}

export function isBound(code) {
  return bound.has(code);
}

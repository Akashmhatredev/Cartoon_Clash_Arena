// Input manager: merges keyboard, gamepads and touch into per-controller masks.
// The scene calls getMask(controllerId) once per fixed tick. No allocations on that path.
import { BTN } from '@shared/input.js';
import { attachKeyboard, detachKeyboard, keyboardMask } from './keyboard.js';
import { configureGamepads, pollGamepads, padMask } from './gamepad.js';
import { touchInput } from './touch.js';

const LR = BTN.LEFT | BTN.RIGHT;
const UD = BTN.UP | BTN.DOWN;
let mergeP2 = false; // single human player: P2 keys and pad 1 also drive P1
let lastPoll = -1;

export function initInput(settings = {}, opts = {}) {
  mergeP2 = !!opts.mergeP2;
  attachKeyboard(settings.keymaps);
  configureGamepads(settings.gamepad || {});
  lastPoll = -1;
}

export function destroyInput() {
  detachKeyboard();
  touchInput.mask = 0;
  mergeP2 = false;
}

// SOCD cleaning: left+right = neutral, up+down = up.
function clean(m) {
  if ((m & LR) === LR) m &= ~LR;
  if ((m & UD) === UD) m &= ~BTN.DOWN;
  return m;
}

export function getMask(controllerId) {
  const now = performance.now();
  if (now - lastPoll > 4) {
    pollGamepads();
    lastPoll = now;
  }
  let m = 0;
  if (controllerId === 'p1') {
    m = keyboardMask(0) | padMask(0) | touchInput.mask;
    if (mergeP2) m |= keyboardMask(1) | padMask(1);
  } else if (controllerId === 'p2') {
    m = keyboardMask(1) | padMask(1);
  }
  return clean(m);
}

export { touchInput };

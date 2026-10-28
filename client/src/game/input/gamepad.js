// Gamepad poller (standard mapping). Connected pads in order: first -> P1, second -> P2 (swap optional).
import { BTN } from '@shared/input.js';

const masks = [0, 0];
let enabled = true;
let swap = false;
const DEAD = 0.45;

// Standard mapping button index -> bit.
const BUTTON_MAP = [
  [0, BTN.LIGHT], // A / Cross
  [2, BTN.HEAVY], // X / Square
  [1, BTN.SPECIAL], // B / Circle
  [3, BTN.THROW], // Y / Triangle
  [4, BTN.BLOCK], // LB
  [6, BTN.BLOCK], // LT
  [5, BTN.ULT], // RB
  [7, BTN.ULT], // RT
  [12, BTN.UP],
  [13, BTN.DOWN],
  [14, BTN.LEFT],
  [15, BTN.RIGHT],
];

export const GAMEPAD_LEGEND = [
  ['Stick / D-pad', 'Move, jump (up), crouch (down)'],
  ['A / Cross', 'Light'],
  ['X / Square', 'Heavy'],
  ['B / Circle', 'Special'],
  ['Y / Triangle', 'Throw'],
  ['LB / LT', 'Block'],
  ['RB / RT', 'Ultimate'],
];

export function configureGamepads(opts = {}) {
  enabled = opts.enabled !== false;
  swap = !!opts.swap;
}

function pressed(buttons, i) {
  const b = buttons[i];
  return !!b && (b.pressed || b.value > 0.5);
}

function readPad(p) {
  const b = p.buttons;
  const a = p.axes;
  let m = 0;
  for (let k = 0; k < BUTTON_MAP.length; k++) if (pressed(b, BUTTON_MAP[k][0])) m |= BUTTON_MAP[k][1];
  if (a.length >= 2) {
    const x = a[0];
    const y = a[1];
    if (x < -DEAD) m |= BTN.LEFT;
    else if (x > DEAD) m |= BTN.RIGHT;
    if (y < -DEAD) m |= BTN.UP;
    else if (y > DEAD) m |= BTN.DOWN;
  }
  return m;
}

export function pollGamepads() {
  masks[0] = 0;
  masks[1] = 0;
  if (!enabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
  let pads;
  try {
    pads = navigator.getGamepads();
  } catch {
    return;
  }
  if (!pads) return;
  let slot = 0;
  for (let i = 0; i < pads.length && slot < 2; i++) {
    const p = pads[i];
    if (!p || !p.connected) continue;
    masks[swap ? 1 - slot : slot] = readPad(p);
    slot++;
  }
}

export function padMask(slot) {
  return masks[slot];
}

export function listGamepads() {
  if (typeof navigator === 'undefined' || !navigator.getGamepads) return [];
  try {
    return Array.from(navigator.getGamepads() || [])
      .filter((p) => p && p.connected)
      .map((p) => ({ index: p.index, id: p.id, standard: p.mapping === 'standard' }));
  } catch {
    return [];
  }
}

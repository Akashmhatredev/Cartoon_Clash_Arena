export const BTN = { LEFT: 1, RIGHT: 2, UP: 4, DOWN: 8, LIGHT: 16, HEAVY: 32, SPECIAL: 64, BLOCK: 128, THROW: 256, ULT: 512 };
export const BTN_NAMES = ['left', 'right', 'up', 'down', 'light', 'heavy', 'special', 'block', 'throw', 'ult'];
export const INPUT_MASK_ALL = 1023;
export function isValidMask(m) { return Number.isInteger(m) && m >= 0 && m <= INPUT_MASK_ALL; }

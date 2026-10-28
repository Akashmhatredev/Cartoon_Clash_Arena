const NAMED = {
  Space: 'Space', Enter: 'Enter', Escape: 'Esc', Tab: 'Tab', Backspace: 'Bksp',
  ShiftLeft: 'L Shift', ShiftRight: 'R Shift', ControlLeft: 'L Ctrl', ControlRight: 'R Ctrl',
  AltLeft: 'L Alt', AltRight: 'R Alt', MetaLeft: 'L Cmd', MetaRight: 'R Cmd',
  ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\',
  BracketLeft: '[', BracketRight: ']', Minus: '-', Equal: '=', Backquote: '`', CapsLock: 'Caps',
  NumpadEnter: 'Num Ent', NumpadAdd: 'Num +', NumpadSubtract: 'Num -', NumpadMultiply: 'Num *',
  NumpadDivide: 'Num /', NumpadDecimal: 'Num .', Insert: 'Ins', Delete: 'Del', Home: 'Home', End: 'End',
  PageUp: 'PgUp', PageDown: 'PgDn',
};

export function keyLabel(code) {
  if (!code) return '—';
  if (NAMED[code]) return NAMED[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/** Keys that can never be bound: Escape cancels/pauses, F3 toggles the debug overlay. */
export const RESERVED_CODES = new Set(['Escape', 'F3']);

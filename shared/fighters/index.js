import shinchan from './shinchan.js';
import doraemon from './doraemon.js';
import hattori from './hattori.js';
import pikachu from './pikachu.js';
import ben10 from './ben10.js';
import nobita from './nobita.js';
import goku from './goku.js';
import bheem from './bheem.js';

export const SLOTS = ['light', 'heavy', 'crouchLight', 'crouchHeavy', 'airLight', 'airHeavy', 'throw',
  'special1', 'special2', 'special3', 'ultimate'];
const STAT_KEYS = ['walkSpeed', 'backSpeed', 'jumpVel', 'jumpSpeedX', 'gravity', 'dashSpeed', 'dashFrames', 'dmgMult', 'defMult', 'body'];

export const FIGHTERS = { shinchan, doraemon, hattori, pikachu, ben10, nobita, goku, bheem };

const statCache = {};
for (const id in FIGHTERS) {
  const d = FIGHTERS[id];
  for (const slot in d.moves) d.moves[slot].id = slot;
  const base = {};
  for (const k of STAT_KEYS) base[k] = d[k];
  statCache[id] = { base };
  for (const form in d.forms || {}) {
    const fo = d.forms[form];
    for (const slot in fo.moves || {}) fo.moves[slot].id = slot;
    const s = { ...base };
    for (const k of STAT_KEYS) if (fo[k] !== undefined) s[k] = fo[k];
    statCache[id][form] = s;
  }
}

export function getFighter(id) {
  return FIGHTERS[id] || null;
}

export function getMove(charId, slot, form = null) {
  const d = FIGHTERS[charId];
  if (!d) return null;
  if (form) {
    const fo = d.forms && d.forms[form];
    if (fo && fo.moves && fo.moves[slot]) return fo.moves[slot];
  }
  return d.moves[slot] || null;
}

/** Movement/defence stats for a fighter in its current form (cached, no allocation). */
export function getStats(charId, form = null) {
  const c = statCache[charId];
  return (form && c[form]) || c.base;
}

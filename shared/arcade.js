// Arcade ladder builder (CONTRACT section 6). Deterministic for a given seed.
import { FIGHTER_IDS } from './constants.js';

export const ARCADE_LENGTH = 7;

const NAMES = {
  shinchan: 'Shinchan', doraemon: 'Doraemon', hattori: 'Ninja Hattori', pikachu: 'Pikachu',
  ben10: 'Ben 10', nobita: 'Nobita', goku: 'Kid Goku', bheem: 'Chhota Bheem',
};
const HOME = {
  shinchan: 'suburb', doraemon: 'suburb', nobita: 'suburb', hattori: 'dojo',
  pikachu: 'forest', ben10: 'neon_city', goku: 'island', bheem: 'village',
};
const BOUT = {
  shinchan: 'Mischief Mayhem', doraemon: 'Gadget Gauntlet', hattori: 'Ninja Showdown',
  pikachu: 'Thunder Trial', ben10: 'Omnitrix Overdrive', nobita: 'Underdog Uprising',
  goku: 'Saiyan Rumble', bheem: 'Dholakpur Brawl',
};
const LADDERS = {
  easy: ['easy', 'easy', 'easy', 'easy', 'normal', 'normal', 'boss'],
  normal: ['easy', 'normal', 'normal', 'normal', 'normal', 'hard', 'boss'],
  hard: ['normal', 'hard', 'hard', 'hard', 'hard', 'hard', 'boss'],
};
const ORDINAL = ['', 'Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 5', 'Semi-Final'];

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * buildLadder(playerCharId, difficulty 'easy'|'normal'|'hard', seed)
 *   -> [{ opponent, stage, aiDifficulty, mods: { hpMult, dmgMult }, boss, title }] x ARCADE_LENGTH
 * Opponents are the other fighters in a seeded shuffle; the last one is the boss on 'final'.
 */
export function buildLadder(playerCharId, difficulty = 'normal', seed = 1) {
  const diffs = LADDERS[difficulty] || LADDERS.normal;
  const rand = rng(((seed >>> 0) ^ 0xA5C3_1E77) >>> 0);
  const pool = FIGHTER_IDS.filter((id) => id !== playerCharId);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
  }
  while (pool.length < ARCADE_LENGTH) pool.push(pool[pool.length % Math.max(1, pool.length)] || FIGHTER_IDS[0]);
  const ladder = [];
  for (let i = 0; i < ARCADE_LENGTH; i++) {
    const opponent = pool[i];
    const boss = i === ARCADE_LENGTH - 1;
    const name = NAMES[opponent] || opponent;
    ladder.push({
      opponent,
      stage: boss ? 'final' : (HOME[opponent] || 'island'),
      aiDifficulty: boss ? 'boss' : diffs[i],
      mods: boss ? { hpMult: 1.3, dmgMult: 1.15 } : { hpMult: 1, dmgMult: 1 },
      boss,
      title: boss ? `FINAL BOSS: Champion ${name}` : `${ORDINAL[i + 1]}: ${BOUT[opponent] || 'Clash'} vs ${name}`,
    });
  }
  return ladder;
}

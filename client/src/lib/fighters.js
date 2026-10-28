import { FIGHTER_IDS, STAGES, getFighter } from '@shared/index.js';

export const ROSTER = FIGHTER_IDS;

export function fighter(id) {
  try {
    return getFighter(id) || null;
  } catch {
    return null;
  }
}

export function fighterName(id) {
  return fighter(id)?.name || id || '???';
}

export function stageName(id) {
  if (id === 'random') return 'Random';
  return STAGES.find((s) => s.id === id)?.name || id;
}

export const MOVE_GROUPS = [
  { label: 'Basics', slots: ['light', 'heavy', 'crouchLight', 'crouchHeavy', 'airLight', 'airHeavy', 'throw'] },
  { label: 'Specials', slots: ['special1', 'special2', 'special3'] },
  { label: 'Ultimate', slots: ['ultimate'] },
];

// CSS backdrops for stage chips and ladder cards (menus only; real stages are drawn in Phaser).
export const STAGE_SWATCH = {
  neon_city: 'linear-gradient(160deg, #1a0b3d 0%, #3a0f5c 45%, #ff2fa6 100%)',
  suburb: 'linear-gradient(170deg, #2b1850 0%, #c2416b 55%, #ff8a1f 100%)',
  dojo: 'linear-gradient(170deg, #050a24 0%, #14245e 60%, #6f86d6 100%)',
  forest: 'linear-gradient(170deg, #07150f 0%, #1d4a2a 55%, #d8e23a 100%)',
  village: 'linear-gradient(170deg, #2a1608 0%, #8a4a1a 55%, #ffc061 100%)',
  island: 'linear-gradient(170deg, #062038 0%, #0f6c8c 55%, #7ff0ff 100%)',
  final: 'linear-gradient(160deg, #12040c 0%, #5c0f3a 45%, #ff8a1f 100%)',
  random: 'conic-gradient(from 200deg, #22e4ff, #2f6bff, #ff2fa6, #ff8a1f, #22e4ff)',
};

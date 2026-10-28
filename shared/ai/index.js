// Public AI API (CONTRACT section 6).
import { createBrain, AI_STATES } from './brain.js';

export { AI_STATES };
export { DIFFICULTY, STYLES, getStyle } from './styles.js';

const LEVELS = { easy: 1, normal: 1, hard: 1, boss: 1 };

/**
 * createAI({ charId, difficulty: 'easy'|'normal'|'hard'|'boss', seed = 1 })
 *   -> { think(state, side) -> inputMask, reset() }
 * Call think() exactly once per tick before step(). Deterministic for a given seed and state sequence.
 */
export function createAI({ charId, difficulty = 'normal', seed = 1 } = {}) {
  const diff = LEVELS[difficulty] ? difficulty : 'normal';
  const brain = createBrain(charId, diff, seed);
  return {
    charId,
    difficulty: diff,
    think: brain.think,
    reset: brain.reset,
    get aiState() { return brain.state; },
  };
}

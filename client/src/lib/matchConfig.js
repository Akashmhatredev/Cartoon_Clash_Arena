import { STAGES, ROUNDS_TO_WIN } from '@shared/index.js';

const NO_MOD = () => ({ hpMult: 1, dmgMult: 1 });

export function randomSeed() {
  return ((Math.random() * 0x7fffffff) >>> 0) || 1;
}

export function resolveStage(stage) {
  if (stage && stage !== 'random' && STAGES.some((s) => s.id === stage)) return stage;
  const pool = STAGES.filter((s) => s.id !== 'final');
  return pool[Math.floor(Math.random() * pool.length)].id;
}

export function arcadeConfig(run) {
  const rung = run.ladder[run.index];
  return {
    mode: 'arcade',
    p1: run.p1,
    p2: rung.opponent,
    stage: rung.stage,
    roundsToWin: ROUNDS_TO_WIN || 2,
    seed: randomSeed(),
    controllers: ['p1', 'ai'],
    aiDifficulty: rung.aiDifficulty || run.difficulty || 'normal',
    mods: [NO_MOD(), { hpMult: rung.mods?.hpMult ?? 1, dmgMult: rung.mods?.dmgMult ?? 1 }],
    training: null,
    arcade: {
      index: run.index,
      ladder: run.ladder,
      difficulty: run.difficulty,
      boss: !!rung.boss,
      title: rung.title || '',
    },
  };
}

export function versusConfig({ p1, p2, stage }) {
  return {
    mode: 'versus',
    p1,
    p2,
    stage: resolveStage(stage),
    stageChoice: stage || 'random',
    roundsToWin: ROUNDS_TO_WIN || 2,
    seed: randomSeed(),
    controllers: ['p1', 'p2'],
    aiDifficulty: null,
    mods: [NO_MOD(), NO_MOD()],
    training: null,
  };
}

export function trainingConfig({ p1, dummy, stage, dummyMode = 'stationary', infiniteMeter = true }) {
  return {
    mode: 'training',
    p1,
    p2: dummy,
    stage: resolveStage(stage),
    stageChoice: stage || 'random',
    roundsToWin: ROUNDS_TO_WIN || 2,
    seed: randomSeed(),
    controllers: ['p1', dummyMode === 'ai' ? 'ai' : 'dummy'],
    aiDifficulty: 'easy',
    mods: [NO_MOD(), NO_MOD()],
    training: { dummyMode, dummyInvincible: dummyMode === 'invincible', infiniteMeter: !!infiniteMeter },
  };
}

/** Same matchup, fresh seed (and a fresh random stage if the stage was random). */
export function rematchConfig(cfg) {
  const next = JSON.parse(JSON.stringify(cfg));
  next.seed = randomSeed();
  if (next.stageChoice === 'random') next.stage = resolveStage('random');
  return next;
}

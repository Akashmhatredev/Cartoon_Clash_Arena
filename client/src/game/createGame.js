import Phaser from 'phaser';
import { VIEW } from '@shared/constants.js';
import { FightScene } from './FightScene.js';

// Once auto performance mode triggers, later matches this session start at 1x resolution.
let perfLatched = false;

/**
 * Builds the Phaser game for one match.
 * @returns {{ game: Phaser.Game, res: number, destroy(): void }}
 */
export function createGame(parent, { config, settings = {}, hooks = {} } = {}) {
  const perf = settings.perfMode === 'on' || (settings.perfMode === 'auto' && perfLatched);
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  const res = perf ? 1 : Math.min(2, Math.max(1, dpr));
  const W = VIEW?.w || 1280;
  const H = VIEW?.h || 720;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: Math.round(W * res),
    height: Math.round(H * res),
    backgroundColor: '#070b1a',
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    render: {
      pixelArt: false,
      antialias: true,
      antialiasGL: true,
      roundPixels: false,
      powerPreference: 'high-performance',
    },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    input: { keyboard: false, mouse: false, touch: false, gamepad: false },
    disableContextMenu: true,
    banner: false,
  });

  game.scene.add('fight', FightScene, true, {
    config,
    settings,
    hooks,
    res,
    perf,
    onPerfAuto: () => {
      perfLatched = true;
    },
  });

  let destroyed = false;
  return {
    game,
    res,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      try {
        game.scene.getScene('fight')?.teardown?.();
      } catch {
        /* scene may not exist yet */
      }
      try {
        game.destroy(true);
      } catch (err) {
        console.warn('[createGame] destroy', err);
      }
    },
  };
}

# Plugging pre-rendered sprites into FightScene

`FightScene` constructs `new FighterView(scene, charId, side)` and calls `view.sync(f, x, y, dtMs, perf)` every render frame, after `preloadFighterArt(scene, charId)`. A sprite-based view implements the same two calls plus `destroy()`. Keep the procedural `FighterView` as fallback: `art/index.js` can export a factory that picks the sprite view when an atlas exists for the character.

## Loading

Phaser's loader is unused in this project (textures are generated), so load the atlas with the loader inside `preload`-less flow:

```js
// client/src/game/art/sprites/load.js
export function loadSpriteAtlas(scene, charId) {
  const key = `ccs:${charId}`;
  if (scene.textures.exists(key)) return Promise.resolve(key);
  return new Promise((resolve, reject) => {
    scene.load.atlas(key, `/sprites/${charId}.png`, `/sprites/${charId}.json`);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => resolve(key));
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, reject);
    scene.load.start();
  });
}
```

Call it from `preloadFighterArt` when a manifest for the character is registered (for example a `SPRITE_CHARS` set), before `FighterView` construction. Files live in `client/public/sprites/` so Vite serves them as static assets and they never enter the JS bundle.

## Frame selection (mirror of Animator._target in animator.js)

```js
const BASE = { idle: 'idle', walk: 'walk', crouch: 'crouch', jump: 'jump', dash: 'dash', backdash: 'backdash', block: 'block',
  blockstun: 'block', hitstun: 'hitstun', launched: 'launched', knockdown: 'knockdown', getup: 'getup', grabbed: 'grabbed',
  ko: 'knockdown', win: 'win', lose: 'lose', intro: 'intro' };

function pickAnim(f, moveCache) {
  if (f.action === 'attack') {
    const mv = moveCache(f);                       // getMove(charId, f.moveId, f.form), cached
    const anim = (mv && mv.anim) || guessAnim(f.moveId);
    const ph = f.movePhase === 'startup' ? 'w' : f.movePhase === 'active' ? 's' : 'r';
    return `${anim}_${ph}`;                        // e.g. "punch_s"; fall back to `${anim}` if the atlas has no phases
  }
  if (f.action === 'jump') return f.vy < 0 ? 'jump' : 'fall';
  if (f.action === 'block' || f.action === 'blockstun') return f.blocking === 'low' || f.crouching ? 'crouchBlock' : 'block';
  if (f.action === 'hitstun' && f.crouching) return 'crouchHit';
  return BASE[f.action] || 'idle';
}
```

Frame index within an animation: for attack phases map `moveFrame` across the phase length (`startup`, `active`, `recovery` from the move data) so the strike frame lands exactly on active frames; for loops use `actionFrame` (or local time) modulo frame count; for one-shots clamp to the last frame.

## The view

```js
export class SpriteFighterView {
  constructor(scene, charId, side) {
    this.key = `ccs:${charId}`;
    this.frames = indexFrames(scene.textures.get(this.key));   // { animName: [frameNames...] }
    this.sprite = scene.add.image(0, 0, this.key).setDepth(20 + side);
    this.sprite.setScale(1 / RES_OF_ATLAS);                     // atlas rendered at 2x
    this.shadow = scene.add.image(0, 640, TEX.shadow).setDepth(19).setAlpha(0.5);
    // reuse glow/aura/orb/ring images from FighterView if you want parity
  }
  sync(f, x, y, dtMs, perf) {
    const anim = pickAnim(f, this.moveOf);
    const list = this.frames[anim] || this.frames.idle;
    const i = frameIndex(f, anim, list.length);
    this.sprite.setFrame(list[i]);                              // frame.customPivot puts the feet at (x, y)
    this.sprite.setPosition(x, y).setScale(f.facing * this.sx, this.sy);
    this.sprite.setAlpha(f.invuln > 0 && f.action !== 'ko' ? (((performance.now() / 40) | 0) & 1 ? 0.45 : 0.95) : 1);
    if (f.hitFlash > 0) this.sprite.setTintFill(0xffffff); else if (f.armor) this.sprite.setTint(0xffc34a); else this.sprite.clearTint();
    // shadow as in FighterView: scale with height above ground, fade when airborne
  }
  destroy() { this.sprite.destroy(); this.shadow.destroy(); }
}
```

Squash-and-stretch, auras, the charge orb and form-swap ring can be copied from `FighterView` (they are plain images). Ben 10 needs one atlas per form or one atlas with form-prefixed animations.

## Checklist

1. Atlas and JSON in `client/public/sprites/<id>.(png|json)`, pivot embedded, frames trimmed.
2. `preloadFighterArt` loads the atlas for characters in `SPRITE_CHARS`; everything else unchanged.
3. `FightScene.boot` builds `SpriteFighterView` for those characters (factory in `art/index.js`).
4. Verify at `res` 1 and 2, in perf mode, facing both ways, during throws (grabbed pose) and KO (knockdown pose stays on the last frame).
5. Portraits: either keep procedural portraits or render a 256 px bust PNG per character and serve it the same way (`lib/portraits.js` consumer).

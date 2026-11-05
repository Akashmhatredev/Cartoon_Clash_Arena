# Visual verification

Art and motion cannot be checked by `node --check` or Vitest. Look at them. Two levels, both scriptable from the terminal:

1. **Art lab**: a scratch page that imports the real art modules and draws stills, expression sheets and engine-driven film strips. Fast and deterministic; use it while iterating.
2. **Real game over CDP**: headless Chrome runs the actual app, a match is started through the Pinia store, and screenshots plus console errors come back. Use it to confirm atlas baking, `FighterView`, tints, auras and frame rate.

Ground rules:
- Build the lab and scripts in a scratch directory **outside the repo** (the session scratchpad or a temp folder). An IDE may auto-commit new files inside the repo, and these tools are throwaway.
- Do not add dependencies. The repo's own Vite plus system Chrome (`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` on macOS) are enough.
- Node 24: `export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH`. The CDP script uses Node's global `fetch` and `WebSocket`.
- Start dev servers in the background on fixed ports and leave them running while you iterate; stop them when done.
- Read every PNG you produce (the Read tool shows images). Save before/after pairs so changes can be compared side by side.

## 1. Art lab

Three files in `<lab>/`:

`vite.config.mjs`, served by the repo's Vite so `@/` and `@shared/` resolve to live repo files (edits show on reload):

```js
export default {
  root: '<lab>',
  resolve: { alias: { '@': '<repo>/client/src', '@shared': '<repo>/shared' } },
  server: { port: 5199, strictPort: true, fs: { allow: ['<repo>', '<lab>'] } },
  logLevel: 'warn',
};
```

```bash
node <repo>/node_modules/vite/bin/vite.js --config <lab>/vite.config.mjs   # run in the background
```

`index.html`: a dark body (`#0d1530`), one `<canvas id="c">` and `<script type="module" src="./lab.js">`. Load Bungee from `/@fs/<repo>/client/public/fonts/Bungee-Regular.woff2` if labels need it.

`lab.js` reads `location.search` and draws one view. The core call:

```js
import { getSpec } from '@/game/art/chars.js';
import { drawFigure } from '@/game/art/figure.js';
import { POSES, ATTACKS, IDLE, CROUCH } from '@/game/art/poses.js';
import { makePose } from '@/game/art/rig.js';
import { motionFor } from '@/game/art/motion.js';
import { Animator } from '@/game/art/animator.js';

function fig(ctx, spec, pose, x, groundY, zoom, expr = null) {
  ctx.save(); ctx.translate(x, groundY); ctx.scale(spec.k * zoom, spec.k * zoom);
  drawFigure(ctx, spec, pose, { expr });
  ctx.restore();
}
const stance = (id, form) => makePose(motionFor(id, form).stance, IDLE);
```

Views that pay for themselves (select with `?view=` and `?chars=goku,ben10:fourarms`):

| View | Draws | Catches |
| --- | --- | --- |
| `lineup` | every fighter in its stance on one ground line, dashed hurtbox `body.w x body.h`, a height ruler, `h`, `w` and `k` printed under each | proportions, relative heights, art overflowing the hurtbox, `k` drifting from 1, outline weight mismatches |
| `face` | the head part (plus parts on the head bone such as ears and flames) drawn with `normal`, `blink`, `hurt`, `shout` at 3-4x | missing or broken expressions, clipped hair, likeness |
| `sheet` | per fighter: stance, three expressions, walk (an `Animator` stepped about 18 ticks with `action: 'walk'`), jab, kick, crouch, hitstun, win (animator stepped about 90 ticks) | whole-body read of every common state |
| `big` | a few `POSES` / `ATTACKS[x].s` keys at 4x (`new Animator(id).keyPoses(moveId, form)` returns a move's stance-adjusted `w`, `s`, `r`, `alt`) | pose details, joint seams, hand and foot shapes |
| `portraits` | `renderPortrait(id, size, { form })` for the roster | menu crops, `EXTRA_TOP` |
| `film` | the real engine: `createMatch`, then `step(state, [scriptMask, ai.think(state, 1)])` per tick with `createAI` for P2 and one `Animator` per side updated with `dt = 1/60`; every Nth tick is drawn into a grid cell with `drawFigure(ctx, spec, A.cur, { expr: A.expr })`, scaled by `A.sx * A.spin` and `A.sy`, flipped by `facing`, labelled with tick, action and move phase | timing: anticipation, strike on the first active frame, follow-through, overshoot, walk foot sliding, hit recoil |

For `film`, a compact input script such as `idle:6,fwd:40,L:14,H:24,S:40,jumpf:44,DL:14,U:60,block:20` (button name and tick count; attack buttons pressed only on the first ticks of their segment) makes scenarios repeatable. Add knobs for the opponent (`ai=0` keeps P2 idle), starting gap and which side to follow.

End `lab.js` with `document.title = 'ready'`.

Screenshot with headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=2240,480 --virtual-time-budget=6000 \
  --screenshot="<out>/lineup.png" "http://localhost:5199/?view=lineup&zoom=1.6"
```

`--virtual-time-budget` lets module loading finish before the capture. Size the window to the view (for a grid, `cols * cellWidth` by `rows * cellHeight`). Wrap it in a two-line shell script that takes the query, output path, width and height.

What to look for:
- Silhouette reads at thumbnail size; head-to-body ratio and build match the canon description.
- Feet on the ground line, art inside the dashed hurtbox (hair and ears may poke out a little), `k` between 0.9 and 1.1.
- All four expressions differ clearly at 1x, and none clips (a flat edge means the part `box` is too small).
- Elbows and knees continuous, no rings at joints, back limbs dimmed.
- In film strips: wind-up before the strike, strike fully out on the first active cell, a short hold and settle in recovery, head and forearms lagging the body slightly, planted feet in the walk, a clean flip and landing on forward jumps, alternating hit poses in combos.

## 2. Real game over CDP

Run the game's dev server (`npm run dev`, or the client's Vite on another port). Then a Node script:

1. Spawn Chrome: `--headless=new --remote-debugging-port=<port> --user-data-dir=<temp profile> --no-first-run --hide-scrollbars --force-device-scale-factor=1 --window-size=1280,720 --autoplay-policy=no-user-gesture-required about:blank`. With `GPU=1` add `--use-angle=metal --enable-gpu --ignore-gpu-blocklist` (macOS); without it use `--use-angle=swiftshader --enable-unsafe-swiftshader`. Prefer GPU: software rendering often drops under 45 FPS, which latches performance mode for the session (no glows, 1x resolution) and makes screenshots unrepresentative.
2. Poll `http://127.0.0.1:<port>/json/list`, open the page target's `webSocketDebuggerUrl` with `new WebSocket(...)`, and send JSON `{ id, method, params }` messages. Enable `Runtime` and `Page`; collect `Runtime.consoleAPICalled` (error and warning) and `Runtime.exceptionThrown`.
3. `Emulation.setDeviceMetricsOverride` to 1280x720, `Page.navigate` to the dev URL, wait about 2.5 s for the menu.
4. Start a match from inside the page with `Runtime.evaluate` (`awaitPromise: true`):

```js
(async () => {
  const pinia = document.querySelector('#app').__vue_app__.config.globalProperties.$pinia;
  pinia._s.get('settings').cleanMode = true;            // hide scanlines for cleaner shots
  const { useMatch } = await import('/src/stores/match.js');
  useMatch(pinia).start({ mode: 'versus', p1: 'goku', p2: 'bheem', stage: 'island', roundsToWin: 2, seed: 7,
    controllers: ['ai', 'ai'], aiDifficulty: 'hard',
    mods: [{ hpMult: 1, dmgMult: 1 }, { hpMult: 1, dmgMult: 1 }], training: null });
  return 'started';
})()
```

   Importing `/src/stores/match.js` in the page resolves to the same module instance Vite already served to the app, so this is the live store; pass the app's own `pinia` explicitly. For a training dummy use `mode: 'training'`, `controllers: ['ai', 'dummy']`, `training: { dummyMode: 'stationary', dummyInvincible: false, infiniteMeter: true }`. The config shape is in CLAUDE.md (Match configuration) and `client/src/lib/matchConfig.js`.
5. Wait for the intro (about 3.5-7 s), then `Page.captureScreenshot` (`format: 'png'`) every few hundred ms and write the base64 data to files.
6. Optional in-page benchmark: `const { Animator } = await import('/src/game/art/animator.js')`, call `update` 20000 times on a walking fighter object and report microseconds per call. Also read the FPS line of the debug overlay (set `showDebug` in settings).
7. Print collected errors and warnings (`[art] part <id> <name>` means a drawer threw while baking), and always kill Chrome in a `finally` block. Delete the temp profile afterwards.

Run it for every fighter you touched, on at least one bright and one dark stage (`neon_city suburb dojo forest village island final`), and include a Ben 10 match long enough to see a form change.

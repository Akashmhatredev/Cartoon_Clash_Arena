---
name: stage-design
description: Create or modify a Cartoon Clash stage (parallax background) in client/src/game/stages. Use this for any request about a stage, arena, backdrop, floor, skyline, weather, lanterns, crowd, ambient motion, "add a new stage", "make the forest darker", stage palette, stage selection chips, home stages, or the arcade final stage. Covers the layer/ambient definition format, the painter helpers, performance rules and every registry a new stage must be added to.
---

# Stage design

Stages are procedural: each layer is painted once to a wide canvas with Canvas2D (`paint.js` helpers), uploaded as a texture, and scrolled by a parallax factor. Ambient motion (stars, clouds, leaves, flags, flames) comes from pooled sprite kits (`sprites.js`, `ambient.js`) that only mutate pre-allocated images. `buildStage(scene, stageId, { perf })` in `stages/index.js` wires it up; `defs.js` holds the seven definitions. Read `references/paint-helpers.md` for the signatures of every helper and kit.

## Coordinate system

- World is 1280x720, floor top `FLOOR_Y = 640`, stage walls at x 60 and 1220. Layers are painted from `X0 = -60` to `X1 = 1340` (`LW = 1400`) so parallax never shows an edge.
- Fighters live in y 440-640. Keep that band calm: no high-contrast detail, no moving objects, soft haze is fine. `inCenter(x)` (300 < x < 980) marks the central zone.
- Layer `top` and `h` crop the painted canvas vertically; the floor layer is `top: 600, h: 160, d: 4`.

## Definition shape

```js
const myStage = {
  layers: [
    { f: 0,     top: -30, h: 780, soft: true, draw(c, rnd, marks, perf) { /* sky */ } },
    { f: -0.02, top: 200, h: 460,             draw(c, rnd, marks, perf) { /* far */ } },
    { f: -0.08, top: 0,   h: 660,             draw(c, rnd, marks, perf) { /* near, record marks */ } },
    { f: 0,     top: 600, h: 160, d: 4,       draw(c) { floor(c, { ... }); } },
  ],
  amb(B, marks) { /* ambient kits */ },
};
```

- `f`: parallax factor relative to the fighters' midpoint. Negative values move opposite to the camera focus and read as "far away"; use -0.02 for horizon, -0.05 to -0.1 for mid, 0 for sky and floor. Positive values look closer than the fighters (rarely wanted).
- `soft: true` paints at reduced resolution (gradients, haze). `d` sets Phaser depth (defaults to the layer index; stage depths must stay 0-9).
- `draw(c, rnd, marks, perf)`: `rnd` is a seeded PRNG (`mkRng(hashStr(id))`) so a stage looks the same every match; `marks` is a plain object for passing positions to `amb` (`mark(marks, 'lanterns', { x, y })`); `perf` lets you skip expensive detail.
- `amb(B, marks)`: `B.perf`, `B.rnd`, `B.tex(name, w, h, paint)` (cached canvas texture), `B.img(key, x, y, depth, f, ox, oy)` (returns a `rec` with `o` the Phaser image, parallax `f`, `k`, `s`, `ph`), `B.rect(color, alpha, depth)`, `B.add(rec)` (additive blend unless perf), `B.tick(fn(dt, t, off))`.

## Kits (`ambient.js`, all pooled)

`twinkle(B, n, keys, o)` stars and sparkles; `drift(B, n, keys, o)` wrapping clouds and boats; `fall(B, n, keys, o)` leaves, petals, rain, embers rising with negative vy; `flock(B, n, key, o)` birds; `sway(B, recs, o)` rocking banners and plants; `pulse(B, recs, o)` glow breathing; `blink(B, pts, key, o)` windows and signs; `flames(B, pts, flameKey, glowKey, o)`; `embers(B, n, key, pts, o)`. Sprite makers in `sprites.js` return texture keys: `dot star cloud leaf petal rain flame bird bolt lantern flag kite wave beam banner soft`.

Halve counts in perf mode (`P ? 8 : 24`) and skip glows (`if (!P)`), matching the existing stages.

## Palette and mood

Shared palette `C`: navy `#070b1a` / `#0d1530`, cyan `#22e4ff`, blue `#2f6bff`, orange `#ff8a1f`, magenta `#ff2fa6`, text `#eaf2ff`, gold `#ffd24a`. Each stage picks one dominant hue family plus one accent light source and keeps the fighters readable: dark floor, lighter sky, neon only on edges. The `floor()` helper gives perspective seams, a centre light pool and an edge highlight; pass `decor(cc)` for glows under lamps.

Existing stages for reference: `neon_city` (Ben 10, magenta/cyan signs), `suburb` (Shinchan, Doraemon, Nobita; sunset), `dojo` (Hattori; moonlit, lanterns on a rope), `forest` (Pikachu; storm, lightning bolts), `village` (Bheem; warm, banners, pots), `island` (Goku; sea, palms), `final` (arcade boss colosseum, excluded from random picks).

## Checklist: add a stage

1. `shared/stages.js`: append `{ id, name }`. Keep `final` last; random stage pools filter it out (`matchConfig.resolveStage`, `room.js pickStage`).
2. `defs.js`: write `const <id> = { layers, amb }` and add it to `STAGE_DEFS`. Unknown ids fall back to `neon_city`.
3. `client/src/lib/fighters.js`: add a `STAGE_SWATCH[<id>]` CSS gradient for select chips and ladder cards.
4. Optional: make it a fighter's `homeStage` in `shared/fighters/<id>.js`, and mirror in `shared/arcade.js HOME` and `server/src/room.js HOME_FALLBACK`.
5. `STAGE_IDS` is validated by the protocol (host stage picks), so bump `PROTOCOL_VERSION` in `shared/protocol.js`.
6. README stage list. Then run Training on the new stage at both 1x and 2x (`perfMode` on/off in Settings) and on a phone-sized window.

## Performance notes

Layer canvases are big (1400 px wide at up to 2x); keep layer count around 4-6. Draw cost happens once per match in `buildStage`, so complexity in `draw` is fine, but every `B.tick` runs every frame: keep ticks to simple arithmetic on pooled recs. `destroy()` removes textures and zeroes canvases; anything you create outside `B.tex`/`B.img`/`B.rect` must be destroyed manually.

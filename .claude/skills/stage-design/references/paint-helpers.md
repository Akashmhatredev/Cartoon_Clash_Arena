# Stage painter, sprite and ambient reference

## paint.js constants and utilities

`W 1280`, `H 720`, `PAD 60`, `X0 -60`, `X1 1340`, `LW 1400`, `FLOOR_Y 640`, `TAU`.
`mkRng(seed)` seeded PRNG returning `r()` in [0,1); `hashStr(str)`; `lerp`, `between(r, a, b)`, `pick(r, arr)`.
Colour: `hexRgb`, `rgba(hex, a)`, `mix(a, b, t)`. Gradients: `vgrad(c, y0, y1, stops)`, `hgrad(c, x0, x1, stops)` where `stops = [[t, color], ...]`. `fillAll(c, style, y0, y1)` fills the whole layer width.

## Shape helpers

| Helper | Use |
| --- | --- |
| `glow(c, x, y, r, color, a, sy)` | radial glow, `sy` squashes vertically |
| `rrect(c, x, y, w, h, r)` | rounded rect path (call `c.fill()`/`c.stroke()`) |
| `circle(c, x, y, r, fill)`, `ellipse(c, x, y, rx, ry, fill)` | filled shapes |
| `neon(c, color, lw, blur, pathFn)` | neon tube stroke with white-hot core |
| `ridge(c, r, { base, amp, step, fill, peaks, bottom })` | hills (`peaks:false`) or mountains (`peaks:true`) across the full width |
| `cloud(c, x, y, w, h, top, bottom, a)` | puffy gradient cloud |
| `stars(c, r, n, y0, y1, color, maxR)` | star field |
| `haze(c, y0, y1, color, a0, a1)` | vertical atmospheric band |
| `windows(c, r, x, y, w, h, colors, p, a, cw, ch, gx, gy)` | lit window grid, `p` = lit probability |
| `rope(c, x0, y0, x1, y1, sag, color, lw, cb, n)` | sagging rope; `cb(x, y)` is called `n` times along it (hang lanterns via `mark`) |
| `floor(c, { top, vpy, spacing, shift, c0, c1, c2, pool, poolA, decor, line, lineA, lineW, rows, edge, edgeA, shadow })` | ground band with perspective seams, light pool, edge lip and contact shadow |
| `devScale(c)` | device scale of the current transform (shadowBlur ignores transforms) |

Local helpers inside `defs.js` worth reusing: `palm`, `pagoda`, `bambooStalk`, `leafClump`, `stoneLantern`, `pine`, `temple`, `pot`, `mark(marks, key, value)`, `inCenter(x)`.

## sprites.js (return a texture key; cached per stage build through `B.tex`)

`dot(B, color)`, `star(B, color)`, `cloud(B, name, top, bottom, w, h)`, `leaf(B, color, name)`, `petal(B, color)`, `rain(B, color)`, `flame(B)`, `bird(B, color)`, `bolt(B)`, `lantern(B, color)`, `flag(B, color)`, `kite(B, c1, c2)`, `wave(B, color)`, `beam(B, color)`, `banner(B, c1, c2, w, h)`, `soft(B)`.

## ambient.js kits

Common options for scatter-based kits: `x0 x1 y0 y1` spawn range, `depth`, `f` parallax, `ox oy` origin, `s0 s1` scale range, `a0 a1` alpha range, `add` additive blend.

| Kit | Extra options |
| --- | --- |
| `twinkle(B, n, keys, o)` | `pts` fixed positions, `sp0 sp1` speed, `sharp` falloff |
| `drift(B, n, keys, o)` | `vx0 vx1` px/s, `dir`, `wrap`, `flip`, `bob` |
| `fall(B, n, keys, o)` | vertical speed, sway, spin, flutter (see source header) |
| `flock(B, n, key, o)` | bird flocks |
| `sway(B, recs, o)` | rock existing recs |
| `pulse(B, recs, o)` | breathe alpha/scale of existing recs |
| `blink(B, pts, key, o)` | windows and signs at fixed points |
| `flames(B, pts, flameKey, glowKey, o)` | torches at points |
| `embers(B, n, key, pts, o)` | rising sparks from points |

`rec` fields: `o` (Phaser Image), `x` base x before parallax, `f`, `k` (1 / texture res), `s` scale, `ph` phase, `a` alpha, plus kit-specific (`vx`, `by`, `sp`). The stage `update(dtMs, focusX)` applies `rec.o.x = rec.x + off * rec.f` after all ticks.

# Cartoon Clash: Legends of Childhood

A 2D 1v1 arcade fighting game that runs in the browser. Eight cartoon fighters, seven parallax stages, and a deterministic 60 Hz combat engine shared by the browser and the online server.

- **Offline first.** Training, Arcade and Local Versus work right after `npm install && npm run dev`. No server, account, env vars or network needed.
- **Optional online.** Private rooms with a short join code, running on a Cloudflare Worker + Durable Object that is the authority on every match.
- **Optional accounts.** Supabase sign-in, rank points (Elo), match history and a leaderboard.

Stack: Vue 3 + Pinia (menus and HUD), Phaser 3 (fight loop), Vite, plain JavaScript ES modules, Web Audio (synthesized sound effects), Cloudflare Workers + Durable Objects, Supabase.

---

## Quick start

Requires **Node 20.19 or newer** (`.nvmrc` pins Node 24).

```bash
nvm use            # or install Node 24 some other way
npm install
npm run dev        # http://localhost:5173 (also exposed on your LAN for phone testing)
```

That's all you need for offline play. If Online, Account or Leaderboard are not configured, their buttons are disabled and show the reason.

### Scripts (run from the repo root)

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server for the client |
| `npm run build` | Production build to `client/dist` |
| `npm run preview` | Serve the production build locally |
| `npm run server:install` | Install the Worker's dependencies (`server/` is not an npm workspace) |
| `npm run server:dev` | Run the Worker locally with `wrangler dev` on port 8787 |
| `npm run server:deploy` | Deploy the Worker to Cloudflare |
| `npm test` | Run Vitest. There are no test files yet, so this currently exits with "No test files found". |

---

## Game modes

| Mode | Description |
| --- | --- |
| **Arcade** | Pick a fighter and a difficulty (Easy, Normal or Hard), then fight a 7-bout ladder against the other fighters. The final boss fights on Clash Colosseum with +30% HP and +15% damage. Progress is saved locally, so you can resume a run. |
| **Local Versus** | Two players on one device, using keyboard and/or gamepads. Includes rematch and character switch. |
| **Training** | Fight a dummy that is stationary, invincible, or controlled by a basic AI. Optional infinite meter. Shows damage, combo count and current move name, with a move-list overlay and a reset button. |
| **Online** | Create a private room or join one by its 5-character code. Both players pick fighters and ready up, then play best of 3. Supports rematch, a ping indicator and reconnecting. |
| **Leaderboard / Account** | Sign in, set a display name, and view rank points, wins/losses and the top 100. |

---

## Controls

All keyboard bindings can be changed in **Settings > Controls**. Directions are absolute screen directions; the engine works out forward and back from which way your fighter faces.

### Keyboard

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move left / right | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch | `S` | `↓` |
| Light | `J` | `Numpad 1` |
| Heavy | `K` | `Numpad 2` |
| Special | `L` | `Numpad 3` |
| Block | `U` | `Numpad 4` |
| Throw | `I` | `Numpad 5` |
| Ultimate | `O` | `Numpad 6` |

`Esc` (or `P` if it isn't bound) pauses the game. `F3` toggles the debug overlay (FPS, ping, tick drift). Neither `Esc` nor `F3` can be rebound.

### Gamepad (standard mapping)

The first connected pad is Player 1 and the second is Player 2. You can swap them in Settings.

| Button | Action |
| --- | --- |
| Left stick / D-pad | Move, jump (up), crouch (down) |
| A / Cross | Light |
| X / Square | Heavy |
| B / Circle | Special |
| Y / Triangle | Throw |
| LB / LT | Block |
| RB / RT | Ultimate |

### Touch

On touch devices, a virtual D-pad and buttons appear (Light, Heavy, Special, Jump, Block, Throw, Ultimate). Multi-touch is supported. In Settings you can set touch controls to Auto, On or Off.

### Commands

| Input | Result |
| --- | --- |
| Double-tap forward / back | Dash / backdash |
| Hold Block | Standing guard (blocks mid and high) |
| Down + Block | Crouching guard (blocks mid and low) |
| Light / Heavy | Standing attack. Hold Down for crouching versions; press in the air for aerial versions. |
| Special | Special 1 |
| Forward or back + Special | Special 2 |
| Down + Special | Special 3 |
| Ultimate | Ultimate. Needs a full meter. |
| Throw | Grab a grounded opponent. Press Throw right after being grabbed to tech (escape) it. |

Inputs are buffered for 8 frames. You can view each fighter's full move list, with inputs and descriptions, on the character select screen and in the pause menu.

---

## Roster

| Fighter | HP | Specials | Ultimate | Passive |
| --- | --- | --- | --- | --- |
| **Shinchan** | 100 | B-Style Dash, Mischief Feint, Chaos Spin | Maximum Mischief | *Unpredictable:* some basics recover faster |
| **Doraemon** | 105 | Bamboo Copter, Anywhere Door, Time Machine Pulse | Future Gadget Arsenal | *Gadget Expert:* faster gadget cooldowns after a 3-hit combo |
| **Ninja Hattori** | 90 | Shadow Clone, Wind Dash, Shuriken Burst | Shadow Storm | *Ninja Reflex:* faster recovery after a dodge |
| **Pikachu** | 95 | Thunder Jolt, Quick Attack, Thunder Wave | Thunderstorm | *Static Charge:* basic hits power up the next electric special |
| **Ben 10** | 100 | Omnitrix Shift (Four Arms, XLR8, Heatblast), Alien Rush, Elemental Blast | Omnitrix Overload | *Adaptive Fighter:* each alien form has real strengths and downsides |
| **Nobita** | 90 | Slingshot Shot, Lucky Escape, Gadget Trap | Impossible Comeback | *Survival Instinct:* takes less damage below 30% HP |
| **Kid Goku** | 105 | Kamehameha (hold to charge), Power Pole Strike, Dragon Dash | Miniature Spirit Burst | *Martial Arts Momentum:* long combos build bonus meter |
| **Chhota Bheem** | 115 | Power Charge, Earthquake Slam, Super Strength | Dholakpur Smash | *Unbreakable Spirit:* armor against light hits on some heavy frames |

Stages: Neon City Rooftop, Sunset Suburb, Moonlit Dojo, Thunder Forest, Village Square, Tournament Island and Clash Colosseum (the arcade final).

Fighters are pure data (`shared/fighters/<id>.js`): stats, hurtboxes, and per-move frame data, hitboxes, damage, knockback, cooldown and meter values. Names, moves and art can be changed without touching the engine.

---

## Settings

Settings are saved in `localStorage` (`cc.settings.v1`); arcade progress is saved in `cc.progress.v1`.

- Volume and mute
- **Clean mode:** hides the scanline overlay
- **Performance mode** (Auto / On / Off): fewer particles, no glow, 1x render resolution. Auto turns it on when the frame rate drops.
- Debug overlay
- Key rebinding for both players. Binding a key that is already in use swaps the two keys.
- Touch controls and gamepad options
- Player name

---

## Configuration (online and accounts)

All of this is optional. Leave it out and the game runs fully offline.

### Client: `client/.env.local`

```bash
VITE_WS_URL=ws://localhost:8787                  # game server; use wss:// in production
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

| Variable | Enables |
| --- | --- |
| `VITE_WS_URL` | Online button. Must be `wss://` when the page is served over https. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Account and Leaderboard. Online matches between two signed-in players become ranked. |

> Every `VITE_` variable is bundled into the browser build and is public. **Never put the Supabase service-role key in one.**

### Server: `server/.dev.vars` (local) or Wrangler secrets (deployed)

| Name | Kind | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | secret | Lets the Worker record match results |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Server-side only. Only the Worker writes results and rank points. |
| `ALLOWED_ORIGINS` | var in `wrangler.jsonc` | Comma-separated origins that can create or join rooms. Supports `*` wildcards such as `https://*.vercel.app`. Empty means any origin. |

Without the two secrets, online play still works but matches are unranked. See `server/.dev.vars.example`.

### Run online play locally

```bash
npm run server:install
cp server/.dev.vars.example server/.dev.vars   # optional: fill in for ranked matches
npm run server:dev                             # Worker on :8787
echo "VITE_WS_URL=ws://localhost:8787" >> client/.env.local
npm run dev
```

Open the game in two different browsers (or one normal window and one private window). Create a room in one, then join it with the code in the other.

---

## Deployment

The project is set up for three free tiers. Only the frontend is required.

| Piece | Host | Needed for |
| --- | --- | --- |
| `client/` | Vercel (Hobby) | everything |
| `server/` | Cloudflare Workers Free (SQLite-backed Durable Objects) | online rooms |
| `supabase/schema.sql` | Supabase Free (an existing project works; every object uses the `cc_` prefix) | accounts, ranking, leaderboard |

Short version:

1. **Supabase:** run `supabase/schema.sql` in the SQL editor. It is safe to re-run. Then add your site URLs to the auth redirect list.
2. **Worker:** `cd server && npx wrangler login`. Optionally run `wrangler secret put` for the two Supabase secrets. Then `npx wrangler deploy`. Check it with `curl https://<worker>/health`.
3. **Vercel:** set Root Directory to `client`, keep "Include files outside the root directory" enabled (the client imports `../shared`), and set the `VITE_` variables.

Full step-by-step instructions, verification steps, and the current free-tier limits are in **[docs/DEPLOY.md](docs/DEPLOY.md)**.

---

## Architecture

```
shared/            Deterministic game logic, used by both client and server
  engine/          60 Hz fixed-step simulation: hit/hurt boxes, frame data, combos, meter, rounds
  fighters/        One data file per fighter, plus the shared move-kit helpers
  ai/              State-machine AI with reaction delay and per-fighter styles
  arcade.js        Seeded arcade ladder builder
  protocol.js      Versioned online message format, limits and error codes
client/            Vue 3 + Vite app
  src/screens/     Menu, select, ladder, fight, results, settings, online lobby, account, leaderboard
  src/stores/      Pinia: ui, match, settings, progress
  src/game/        Phaser: FightScene, drivers, input, procedural vector art, stages, FX, sfx
  src/net/         Online session, predicting OnlineDriver, Supabase helpers
server/            Cloudflare Worker (HTTP + WebSocket) and Room Durable Object
supabase/          schema.sql: tables, RLS, leaderboard view, cc_record_match()
docs/DEPLOY.md     Deployment guide and free-tier limits
CONTRACT.md        Cross-module API contract (engine state, events, driver interface)
```

Key design points:

- **One engine, everywhere.** `shared/` uses no `Math.random`, no `Date` and no trig functions in the combat simulation. Its state is plain JSON. The same `step(state, [mask0, mask1])` runs offline matches in the browser and online matches on the server, so the rules are identical.
- **Driver interface.** `FightScene` runs a fixed 60 Hz accumulator with render interpolation and talks to a driver (`tick(inputs) -> events`). `LocalDriver` steps the engine directly. `OnlineDriver` predicts locally and reconciles to server snapshots.
- **Server authority.** Clients send only input bitmasks. The Room Durable Object runs the engine at 60 Hz and broadcasts snapshots at 20 Hz. Clients cannot declare hits, damage, rounds or wins. Rank points are written only by the Worker through a `SECURITY DEFINER` function that only `service_role` can execute.
- **Abuse limits.** Messages are capped at 1 KB (4 KB for the hello message), each socket can send at most 120 messages/s, room creation is rate-limited per IP, unknown protocol versions are rejected, stale or duplicate inputs are dropped, and idle rooms are cleaned up after 10 minutes.
- **Vector art, no pixels.** Fighters are procedural vector rigs, rasterized at load into high-resolution atlases (up to 2x device pixel ratio). Phaser runs with `pixelArt:false` and antialiasing on.

`CONTRACT.md` documents the engine state shape, event list, fighter data format and module interfaces in detail.

---

## Known limitations

- **No automated tests yet.** Vitest is installed and `npm test` is wired up, but no test files exist, so it currently exits with an error. Combat balance has only been checked by playing.
- **Online netcode is prediction + reconciliation, not rollback.** The net layer is kept behind the driver interface so rollback could be added later. On high-latency connections, expect visible corrections to the opponent's position.
- **Private rooms only.** There is no matchmaking or spectating.
- **Matches can be lost on restart.** If a Worker deploy or a Durable Object eviction happens mid-match, that match is lost and both players go back to the lobby with an "interrupted" notice.
- **Disconnects.** A dropped player has 20 s to reconnect. The match pauses for both players during that time, and after 20 s the absent player forfeits.
- **Ranked play** requires the Worker's Supabase secrets to be set and both players to be signed in as different users. Otherwise, online matches are unranked.
- **Free-tier ceilings.** The Cloudflare free plan allows roughly a few hundred online matches per day. Supabase's built-in SMTP sends only 2 emails/hour, so set up custom SMTP before real use. Vercel Hobby is for non-commercial use only. Details are in [docs/DEPLOY.md](docs/DEPLOY.md).
- **Bundle size.** The Phaser fight chunk is about 360 kB gzipped. It is lazy-loaded, so menus load without it.
- **Character IP.** This is a non-commercial fan project. Shinchan, Doraemon, Ninja Hattori, Pikachu, Ben 10, Nobita, Goku and Chhota Bheem belong to their respective owners, and this project is not affiliated with or endorsed by them. All art is original procedural placeholder art. Fighters are data-driven, so names and art can be replaced without touching the engine.

---

## Credits

- Fonts: [Bungee](https://fonts.google.com/specimen/Bungee) and [Inter](https://rsms.me/inter/), self-hosted under the SIL Open Font License (see `client/public/fonts/OFL-*.txt`).
- Built with [Vue](https://vuejs.org/), [Pinia](https://pinia.vuejs.org/), [Phaser](https://phaser.io/), [Vite](https://vite.dev/), [Cloudflare Workers](https://developers.cloudflare.com/workers/) and [Supabase](https://supabase.com/).

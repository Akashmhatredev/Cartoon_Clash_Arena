# Cartoon Clash: Lean Build Prompt + Supabase Setup

Part 1 is the prompt to paste into your coding agent (Claude Code). Part 2 is your step-by-step Supabase setup, reusing an existing project.

## Part 1: The prompt

**ROLE:** Senior browser-game and netcode engineer. Build **Cartoon Clash: Legends of Childhood**, a complete, playable 2D 1v1 arcade fighting game. Real mechanics, no mockups or landing pages. Inspect the repo first. If empty, initialize it. Preserve useful existing code.

### Workflow (strict order)

1. **Plan** in 15 lines max. No restating these requirements.
2. **Build in parallel.** Spawn parallel sub-agents or tasks, one per workstream, each owning separate files, and merge as they finish:
   - **A, Engine:** `shared/` combat core. Pure JS, deterministic 60 Hz fixed step, hit/hurt boxes, frame data, combos, meter, rounds.
   - **B, Client:** Vue screens, Pinia, HUD overlays, touch controls, settings.
   - **C, Content:** 8 fighter data files, vector art and atlas generator, stages, effects, Web Audio sfx.
   - **D, AI:** state-machine opponents and arcade progression.
   - **E, Server:** Cloudflare Worker, Durable Object rooms, protocol. Write it in parallel but do not test it until step 5.
3. **DEMO GATE.** As soon as the offline modes are playable, run `npm run dev`, print the URL plus a 5-line what-to-try list, then **STOP and wait for my approval**. Write and run no tests before this.
4. **Tests.** After approval, write and run unit tests for combat logic. Fix failures.
5. **Finish.** Online two-browser test, Supabase, polish, production build, README, deploy docs.

**Token rules:** short status lines only, no long explanations, batch file writes, do not re-read files you just wrote, reuse code, avoid extra dependencies (only vue, pinia, phaser, vite, vitest, wrangler, @supabase/supabase-js).

### Offline first (non-negotiable)

Training, Arcade, and Local Versus with all 8 fighters must work after `npm install && npm run dev`. No server, no env vars, no account, no network. Settings and progress live in localStorage. If online or leaderboard is not configured, show those buttons disabled with a one-line reason. Never fake online play.

### Stack

- Vue 3 + Vite (JavaScript) for menus, select screens, lobby, results, HUD overlays.
- Phaser 3 for the fight loop. No per-frame Vue reactivity. Never make game objects Vue components.
- Pinia for app state. Web Audio for sfx.
- Cloudflare Workers + Durable Objects (WebSocket) for online rooms.
- Supabase (optional) for accounts, stats, leaderboard. Frontend on Vercel free tier, server on Cloudflare free tier. Verify current free-tier limits before writing deploy docs.

### Visual style: retro but clean

- Retro-arcade feel from color, type, layout, and motion. **No pixel art, no pixelation, no nearest-neighbor filtering, no bitmap fonts.**
- Smooth vector or flat-shaded cartoon characters with bold outlines, drawn procedurally or from SVG and rasterized to high-resolution atlases at load. Layered parallax stages.
- Navy/black base, cyan, electric blue, orange, magenta accents. Self-hosted arcade display font plus a readable sans body font.
- Subtle neon borders and glow. Optional faint scanlines, with a **Clean mode** toggle that disables them.
- Phaser config: `pixelArt:false, antialias:true, roundPixels:false`, linear filtering, devicePixelRatio aware (cap 2x).
- Original placeholder art only. Names, art, and moves are data-driven so licensed art can be swapped in without touching the engine.

### Responsiveness and performance

- Fixed 60 Hz simulation with render interpolation (smooth at 60/120/144 Hz). Input applies on the next tick, with 6-8 frame input buffering.
- 16:9 logical resolution, `Scale.FIT`, letterboxed, sharp on high-DPI, survives resize and rotation mid-match.
- Phone portrait menus, landscape gameplay. Safe-area insets, `clamp()` sizing, touch targets at least 48px, multi-touch, `touch-action:none`, no zoom or scroll while playing.
- Object pooling for projectiles and particles. No per-frame allocations. Lazy-load per-character and per-stage assets. Menu bundle under about 3 MB gzipped.
- Performance mode (fewer particles, no glow, 1x resolution) that auto-enables on low FPS. Debug overlay with FPS, ping, tick drift.
- Clean up listeners, timers, sockets, and Phaser instances on unmount.

### Modes

- **Training:** dummy settings (stationary, invincible, basic AI), damage and combo display, current move name, move-list overlay, reset button.
- **Arcade:** pick a fighter, difficulty Easy/Normal/Hard, escalating opponents, victory screen per fight, final boss, progress saved locally.
- **Local Versus:** two players on one device, simultaneous keys without ghosting conflicts, gamepad support, rematch and character switch.
- **Online:** private room with short code, join by code, ready states, both pick characters, start when both ready, best of 3, rematch, connection and ping indicator, reconnect token, reject joins to matches in progress, reject malformed input, rate limits, abandoned-room cleanup.

### Controls (rebindable, prevent browser defaults)

- **P1:** A/D move, W jump, S crouch, J light, K heavy, L special, U block, I throw, O ultimate.
- **P2:** Arrows move/jump/crouch, Numpad 1 light, 2 heavy, 3 special, 4 block, 5 throw, 6 ultimate.
- **Touch:** virtual D-pad plus attack, special, block, jump, ultimate buttons.

### Combat framework (shared by all fighters, data-driven)

Light/heavy, standing/crouching/aerial attacks, block, throw with tech window, jump, dash, hitboxes/hurtboxes, startup/active/recovery frames, hitstun, knockback, combo counter with damage scaling, special cooldowns, super meter and ultimates, round timer, best of 3, hit pause, screen shake, particles, victory/defeat poses. Each move defines: damage, startup, active, recovery, hitbox, knockback, block behavior, cooldown, meter gain/cost, scaling, animation, effect.

Rules: no random damage or hit registration. One hit per move per target unless the move is explicitly multi-hit. No infinite combos, permanent stuns, unlimited invulnerability, unblockable moves without counterplay, unavoidable ultimates, or projectile spam. Local and online rules are identical (same shared code).

### Roster (balance numbers by testing)

| Fighter | HP / Speed / Power / Defense | Basics | Specials | Ultimate | Passive |
| --- | --- | --- | --- | --- | --- |
| Shinchan | 100 / High / Med / Low | Punch, Kick, Taunt (safe, small meter) | B-Style Dash (slide, brief evasion, cooldown); Mischief Feint (fake into quick strike); Chaos Spin (multi-hit, punishable) | Maximum Mischief (strike chain, final knockback) | Unpredictable: slightly less recovery on some basics |
| Doraemon | 105 / Med / Med / High | Jab, Gadget Bash, spin strike | Bamboo Copter (limited glide, cooldown); Anywhere Door (short teleport, directional, bounded); Time Machine Pulse (short slow field, visible) | Future Gadget Arsenal (projectile + close strike, blockable) | Gadget Expert: faster gadget cooldown after a basic combo |
| Ninja Hattori | 90 / Very high / Med / Low | Jab, Low Sweep, Jump Slash | Shadow Clone (harmless decoy); Wind Dash (cross-through window, cooldown); Shuriken Burst (limited spread, blockable) | Shadow Storm (first hit must connect) | Ninja Reflex: shorter recovery after a dodge |
| Pikachu | 95 / Very high / Med / Med-low | Jab, Tail Strike, Jump Spark | Thunder Jolt (projectile); Quick Attack (dash, cooldown); Thunder Wave (short pulse, brief interrupt, no stun chains) | Thunderstorm (visible warning, multi-hit) | Static Charge: charge meter buffs next electric special |
| Ben 10 | 100 / Med / Variable / Med | Omnitrix Strike plus form punch and aerial | Omnitrix Shift (Four Arms strong+slow, XLR8 fast+weak, Heatblast ranged+limited ammo; cooldown); Alien Rush; Elemental Blast (per form) | Omnitrix Overload (full meter, fixed sequence) | Adaptive Fighter: each form has real downsides, shifting cannot cancel freely |
| Nobita | 90 / Low / Med / Med | Jab, Slingshot Strike, Desperate Kick | Slingshot Shot; Lucky Escape (backstep, not during every attack); Gadget Trap (visible, temporary) | Impossible Comeback (stronger vs a committed attack) | Survival Instinct: small defense at low HP, never zero damage |
| Kid Goku | 105 / High / High / Med | Rapid Punch, Power Kick, Jump Strike | Kamehameha (charge, interruptible); Power Pole Strike (long reach, recovery); Dragon Dash (combo on hit, cannot pass blockers) | Miniature Spirit Burst (full meter, short charge) | Martial Arts Momentum: full combo builds meter, capped |
| Chhota Bheem | 115 / Med-low / Very high / High | Punch, Kick, Ground Slam | Power Charge (big recovery on miss); Earthquake Slam (close range only); Super Strength (timed buff, slower) | Dholakpur Smash (clear startup, arena impact) | Unbreakable Spirit: armor vs light hits on select heavy frames, not throws or heavies |

### AI

State machine with Idle, Approach, Retreat, Attack, Block, Jump, Dodge, Recover, Special, Ultimate. Easy: slow reactions, occasional block. Normal: spacing, combos, some blocks, specials. Hard: punishes unsafe moves, uses character-specific tools, not frame-perfect. No reading future input, no impossible reaction times. Per-fighter style preferences.

### Online server (authoritative)

- Durable Object per room holds players, characters, ready state, round, health, meter, positions, attacks, projectiles, timer, connection state, result.
- Server validates attack requests and computes all damage, cooldowns, round and match results. Clients predict movement and animate locally but cannot declare hits or wins. Interpolate remote players, reconcile on mismatch.
- Compact versioned messages. Handle duplicate, stale, malformed, and oversized messages, rate limiting, disconnect/reconnect tokens, expired rooms, simultaneous attacks.
- Keep the net layer behind an interface so rollback can be added later (not required now).
- Free plan needs SQLite-backed Durable Objects (`new_sqlite_classes` in wrangler config). Verify current limits.

### Accounts and leaderboard (optional, reuse existing Supabase project)

Guest play always works. Optional sign-in, display name, wins/losses, rank points, match history, character usage, leaderboard. Tables use the `cc_` prefix so they do not collide with my other project. Only the Worker (service-role key, server-side only) writes match results and rank points. Clients can read and can edit only their own display name. Never expose the service-role key to the browser. Setup steps are in Part 2 of this doc.

### Tests (only after demo approval)

Vitest for: startup/active/recovery, hitbox collision, block damage, combo scaling, cooldowns, meter use, Ben 10 transformation, round completion, simultaneous attacks, invalid messages, room join/leave, reconnect, server-authoritative damage, leaderboard validation. Integration test for the room via two WebSocket clients. Add a short manual checklist (online two-player, desktop, mobile, high latency).

### Done when

App starts. Menu and select work. All 8 fighters have 3 specials and an ultimate. Training, Arcade, Local Versus work offline. Online works across two browser sessions when configured. Layout adapts to phone, tablet, desktop with no visible pixelation. Production build passes. README covers setup, env vars, controls, deploy, and honest known limitations.

---

## Part 2: Supabase setup using your existing project

This reuses a Supabase project you already have, so you do not spend another free project slot. Everything for this game is prefixed `cc_` and does not touch your other tables.

### Step 1: Open the existing project

1. Go to supabase.com/dashboard and open the project you already use for your other app.
2. Open **Project Settings > API** (or **API Keys**).
3. Copy the **Project URL** and the **anon / publishable key**. Keep the **service\_role key** hidden for now. It is secret.

### Step 2: Create the tables

Open **SQL Editor > New query**, paste this, and run it:

```sql
create table if not exists cc_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 3 and 20),
  rank_points int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cc_matches (
  id uuid primary key default gen_random_uuid(),
  p1 uuid references auth.users(id),
  p2 uuid references auth.users(id),
  winner uuid,
  p1_char text,
  p2_char text,
  rounds jsonb,
  created_at timestamptz not null default now()
);

alter table cc_profiles enable row level security;
alter table cc_matches enable row level security;

create policy cc_profiles_read on cc_profiles for select using (true);
create policy cc_profiles_insert on cc_profiles for insert with check (auth.uid() = id);
create policy cc_profiles_update on cc_profiles for update using (auth.uid() = id);

-- users may change ONLY their display name, never points or wins
revoke update on cc_profiles from anon, authenticated;
grant update (display_name) on cc_profiles to authenticated;

create policy cc_matches_read on cc_matches for select
  using (auth.uid() = p1 or auth.uid() = p2);
-- no insert/update policies on cc_matches: only the service role can write

create or replace view cc_leaderboard as
  select display_name, rank_points, wins, losses
  from cc_profiles order by rank_points desc limit 100;
grant select on cc_leaderboard to anon, authenticated;
```

### Step 3: Auth (reuse what you already have)

1. Open **Authentication > Providers**. Keep the providers you already enabled (email, Google, etc.). No new setup is needed.
2. Open **Authentication > URL Configuration**. Add your Vercel domain (for example `https://your-game.vercel.app`) to **Redirect URLs**, and `http://localhost:5173` for local dev. Do not remove the entries your other project needs.
3. Note that your other project's users can also sign in here. That is fine, since the game creates its own `cc_profiles` row on first login.

### Step 4: Local config (optional, only for accounts and leaderboard)

Create `client/.env.local`:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_WS_URL=ws://localhost:8787
```

Skip this file entirely to play offline. The game runs without it.

### Step 5: Deploy the multiplayer server (Cloudflare)

1. Create a free Cloudflare account and run `npx wrangler login` in `server/`.
2. Set the secrets (never commit these):
   - `npx wrangler secret put SUPABASE_URL`
   - `npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY` (paste the service\_role key from Step 1)
3. Run `npx wrangler deploy`. Copy the resulting `https://....workers.dev` URL.

### Step 6: Deploy the frontend (Vercel)

1. Push the repo to GitHub and import it into Vercel. Set the root directory to `client`.
2. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_WS_URL` set to your Worker URL using `wss://` instead of `https://`.
3. Deploy, then add the Vercel URL to Supabase redirect URLs (Step 3).

### Step 7: Verify

1. Open the game, sign in, and confirm a `cc_profiles` row appears in **Table Editor**.
2. Open two different browsers, create a room in one, join with the code in the other, and play a match.
3. After the match, confirm a new `cc_matches` row and updated points. Check that a browser-side attempt to edit `rank_points` fails.

### Free-tier notes (verify current limits before relying on them)

- Supabase free projects can be paused after a period of inactivity. Reusing an active project helps avoid this.
- Cloudflare free Durable Objects require the SQLite-backed type and have daily request limits.
- Never put the service\_role key in any `VITE_` variable. Anything with that prefix is public in the browser.

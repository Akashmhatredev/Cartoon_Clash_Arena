# Deploying Cartoon Clash

Three free pieces, all optional except the frontend:

| Piece | Host | Needed for |
| --- | --- | --- |
| `client/` (Vite build) | Vercel Hobby | everything |
| `server/` (Worker + Room Durable Object) | Cloudflare Workers Free | online rooms |
| `supabase/schema.sql` | Supabase Free (reuse an existing project) | accounts, rank points, leaderboard |

Without `VITE_WS_URL` the Online button is disabled with a reason. Without the Supabase vars, Account and Leaderboard are disabled. Offline modes always work.

## 1. Supabase (optional)

1. Open your existing project, then go to **Project Settings > API Keys**. Copy the Project URL and the anon/publishable key (public). Copy the service_role or secret key too, but it goes **only** into the Worker secret.
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and run it. Re-running it is safe. It creates `cc_profiles`, `cc_matches`, the `cc_leaderboard` view (`security_invoker`), and `cc_record_match()`. That function is `SECURITY DEFINER`, executable only by `service_role`, and applies an Elo update with K=32.
3. Under **Authentication > URL Configuration**, add `http://localhost:5173` and your Vercel URL (plus `https://*-<team>.vercel.app` for previews) to **Redirect URLs**. Keep the entries your other app uses.
4. Under **Authentication > Providers**, enable Email. Google and GitHub are optional: the buttons simply fail if they're disabled. The built-in SMTP sends only **2 emails/hour**, so configure custom SMTP before real use.

## 2. Cloudflare Worker (online rooms)

```bash
export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH
cd server
npm install
npx wrangler login
# optional (ranked matches); without these, online play works but nothing is recorded
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

- `wrangler.jsonc` already declares the `Room` class under `new_sqlite_classes`. That's required: the Free plan only allows SQLite-backed Durable Objects.
- Set `ALLOWED_ORIGINS` in `wrangler.jsonc` `vars` to your site, e.g. `"https://your-game.vercel.app,https://*.vercel.app,http://localhost:5173"`. Empty allows any origin.
- The `ratelimits` block limits `POST /rooms` to 10 per minute per IP. If deploy rejects it, delete the block; the Worker skips the check when the binding is missing.
- Check it with `curl https://<name>.<subdomain>.workers.dev/health`. It should return `{"ok":true,"v":1,"ranked":true|false}`.
- For local dev, run `npm run server:dev` (port 8787). Secrets go in `server/.dev.vars` (see `.dev.vars.example`).

## 3. Vercel (frontend)

1. Import the GitHub repo. Set **Root Directory** = `client`, Framework = Vite, Build = `npm run build`, Output = `dist`.
2. In **Settings > Build and Deployment > Root Directory**, keep **"Include files outside the root directory in the Build Step"** enabled. The client imports `../shared` through the `@shared` alias.
3. Add these environment variables. All are public, so never put the service key here:
   - `VITE_WS_URL` = `wss://<name>.<subdomain>.workers.dev`. Use `wss`, not `https`; an https page can't open `ws://`.
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (optional)
4. Deploy. Then add the production URL to the Supabase redirect URLs and to `ALLOWED_ORIGINS`, and run `wrangler deploy` again.

For local dev, put the same three variables in `client/.env.local` with `VITE_WS_URL=ws://localhost:8787`.

## 4. Verify

1. Sign in, set a display name, and check that a row appears in `cc_profiles`.
2. In two browsers, create a room in one and join by code in the other. Pick fighters, press Ready in both, and play a best of 3.
3. With both players signed in (different users), you should get a new `cc_matches` row and updated `rank_points`/`wins`/`losses`.
4. From the browser console, `update cc_profiles set rank_points=...` should fail. Only `display_name` is updatable.

## Free-tier limits (checked 2026-10-27)

| Service | Limit | Value |
| --- | --- | --- |
| Workers Free | Requests | 100,000/day, resets 00:00 UTC |
| Workers Free | CPU per invocation | 10 ms (network wait not counted) |
| Workers Free | Subrequests | 50 per request |
| Workers | WebSocket | Opening a connection = 1 request. Messages routed through the Worker are not requests |
| Durable Objects Free | Storage backend | SQLite-backed only (`new_sqlite_classes`) |
| Durable Objects Free | Requests | 100,000/day (incoming WS messages billed 20:1; outgoing messages and protocol pings free) |
| Durable Objects Free | Duration | 13,000 GB-s/day |
| Durable Objects Free | SQLite | 5M rows read/day, 100k rows written/day, 5 GB stored per account (FAQ says 1 GB per object on Free) |
| Durable Objects | CPU | 30 s per request/WS message (reset by each event) |
| Durable Objects | Alarms | each `setAlarm()` = 1 row written; alarm invocations count as requests |
| Vercel Hobby | Use | non-commercial personal use only |
| Vercel Hobby | Fast Data Transfer | 100 GB/month |
| Vercel Hobby | Builds | 45 min/deploy, 1 concurrent, 100 deployments/day |
| Supabase Free | Projects | 2 active free projects (paused ones don't count) |
| Supabase Free | Pausing | paused after 7 days of low activity; restorable for up to 1 year |
| Supabase Free | Size | 500 MB database, 5 GB egress, 50,000 auth MAU, 1 GB file storage |
| Supabase Auth | Emails | built-in SMTP: 2 emails/hour; OTP/signup: 30 per 5 min per IP |

What this means for a match: each client sends about 10 to 20 input messages per second (sends on change, plus a 100 ms heartbeat) and one ping per second. A 3-minute match is roughly 4-7k incoming messages, or about 200-350 DO requests at 20:1. That allows a few hundred matches a day on the free plan. While a match runs, the room's 60 Hz loop keeps the object active and billed for duration. Lobbies use the WebSocket Hibernation API, and idle rooms are deleted by an alarm after 10 minutes.

Sources:
[Workers limits](https://developers.cloudflare.com/workers/platform/limits/) ·
[Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) ·
[Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) ·
[Durable Objects limits](https://developers.cloudflare.com/durable-objects/platform/limits/) ·
[Vercel limits](https://vercel.com/docs/limits) ·
[Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines) ·
[Vercel monorepo FAQ](https://vercel.com/docs/monorepos/monorepo-faq) ·
[Supabase pricing](https://supabase.com/pricing) ·
[Supabase pausing](https://supabase.com/docs/guides/platform/free-project-pausing) ·
[Supabase billing](https://supabase.com/docs/guides/platform/billing-on-supabase) ·
[Supabase auth rate limits](https://supabase.com/docs/guides/auth/rate-limits)

## Online design notes

- **Authority.** The Room Durable Object runs the shared engine at 60 Hz. Clients send only input masks (`{s,f,m}`), so they can't declare hits, damage, rounds or wins.
- **Disconnects.** The slot is held for 20 s using the reconnect token in `sessionStorage`. During a match the simulation pauses for both players. After 20 s the absent player forfeits, which counts as a loss when the match is ranked. In the lobby the slot is simply freed.
- **Abuse limits.** Messages are capped at 1 KB (hello: 4 KB for the auth token). Each socket gets 120 msgs/s, and the socket is closed on sustained abuse. Unknown protocol versions are rejected, and stale or duplicate input seqs are dropped.
- **Restarts.** A deploy or eviction mid-match loses that match. Players return to the lobby with an "interrupted" notice.

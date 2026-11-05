---
name: deploy-release
description: Build, configure and ship Cartoon Clash: production Vite build, environment variables, Vercel (client), Cloudflare Workers + Durable Objects (server), Supabase schema and secrets, origin allowlists, health checks, free-tier limits and the pre-release checklist. Use this for "deploy", "release", "publish", "go live", "set up Supabase", "wrangler", "env vars", "the online button is disabled in prod", CORS/origin errors, "wss required", or when preparing a version bump that touches the protocol.
---

# Deploy and release

Three free pieces, only the client is required. `docs/DEPLOY.md` has the step-by-step guide and the free-tier limits table (checked 2026-10-27); this skill is the operational checklist on top of it.

| Piece | Host | Enables | Config |
| --- | --- | --- | --- |
| `client/` | Vercel Hobby (root dir `client`, Vite, build `npm run build`, output `dist`, keep "Include files outside the root directory" on for `../shared`) | everything | `VITE_WS_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| `server/` | Cloudflare Workers Free (`wrangler.jsonc`, `Room` under `new_sqlite_classes`, optional `ratelimits` binding) | online rooms, ranked recording | secrets `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; var `ALLOWED_ORIGINS` |
| `supabase/schema.sql` | Supabase Free, reuse an existing project | accounts, rank points, leaderboard | run in the SQL editor (idempotent); redirect URLs; Email provider; custom SMTP for real use |

## Commands

```bash
export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH
npm run build                       # client/dist; check the chunk sizes it prints
npm run preview                     # serve the build locally
cd server && npx wrangler login     # once
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy --dry-run --outdir .wrangler/dry   # validate config without deploying
npx wrangler deploy
curl https://<name>.<subdomain>.workers.dev/health     # {"ok":true,"v":2,"ranked":true|false}
npx wrangler tail                   # live logs
```

## Pre-release checklist

1. **Engine sanity**: `node .claude/skills/engine-testing/scripts/smoke.mjs` passes; `npm test` passes if tests exist.
2. **Build**: `npm run build` succeeds with no new warnings; the fight chunk stays around 360 kB gzipped and the menu bundle well under 3 MB. New heavy deps belong in lazy chunks.
3. **Protocol**: if `shared/protocol.js`, `FIGHTER_IDS`, `STAGE_IDS` or state semantics changed, `PROTOCOL_VERSION` was bumped and server and client deploy together. Old clients get a "version mismatch, refresh" error by design.
4. **Origins**: `ALLOWED_ORIGINS` in `wrangler.jsonc` lists the production URL and preview patterns (`https://*.vercel.app`), plus `http://localhost:5173` only if you want local clients on the prod Worker. Redeploy the Worker after changing it.
5. **Env**: Vercel has `VITE_WS_URL` as `wss://...` (an https page cannot open `ws://`; the client disables Online with a reason if it is wrong). Supabase vars are optional. No secret ever appears in a `VITE_` variable or in the client bundle (grep `client/dist` for `service_role` or `sb_secret` to be sure).
6. **Supabase**: `schema.sql` re-run after schema changes (safe), redirect URLs include the new domain, `cc_record_match` still restricted to `service_role`.
7. **Verify in prod**: `/health` returns the expected `v` and `ranked`; offline Training works; two browsers can create and join a room and finish a best of 3; a ranked match between two signed-in users creates a `cc_matches` row and updates `rank_points`; a browser-side `update cc_profiles set rank_points` fails.
8. **Docs**: README and `docs/DEPLOY.md` reflect any new variable, limit or step. Update the "checked on" date in the limits table if you re-verified them.

## Operational notes

- A Worker deploy mid-match loses that match; players return to the lobby with an "interrupted" notice. Deploy during quiet hours or accept it.
- Free-tier budget: roughly a few hundred online matches per day (Durable Object requests at 20:1 for incoming WS messages, plus duration while the 60 Hz loop runs). Idle rooms are cleaned after 10 minutes; nothing else accumulates.
- Supabase free projects pause after 7 idle days; reusing an active project avoids this. Built-in SMTP sends 2 emails per hour, so OTP sign-in needs custom SMTP before real traffic.
- Vercel Hobby is non-commercial only. Keep the project a non-commercial fan game or move tiers.
- Rollback: Vercel keeps previous deployments (promote one); Cloudflare keeps Worker versions (`wrangler rollback`). Roll both back together if the protocol changed.

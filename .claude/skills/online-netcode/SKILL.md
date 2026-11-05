---
name: online-netcode
description: Online multiplayer for Cartoon Clash: the versioned protocol in shared/protocol.js, the Cloudflare Worker and Room Durable Object in server/src, the browser OnlineSession (client/src/net/session.js), the predicting OnlineDriver, lobby flow, reconnects, ranked recording and abuse limits. Use this for anything about rooms, join codes, WebSockets, snapshots, desyncs, lag, rubber-banding, ping, "opponent teleports", reconnect, forfeits, rate limits, protocol version errors, adding a message type, Supabase ranking from the Worker, or testing online play locally with two browsers.
---

# Online netcode

Clients send only input masks; the Room Durable Object runs the shared engine at 60 Hz and is the authority on everything else. Read `references/protocol.md` for every message, limit and error code.

## Pieces

| File | Role |
| --- | --- |
| `shared/protocol.js` | `PROTOCOL_VERSION`, message type tables `C2S`/`S2C`, `ERR` codes and texts, WebSocket close codes, `NET` tunables, `parseClientMessage` (server-side validation, size and field checks), `packState`/`applyPackedState` (lossless snapshot compression with short keys), `expandLobby` |
| `server/src/index.js` | Worker: `GET /health`, `POST /rooms` (creates a room with an unguessable 5-char code, per-IP rate limit binding optional), `GET /rooms/:code/ws` (upgrade forwarded to the DO), CORS and `ALLOWED_ORIGINS` glob allowlist |
| `server/src/room.js` | `Room` DO: lobby state persisted in storage (`meta`), match in memory, 60 Hz loop (`pump`/`simTick`), snapshots every 3 ticks, input queueing with seq/frame validation, pause on disconnect, forfeit after 20 s, alarms for idle cleanup (10 min) and max room life (4 h), WebSocket Hibernation in the lobby |
| `server/src/supabase.js` | `verifyUser(env, accessToken)` via the auth endpoint (never trusts client ids), `recordMatch(env, args)` calls `cc_record_match` RPC with the service key, idempotent per match id |
| `client/src/net/config.js` | `onlineConfigured`, `supabaseConfigured`, disabled reasons; `wss://` required on https |
| `client/src/net/session.js` | `getSession()` singleton `OnlineSession`: `create()`, `join(code)`, `selectCharacter(id)`, `setReady(bool)`, `setStage(id)`, `requestRematch()`, `leave()`, `on(evt, cb)`; reconnect token in `sessionStorage` (`cc.net.v1`), exponential backoff (~20 s total), ping every 2 s |
| `client/src/net/OnlineDriver.js` | Driver interface for `FightScene`: predicts with local input and the last known remote mask, 256-frame input history, re-simulates from each snapshot, keeps local frame ~ server frame + RTT/2 + 2 frames (skips or doubles ticks when drift > 3), drops predicted `roundEnd`/`matchEnd` and uses the server's `ev` instead |
| `client/src/screens/OnlineLobby.vue` | room create/join UI, picks, ready, stage (host), rematch, ping, reconnect notice |

## Match lifecycle

1. `POST /rooms` → `{ code }`. Each client opens the WS and sends `hello { name, tok?, auth?, ch? }` within 10 s. The server replies `welcome { side, tok, code }` and broadcasts `lobby`.
2. Both pick characters (`char`) and ready up (`ready`); the host may set a stage (`stage`, null = a random home stage). `maybeStart` builds `startInfo { code, match, seed, p1, p2, stage, roundsToWin, names, resume }` and sends `start`.
3. Clients load the fight scene and send `loaded` (the server starts after both or after a 10 s timeout). The loop runs `step` at 60 Hz, consuming the latest input per side (inputs are scheduled by frame, clamped to `serverFrame + 30`, stale or duplicate `seq` dropped), broadcasting `snap { f, a, m, w, p, pt, s }` every 3 ticks and `ev` for round and match ends.
4. A disconnect pauses the simulation (`p` flag, `pt` seconds) for up to `RECONNECT_GRACE_MS` (20 s). Reconnecting with the same `tok` restores the slot. After the grace the absent player forfeits (counted as a loss when ranked).
5. `end { r }` carries the result; if both players were verified Supabase users and secrets are set, `rank` records the match and sends `ranked { d: { points, delta } }`. `rematch` returns both to ready.
6. Rooms expire after 10 idle minutes or 4 hours total (`alarm`). A DO restart mid-match aborts the match (`reason: 'aborted'`), players land back in the lobby.

## Abuse and safety limits

Messages > 1 KB rejected (hello 4 KB, auth token ≤ 3500 chars); 120 msgs/s per socket soft limit, hard close at 240; unknown or wrong `v` is fatal; every field is type- and range-checked in `validateFields`; names are sanitized to 16 chars; room codes avoid ambiguous characters; `ALLOWED_ORIGINS` gates room creation and WS upgrades; clients never send ids, only tokens the server verifies. Keep all of these when adding features.

## Checklist: add or change a message

1. Add the type to `C2S` or `S2C`, validate its fields in `validateFields` (reject anything unexpected; sizes count), and document it in `references/protocol.md`.
2. Handle it in `room.js webSocketMessage` (respect `meta.phase` and side) and in `session.js` (a method to send it, an event to emit it).
3. If an old client could not understand the new server (or vice versa), bump `PROTOCOL_VERSION`. Deploy server and client together; the `health` endpoint reports `v`.
4. Test locally with two browser profiles (see below) and with throttled network in devtools (add 150 ms latency) to watch reconciliation.

## Local two-browser test

```bash
export PATH=$HOME/.nvm/versions/node/v24.18.0/bin:$PATH
npm run server:install && npm run server:dev        # Worker on :8787 (background)
echo "VITE_WS_URL=ws://localhost:8787" >> client/.env.local
npm run dev                                          # :5173 (background)
```

Open one normal and one private window, create a room in one, join with the code in the other, pick, ready, fight. `F3` shows ping and tick drift; `npx wrangler tail` (from `server/`) streams Worker logs. For ranked recording add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `server/.dev.vars` and sign in as two different users.

## Debugging notes

- "Opponent teleports": prediction mismatch. Check `driver.stats.resim` and `drift` through the F3 overlay; large `resim` means snapshots arrive late (network) or the engine is non-deterministic (compare `packState` of client and server for the same frame).
- "Version mismatch" toast: one side is stale. Redeploy both or hard refresh.
- Inputs feel late: `MAX_INPUT_LEAD` and `BUFFER_FRAMES` trade latency for stability; the drift controller in `OnlineDriver.tick` keeps the client slightly ahead of the server on purpose.
- Everything server-side runs inside the free-tier CPU limits: keep per-message work tiny, never await inside the sim loop, and persist only lobby metadata (the match is memory-only by design).

# Protocol reference (v2)

Every message is JSON `{ v: PROTOCOL_VERSION, t: '<type>', ...fields }` (`PROTOCOL_VERSION` is 2 since the canon-height fighter body change). Keys are short on purpose.

## Limits (`shared/protocol.js`)

| Constant | Value |
| --- | --- |
| `MAX_MSG_BYTES` | 1024 (all client messages except hello) |
| `MAX_HELLO_BYTES` | 4096 (hello may carry a Supabase JWT) |
| `MAX_NAME_LEN` / `MAX_TOKEN_LEN` / `MAX_AUTH_LEN` | 16 / 64 / 3500 |
| `ROOM_CODE_ALPHABET` | `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no I L O 0 1), length 5 |
| `NET.SNAPSHOT_EVERY` | 3 ticks (20 Hz) |
| `NET.MAX_INPUT_LEAD` | 30 frames |
| `NET.HEARTBEAT_MS` | 100 (client re-sends its mask at least this often) |
| `NET.PING_MS` | 2000 |
| `NET.RECONNECT_GRACE_MS` | 20000 |
| `NET.RATE_LIMIT_PER_SEC` | 120 (hard close at 2x) |

Room DO constants: `IDLE_MS` 10 min, `MAX_ROOM_MS` 4 h, `LOAD_TIMEOUT_MS` 10 s, `HELLO_TIMEOUT_MS` 10 s, `MAX_SOCKETS` 6, `MAX_CATCHUP` 8 sim steps per timer callback, `END_TAIL_FRAMES` 150, `MAX_QUEUE` 64 inputs, `MAX_STRIKES` 20.

## Client → server (`C2S`)

| Type | Fields | Notes |
| --- | --- | --- |
| `hello` | `name`, `tok?` (reconnect token `[A-Za-z0-9_-]{8,64}`), `auth?` (Supabase access token), `ch?` (fighter id) | first message, within 10 s |
| `char` | `id` ∈ `FIGHTER_IDS` | lobby only, not while ready |
| `ready` | `on` boolean | lobby only |
| `stage` | `id` ∈ `STAGE_IDS` or null | host only |
| `rematch` | – | same as ready after a match |
| `loaded` | – | fight scene finished loading |
| `in` | `s` seq ≥ 1, `f` frame ≥ 0, `m` mask 0..1023 | stale/duplicate `s` dropped, `f` clamped to server + 30 |
| `ping` | `i` id, `c` client time, `p?` last RTT ms | |
| `leave` | – | frees the slot |

## Server → client (`S2C`)

| Type | Fields |
| --- | --- |
| `welcome` | `side`, `tok`, `code` |
| `lobby` | `code`, `ph` phase (`lobby`/`match`), `host` side, `st` stage, `n` match number, `p: [P, P]` with `P = { n name, c char, r ready, o connected, ms ping, a authed }`, `rk` ranked |
| `start` | `si: { code, match, seed, p1, p2, stage, roundsToWin, names, resume }` |
| `snap` | `f` server frame, `a: [ack0, ack1]` last input seq per side, `m: [mask0, mask1]`, `w` waiting (not both loaded), `p` paused, `pt` pause seconds, `s` packed state |
| `ev` | `f`, `e` event (authoritative `roundEnd`, `matchEnd`) |
| `end` | `r: { winner, reason, wins, rounds, names, chars, ranked }` (`reason` may be `aborted`) |
| `ranked` | `d: { points: [a, b], delta: [a, b] }` or null, `err?` |
| `pong` | `i`, `c` |
| `err` | `c` code, `m` message |

## Error codes and close codes

`ERR`: `version not_found full in_progress bad_msg too_big rate not_host no_char replaced expired server` (client adds `network`). Texts in `ERR_TEXT`.

`CLOSE`: `NORMAL 1000`, `VERSION 4000`, `REPLACED 4001`, `FULL 4003`, `NOT_FOUND 4004`, `RATE 4008`, `IN_PROGRESS 4009`, `EXPIRED 4010`, `BAD 4011`. 4xxx codes are fatal: the client does not auto-reconnect; `FORGET` codes also drop the stored room.

## Snapshot packing

`packState(state)` sends every top-level field except `config` and `events`, replacing keys in `LONG_KEYS` with `$<n>` codes and inactive pool entries with `'~'`. `applyPackedState(target, packed)` merges in place, keeping object identity so the renderer's references stay valid. A full snapshot is about 2.3 kB of JSON today. Adding state fields grows every snapshot; add long names to `LONG_KEYS` (both sides share the file, so this is safe) and bump `PROTOCOL_VERSION` when semantics change.

## HTTP

`GET /health` → `{ ok: true, v, ranked }`. `POST /rooms` → `201 { code, v }` or `403 origin`, `429 rate`, `503 busy`. `GET /rooms/:code/ws` → WebSocket upgrade or `426`, `403`, `404`.

// Cartoon Clash online protocol (shared by the Worker/Durable Object and the browser client).
// Every message is JSON: { v: PROTOCOL_VERSION, t: <type>, ...fields }. Keys are kept short on purpose.
import { FIGHTER_IDS } from './constants.js';
import { STAGE_IDS } from './stages.js';
import { isValidMask } from './input.js';

export const PROTOCOL_VERSION = 1;

export const MAX_MSG_BYTES = 1024;     // every client message except hello
export const MAX_HELLO_BYTES = 4096;   // hello may carry a Supabase access token (JWTs are often > 1 KB)
export const MAX_NAME_LEN = 16;
export const MAX_TOKEN_LEN = 64;
export const MAX_AUTH_LEN = 3500;

export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I L O 0 1
export const ROOM_CODE_LEN = 5;
const CODE_RE = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LEN}}$`);
export function normalizeRoomCode(code) { return String(code || '').trim().toUpperCase(); }
export function isValidRoomCode(code) { return typeof code === 'string' && CODE_RE.test(code); }

// Tunables both sides agree on.
export const NET = {
  SNAPSHOT_EVERY: 3,          // server broadcasts a snapshot every 3 ticks (20 Hz)
  MAX_INPUT_LEAD: 30,         // server clamps scheduled input frames to serverFrame + 30
  HEARTBEAT_MS: 100,          // client re-sends its current mask at least this often during a match
  PING_MS: 2000,
  RECONNECT_GRACE_MS: 20000,  // server holds a disconnected player's slot this long
  RATE_LIMIT_PER_SEC: 120,
};

// Client -> server
export const C2S = {
  HELLO: 'hello',     // { name, tok?, auth?, ch? }  first message; tok = reconnect token, auth = Supabase access token
  CHAR: 'char',       // { id }
  READY: 'ready',     // { on }
  STAGE: 'stage',     // { id | null }   host only; null = random home stage
  REMATCH: 'rematch', // {}  same as ready:true after a match
  LOADED: 'loaded',   // {}  client finished loading the fight scene
  INPUT: 'in',        // { s: seq, f: frame, m: mask }
  PING: 'ping',       // { i: id, c: clientTime, p?: lastRttMs }
  LEAVE: 'leave',     // {}
};
const C2S_SET = new Set(Object.values(C2S));

// Server -> client
export const S2C = {
  WELCOME: 'welcome', // { side, tok, code }
  LOBBY: 'lobby',     // { code, ph, host, st, n, p: [P|null, P|null], rk }  P = { n, c, r, o, ms, a }
  START: 'start',     // { si: { code, match, seed, p1, p2, stage, roundsToWin, names, resume } }
  SNAP: 'snap',       // { f, a: [ack0, ack1], m: [mask0, mask1], w, p, pt, s: packedState }
  EVENT: 'ev',        // { f, e: event }   authoritative key events: roundEnd, matchEnd
  END: 'end',         // { r: { winner, reason, wins, rounds, names, chars, ranked } }
  RANKED: 'ranked',   // { d: { points:[a,b], delta:[a,b] } | null, err? }
  PONG: 'pong',       // { i, c }
  ERROR: 'err',       // { c: ERR code, m: message }
};

export const ERR = {
  VERSION: 'version',
  NOT_FOUND: 'not_found',
  FULL: 'full',
  IN_PROGRESS: 'in_progress',
  BAD_MSG: 'bad_msg',
  TOO_BIG: 'too_big',
  RATE: 'rate',
  NOT_HOST: 'not_host',
  NO_CHAR: 'no_char',
  REPLACED: 'replaced',
  EXPIRED: 'expired',
  SERVER: 'server',
};

export const ERR_TEXT = {
  version: 'Game version mismatch. Refresh the page to update.',
  not_found: 'Room not found. Check the code.',
  full: 'That room is full.',
  in_progress: 'That match is already in progress.',
  bad_msg: 'The server rejected a malformed message.',
  too_big: 'Message too large.',
  rate: 'Too many messages. Slow down.',
  not_host: 'Only the host can do that.',
  no_char: 'Pick a character first.',
  replaced: 'This room was opened in another tab.',
  expired: 'The room expired.',
  server: 'Server error.',
  network: 'Could not reach the server.',
};

// WebSocket close codes. 4xxx codes are fatal for the client (no auto-reconnect).
export const CLOSE = { NORMAL: 1000, VERSION: 4000, REPLACED: 4001, FULL: 4003, NOT_FOUND: 4004, RATE: 4008, IN_PROGRESS: 4009, EXPIRED: 4010, BAD: 4011 };

export function encode(t, fields) {
  const o = { v: PROTOCOL_VERSION, t };
  if (fields) for (const k in fields) o[k] = fields[k];
  return JSON.stringify(o);
}

function byteLength(s) {
  // Fast path: ASCII-only strings have length === bytes; worst case UTF-8 is 3 bytes per UTF-16 unit.
  if (s.length * 3 <= MAX_MSG_BYTES) return s.length;
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 0x80 ? 1 : c < 0x800 ? 2 : 3; }
  return n;
}

const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const TOKEN_RE = /^[A-Za-z0-9_-]{8,64}$/;
const AUTH_RE = /^[A-Za-z0-9_\-.]{20,3500}$/;

export function sanitizeName(name) {
  const s = String(name ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LEN);
  return s.length ? s : 'Player';
}

// Server-side validation of a raw client frame. Returns { ok, msg } or { ok:false, err, fatal }.
export function parseClientMessage(raw) {
  if (typeof raw !== 'string') return { ok: false, err: ERR.BAD_MSG };
  if (raw.length > MAX_HELLO_BYTES) return { ok: false, err: ERR.TOO_BIG };
  let m;
  try { m = JSON.parse(raw); } catch { return { ok: false, err: ERR.BAD_MSG }; }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, err: ERR.BAD_MSG };
  if (m.v !== PROTOCOL_VERSION) return { ok: false, err: ERR.VERSION, fatal: true };
  if (typeof m.t !== 'string' || !C2S_SET.has(m.t)) return { ok: false, err: ERR.BAD_MSG };
  if (m.t !== C2S.HELLO && byteLength(raw) > MAX_MSG_BYTES) return { ok: false, err: ERR.TOO_BIG };
  if (!validateFields(m)) return { ok: false, err: ERR.BAD_MSG };
  return { ok: true, msg: m };
}

function validateFields(m) {
  switch (m.t) {
    case C2S.HELLO:
      if (m.name != null && typeof m.name !== 'string') return false;
      if (m.tok != null && (typeof m.tok !== 'string' || !TOKEN_RE.test(m.tok))) return false;
      if (m.auth != null && (typeof m.auth !== 'string' || !AUTH_RE.test(m.auth))) return false;
      if (m.ch != null && !FIGHTER_IDS.includes(m.ch)) return false;
      m.name = sanitizeName(m.name);
      return true;
    case C2S.CHAR: return FIGHTER_IDS.includes(m.id);
    case C2S.READY: return typeof m.on === 'boolean';
    case C2S.STAGE: return m.id === null || STAGE_IDS.includes(m.id);
    case C2S.INPUT: return isInt(m.s, 1, 0x7fffffff) && isInt(m.f, 0, 0x7fffffff) && isValidMask(m.m);
    case C2S.PING: return isInt(m.i, 0, 0x7fffffff) && typeof m.c === 'number' && Number.isFinite(m.c) && (m.p == null || isInt(m.p, 0, 60000));
    default: return true; // rematch, loaded, leave carry no fields
  }
}

// Client-side light decode of a server frame.
export function decodeServer(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const m = JSON.parse(raw);
    return m && typeof m === 'object' && typeof m.t === 'string' ? m : null;
  } catch { return null; }
}

// ---- Snapshot packing ------------------------------------------------------------------------
// Generic and lossless: every state field is sent (so the client can resimulate exactly), long
// keys are swapped for "$<n>" codes, inactive pool entries ({ active:false, ... }) become INACTIVE.
// config (static, known from start info) and events (per tick) are not sent.
const LONG_KEYS = [
  'phase', 'phaseFrame', 'round', 'timer', 'roundsToWin', 'wins', 'roundWinner', 'matchWinner', 'hitstop', 'shake',
  'slow', 'fighters', 'projectiles', 'entities', 'stats', 'frame', 'side', 'charId', 'facing', 'maxHp', 'meter',
  'action', 'actionFrame', 'moveId', 'moveFrame', 'movePhase', 'grounded', 'crouching', 'blocking', 'invuln', 'armor',
  'comboHits', 'comboDamage', 'lastMoveName', 'cooldowns', 'form', 'ammo', 'buffs', 'charge', 'hitFlash', 'active',
  'owner', 'kind', 'life', 'hitsLeft', 'maxLife', 'maxCombo', 'damage',
];
const K2S = Object.create(null);
const S2K = Object.create(null);
LONG_KEYS.forEach((k, i) => { K2S[k] = '$' + i.toString(36); S2K[K2S[k]] = k; });
const SKIP_TOP = { config: 1, events: 1 };
export const INACTIVE = '~';

function packValue(v) {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) {
    const out = new Array(v.length);
    for (let i = 0; i < v.length; i++) {
      const e = v[i];
      out[i] = e && typeof e === 'object' && !Array.isArray(e) && e.active === false ? INACTIVE : packValue(e);
    }
    return out;
  }
  const out = {};
  for (const k in v) {
    const x = v[k];
    if (x === undefined || typeof x === 'function') continue;
    out[K2S[k] || k] = packValue(x);
  }
  return out;
}

export function packState(state) {
  const out = {};
  for (const k in state) if (!SKIP_TOP[k]) out[K2S[k] || k] = packValue(state[k]);
  return out;
}

function mergeValue(dst, src) {
  if (src === null || typeof src !== 'object') return src;
  if (Array.isArray(src)) {
    const arr = Array.isArray(dst) ? dst : [];
    arr.length = src.length;
    for (let i = 0; i < src.length; i++) {
      const s = src[i];
      if (s === INACTIVE) {
        const d = arr[i];
        if (d && typeof d === 'object' && !Array.isArray(d)) d.active = false;
        else arr[i] = { active: false };
      } else arr[i] = mergeValue(arr[i], s);
    }
    return arr;
  }
  const obj = dst && typeof dst === 'object' && !Array.isArray(dst) ? dst : {};
  for (const k in obj) if (!((K2S[k] || k) in src)) delete obj[k];
  for (const sk in src) { const k = S2K[sk] || sk; obj[k] = mergeValue(obj[k], src[sk]); }
  return obj;
}

// Writes a packed snapshot into an existing state object in place (keeps config/events and object identity).
export function applyPackedState(target, packed) {
  for (const sk in packed) { const k = S2K[sk] || sk; target[k] = mergeValue(target[k], packed[sk]); }
  return target;
}

// Lobby player compact <-> friendly
export function expandLobby(l) {
  return {
    code: l.code, phase: l.ph, hostSide: l.host, stage: l.st ?? null, matchNo: l.n | 0, ranked: !!l.rk,
    players: (l.p || [null, null]).map(p => p && ({ name: p.n, char: p.c ?? null, ready: !!p.r, connected: !!p.o, ping: p.ms | 0, authed: !!p.a })),
  };
}

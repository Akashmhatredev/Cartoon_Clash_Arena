// Cartoon Clash Worker: HTTP entry point. Rooms live in the Room Durable Object (./room.js).
//   GET  /health            -> { ok, v }
//   POST /rooms             -> 201 { code }      creates a room with an unguessable 5-char code
//   GET  /rooms/:code/ws    -> WebSocket upgrade, forwarded to the room's Durable Object
import { PROTOCOL_VERSION, ROOM_CODE_ALPHABET, ROOM_CODE_LEN, isValidRoomCode, normalizeRoomCode } from '../../shared/protocol.js';
import { supabaseEnabled } from './supabase.js';

export { Room } from './room.js';

const reCache = new Map();
function globToRe(p) {
  let re = reCache.get(p);
  if (!re) {
    re = new RegExp('^' + p.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+') + '$', 'i');
    reCache.set(p, re);
  }
  return re;
}

function allowList(env) {
  return String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

export function originAllowed(origin, env) {
  const list = allowList(env);
  if (!list.length || list.includes('*')) return true;
  if (!origin) return false;
  return list.some(p => p === origin || (p.includes('*') && globToRe(p).test(origin)));
}

function corsHeaders(origin, env) {
  const h = {
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (origin && originAllowed(origin, env)) h['Access-Control-Allow-Origin'] = origin;
  else if (!allowList(env).length) h['Access-Control-Allow-Origin'] = '*';
  return h;
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}

function randomCode() {
  const n = ROOM_CODE_ALPHABET.length;
  const max = 256 - (256 % n); // rejection sampling: no modulo bias
  let s = '';
  while (s.length < ROOM_CODE_LEN) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    for (let i = 0; i < bytes.length && s.length < ROOM_CODE_LEN; i++) if (bytes[i] < max) s += ROOM_CODE_ALPHABET[bytes[i] % n];
  }
  return s;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);
    const method = request.method;

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    if (url.pathname === '/health' && method === 'GET') {
      return json({ ok: true, v: PROTOCOL_VERSION, ranked: supabaseEnabled(env) }, 200, cors);
    }

    if (url.pathname === '/rooms' && method === 'POST') {
      if (!originAllowed(origin, env)) return json({ error: 'origin' }, 403, cors);
      if (env.CREATE_LIMITER) {
        const { success } = await env.CREATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'anon' });
        if (!success) return json({ error: 'rate' }, 429, cors);
      }
      for (let i = 0; i < 6; i++) {
        const code = randomCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await stub.init(code)) return json({ code, v: PROTOCOL_VERSION }, 201, cors);
      }
      return json({ error: 'busy' }, 503, cors);
    }

    const m = url.pathname.match(/^\/rooms\/([A-Za-z0-9]{1,16})\/ws$/);
    if (m && method === 'GET') {
      if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return json({ error: 'upgrade_required' }, 426, cors);
      if (!originAllowed(origin, env)) return new Response('origin not allowed', { status: 403 });
      const code = normalizeRoomCode(m[1]);
      if (!isValidRoomCode(code)) return new Response('room not found', { status: 404 });
      return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(request);
    }

    return json({ error: 'not_found' }, 404, cors);
  },
};

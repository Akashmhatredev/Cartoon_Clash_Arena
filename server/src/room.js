// Room Durable Object: authoritative lobby + match for one room code.
// Clients only send input masks. The server runs the shared engine at 60 Hz and broadcasts snapshots,
// so hits, damage, rounds and wins are computed here only.
//
// Disconnect policy: a disconnected player's slot is held for 20 s (reconnect token in the hello).
// During a match the simulation PAUSES for both players until the player returns; after 20 s the
// absent player forfeits (counted as a loss when ranked). In the lobby the slot is simply freed.
import { DurableObject } from 'cloudflare:workers';
import { createMatch, step, FIGHTER_IDS, STAGE_IDS, ROUNDS_TO_WIN, DT_MS, getFighter } from '../../shared/index.js';
import { C2S, S2C, ERR, ERR_TEXT, CLOSE, NET, encode, parseClientMessage, packState } from '../../shared/protocol.js';
import { supabaseEnabled, verifyUser, recordMatch } from './supabase.js';

const GRACE_MS = NET.RECONNECT_GRACE_MS;
const IDLE_MS = 10 * 60 * 1000;       // no meaningful activity for 10 min outside a match -> room expires
const MAX_ROOM_MS = 4 * 60 * 60 * 1000;
const LOAD_TIMEOUT_MS = 10000;        // start the clock even if a client never reports 'loaded'
const HELLO_TIMEOUT_MS = 10000;
const MAX_SOCKETS = 6;
const MAX_CATCHUP = 8;                // max sim steps per timer callback before dropping backlog
const END_TAIL_FRAMES = 150;          // keep simulating win poses after matchEnd
const MAX_QUEUE = 64;
const RATE_HARD = NET.RATE_LIMIT_PER_SEC * 2;
const MAX_STRIKES = 20;
const HOME_FALLBACK = { shinchan: 'suburb', doraemon: 'suburb', nobita: 'suburb', hattori: 'dojo', pikachu: 'forest', ben10: 'neon_city', goku: 'island', bheem: 'village' };

function homeStage(id) {
  let s = null;
  try { s = getFighter(id)?.homeStage; } catch { /* fall back */ }
  s = s || HOME_FALLBACK[id];
  return STAGE_IDS.includes(s) ? s : null;
}

function pickStage(a, b, seed) {
  const homes = [homeStage(a), homeStage(b)].filter(Boolean);
  if (homes.length) return homes[seed % homes.length];
  const pool = STAGE_IDS.filter(s => s !== 'final');
  return pool[seed % pool.length];
}

function randomToken() {
  const b = crypto.getRandomValues(new Uint8Array(18));
  let s = '';
  for (const x of b) s += x.toString(16).padStart(2, '0');
  return s; // 36 hex chars
}

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.meta = null;          // persisted: { code, createdAt, lastActive, phase, stage, matchNo, players:[P|null,P|null] }
    this.match = null;         // in memory only (the loop keeps the object awake during a match)
    this.loop = null;
    this.bound = [null, null]; // side -> current WebSocket
    this.sock = new WeakMap(); // ws -> { side, win, count, over, strikes, helloTimer }
    this.alarmAt = null;
    // Rebind hibernated sockets.
    for (const ws of ctx.getWebSockets()) {
      const side = this.attSide(ws);
      if (side >= 0) this.bound[side] = ws;
    }
    ctx.blockConcurrencyWhile(async () => {
      this.meta = (await ctx.storage.get('meta')) || null;
      this.alarmAt = await ctx.storage.getAlarm();
      if (this.meta && this.meta.phase === 'match') {
        // The object was evicted mid-match (deploy/restart): the match state is gone, go back to the lobby.
        this.meta.phase = 'lobby';
        for (const p of this.meta.players) if (p) p.ready = false;
        await ctx.storage.put('meta', this.meta);
        this.aborted = true;
      }
    });
  }

  // ---- RPC from the Worker ------------------------------------------------------------------
  async init(code) {
    if (this.meta) return false; // code collision: Worker retries with another code
    const now = Date.now();
    this.meta = { code, createdAt: now, lastActive: now, phase: 'lobby', stage: null, matchNo: 0, players: [null, null] };
    await this.persist();
    await this.scheduleAlarm(now + IDLE_MS);
    return true;
  }

  // ---- WebSocket lifecycle (Hibernation API) -------------------------------------------------
  async fetch(request) {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ side: -1 });
    const info = this.info(server);
    if (this.ctx.getWebSockets().length > MAX_SOCKETS) this.fail(server, ERR.FULL, CLOSE.FULL);
    else if (!this.meta) this.fail(server, ERR.NOT_FOUND, CLOSE.NOT_FOUND);
    else info.helloTimer = setTimeout(() => { if (info.side < 0) this.fail(server, ERR.BAD_MSG, CLOSE.BAD); }, HELLO_TIMEOUT_MS);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, data) {
    const info = this.info(ws);
    const now = Date.now();
    if (now - info.win >= 1000) {
      info.over = info.count > NET.RATE_LIMIT_PER_SEC ? info.over + 1 : 0;
      info.win = now;
      info.count = 0;
    }
    info.count++;
    if (info.count > RATE_HARD || info.over >= 5) return this.fail(ws, ERR.RATE, CLOSE.RATE);
    if (info.count > NET.RATE_LIMIT_PER_SEC) return; // drop silently

    const r = parseClientMessage(typeof data === 'string' ? data : null);
    if (!r.ok) {
      if (r.fatal) return this.fail(ws, r.err, CLOSE.VERSION);
      if (++info.strikes > MAX_STRIKES) return this.fail(ws, r.err, CLOSE.BAD);
      if (info.strikes <= 3) this.sendErr(ws, r.err);
      return;
    }
    const m = r.msg;
    const side = info.side;

    if (m.t === C2S.PING) {
      this.safeSend(ws, encode(S2C.PONG, { i: m.i, c: m.c }));
      if (side >= 0 && m.p != null) this.updatePing(side, m.p);
      return;
    }
    if (m.t === C2S.HELLO) return this.onHello(ws, info, m);
    if (side < 0 || this.bound[side] !== ws || !this.meta) return this.sendErr(ws, ERR.BAD_MSG);
    const p = this.meta.players[side];
    if (!p) return;

    switch (m.t) {
      case C2S.INPUT: return this.onInput(side, m);
      case C2S.LOADED:
        if (this.match && this.match.waiting) this.match.loaded[side] = true;
        return;
      case C2S.CHAR:
        if (this.meta.phase !== 'lobby' || p.ready) return;
        p.char = m.id;
        return this.lobbyChanged();
      case C2S.READY:
      case C2S.REMATCH: {
        if (this.meta.phase !== 'lobby') return;
        const on = m.t === C2S.REMATCH ? true : m.on;
        if (on && !p.char) return this.sendErr(ws, ERR.NO_CHAR);
        p.ready = on;
        await this.lobbyChanged();
        return this.maybeStart();
      }
      case C2S.STAGE:
        if (side !== this.hostSide()) return this.sendErr(ws, ERR.NOT_HOST);
        if (this.meta.phase !== 'lobby') return;
        this.meta.stage = m.id;
        return this.lobbyChanged();
      case C2S.LEAVE: return this.onLeave(ws, info, side);
    }
  }

  async webSocketClose(ws) {
    this.onSocketGone(ws);
    try { ws.close(1000, 'bye'); } catch { /* already closed */ }
  }

  async webSocketError(ws) {
    this.onSocketGone(ws);
  }

  async alarm() {
    this.alarmAt = null;
    if (!this.meta) return;
    const now = Date.now();
    let changed = false;
    for (let s = 0; s < 2; s++) {
      const p = this.meta.players[s];
      if (p && !this.bound[s] && p.discAt && now - p.discAt >= GRACE_MS) {
        if (this.match && !this.match.ended) {
          if (this.bound[1 - s]) this.forfeit(s);
          else this.stopMatch();
        }
        this.meta.players[s] = null;
        changed = true;
      }
    }
    if (changed) await this.lobbyChanged(false);
    if (!this.match) {
      const idle = now - this.meta.lastActive >= IDLE_MS;
      const old = now - this.meta.createdAt >= MAX_ROOM_MS;
      if (idle || old) return this.expire();
    }
    let next = (this.match ? now : this.meta.lastActive) + IDLE_MS;
    for (const p of this.meta.players) if (p && p.discAt) next = Math.min(next, p.discAt + GRACE_MS);
    await this.scheduleAlarm(Math.max(next, now + 1000));
  }

  // ---- Lobby ---------------------------------------------------------------------------------
  async onHello(ws, info, m) {
    if (info.side >= 0) return; // duplicate hello
    if (!this.meta) return this.fail(ws, ERR.NOT_FOUND, CLOSE.NOT_FOUND);
    const P = this.meta.players;
    let side = m.tok ? P.findIndex(p => p && p.tok === m.tok) : -1;
    const reconnect = side >= 0;
    if (reconnect) {
      const old = this.bound[side];
      if (old && old !== ws) { this.bound[side] = null; this.fail(old, ERR.REPLACED, CLOSE.REPLACED); }
    } else {
      if (this.meta.phase === 'match') return this.fail(ws, ERR.IN_PROGRESS, CLOSE.IN_PROGRESS);
      side = !P[0] ? 0 : !P[1] ? 1 : -1;
      if (side < 0) return this.fail(ws, ERR.FULL, CLOSE.FULL);
      P[side] = { name: m.name, char: m.ch || null, ready: false, tok: randomToken(), uid: null, ping: 0, discAt: 0 };
    }
    const p = P[side];
    p.name = m.name;
    p.discAt = 0;
    if (!m.auth) p.uid = null;
    clearTimeout(info.helloTimer);
    info.side = side;
    ws.serializeAttachment({ side });
    this.bound[side] = ws;
    this.safeSend(ws, encode(S2C.WELCOME, { side, tok: p.tok, code: this.meta.code }));
    if (this.aborted && reconnect) this.safeSend(ws, encode(S2C.END, { r: { winner: null, reason: 'aborted', wins: [0, 0], rounds: [], ranked: false } }));
    await this.lobbyChanged();

    const mt = this.match;
    if (mt) {
      mt.lastSeq[side] = 0; // a reloaded client restarts its seq counter
      this.safeSend(ws, encode(S2C.START, { si: { ...mt.si, resume: true } }));
      if (mt.paused && this.bound[0] && this.bound[1]) this.resumeMatch();
      else this.broadcastSnap(Date.now());
    }

    if (m.auth && supabaseEnabled(this.env)) {
      const tok = p.tok;
      const uid = await verifyUser(this.env, m.auth);
      const cur = this.meta?.players[side];
      if (cur && cur.tok === tok) {
        cur.uid = uid; // a running match keeps the uids captured at its start
        await this.lobbyChanged(false);
      }
    }
  }

  async onLeave(ws, info, side) {
    if (this.match && !this.match.ended) this.forfeit(side);
    this.meta.players[side] = null;
    this.bound[side] = null;
    info.side = -1;
    ws.serializeAttachment({ side: -1 });
    await this.lobbyChanged();
    try { ws.close(1000, 'left'); } catch { /* ignore */ }
  }

  onSocketGone(ws) {
    const info = this.sock.get(ws);
    if (info) clearTimeout(info.helloTimer);
    const side = info ? info.side : this.attSide(ws);
    if (side < 0 || this.bound[side] !== ws) return;
    this.bound[side] = null;
    const p = this.meta?.players[side];
    if (!p) return;
    p.discAt = Date.now();
    if (this.match && !this.match.ended) this.pauseMatch();
    this.lobbyChanged(false);
    this.scheduleAlarm(p.discAt + GRACE_MS);
  }

  updatePing(side, ms) {
    const p = this.meta?.players[side];
    if (!p) return;
    const old = p.ping;
    p.ping = ms;
    if (!this.match && Math.abs(old - ms) > 15) this.broadcastLobby();
  }

  hostSide() {
    const P = this.meta?.players || [];
    return P[0] ? 0 : P[1] ? 1 : -1;
  }

  async lobbyChanged(touch = true) {
    if (!this.meta) return;
    if (touch) this.meta.lastActive = Date.now();
    this.broadcastLobby();
    await this.persist();
  }

  broadcastLobby() {
    const M = this.meta;
    if (!M) return;
    const P = M.players;
    const rk = !!(P[0]?.uid && P[1]?.uid && P[0].uid !== P[1].uid);
    this.broadcast(encode(S2C.LOBBY, {
      code: M.code, ph: M.phase, host: this.hostSide(), st: M.stage, n: M.matchNo, rk,
      p: P.map((p, s) => p && { n: p.name, c: p.char, r: p.ready ? 1 : 0, o: this.bound[s] ? 1 : 0, ms: p.ping | 0, a: p.uid ? 1 : 0 }),
    }));
  }

  // ---- Match ---------------------------------------------------------------------------------
  async maybeStart() {
    const M = this.meta;
    if (!M || M.phase !== 'lobby' || this.match) return;
    const [a, b] = M.players;
    if (!a || !b || !a.ready || !b.ready || !a.char || !b.char || !this.bound[0] || !this.bound[1]) return;
    if (!FIGHTER_IDS.includes(a.char) || !FIGHTER_IDS.includes(b.char)) return;

    const seed = (crypto.getRandomValues(new Uint32Array(1))[0] >>> 0) || 1;
    const stage = M.stage && STAGE_IDS.includes(M.stage) ? M.stage : pickStage(a.char, b.char, seed);
    let state;
    try {
      state = createMatch({ p1: a.char, p2: b.char, stage, roundsToWin: ROUNDS_TO_WIN, seed });
    } catch (e) {
      console.error('createMatch failed', e);
      a.ready = b.ready = false;
      this.broadcast(encode(S2C.ERROR, { c: ERR.SERVER, m: ERR_TEXT.server }));
      return this.lobbyChanged();
    }
    M.phase = 'match';
    M.matchNo++;
    const now = Date.now();
    const si = { code: M.code, match: M.matchNo, seed, p1: a.char, p2: b.char, stage, roundsToWin: ROUNDS_TO_WIN, names: [a.name, b.name] };
    this.match = {
      id: crypto.randomUUID(), si, state, frame: 0,
      waiting: true, running: false, paused: false, pauseUntil: 0, loaded: [false, false], loadDeadline: now + LOAD_TIMEOUT_MS, t0: now,
      masks: [0, 0], acks: [0, 0], lastSeq: [0, 0], lastQ: [0, 0], queues: [[], []],
      ended: false, endFrame: 0, rounds: [], lastSnapAt: 0, lastSnapFrame: 0,
      uids: [a.uid, b.uid], chars: [a.char, b.char], names: [a.name, b.name],
    };
    this.aborted = false;
    this.broadcast(encode(S2C.START, { si: { ...si, resume: false } }));
    await this.lobbyChanged();
    this.loop = setInterval(() => this.pump(), 15);
  }

  // 60 Hz fixed step with catch-up, driven by wall time.
  pump() {
    const m = this.match;
    if (!m) return;
    const now = Date.now();
    if (m.waiting) {
      if ((m.loaded[0] && m.loaded[1]) || now >= m.loadDeadline) {
        m.waiting = false;
        m.running = !m.paused;
        m.t0 = now;
        this.broadcastSnap(now);
      } else if (now - m.lastSnapAt > 500) this.broadcastSnap(now);
      return;
    }
    if (!m.running) {
      if (now - m.lastSnapAt > 500) this.broadcastSnap(now);
      return;
    }
    const target = Math.floor((now - m.t0) / DT_MS);
    for (let n = 0; m.frame < target && n < MAX_CATCHUP && this.match === m; n++) this.simTick(m);
    if (this.match !== m) return;
    if (m.frame < target) m.t0 = now - m.frame * DT_MS; // too far behind: drop the backlog instead of spiralling
    if (m.frame - m.lastSnapFrame >= NET.SNAPSHOT_EVERY) this.broadcastSnap(now);
  }

  simTick(m) {
    for (let s = 0; s < 2; s++) {
      const q = m.queues[s];
      while (q.length && q[0][0] <= m.frame) {
        const it = q.shift();
        m.masks[s] = it[1];
        m.acks[s] = it[2];
      }
    }
    // Both fighters' inputs go into the same step(), so simultaneous attacks resolve in the engine's same-tick logic.
    step(m.state, m.masks);
    m.frame++;
    const evs = m.state.events;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type === 'roundEnd') {
        m.rounds.push({ w: e.winner, r: e.reason });
        this.broadcast(encode(S2C.EVENT, { f: m.frame, e }));
      } else if (e.type === 'matchEnd' && !m.ended) {
        this.broadcast(encode(S2C.EVENT, { f: m.frame, e }));
        this.finishMatch(m, e.winner, 'ko');
      }
    }
    if (m.ended && m.frame - m.endFrame >= END_TAIL_FRAMES) this.stopMatch();
  }

  onInput(side, msg) {
    const m = this.match;
    if (!m || m.ended) return;
    if (msg.s <= m.lastSeq[side]) return; // duplicate or stale
    m.lastSeq[side] = msg.s;
    let f = msg.f;
    const lo = Math.max(m.frame, m.lastQ[side]);
    if (f < lo) f = lo;                                            // late: apply on the next tick
    if (f > m.frame + NET.MAX_INPUT_LEAD) f = Math.max(lo, m.frame + NET.MAX_INPUT_LEAD); // too far ahead
    const q = m.queues[side];
    if (q.length >= MAX_QUEUE) {
      const it = q.shift();
      m.masks[side] = it[1];
      m.acks[side] = it[2];
    }
    q.push([f, msg.m, msg.s]);
    m.lastQ[side] = f;
    this.meta.lastActive = Date.now();
  }

  broadcastSnap(now) {
    const m = this.match;
    if (!m) return;
    m.lastSnapAt = now;
    m.lastSnapFrame = m.frame;
    const fields = { f: m.frame, a: m.acks, m: m.masks, w: m.waiting ? 1 : 0, p: m.paused ? 1 : 0, s: packState(m.state) };
    if (m.paused) fields.pt = Math.max(0, Math.ceil((m.pauseUntil - now) / 1000));
    this.broadcast(encode(S2C.SNAP, fields));
  }

  pauseMatch() {
    const m = this.match;
    if (!m || m.paused) return;
    m.paused = true;
    m.running = false;
    m.pauseUntil = Date.now() + GRACE_MS;
    this.broadcastSnap(Date.now());
  }

  resumeMatch() {
    const m = this.match;
    if (!m || !m.paused) return;
    const now = Date.now();
    m.paused = false;
    if (!m.waiting) {
      m.running = true;
      m.t0 = now - m.frame * DT_MS;
    }
    this.broadcastSnap(now);
  }

  finishMatch(m, winner, reason) {
    m.ended = true;
    m.endFrame = m.frame;
    const ranked = !!(supabaseEnabled(this.env) && m.uids[0] && m.uids[1] && m.uids[0] !== m.uids[1]);
    const result = {
      winner, reason, wins: m.state.wins.slice(), rounds: m.rounds, names: m.names, chars: m.chars, ranked,
      stats: m.state.stats, match: m.si.match,
    };
    this.broadcast(encode(S2C.END, { r: result }));
    if (ranked) this.rank(m, winner);
  }

  forfeit(loser) {
    const m = this.match;
    if (!m || m.ended) return;
    const winner = 1 - loser;
    this.broadcast(encode(S2C.EVENT, { f: m.frame, e: { type: 'matchEnd', winner, forfeit: true } }));
    this.finishMatch(m, winner, 'forfeit');
    this.stopMatch();
  }

  stopMatch() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.match = null;
    if (!this.meta) return;
    this.meta.phase = 'lobby';
    for (const p of this.meta.players) if (p) p.ready = false;
    this.lobbyChanged();
  }

  async rank(m, winner) {
    try {
      const d = await recordMatch(this.env, {
        p_match_id: m.id,
        p_p1: m.uids[0],
        p_p2: m.uids[1],
        p_winner_side: winner === 0 || winner === 1 ? winner : null,
        p_p1_char: m.chars[0],
        p_p2_char: m.chars[1],
        p_rounds: m.rounds,
        p_p1_name: m.names[0],
        p_p2_name: m.names[1],
      });
      this.broadcast(encode(S2C.RANKED, { d }));
    } catch (e) {
      console.error('rank failed', e?.message || e);
      this.broadcast(encode(S2C.RANKED, { d: null, err: 'record_failed' }));
    }
  }

  async expire() {
    for (const ws of this.ctx.getWebSockets()) this.fail(ws, ERR.EXPIRED, CLOSE.EXPIRED);
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.match = null;
    this.meta = null;
    this.bound = [null, null];
    this.alarmAt = null;
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  // ---- Helpers -------------------------------------------------------------------------------
  info(ws) {
    let i = this.sock.get(ws);
    if (!i) {
      i = { side: this.attSide(ws), win: 0, count: 0, over: 0, strikes: 0, helloTimer: null };
      this.sock.set(ws, i);
    }
    return i;
  }

  attSide(ws) {
    try {
      const a = ws.deserializeAttachment();
      return a && Number.isInteger(a.side) ? a.side : -1;
    } catch { return -1; }
  }

  persist() {
    return this.meta ? this.ctx.storage.put('meta', this.meta) : Promise.resolve();
  }

  // Only moves the alarm earlier (each setAlarm is a billed storage write).
  async scheduleAlarm(at) {
    if (this.alarmAt != null && this.alarmAt <= at) return;
    this.alarmAt = at;
    await this.ctx.storage.setAlarm(at);
  }

  safeSend(ws, str) {
    try { ws.send(str); } catch { /* socket closing */ }
  }

  broadcast(str) {
    for (let s = 0; s < 2; s++) if (this.bound[s]) this.safeSend(this.bound[s], str);
  }

  sendErr(ws, code) {
    this.safeSend(ws, encode(S2C.ERROR, { c: code, m: ERR_TEXT[code] || code }));
  }

  fail(ws, code, closeCode) {
    this.sendErr(ws, code);
    try { ws.close(closeCode, code); } catch { /* ignore */ }
  }
}

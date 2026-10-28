// OnlineSession: one WebSocket to the room Durable Object, with reconnect token, backoff and ping.
// Events: lobby, start, end, ping, error, close (public) plus snap, ev, ranked (used by OnlineDriver/screens).
import { WS_URL, HTTP_URL, onlineConfigured, onlineDisabledReason } from './config.js';
import {
  PROTOCOL_VERSION, C2S, S2C, ERR, ERR_TEXT, NET, MAX_HELLO_BYTES,
  encode, decodeServer, expandLobby, normalizeRoomCode, isValidRoomCode,
} from '@shared/protocol.js';

const STORE_KEY = 'cc.net.v1';
const FATAL = new Set([ERR.VERSION, ERR.NOT_FOUND, ERR.FULL, ERR.IN_PROGRESS, ERR.REPLACED, ERR.EXPIRED, ERR.RATE]);
const FORGET = new Set([ERR.VERSION, ERR.NOT_FOUND, ERR.FULL, ERR.IN_PROGRESS, ERR.EXPIRED]);
const BACKOFF = [500, 1000, 2000, 3000, 4000, 5000, 5000]; // ~20 s total = server slot grace

function readStored() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}
function writeStored(v) {
  try { v ? sessionStorage.setItem(STORE_KEY, JSON.stringify(v)) : sessionStorage.removeItem(STORE_KEY); } catch { /* private mode */ }
}
export function getStoredRoom() {
  const s = readStored();
  return s && isValidRoomCode(s.code) ? s : null;
}

const mkErr = (code, message) => ({ code, message: message || ERR_TEXT[code] || String(code) });

export class OnlineSession {
  constructor() {
    this.listeners = new Map();
    this.ws = null;
    this.status = 'idle';     // idle | connecting | open | reconnecting | closed
    this.code = null;
    this.side = null;
    this.token = null;
    this.lobby = null;        // expanded lobby (see expandLobby) + side
    this.startInfo = null;
    this.pendingStart = null; // start received but no driver attached yet
    this.lastResult = null;
    this.rankUpdate = null;
    this.rtt = 0;
    this.ping = 0;
    this.name = 'Player';
    this.auth = null;
    this.char = null;
    this.driverMatch = 0;
    this._wanted = false;
    this._welcomed = false;
    this._attempt = 0;
    this._fatal = null;
    this._waiter = null;
    this._pingTimer = null;
    this._retryTimer = null;
    this._pingId = 0;
  }

  on(evt, cb) {
    let set = this.listeners.get(evt);
    if (!set) this.listeners.set(evt, (set = new Set()));
    set.add(cb);
    return () => set.delete(cb);
  }

  emit(evt, data) {
    const set = this.listeners.get(evt);
    if (set) for (const cb of set) { try { cb(data); } catch (e) { console.error(`[net] ${evt} listener`, e); } }
  }

  get connected() { return this.status === 'open'; }
  get inRoom() { return this._wanted && !!this.code; }

  _identity(opts) {
    if (!opts) return;
    if (opts.name != null) this.name = String(opts.name).slice(0, 16) || 'Player';
    if (opts.auth !== undefined) this.auth = opts.auth || null;
    if (opts.char !== undefined) this.char = opts.char || null;
  }

  async create(opts = {}) {
    if (!onlineConfigured) throw mkErr('disabled', onlineDisabledReason);
    this._identity(opts);
    let res;
    try {
      res = await fetch(`${HTTP_URL}/rooms`, { method: 'POST' });
    } catch {
      const e = mkErr('network');
      this.emit('error', e);
      throw e;
    }
    if (!res.ok) {
      const e = mkErr(res.status === 429 ? ERR.RATE : ERR.SERVER, res.status === 429 ? 'Too many rooms created. Wait a minute.' : `Could not create a room (${res.status}).`);
      this.emit('error', e);
      throw e;
    }
    const { code } = await res.json();
    return this.join(code, opts);
  }

  join(code, opts = {}) {
    if (!onlineConfigured) return Promise.reject(mkErr('disabled', onlineDisabledReason));
    code = normalizeRoomCode(code);
    if (!isValidRoomCode(code)) {
      const e = mkErr(ERR.NOT_FOUND, 'Room codes are 5 letters or digits.');
      this.emit('error', e);
      return Promise.reject(e);
    }
    this._identity(opts);
    if (this.ws || this._wanted) this._teardown();
    const stored = readStored();
    this.token = stored && stored.code === code ? stored.token : null;
    this.code = code;
    this.side = null;
    this.lobby = null;
    this.lastResult = null;
    this.rankUpdate = null;
    this._wanted = true;
    this._welcomed = false;
    this._attempt = 0;
    this._fatal = null;
    return new Promise((resolve, reject) => {
      this._waiter = { resolve, reject };
      this._connect();
    });
  }

  selectCharacter(id) { this.char = id; this._send(C2S.CHAR, { id }); }
  setReady(on) { this._send(C2S.READY, { on: !!on }); }
  setStage(id) { this._send(C2S.STAGE, { id: id || null }); }
  requestRematch() { this.lastResult = null; this._send(C2S.REMATCH); }
  sendLoaded() { this._send(C2S.LOADED); }
  // Hot path: hand-built string, no object allocation.
  sendInput(seq, frame, mask) {
    const ws = this.ws;
    if (ws && ws.readyState === 1) ws.send('{"v":' + PROTOCOL_VERSION + ',"t":"in","s":' + seq + ',"f":' + frame + ',"m":' + mask + '}');
  }

  leave() {
    if (this.ws && this.ws.readyState === 1) this._send(C2S.LEAVE);
    this._teardown();
    writeStored(null);
    this.code = null;
    this.side = null;
    this.token = null;
    this.lobby = null;
    this.startInfo = null;
    this.pendingStart = null;
    this.lastResult = null;
    this.status = 'idle';
    this.emit('close', { code: 1000, reason: 'left', willReconnect: false });
  }

  // OnlineDriver bookkeeping: a resumed 'start' for a match with a live driver is not re-emitted.
  _attachDriver(matchNo) { this.driverMatch = matchNo; this.pendingStart = null; }
  _detachDriver(matchNo) { if (this.driverMatch === matchNo) this.driverMatch = 0; }

  // ---- internals ----
  _teardown() {
    this._wanted = false;
    clearTimeout(this._pingTimer);
    clearTimeout(this._retryTimer);
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try { ws.close(1000, 'bye'); } catch { /* ignore */ }
    }
    if (this._waiter) { this._waiter.reject(mkErr('closed', 'Connection closed.')); this._waiter = null; }
  }

  _send(t, fields) {
    const ws = this.ws;
    if (ws && ws.readyState === 1) ws.send(encode(t, fields));
  }

  _connect() {
    clearTimeout(this._retryTimer);
    this.status = this._attempt ? 'reconnecting' : 'connecting';
    let ws;
    try {
      ws = new WebSocket(`${WS_URL}/rooms/${this.code}/ws`);
    } catch {
      return this._onClose(null, { code: 1006, reason: 'connect failed' });
    }
    this.ws = ws;
    ws.onopen = () => {
      const hello = { name: this.name };
      if (this.token) hello.tok = this.token;
      if (this.char) hello.ch = this.char;
      if (this.auth && this.auth.length <= 3500) hello.auth = this.auth;
      let raw = encode(C2S.HELLO, hello);
      if (raw.length > MAX_HELLO_BYTES) { delete hello.auth; raw = encode(C2S.HELLO, hello); }
      ws.send(raw);
    };
    ws.onmessage = e => this._onMessage(e.data);
    ws.onclose = e => this._onClose(ws, e);
    ws.onerror = () => { /* close follows */ };
  }

  _schedulePing() {
    clearTimeout(this._pingTimer);
    this._pingTimer = setTimeout(() => {
      this._send(C2S.PING, { i: ++this._pingId & 0x7fffffff, c: performance.now(), p: this.ping | 0 });
      this._schedulePing();
    }, this.driverMatch ? 1000 : NET.PING_MS);
  }

  _onMessage(raw) {
    const m = decodeServer(raw);
    if (!m) return;
    if (m.v !== PROTOCOL_VERSION) {
      this._fatal = mkErr(ERR.VERSION);
      this.emit('error', this._fatal);
      try { this.ws?.close(1000); } catch { /* ignore */ }
      return;
    }
    switch (m.t) {
      case S2C.SNAP: this.emit('snap', m); break;
      case S2C.EVENT: this.emit('ev', m); break;
      case S2C.WELCOME:
        this.side = m.side;
        this.token = m.tok;
        this.code = m.code;
        writeStored({ code: m.code, token: m.tok });
        this._welcomed = true;
        this._attempt = 0;
        this.status = 'open';
        this._send(C2S.PING, { i: ++this._pingId & 0x7fffffff, c: performance.now() });
        this._schedulePing();
        if (this._waiter) { this._waiter.resolve({ code: m.code, side: m.side }); this._waiter = null; }
        break;
      case S2C.LOBBY:
        this.lobby = { ...expandLobby(m), side: this.side };
        this.emit('lobby', this.lobby);
        break;
      case S2C.START: {
        const si = { ...m.si, side: this.side };
        this.startInfo = si;
        if (si.resume && this.driverMatch === si.match) break; // live driver resyncs from snapshots
        this.lastResult = null;
        this.rankUpdate = null;
        this.pendingStart = si;
        this.emit('start', si);
        break;
      }
      case S2C.END:
        this.lastResult = m.r;
        this.emit('end', m.r);
        break;
      case S2C.RANKED:
        this.rankUpdate = m.d || null;
        if (this.lastResult) this.lastResult.rank = m.d || null;
        this.emit('ranked', m);
        break;
      case S2C.PONG: {
        const rtt = performance.now() - m.c;
        if (rtt >= 0 && rtt < 30000) {
          this.rtt = this.rtt ? this.rtt * 0.7 + rtt * 0.3 : rtt;
          this.ping = Math.round(this.rtt);
          this.emit('ping', this.ping);
        }
        break;
      }
      case S2C.ERROR: {
        const e = mkErr(m.c, m.m);
        if (FATAL.has(m.c)) this._fatal = e;
        this.emit('error', e);
        break;
      }
    }
  }

  _onClose(ws, e) {
    if (ws && ws !== this.ws) return;
    clearTimeout(this._pingTimer);
    this.ws = null;
    const code = e?.code ?? 1006;
    const fatal = this._fatal || (code >= 4000 && code < 4100 ? mkErr(e.reason || 'closed', ERR_TEXT[e.reason] || 'Disconnected by the server.') : null);
    const maxAttempts = this._welcomed ? BACKOFF.length : 2;
    if (!this._wanted || fatal || this._attempt >= maxAttempts) {
      const wasWanted = this._wanted;
      this._wanted = false;
      this.status = 'closed';
      if (fatal && FORGET.has(fatal.code)) writeStored(null);
      const reason = fatal?.message || (this._welcomed ? 'Connection lost.' : ERR_TEXT.network);
      if (this._waiter) { this._waiter.reject(fatal || mkErr('network', reason)); this._waiter = null; }
      if (wasWanted) this.emit('close', { code, reason, willReconnect: false, fatal: fatal?.code || null });
      return;
    }
    const delay = BACKOFF[this._attempt++];
    this.status = 'reconnecting';
    this.emit('close', { code, reason: 'Reconnecting…', willReconnect: true, attempt: this._attempt, delay });
    this._retryTimer = setTimeout(() => { if (this._wanted) this._connect(); }, delay);
  }
}

let instance = null;
export function getSession() {
  if (!instance) instance = new OnlineSession();
  return instance;
}

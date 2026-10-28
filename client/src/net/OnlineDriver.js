// OnlineDriver: Driver interface (state, localSide, tick, stats, destroy) for server-authoritative online play.
//
// Prediction + reconciliation: the local engine copy runs every tick with the local input applied at once
// and the remote input = last known (from the latest snapshot). Each local input is stored in a ring buffer
// by frame. When a snapshot arrives (server frame F), the state is overwritten with it and frames F..now
// are re-simulated from the ring buffer; events produced by that resim are dropped so effects never repeat.
// Round/match results come only from the server ('ev' messages), never from prediction.
// Frame drift: the local frame is kept ~ serverFrame + rtt/2 (in frames) + BUFFER so inputs reach the server
// just before it needs them; when the smoothed drift exceeds 3 frames a tick is skipped or doubled.
// Rollback could replace this class later without touching the session or the scene (same Driver interface).
import { createMatch, step, DT_MS } from '@shared/index.js';
import { applyPackedState, NET } from '@shared/protocol.js';

const HIST = 256;
const HMASK = HIST - 1;
const BUFFER_FRAMES = 2;
const DRIFT_LIMIT = 3;
const HARD_RESYNC = 30;
const MAX_RESIM = 120;
const PRED_DROP = { roundEnd: 1, matchEnd: 1 };

export class OnlineDriver {
  constructor(session, startInfo) {
    const si = startInfo || session.startInfo;
    this.session = session;
    this.startInfo = si;
    this.localSide = si.side ?? session.side ?? 0;
    this.remoteSide = 1 - this.localSide;
    this.names = si.names || ['P1', 'P2'];
    this.state = createMatch({ p1: si.p1, p2: si.p2, stage: si.stage, roundsToWin: si.roundsToWin, seed: si.seed });
    this.stats = { ping: session.ping | 0, drift: 0, resim: 0, ack: 0, unacked: 0 };
    this.status = { waiting: true, paused: false, pauseSeconds: 0, ended: false, result: null };
    this.result = null;
    this.frame = 0;
    this.hist = new Uint16Array(HIST);
    this.inputs = [0, 0];
    this.remoteMask = 0;
    this.seq = 0;
    this.lastSentMask = -1;
    this.lastSentAt = 0;
    this.snap = null;
    this.snapRecv = 0;
    this.lastSnapFrame = 0;
    this.lastSnapRecv = 0;
    this.running = false;
    this.driftAvg = 0;
    this.loadedSent = false;
    this.serverEvents = [];
    this.out = [];
    session._attachDriver(si.match);
    this._offs = [
      session.on('snap', m => { this.snap = m; this.snapRecv = performance.now(); }),
      session.on('ev', m => { if (m && m.e) this.serverEvents.push(m.e); }),
      session.on('end', r => {
        this.result = r;
        this.status.ended = true;
        this.status.result = r;
        if (r && r.reason === 'aborted') this.serverEvents.push({ type: 'matchEnd', winner: 'draw', aborted: true });
      }),
    ];
  }

  tick(inputs) {
    const out = this.out;
    out.length = 0;
    const now = performance.now();
    if (!this.loadedSent) { this.loadedSent = true; this.session.sendLoaded(); }
    const local = (inputs ? inputs[this.localSide] : 0) & 1023;
    if (this.snap) this._applySnapshot();
    this.stats.ping = this.session.ping | 0;

    let steps = 0;
    if (this.running) {
      const rttF = (this.session.rtt || 80) / DT_MS;
      const estServer = this.lastSnapFrame + (now - this.lastSnapRecv) / DT_MS + rttF / 2;
      const drift = this.frame - (estServer + rttF / 2 + BUFFER_FRAMES);
      this.driftAvg += (drift - this.driftAvg) * 0.2;
      if (drift < -HARD_RESYNC) { steps = Math.min(60, Math.round(-drift)); this.driftAvg = 0; }
      else if (this.driftAvg > DRIFT_LIMIT) steps = 0;
      else if (this.driftAvg < -DRIFT_LIMIT) steps = 2;
      else steps = 1;
      this.stats.drift = Math.round(this.driftAvg * 10) / 10;
    }

    const inp = this.inputs;
    for (let i = 0; i < steps; i++) {
      this.hist[this.frame & HMASK] = local;
      if (i === 0 && (local !== this.lastSentMask || now - this.lastSentAt >= NET.HEARTBEAT_MS)) {
        this.session.sendInput(++this.seq, this.frame, local);
        this.lastSentMask = local;
        this.lastSentAt = now;
      }
      inp[this.localSide] = local;
      inp[this.remoteSide] = this.remoteMask;
      step(this.state, inp);
      this.frame++;
      const evs = this.state.events;
      for (let j = 0; j < evs.length; j++) if (!PRED_DROP[evs[j].type]) out.push(evs[j]);
    }

    if (this.serverEvents.length) {
      for (let j = 0; j < this.serverEvents.length; j++) out.push(this.serverEvents[j]);
      this.serverEvents.length = 0;
    }
    return out;
  }

  _applySnapshot() {
    const s = this.snap;
    this.snap = null;
    if (!s || !s.s) return;
    this.lastSnapFrame = s.f;
    this.lastSnapRecv = this.snapRecv;
    this.status.waiting = !!s.w;
    this.status.paused = !!s.p;
    this.status.pauseSeconds = s.pt | 0;
    this.running = !s.w && !s.p;
    this.remoteMask = (s.m && s.m[this.remoteSide]) | 0;
    this.stats.ack = (s.a && s.a[this.localSide]) | 0;
    this.stats.unacked = Math.max(0, this.seq - this.stats.ack);

    const st = this.state;
    applyPackedState(st, s.s);
    st.events.length = 0;
    if (!this.running || this.frame <= s.f || this.frame - s.f > MAX_RESIM) {
      this.frame = s.f;
      this.stats.resim = 0;
      return;
    }
    const inp = this.inputs;
    inp[this.remoteSide] = this.remoteMask;
    for (let f = s.f; f < this.frame; f++) {
      inp[this.localSide] = this.hist[f & HMASK];
      step(st, inp);
    }
    st.events.length = 0; // resim events are discarded (already shown when first predicted)
    this.stats.resim = this.frame - s.f;
  }

  destroy() {
    for (const off of this._offs) off();
    this._offs.length = 0;
    this.session._detachDriver(this.startInfo.match);
  }
}

import Phaser from 'phaser';
import { DT_MS } from '@shared/constants.js';
import { createAI } from '@shared/ai/index.js';
import { LocalDriver } from './drivers/LocalDriver.js';
import { preloadFighterArt, preloadProjectileArt, FighterView, ProjectileLayer } from './art/index.js';
import { buildStage } from './stages/index.js';
import { Effects } from './fx/index.js';
import { sfx } from './audio/sfx.js';
import { initInput, destroyInput, getMask } from './input/index.js';

const MAX_CATCHUP = 5;
const SNAP_DIST = 220; // teleports / resets snap instead of smearing
const MATCH_END_DELAY = 2000;
const LOW_FPS = 45;
const LOW_FPS_SECONDS = 3;
const WARMUP_MS = 2000;
const CX = 640;
const CY = 360;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function matchOptions(cfg) {
  const t = cfg.training;
  return {
    p1: cfg.p1,
    p2: cfg.p2,
    stage: cfg.stage,
    roundsToWin: cfg.roundsToWin || 2,
    seed: cfg.seed || 1,
    mods: cfg.mods || [
      { hpMult: 1, dmgMult: 1 },
      { hpMult: 1, dmgMult: 1 },
    ],
    training: t ? { dummyInvincible: !!t.dummyInvincible, infiniteMeter: !!t.infiniteMeter } : null,
  };
}

function lerpSnap(a, b, t) {
  const d = b - a;
  return d > SNAP_DIST || d < -SNAP_DIST ? b : a + d * t;
}

export class FightScene extends Phaser.Scene {
  constructor() {
    super({ key: 'fight' });
  }

  init(data) {
    this.cfg = data.config;
    this.opts = data.settings || {};
    this.hooks = data.hooks || {};
    this.res = data.res || 1;
    this.perf = !!data.perf;
    this.onPerfAuto = data.onPerfAuto || null;
    this.registry.set('res', this.res);

    this.online = this.cfg.mode === 'online';
    this.isTraining = this.cfg.mode === 'training';
    this.ready = false;
    this.dead = false;
    this.paused = false;
    this.inputLocked = false;
    this.acc = 0;
    this.clock = 0;
    this.prev = new Float64Array(4);
    this.inputs = [0, 0];
    this.ctrl = ['dummy', 'dummy'];
    this.ai = [null, null];
    this.views = [null, null];
    this.driver = null;
    this.stageView = null;
    this.proj = null;
    this.fx = null;
    this.endAt = -1;
    this.endSent = false;
    this.shaking = false;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    this.fpsEma = 60;
    this.lowSecs = 0;
    this.warmup = WARMUP_MS;
    this.debugT = 0;
    this.warned = false;
  }

  create() {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.teardown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.teardown, this);
    const cam = this.cameras.main;
    cam.setBackgroundColor('#070b1a');
    cam.setZoom(this.res);
    cam.centerOn(CX, CY);
    this.boot().catch((err) => this.fail(err));
  }

  async boot() {
    const cfg = this.cfg;
    const ids = [cfg.p1, cfg.p2];

    // Text in FX must use the arcade font, so wait for it (bounded).
    try {
      await Promise.race([document.fonts ? document.fonts.load('32px Bungee') : Promise.resolve(), wait(2500)]);
    } catch {
      /* font failure is not fatal */
    }
    if (this.dead) return;

    await Promise.all([
      preloadFighterArt(this, ids[0]),
      preloadFighterArt(this, ids[1]),
      Promise.resolve(preloadProjectileArt(this)),
    ]);
    if (this.dead) return;

    if (this.online) {
      const [{ OnlineDriver }, { getSession }] = await Promise.all([
        import('@/net/OnlineDriver.js'),
        import('@/net/session.js'),
      ]);
      if (this.dead) return;
      this.driver = new OnlineDriver(getSession(), cfg.online?.startInfo);
    } else {
      this.driver = new LocalDriver(matchOptions(cfg));
    }

    this.stageView = buildStage(this, cfg.stage, { perf: this.perf });
    this.views[0] = new FighterView(this, ids[0], 0);
    this.views[1] = new FighterView(this, ids[1], 1);
    this.proj = new ProjectileLayer(this);
    this.fx = new Effects(this, { perf: this.perf });

    this.setupControllers();
    initInput(this.opts, { mergeP2: !this.ctrl.includes('p2') });
    this.snapPrev();
    this.ready = true;
    this.hooks.onReady?.(this.makeApi());
  }

  setupControllers() {
    const c = this.cfg.controllers || ['p1', 'ai'];
    const ids = [this.cfg.p1, this.cfg.p2];
    const seed = this.cfg.seed || 1;
    for (let s = 0; s < 2; s++) {
      this.ctrl[s] = c[s] || 'dummy';
      if (this.ctrl[s] === 'ai') {
        this.ai[s] = createAI({
          charId: ids[s],
          difficulty: this.cfg.aiDifficulty || 'normal',
          seed: (seed + 7919 * (s + 1)) >>> 0,
        });
      }
    }
  }

  makeApi() {
    return {
      localSide: this.driver?.localSide ?? null,
      online: this.online,
      setPaused: (b) => {
        if (this.online) return;
        this.paused = !!b;
        this.acc = 0;
        this.snapPrev();
      },
      setInputLocked: (b) => {
        this.inputLocked = !!b;
      },
      restart: () => this.restart(),
      setTraining: (t) => this.setTraining(t),
    };
  }

  snapPrev() {
    const st = this.driver?.state;
    if (!st) return;
    const f = st.fighters;
    const pv = this.prev;
    pv[0] = f[0].x;
    pv[1] = f[0].y;
    pv[2] = f[1].x;
    pv[3] = f[1].y;
  }

  restart() {
    if (this.online || !this.driver?.reset) return;
    this.cfg.seed = ((Math.random() * 0x7fffffff) >>> 0) || 1;
    this.driver.reset({ seed: this.cfg.seed });
    for (let s = 0; s < 2; s++) this.ai[s]?.reset?.();
    this.afterReset();
  }

  setTraining(t = {}) {
    if (!this.isTraining || !this.driver?.reset) return;
    const cur = this.cfg.training || {};
    const dummyMode = t.dummyMode || cur.dummyMode || 'stationary';
    const infiniteMeter = t.infiniteMeter ?? !!cur.infiniteMeter;
    const dummyInvincible = dummyMode === 'invincible';
    const needsReset = dummyInvincible !== !!cur.dummyInvincible || infiniteMeter !== !!cur.infiniteMeter;
    this.cfg.training = { dummyMode, dummyInvincible, infiniteMeter };
    this.ctrl[1] = dummyMode === 'ai' ? 'ai' : 'dummy';
    if (this.ctrl[1] === 'ai') {
      if (!this.ai[1]) {
        this.ai[1] = createAI({ charId: this.cfg.p2, difficulty: 'easy', seed: ((this.cfg.seed || 1) + 7919 * 2) >>> 0 });
      } else this.ai[1].reset?.();
    }
    if (needsReset) {
      this.driver.reset({ training: { dummyInvincible, infiniteMeter } });
      this.afterReset();
    }
  }

  afterReset() {
    this.snapPrev();
    this.acc = 0;
    this.endAt = -1;
    this.endSent = false;
    this.hooks.hud?.reset?.();
  }

  update(_time, delta) {
    if (!this.ready || this.dead) return;
    const d = this.driver;
    if (!d || !d.state) return;
    const dt = delta > 250 ? 250 : delta;
    this.trackFps(delta);

    const running = !this.paused || this.online;
    if (running) {
      this.clock += dt;
      this.acc += dt;
      let n = 0;
      while (this.acc >= DT_MS && n < MAX_CATCHUP) {
        this.tick();
        if (this.dead || !this.driver?.state) return;
        this.acc -= DT_MS;
        n++;
      }
      if (this.acc >= DT_MS) this.acc %= DT_MS; // drop backlog beyond the catch-up cap
    }

    this.renderFrame(this.acc / DT_MS, running ? dt : 0);
    this.checkMatchEnd();
    this.reportDebug(dt);
  }

  tick() {
    const d = this.driver;
    const st = d.state;
    const f = st.fighters;
    const pv = this.prev;
    pv[0] = f[0].x;
    pv[1] = f[0].y;
    pv[2] = f[1].x;
    pv[3] = f[1].y;

    for (let s = 0; s < 2; s++) {
      const c = this.ctrl[s];
      let m = 0;
      if (c === 'p1' || c === 'p2') {
        m = getMask(c);
        if (this.inputLocked) m = 0;
      } else if (c === 'ai') {
        const ai = this.ai[s];
        if (ai) m = ai.think(st, s) | 0;
      }
      this.inputs[s] = m;
    }

    const events = d.tick(this.inputs);
    const st2 = d.state;
    if (st2 !== st) this.snapPrev();
    if (events && events.length) {
      try {
        this.fx.handleEvents(events, st2);
      } catch (err) {
        this.warnOnce(err);
      }
      try {
        sfx.handleEvents(events);
      } catch (err) {
        this.warnOnce(err);
      }
    }
  }

  renderFrame(alpha, dt) {
    const st = this.driver.state;
    const a = st.hitstop > 0 ? 1 : alpha; // freeze interpolation during hit-pause
    const f0 = st.fighters[0];
    const f1 = st.fighters[1];
    const pv = this.prev;
    const x0 = lerpSnap(pv[0], f0.x, a);
    const y0 = lerpSnap(pv[1], f0.y, a);
    const x1 = lerpSnap(pv[2], f1.x, a);
    const y1 = lerpSnap(pv[3], f1.y, a);

    this.views[0].sync(f0, x0, y0, dt, this.perf);
    this.views[1].sync(f1, x1, y1, dt, this.perf);
    this.proj.sync(st, a, dt, this.perf);
    this.fx.update(dt);
    this.stageView.update(dt, (x0 + x1) * 0.5);
    this.applyShake(st, a);

    const hud = this.hooks.hud;
    if (hud) hud.update(st, this.driver.stats);
  }

  applyShake(st, a) {
    const cam = this.cameras.main;
    const s = st.shake || 0;
    if (s > 0.002) {
      const t = st.frame + a;
      const amp = 14 * s;
      const jx = (Math.sin(t * 1.93) * 0.6 + Math.sin(t * 3.71 + 1.3) * 0.4) * amp;
      const jy = (Math.cos(t * 2.37) * 0.6 + Math.sin(t * 4.13 + 0.7) * 0.4) * amp * 0.7;
      cam.centerOn(CX + jx, CY + jy);
      this.shaking = true;
    } else if (this.shaking) {
      cam.centerOn(CX, CY);
      this.shaking = false;
    }
  }

  checkMatchEnd() {
    if (this.endSent || this.isTraining) return;
    const st = this.driver.state;
    if (st.phase !== 'matchEnd') {
      this.endAt = -1;
      return;
    }
    if (this.endAt < 0) {
      this.endAt = this.clock;
      return;
    }
    if (this.clock - this.endAt < MATCH_END_DELAY) return;
    this.endSent = true;
    const stats = st.stats || {};
    this.hooks.onMatchEnd?.({
      winner: st.matchWinner,
      wins: [st.wins[0], st.wins[1]],
      stats: {
        maxCombo: [stats.maxCombo?.[0] | 0, stats.maxCombo?.[1] | 0],
        damage: [stats.damage?.[0] || 0, stats.damage?.[1] || 0],
      },
      config: this.cfg,
    });
  }

  trackFps(delta) {
    if (delta > 0) this.fpsEma += (1000 / delta - this.fpsEma) * 0.08;
    this.fpsFrames++;
    this.fpsTime += delta;
    if (this.fpsTime < 1000) return;
    const fps = (this.fpsFrames * 1000) / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    if (this.warmup > 0) {
      this.warmup -= 1000;
      return;
    }
    if (this.opts.perfMode !== 'auto' || this.perf || this.paused || document.hidden) {
      this.lowSecs = 0;
      return;
    }
    this.lowSecs = fps < LOW_FPS ? this.lowSecs + 1 : 0;
    if (this.lowSecs >= LOW_FPS_SECONDS) this.enablePerf(true);
  }

  enablePerf(auto) {
    if (this.perf) return;
    this.perf = true;
    try {
      this.fx?.setPerf(true);
    } catch (err) {
      this.warnOnce(err);
    }
    if (auto) {
      this.onPerfAuto?.();
      this.hooks.onToast?.('Low frame rate detected: performance mode on');
    }
  }

  reportDebug(dt) {
    this.debugT += dt || 16;
    if (this.debugT < 250) return;
    this.debugT = 0;
    const s = this.driver.stats || {};
    this.hooks.onDebug?.(this.fpsEma, s.ping || 0, s.drift || 0, this.perf, this.res);
  }

  warnOnce(err) {
    if (this.warned) return;
    this.warned = true;
    console.warn('[FightScene]', err);
  }

  fail(err) {
    console.error('[FightScene] failed to start', err);
    this.hooks.onError?.(err);
  }

  teardown() {
    if (this.dead) return;
    this.dead = true;
    this.ready = false;
    destroyInput();
    const kill = (o) => {
      try {
        o?.destroy?.();
      } catch (err) {
        console.warn('[FightScene] destroy', err);
      }
    };
    kill(this.views[0]);
    kill(this.views[1]);
    kill(this.proj);
    kill(this.fx);
    kill(this.stageView);
    kill(this.driver);
    this.views[0] = this.views[1] = null;
    this.proj = this.fx = this.stageView = this.driver = null;
    this.ai[0] = this.ai[1] = null;
    this.hooks = {};
  }
}

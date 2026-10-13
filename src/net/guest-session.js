// ============================================================================
//  guest-session.js - the CLIENT of an online match. It runs NO simulation: it sends its input
//  frames (60 Hz, repeated for loss) and match intents to the host, and displays the host's
//  snapshots, interpolated a little in the past (an adaptive delay, snapshot.js). Effects come from the host's events.
//  Your own movement is predicted (predict.js) and your own shots and blocks are echoed at once (echo.js); the host stays the
//  authority for every bullet, hit and damage number.
//  The client is player 1.
//
//  Time comes from a clock ({ now() }); the owner calls netTick(now) often (worker timer) and
//  render(now) once per drawn frame.
// ============================================================================
import { CONFIG } from '../config.js';
import { ClientWorld } from './snapshot.js';
import { T, VERSION, encodeFrame } from './protocol.js';
import { Predictor } from './predict.js';
import { Echo } from './echo.js';
import { netQuality, hostIsSlow } from './quality.js';

const STEP_MS = 1000 / CONFIG.tickRate;

export class GuestSession {
  // opts: { clock, name, code, token, getLocalInput(player, isNew) -> input, reconnect(cb) , onStatus(status, text), onEnded(reason) }
  //   reconnect({ onopen(transport), onerror(err) }) starts a new connection attempt to the same room (used while rejoining)
  constructor(opts) {
    this.opts = opts; this.clock = opts.clock;
    this.role = 'guest'; this.me = 1;
    this.names = [CONFIG.player.names[0], opts.name || CONFIG.player.names[1]];
    this.world = new ClientWorld();
    this.predict = new Predictor();             // your own movement, run locally (config.net.predictOwnMovement)
    this.echo = new Echo();                     // your own shots and blocks shown at once (the host decides whether they count)
    this.lastAim = 0;
    this.localShots = [];                       // times of the muzzle flashes shown at once on a click (the host's own 'shot' event, which arrives later, is then shown without a second flash)
    this.flashes = [];
    this.status = 'connecting';                 // connecting | playing | reconnecting | ended
    this.ready = false;                         // got the first full state
    this.transport = null; this.token = opts.token || null;
    this.evQueue = []; this.lastEv = 0;
    this.seq = 0; this.frames = [];
    this.lastRx = 0; this.lastPing = 0; this.ping = null; this.jitter = 0;
    this.hostHz = null; this.hostSnapEvery = 2;  // the host's measured tick rate and snapshot interval (from its snapshots)
    this.inLoss = 0;                             // share of OUR input frames that did not arrive in time at the host (it reports it)
    this.snapLoss = 0; this.snapWin = { got: 0, missing: 0, lastSeq: null };   // snapshots lost on the way (from their sequence numbers)
    this.qAvg = null; this.inputIv = STEP_MS;   // the host's input queue length (smoothed) and the interval between our input frames
    this.lastInputAt = null; this.nextRejoinAt = 0; this.lostAt = 0;
    this.hostName = null;
    this.stats = { inputsSent: 0, evApplied: 0, evDup: 0 };
  }

  attach(transport) {
    if (this.transport && this.transport !== transport) { this.transport.onmessage = null; this.transport.onclose = null; this.transport.close('replaced'); }
    this.transport = transport; this.lastRx = this.clock.now();
    transport.onmessage = (m) => this._onMessage(m);
    transport.onclose = () => { if (this.transport === transport) this._lost('The connection to the host closed.'); };
    transport.send({ t: T.HELLO, v: VERSION, name: this.names[1], token: this.token }, true);
  }

  _notify(status, text) { if (this.opts.onStatus) this.opts.onStatus(status, text); }

  _onMessage(m) {
    this.lastRx = this.clock.now();
    switch (m.t) {
      case T.WELCOME:
        this.token = m.token; this.hostName = m.hostName; if (m.names) this.names = m.names.slice();
        break;
      case T.REJECT:
        this._end(m.reason === 'full' ? 'That room is full.' : m.reason === 'version' ? 'The host runs a different version of the game. Refresh the page and try again.' : 'The host refused the connection.');
        break;
      case T.FULL:
        this.world = new ClientWorld();
        this.world.applyView(m.mv);
        this.world.applySnap(m.snap, this.clock.now(), STEP_MS);
        this.predict.reset(); this.predict.onSnapshot(m.snap, this._pctx()); this.qAvg = null; this.inputIv = STEP_MS;
        this.echo.reset(); this.echo.onSnapshot(m.snap); this.snapWin.lastSeq = m.snap.seq;
        this.evQueue = []; this.lastEv = m.evSeq;
        if (m.names) this.names = m.names.slice();
        this.ready = true; this.status = 'playing'; this.lostAt = 0;
        this._notify('playing', 'Connected');
        break;
      case T.SNAP: this._countSnap(m.seq); if (this.world.applySnap(m, this.clock.now(), STEP_MS)) { this.predict.onSnapshot(m, this._pctx()); this.echo.onSnapshot(m); this._slew(m.ql); if (typeof m.hz === 'number') { this.hostHz = m.hz; this.hostSnapEvery = m.se || 2; this.inLoss = (m.il || 0) / 100; } } break;
      case T.MV: this.world.applyView(m.view); break;
      case T.EV: this._onEvents(m); break;
      case T.PING: if (this.transport) this.transport.send({ t: T.PONG, ts: m.ts }, false); break;
      case T.PONG: { const rtt = this.clock.now() - m.ts; this.jitter += (Math.abs(rtt - (this.ping === null ? rtt : this.ping)) - this.jitter) / 8; this.ping = this.ping === null ? rtt : this.ping * 0.8 + rtt * 0.2; break; }
      case T.NACK: console.warn('host rejected intent:', m.error); break;
      case T.BYE: this._end('The host left the game.'); break;
      default: break;
    }
  }

  _onEvents(m) {
    // reliable + ordered, but be strict anyway: every event exactly once, in order
    for (const e of m.list) {
      if (e.n <= this.lastEv) { this.stats.evDup++; continue; }
      this.lastEv = e.n; this.evQueue.push(e);
    }
  }

  _lost(text) {
    if (this.status !== 'playing' && this.status !== 'connecting') return;
    if (this.transport) { this.transport.onmessage = null; this.transport.onclose = null; this.transport.close('lost'); this.transport = null; }
    if (!this.ready || !this.opts.reconnect) { this._end(text); return; }
    this.status = 'reconnecting'; this.lostAt = this.clock.now(); this.nextRejoinAt = this.lostAt + 500;
    this._notify('reconnecting', text);
  }

  _end(reason, closeDelay = 0) {
    if (this.status === 'ended') return;
    this.status = 'ended';
    if (this.transport) { const tr = this.transport; tr.onmessage = null; tr.onclose = null; this.transport = null; if (closeDelay) this.clock.at(this.clock.now() + closeDelay, () => tr.close('end')); else tr.close('end'); }
    if (this.opts.onEnded) this.opts.onEnded(reason);
  }

  leave() {
    if (this.transport) this.transport.send({ t: T.BYE, reason: 'client left' }, true);
    this._end('left', 300);
  }

  // ---- 60 Hz network tick: input frames, pings, timeouts --------------------------------------------------------------------------
  netTick(now) {
    if (this.status === 'reconnecting') {
      if (now - this.lostAt > CONFIG.net.graceSeconds * 1000) { this._end('Could not get back into the game.'); return; }
      if (now >= this.nextRejoinAt && !this.rejoining) {
        this.nextRejoinAt = now + CONFIG.net.rejoinEvery * 1000; this.rejoining = true;
        this.opts.reconnect({
          onopen: (tr) => { this.rejoining = false; if (this.status === 'reconnecting') this.attach(tr); else tr.close('late'); },
          onerror: () => { this.rejoining = false; },
        });
      }
      return;
    }
    if (this.status !== 'playing' || !this.transport) return;
    if (now - this.lastRx > CONFIG.net.timeout * 1000) { this._lost('Lost the connection to the host.'); return; }
    if (now - this.lastPing >= CONFIG.net.pingEvery * 1000) { this.lastPing = now; this.transport.send({ t: T.PING, ts: now }, false); }   // on the snapshot channel, so it measures the path the game really uses
    if (!this.ready) return;
    if (this.lastInputAt === null) this.lastInputAt = now;
    let n = 0;
    while (now - this.lastInputAt >= this.inputIv && n < 5) { this.lastInputAt += this.inputIv; n++; this._sendInput(); }
    if (n === 5) this.lastInputAt = now;
  }

  // Keep the host's input queue near its cushion: too many frames waiting = send a little slower, too few = a little faster
  // (at most config.net.inputClockSlew; a few percent are invisible and spare us skipping frames).
  _slew(ql) {
    if (typeof ql !== 'number') return;
    const N = CONFIG.net;
    this.qAvg = this.qAvg === null ? ql : this.qAvg + (ql - this.qAvg) * 0.15;
    let err = this.qAvg - (N.inputCushion + 0.5); err = Math.abs(err) < 0.5 ? 0 : err - Math.sign(err) * 0.5;
    this.inputIv = STEP_MS * (1 + Math.max(-N.inputClockSlew, Math.min(N.inputClockSlew, err * 0.02)));
  }

  // Snapshot loss from the host's sequence numbers (one estimate per ~90 snapshots, smoothed).
  _countSnap(seq) {
    const W = this.snapWin; if (!Number.isInteger(seq)) return;
    if (W.lastSeq !== null && seq > W.lastSeq) { W.missing += seq - W.lastSeq - 1; W.got++; W.lastSeq = seq; }
    else if (W.lastSeq === null) { W.lastSeq = seq; W.got++; }
    if (W.got + W.missing >= 90) { const l = W.missing / (W.got + W.missing); this.snapLoss = this.snapLoss === 0 ? l : this.snapLoss * 0.5 + l * 0.5; W.got = W.missing = 0; }
  }

  _pctx() { return { mapId: this.world.mapId, blocks: this.world.latestBlocks() }; }

  _sendInput() {
    let own = this.world.state.players[1];
    const pd = this.predict.enabled ? this.predict.display(this.lastInputAt) : null;
    if (pd) own = { ...own, x: pd.x, y: pd.y };                // the aim starts at where you are drawn
    const input = this.opts.getLocalInput ? this.opts.getLocalInput(own) : { aim: 0 };
    this.seq++; this.lastAim = input.aim;
    // local echo: what the host will (very probably) do with this frame - shot, recoil, shield
    const fx = this.echo.frame(this.seq, input, { phase: this.world.state.phase, cards: own.cards || [] });
    if (fx.fired) this._echoShot(input, own, fx);
    if (fx.blocked && this.echo.base && this.echo.base.sq) { const now = this.clock.now(), S = this.echo.base.sq; this.echo.blockUntil = now + S.blockWindow * 1000; this.echo.blockCdUntil = now + S.blockCooldown * 1000; }
    if (this.predict.enabled && this.world.mapId) this.predict.tick(this.seq, input, this._pctx(), this.lastInputAt, fx.kick);
    this.frames.unshift(encodeFrame(this.seq, input));
    if (this.frames.length > CONFIG.net.inputRedundancy) this.frames.length = CONFIG.net.inputRedundancy;
    // vd = how far behind the host's present this client draws the opponent (ms); the host uses it for its bounded lag compensation
    this.transport.send({ t: T.IN, f: this.frames, vd: Math.round(this.world.delayMs), sl: Math.round(this.snapLoss * 100) }, false);   // newest frame first, older repeated
    this.stats.inputsSent++;
  }

  // Your click shows the muzzle flash (and, for a plain shot, the bullet) at once. The host's own 'shot' event then arrives without a second flash.
  _echoShot(input, own, fx) {
    const now = this.clock.now(), me = this.world.state.players[1];
    const dist = Math.max(CONFIG.player.muzzleDistance, Math.max(me.w, me.h) / 2 + 3) + 4;
    this.flashes.push({ type: 'shot', player: 1, x: own.x + Math.cos(input.aim) * dist, y: own.y + Math.sin(input.aim) * dist, angle: input.aim, pellets: 1, local: true });
    this.localShots.push(now);
    if (fx.spawn) this.echo.spawn(fx.spawn, own.x, own.y, now, me.w, me.h);
  }

  // ---- drawing --------------------------------------------------------------------------------------------------------------------------------
  // Returns { state, alpha, events } for the renderer at local time `now`. `events` are the ones whose host tick has been reached.
  render(now) {
    const rt = this.world.renderTick(now, STEP_MS);
    const { state, alpha } = this.world.build(rt);
    const pd = this.predict.enabled ? this.predict.display(now) : null;
    if (pd) {                                                  // your own player: where YOUR input has taken it, not the delayed snapshot
      const P = state.players[1];
      P.x = pd.x; P.y = pd.y; P.vx = pd.vx; P.vy = pd.vy; P.grounded = pd.grounded; P.aim = this.lastAim; P.facing = Math.cos(this.lastAim) >= 0 ? 1 : -1;
    }
    const nowMs = this.clock.now();
    const P1 = state.players[1];
    if (P1.alive) {                                            // your shield is drawn from the click on, not one round trip later
      const bl = (this.echo.blockUntil - nowMs) / 1000, bc = (this.echo.blockCdUntil - nowMs) / 1000;
      if (bl > P1.blockLeft) P1.blockLeft = bl;
      if (bc > P1.blockCd) P1.blockCd = bc;
    }
    this.echo.update(nowMs, this.world, state.players[0]);
    state.bullets = this.echo.filter(state.bullets, nowMs);
    const events = this.flashes; this.flashes = [];
    this.localShots = this.localShots.filter((t) => nowMs - t < 600);
    while (this.evQueue.length && this.evQueue[0].tick <= rt + 1) {
      const e = this.evQueue.shift(); this.stats.evApplied++;
      if (e.type === 'shot' && e.player === 1 && this.localShots.length) { this.localShots.shift(); events.push({ ...e, silent: true }); continue; }   // already flashed locally: pass it on, but without the flash
      events.push(e);
    }
    return { state, alpha, events, renderTick: rt };
  }

  get hostSlow() { return hostIsSlow(this.hostHz); }

  // What the player (and the debug panel) is told about the connection. loss = the worse of the two directions.
  netInfo() {
    const tr = this.transport, loss = Math.max(this.snapLoss, this.inLoss);
    return { ping: this.ping, jitter: this.jitter, loss, lossIn: this.snapLoss, lossOut: this.inLoss, hostHz: this.hostHz, hostSlow: this.hostSlow,
      snapHz: Math.round(CONFIG.tickRate / (this.hostSnapEvery || 2)), interpMs: Math.round(this.world.delayMs), lagCompMs: null, viewDelayMs: Math.round(this.world.delayMs),
      channel: (tr && tr.channel) || 'loopback', path: (tr && tr.path) || null, quality: netQuality({ ping: this.ping, jitter: this.jitter, loss }) };
  }

  get state() { return this.world.state; }
  // "My screen can show this round" (the ready gate): reliable, carries the gate id so the host can ignore a stale one.
  sendReady(id) { if (this.transport && this.status === 'playing') { this.transport.send({ t: T.READY, id }, true); this.readySentId = id; return true; } return false; }
  sendIntent(it) { if (this.transport && this.status === 'playing') this.transport.send({ t: T.INTENT, i: it }, true); }
}

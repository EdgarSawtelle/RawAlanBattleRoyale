// ============================================================================
//  host-session.js - the HOST of an online match. It owns the one true simulation (the same
//  sim/world.js + sim/match.js the practice mode uses), runs it at a fixed 60 Hz, applies the
//  client's input frames and intents, and sends snapshots (60 Hz while the link is good, else 30 Hz), events and match views.
//  The host is also player 0: its own input comes from the local keyboard/mouse.
//
//  Time comes from a clock object ({ now() }) and the owner calls advance(now) often (a worker
//  timer in the browser, a virtual clock in tests) - this class never sets timers itself.
// ============================================================================
import { CONFIG } from '../config.js';
import { createState, step, intent, STEP } from '../sim/world.js';
import { matchView } from '../sim/match.js';
import { buildSnap } from './snapshot.js';
import { T, VERSION, decodeFrame, validInputMsg, validIntent } from './protocol.js';
import { netQuality, hostIsSlow } from './quality.js';

const STEP_MS = 1000 / CONFIG.tickRate;
const NEUTRAL = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const newInputState = () => ({ cur: { ...NEUTRAL }, q: [], got: new Set(), proc: -1, primed: false, starve: 0, pendJump: false, pendShoot: false, pendBlock: false });
const randToken = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

export class HostSession {
  // opts: { clock, name, getLocalInput(player) -> input, seed, mapId, onStatus(status, text), onEnded(reason) }
  constructor(opts) {
    this.opts = opts;
    this.clock = opts.clock;
    this.role = 'host'; this.me = 0;
    this.names = [opts.name || CONFIG.player.names[0], CONFIG.player.names[1]];
    this.state = createState({ mapId: opts.mapId, seed: opts.seed ?? 1, rotate: opts.rotate !== false, mapLock: opts.mapLock || null });
    this.state.match.auto = [false, false];                 // two humans: nobody is a bot
    this.status = 'waiting';                                // waiting | playing | paused | ended
    this.transport = null; this.token = null;
    this.paused = false; this.stopAfterTicks = Infinity;    // same test hooks as the practice session
    this.timeScale = 1;
    this.prev = null; this.ticks = 0;
    this.acc = 0; this.lastAdvance = null; this.lastTickAt = this.clock.now();
    this.evSeq = 0; this.outEvents = []; this.localEvents = [];
    this.mvVersion = 0; this.mvSig = ''; this.seq = 0; this.ackSeq = 0;
    this.input = newInputState();
    this.lastRx = 0; this.lastPing = 0; this.ping = null; this.pausedAt = 0;
    this.stats = { snapsSent: 0, inputsRx: 0, intentsRx: 0, stalls: 0 };
    this.snapEvery = CONFIG.net.snapshotFastEvery;           // 1 = 60 Hz while the link is good, else 2 = 30 Hz (see _chooseRate)
    this.tickHz = null; this.tickWin = { t0: null, n: 0 };    // measured host ticks per second (sent to the client: "host is running slow")
    this.loss = { got: 0, missing: 0 }; this.lossIn = 0;     // share of the client's input frames that did not arrive in time
    this.clientVd = 0; this.lagTicks = 0;                    // the client's reported view delay (ms) and the resulting bounded rewind for its bullets
    this.jitter = 0;                                         // round-trip jitter (ms), from the pongs
    this.peerSnapLoss = 0;                                   // share of OUR snapshots that did not reach the client (it reports it)
  }

  // ---- connections ---------------------------------------------------------------------------------------------------
  // A transport just opened. Nothing is trusted until its first message (hello).
  attach(transport) {
    const first = (msg) => {
      if (msg.t !== T.HELLO) return;
      transport.onmessage = null;
      this._hello(transport, msg);
    };
    transport.onmessage = first;
    transport.onclose = () => {};
  }

  _hello(tr, msg) {
    const reject = (reason) => { tr.send({ t: T.REJECT, reason }, true); setTimeout(() => tr.close('rejected'), 50); };
    if (msg.v !== VERSION) return reject('version');
    const rejoin = this.status === 'paused' && msg.token && msg.token === this.token;
    if (this.status === 'waiting') this._startMatch(tr, msg);
    else if (rejoin) this._rejoin(tr, msg);
    else return reject('full');
  }

  _startMatch(tr, msg) {
    this.token = randToken();
    this.names[1] = String(msg.name || CONFIG.player.names[1]).slice(0, CONFIG.net.maxNameLength);
    if (this.names[1] === this.names[0]) this.names[1] = (this.names[1].slice(0, CONFIG.net.maxNameLength - 1) + '2');   // two players with the same name: tell them apart
    this._adopt(tr);
    this.status = 'playing';
    this.lastTickAt = this.clock.now(); this.lastAdvance = null;
    tr.send({ t: T.WELCOME, v: VERSION, you: 1, hostName: this.names[0], token: this.token, rejoin: false, names: this.names }, true);
    this._sendFull();
    this._notify('playing', 'Opponent joined');
  }

  _rejoin(tr, msg) {
    this._adopt(tr);
    this.status = 'playing'; this.lastAdvance = null; this.lastTickAt = this.clock.now();
    tr.send({ t: T.WELCOME, v: VERSION, you: 1, hostName: this.names[0], token: this.token, rejoin: true, names: this.names }, true);
    this._sendFull();
    this._notify('playing', 'Opponent is back');
  }

  _adopt(tr) {
    if (this.transport && this.transport !== tr) { this.transport.onmessage = null; this.transport.onclose = null; this.transport.close('replaced'); }
    this.transport = tr; this.lastRx = this.clock.now(); this.input = newInputState();
    tr.onmessage = (m) => this._onMessage(m);
    tr.onclose = () => { if (this.transport === tr) this._peerLost('The connection to your opponent closed.'); };
  }

  _notify(status, text) { if (this.opts.onStatus) this.opts.onStatus(status, text); }

  _onMessage(m) {
    this.lastRx = this.clock.now();
    switch (m.t) {
      case T.IN: if (validInputMsg(m)) this._onInput(m); break;
      case T.INTENT: {
        if (!validIntent(m.i)) break;
        this.stats.intentsRx++;
        const r = intent(this.state, 1, m.i);
        this._pushEvents(r.events);
        if (!r.ok) this.transport.send({ t: T.NACK, error: r.error }, true);
        this._viewMaybe(); this._flush();
        break;
      }
      case T.PING: this.transport.send({ t: T.PONG, ts: m.ts }, false); break;
      case T.PONG: { const rtt = this.clock.now() - m.ts; this.jitter += (Math.abs(rtt - (this.ping === null ? rtt : this.ping)) - this.jitter) / 8; this.ping = this.ping === null ? rtt : this.ping * 0.8 + rtt * 0.2; break; }
      case T.BYE: this._end('Your opponent left the game.'); break;
      default: break;
    }
  }

  // Input frames are queued by sequence number and simulated ONE PER TICK, in order (the client's
  // prediction relies on that: frame n is tick n). The host never runs ahead of the client's numbers:
  //   * it keeps a cushion of one frame (config.net.inputCushion), so ordinary jitter does not starve it
  //   * if the queue still runs dry it repeats the last input for that tick WITHOUT using up a frame number,
  //     and waits until the cushion is back (a stall; after a long silence the keys are let go)
  //   * a frame missing from the middle of the queue (lost 3 times in a row) is replaced by a repeat
  //   * a frame that arrives after its slot was repeated is dropped, but its button edges are kept for the next tick
  //   * if frames pile up (the host's clock is slower) the oldest are skipped
  _onInput(m) {
    const I = this.input;
    this.stats.inputsRx++;
    this.peerSnapLoss = typeof m.sl === 'number' && m.sl >= 0 ? Math.min(100, m.sl) / 100 : 0;
    if (typeof m.vd === 'number' && m.vd >= 0) this.clientVd = Math.min(CONFIG.net.lagCompMax * 1000, m.vd);   // how far behind the client draws the opponent (bounded: a client claiming more gains at most lagCompMax)
    for (let i = m.f.length - 1; i >= 0; i--) {            // oldest first
      const f = decodeFrame(m.f[i]);
      if (I.got.has(f.seq)) continue;                      // a repeat of a frame we already have
      I.got.add(f.seq);
      if (I.got.size > 200) { const lo = f.seq - 150; for (const s of I.got) if (s < lo) I.got.delete(s); }
      if (f.seq <= I.proc) { I.pendJump = I.pendJump || f.jumpPressed; I.pendShoot = I.pendShoot || f.shootPressed; I.pendBlock = I.pendBlock || f.blockPressed; continue; }   // too late: its slot was already simulated
      let k = I.q.length; while (k > 0 && I.q[k - 1].seq > f.seq) k--;
      I.q.splice(k, 0, f);
    }
  }

  // The input of the client for THIS tick (also moves ackSeq: the number of the frame being simulated).
  _clientInput() {
    const I = this.input, N = CONFIG.net;
    if (I.q.length > N.inputQueueMax) {                    // too far behind: skip the oldest, keep their button edges
      while (I.q.length > N.inputQueueKeep) { const o = I.q.shift(); I.pendJump = I.pendJump || o.jumpPressed; I.pendShoot = I.pendShoot || o.shootPressed; I.pendBlock = I.pendBlock || o.blockPressed; }
      I.proc = I.q[0].seq - 1;
    } else if (I.proc < 0 && I.q.length) I.proc = I.q[0].seq - 1;                 // the first frame sets the numbering
    if (I.proc < 0) return NEUTRAL;                         // nothing received yet
    if (!I.primed && I.q.length > N.inputCushion) I.primed = true;
    else if (I.primed && !I.q.length) I.primed = false;     // ran dry: stall until the cushion is back
    let f = null;
    if (I.primed) {
      if (I.q[0].seq - I.proc > N.inputGapMax) I.proc = I.q[0].seq - 1;            // a long hole: resynchronise
      const next = I.proc + 1;
      if (I.q[0].seq === next) f = I.q.shift();             // (otherwise a hole of a few frames: repeat the last input in its place)
      I.proc = next; this.ackSeq = next; I.starve = 0;
      if (f) this.loss.got++; else this.loss.missing++;                              // a frame that had to be repeated = one that did not arrive in time
    } else { I.starve++; this.stats.stalls++; }
    if (f) I.cur = f;
    let c = I.cur;
    if (I.starve > 12) c = { ...c, left: false, right: false, jump: false, shoot: false, block: false };   // the client went quiet: let go of the keys
    const out = { left: c.left, right: c.right, jump: c.jump, jumpPressed: (f ? f.jumpPressed : false) || I.pendJump, shoot: c.shoot || (f ? f.shootPressed : false) || I.pendShoot, block: c.block || (f ? f.blockPressed : false) || I.pendBlock, aim: c.aim };
    I.pendJump = I.pendShoot = I.pendBlock = false;          // an edge lives for exactly one tick
    return out;
  }

  // Outside live play nothing is simulated: drop the queue so no backlog builds up (the ack still follows the client).
  _dropInputs() {
    const I = this.input;
    if (I.q.length) { I.proc = I.q[I.q.length - 1].seq; I.q = []; I.primed = false; I.pendJump = I.pendShoot = I.pendBlock = false; this.ackSeq = I.proc; }
  }

  _peerLost(text) {
    if (this.status !== 'playing') return;
    this.status = 'paused'; this.pausedAt = this.clock.now();
    if (this.transport) { this.transport.onmessage = null; this.transport.onclose = null; this.transport.close('lost'); this.transport = null; }
    this._notify('paused', text || 'Your opponent disconnected.');
  }

  _end(reason, closeDelay = 0) {
    if (this.status === 'ended') return;
    this.status = 'ended';
    if (this.transport) { const tr = this.transport; tr.onmessage = null; tr.onclose = null; this.transport = null; if (closeDelay) this.clock.at(this.clock.now() + closeDelay, () => tr.close('end')); else tr.close('end'); }
    if (this.opts.onEnded) this.opts.onEnded(reason);
  }

  // Leave on purpose (tells the other side).
  leave() {
    if (this.transport) this.transport.send({ t: T.BYE, reason: 'host left' }, true);
    this._end('left', 300);                                  // give the goodbye time to leave before hanging up
  }

  // ---- the loop -------------------------------------------------------------------------------------------------------
  advance(now) {
    if (this.status === 'paused') {
      if (now - this.pausedAt > CONFIG.net.graceSeconds * 1000) this._end('Your opponent did not come back in time.');
      return;
    }
    if (this.status !== 'playing') return;
    if (now - this.lastRx > CONFIG.net.timeout * 1000) { this._peerLost('Lost the connection to your opponent.'); return; }
    if (now - this.lastPing >= CONFIG.net.pingEvery * 1000 && this.transport) { this.lastPing = now; this.transport.send({ t: T.PING, ts: now }, false); }
    if (this.paused) { this.lastAdvance = now; this.acc = 0; return; }
    if (this.lastAdvance === null) this.lastAdvance = now;
    this.acc += Math.min(250, now - this.lastAdvance) * this.timeScale; this.lastAdvance = now;
    let n = 0;
    while (this.acc >= STEP_MS && n < CONFIG.maxCatchUpTicks) {
      if (this.ticks >= this.stopAfterTicks) { this.acc = 0; break; }
      this._tick(now); this.acc -= STEP_MS; n++;
    }
    if (n === CONFIG.maxCatchUpTicks) this.acc = 0;
  }

  _tick(now) {
    const st = this.state;
    this.prev = { players: st.players.map((p) => ({ x: p.x, y: p.y })), bullets: new Map(st.bullets.map((b) => [b.id, { x: b.x, y: b.y }])) };
    this._measure(now);
    st.lag = [0, this.lagTicks];                                 // bullets of the client are tested against where the host player was (bounded rewind, see sim/bullet.js)
    const live = st.phase === 'playing' || st.phase === 'roundEnd';
    const in0 = live ? (this.opts.getLocalInput ? this.opts.getLocalInput(st.players[0]) : NEUTRAL) : NEUTRAL;
    const in1 = live ? this._clientInput() : (this._dropInputs(), NEUTRAL);
    this.ticks++; this.lastTickAt = now;
    const ev = step(st, [in0, in1], STEP);
    this._pushEvents(ev);
    if (st.tick % this.snapEvery === 0) {
      this._viewMaybe();
      if (this.transport) { this.seq++; this.transport.send({ t: T.SNAP, ...buildSnap(st, this.seq, this.ackSeq, this.mvVersion, this.input.q.length, { hz: this.tickHz === null ? 60 : Math.round(this.tickHz * 10) / 10, se: this.snapEvery, il: Math.round(this.lossIn * 100) }) }, false); this.stats.snapsSent++; }
    }
    this._flush();
  }

  // Once a second: the host's real tick rate, the input loss, the snapshot rate (60 Hz while the link is good, 30 Hz when it is
  // slow or lossy or the host machine is struggling) and the lag compensation window.
  _measure(now) {
    const W = this.tickWin; if (W.t0 === null) W.t0 = now; W.n++;
    if (now - W.t0 >= 1000) {
      const hz = W.n * 1000 / (now - W.t0); this.tickHz = this.tickHz === null ? hz : this.tickHz * 0.5 + hz * 0.5; W.t0 = now; W.n = 0;
      const L = this.loss, tot = L.got + L.missing; if (tot >= 30) { this.lossIn = L.missing / tot; L.got = L.missing = 0; }
      this._chooseRate();
    }
    const lagMs = Math.min(CONFIG.net.lagCompMax * 1000, this.clientVd + (this.ping === null ? 0 : this.ping / 2));
    this.lagTicks = this.transport ? Math.max(0, Math.round(lagMs / STEP_MS)) : 0;
  }
  _chooseRate() {
    const N = CONFIG.net, fast = this.snapEvery === N.snapshotFastEvery, k = fast ? 1.25 : 0.8;   // hysteresis
    const good = (this.ping === null || this.ping < N.snapshotFastMaxRtt * k) && Math.max(this.lossIn, this.peerSnapLoss) < N.snapshotFastMaxLoss * k && (this.tickHz === null || this.tickHz >= N.hostSlowHz);
    this.snapEvery = good ? N.snapshotFastEvery : N.snapshotEvery;
  }
  get hostSlow() { return hostIsSlow(this.tickHz); }

  // What the player (and the debug panel) is told about the connection. loss = the worse of the two directions.
  netInfo() {
    const tr = this.transport, loss = Math.max(this.lossIn, this.peerSnapLoss);
    return { ping: this.ping, jitter: this.jitter, loss, lossIn: this.lossIn, lossOut: this.peerSnapLoss, hostHz: this.tickHz, hostSlow: this.hostSlow,
      snapHz: Math.round(CONFIG.tickRate / this.snapEvery), interpMs: null, lagCompMs: Math.round(this.lagTicks * STEP_MS), viewDelayMs: Math.round(this.clientVd),
      channel: (tr && tr.channel) || 'loopback', path: (tr && tr.path) || null, quality: netQuality({ ping: this.ping, jitter: this.jitter, loss }) };
  }

  alpha() { return this.paused || this.status !== 'playing' ? 1 : Math.max(0, Math.min(1, (this.clock.now() - this.lastTickAt) / STEP_MS)); }

  // Events: kept for the host's own effects, and queued (with a sequence number) for the client.
  _pushEvents(list) {
    if (!list || !list.length) return;
    for (const e of list) { this.evSeq++; this.localEvents.push(e); this.outEvents.push({ ...e, n: this.evSeq }); }
    if (this.localEvents.length > 600) this.localEvents.splice(0, this.localEvents.length - 600);
  }
  _flush() {
    if (!this.outEvents.length) return;
    if (this.transport) this.transport.send({ t: T.EV, n: this.outEvents[0].n, list: this.outEvents }, true);
    this.outEvents = [];
  }
  drainEvents() { const l = this.localEvents; this.localEvents = []; return l; }

  // The match view goes to the client whenever it changed (reliable). The correct quiz answer is
  // not in it until the question has been answered (matchView() hides it).
  _viewMaybe(force) {
    const v = matchView(this.state);
    delete v.timer;
    const sig = JSON.stringify(v);
    if (!force && sig === this.mvSig) return;
    this.mvSig = sig; this.mvVersion++;
    if (this.transport) this.transport.send({ t: T.MV, view: { ...v, v: this.mvVersion } }, true);
  }

  _sendFull() {
    const st = this.state, v = matchView(st); delete v.timer;
    this.mvSig = JSON.stringify(v); this.mvVersion++;
    this.outEvents = [];
    this.seq++;
    this.transport.send({ t: T.FULL, snap: buildSnap(st, this.seq, this.ackSeq, this.mvVersion, this.input.q.length), mv: { ...v, v: this.mvVersion }, evSeq: this.evSeq, names: this.names }, true);
  }

  // ---- UI side -------------------------------------------------------------------------------------------------------------
  // The host's own match intents (it is player 0).
  sendIntent(it) {
    const r = intent(this.state, 0, it);
    this._pushEvents(r.events); this._viewMaybe(); this._flush();
    return r;
  }
  get statusText() { return this.status; }
}

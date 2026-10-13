// ============================================================================
//  transport.js - the Transport abstraction and the in-browser / in-process loopback networks.
//
//  A Transport is one open connection between the host and ONE client:
//      send(msg, reliable = true)     msg = plain JSON-able object
//      onmessage = (msg) => {}        called for every received message (already parsed)
//      onclose   = (reason) => {}     the connection ended (either side, or timeout)
//      close(reason)                  hang up
//      open                           boolean
//  The game code (host-session / guest-session) only knows this interface. Implementations:
//    * LoopbackNetwork   - in the same JavaScript context (tests), driven by a scheduler clock
//    * BroadcastNetwork  - between two tabs of the same browser (BroadcastChannel), offline
//    * PeerNetwork       - real WebRTC through PeerJS (peer-transport.js)
//  The loopback ones can simulate latency, jitter and packet loss (config below), applied to
//  messages sent on the unreliable channel; reliable messages are only delayed (and stay in order).
//
//  Connectors (how a connection is created):
//      network.startHost({ code }, { onready(), onerror(err), onconnection(transport, meta) }) -> { close() }
//      network.connectClient({ code, meta }, { onstatus(text), onopen(transport), onerror(err) }) -> { cancel() }
//  err = { type: 'peer-unavailable' | 'broker' | 'timeout' | 'full' | 'version' | 'id-taken' | 'failed', message }
// ============================================================================

export class Transport {
  constructor() { this.onmessage = null; this.onclose = null; this.open = false; this.closed = false; this.stats = { tx: 0, rx: 0, txBytes: 0, rxBytes: 0 }; }
  send() { return false; }
  close() {}
  _receive(json) {                                    // called by the implementation with a raw JSON string
    if (this.closed) return;
    this.stats.rx++; this.stats.rxBytes += json.length;
    let msg; try { msg = JSON.parse(json); } catch (e) { return; }
    if (this.onmessage) this.onmessage(msg);
  }
  _closed(reason) {
    if (this.closed) return;
    this.closed = true; this.open = false;
    if (this.onclose) this.onclose(reason || 'closed');
  }
}

// Small seeded random generator for reproducible impairment in tests.
export function seededRandom(seed = 1) {
  let a = seed | 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Applies the artificial network conditions to what one side sends.
//   latency (ms one way), jitter (+/- ms), loss (0..1; unreliable messages only, reliable ones get a retransmit delay)
export class SimTransport extends Transport {
  constructor(clock, sendRaw, closeRaw, opts = {}) {
    super();
    this.clock = clock; this.sendRaw = sendRaw; this.closeRaw = closeRaw;
    this.opts = { latency: 0, jitter: 0, loss: 0, rand: Math.random, ...opts };
    this.lastReliableAt = 0;
    this.open = true;
  }
  send(msg, reliable = true) {
    if (!this.open) return false;
    const json = JSON.stringify(msg);
    this.stats.tx++; this.stats.txBytes += json.length;
    const o = this.opts;
    if (o.loss >= 1) return true;                                // a black hole: nothing gets through at all
    let delay = o.latency + (o.jitter ? (o.rand() * 2 - 1) * o.jitter : 0);
    if (delay < 0) delay = 0;
    if (!reliable) {
      if (o.loss > 0 && o.rand() < o.loss) return true;       // dropped
    } else if (o.loss > 0 && o.rand() < o.loss) delay += o.latency * 2 + 40;   // a retransmit costs about an RTT
    let at = this.clock.now() + delay;
    if (reliable) { at = Math.max(at, this.lastReliableAt + 0.001); this.lastReliableAt = at; }   // reliable = ordered
    this.clock.at(at, () => { if (!this.closed) this.sendRaw(json); });
    return true;
  }
  close(reason) {
    if (this.closed) return;
    const lat = this.opts.latency;
    this._closed('local');
    this.clock.at(this.clock.now() + lat, () => this.closeRaw(reason || 'closed'));
  }
}

// ---- in-process loopback network (tests) ----------------------------------------------------------------
export class LoopbackNetwork {
  // opts: { clock, latency, jitter, loss, seed }  (the conditions can be changed later through network.opts)
  constructor(opts) {
    this.clock = opts.clock;
    this.opts = { latency: 0, jitter: 0, loss: 0, seed: 1, ...opts };
    this.rand = seededRandom(this.opts.seed);
    this.hosts = new Map();     // code -> { onconnection, onerror }
  }
  _mk() { const o = this.opts; return { latency: o.latency, jitter: o.jitter, loss: o.loss, rand: this.rand }; }
  startHost({ code }, cb) {
    if (this.hosts.has(code)) { this.clock.at(this.clock.now(), () => cb.onerror && cb.onerror({ type: 'id-taken', message: 'room code already in use' })); return { close() {} }; }
    this.hosts.set(code, cb);
    this.clock.at(this.clock.now(), () => cb.onready && cb.onready());
    return { close: () => { if (this.hosts.get(code) === cb) this.hosts.delete(code); } };
  }
  connectClient({ code, meta }, cb) {
    let cancelled = false;
    const host = this.hosts.get(code), now = this.clock.now(), lat = this.opts.latency;
    if (cb.onstatus) this.clock.at(now, () => cb.onstatus('connecting'));
    if (!host) { this.clock.at(now + lat, () => { if (!cancelled && cb.onerror) cb.onerror({ type: 'peer-unavailable', message: 'no room with that code' }); }); return { cancel() { cancelled = true; } }; }
    this.clock.at(now + lat, () => {
      if (cancelled || this.hosts.get(code) !== host) return;
      let a, b;
      const ca = new SimTransport(this.clock, (json) => b._receive(json), (r) => b._closed(r), this._mk());
      b = new SimTransport(this.clock, (json) => ca._receive(json), (r) => ca._closed(r), this._mk());
      a = ca;
      host.onconnection && host.onconnection(b, meta || {});
      if (cb.onopen) cb.onopen(a);
    });
    return { cancel() { cancelled = true; } };
  }
}

// ---- BroadcastChannel network (two tabs of the same browser, no internet needed) ------------------------------------------
// One shared channel per room code. Messages are addressed to a connection id. Conditions come from the URL
// (?latency=80&jitter=20&loss=2) through opts.
export class BroadcastNetwork {
  constructor(opts = {}) { this.opts = { latency: 0, jitter: 0, loss: 0, ...opts }; this.clock = opts.clock; this.rand = Math.random; }
  _mk() { const o = this.opts; return { latency: o.latency, jitter: o.jitter, loss: o.loss, rand: this.rand }; }
  startHost({ code }, cb) {
    const ch = new BroadcastChannel('rawalan-room-' + code), conns = new Map();
    let taken = false;
    const me = Math.random().toString(36).slice(2);          // so this tab ignores its own probe
    // is the code already used by another host in this browser? ask first.
    const probe = new BroadcastChannel('rawalan-room-' + code);
    probe.onmessage = (e) => { if (e.data && e.data.k === 'here') taken = true; };
    probe.postMessage({ k: 'who', from: me });
    setTimeout(() => {
      probe.close();
      if (taken) { ch.close(); cb.onerror && cb.onerror({ type: 'id-taken', message: 'room code already in use' }); return; }
      cb.onready && cb.onready();
    }, 120);
    ch.onmessage = (e) => {
      const d = e.data; if (!d) return;
      if (d.k === 'who') { if (d.from !== me) ch.postMessage({ k: 'here' }); return; }
      if (d.k === 'join') {
        const cid = d.cid;
        const t = new SimTransport(this.clock, () => {}, () => {}, this._mk());
        t.sendRaw = (json) => ch.postMessage({ k: 'msg', to: cid, from: 'host', json });
        t.closeRaw = (r) => ch.postMessage({ k: 'close', to: cid, from: 'host', reason: r });
        conns.set(cid, t);
        ch.postMessage({ k: 'joined', to: cid });
        cb.onconnection && cb.onconnection(t, d.meta || {});
      } else if (d.to === 'host' && conns.has(d.cid)) {
        const t = conns.get(d.cid);
        if (d.k === 'msg') t._receive(d.json); else if (d.k === 'close') { t._closed(d.reason); conns.delete(d.cid); }
      }
    };
    return { close: () => { for (const t of conns.values()) t.close('host closed'); ch.close(); } };
  }
  connectClient({ code, meta }, cb) {
    const ch = new BroadcastChannel('rawalan-room-' + code), cid = Math.random().toString(36).slice(2, 10);
    let done = false, timer;
    cb.onstatus && cb.onstatus('connecting');
    ch.onmessage = (e) => {
      const d = e.data; if (!d) return;
      if (d.k === 'joined' && d.to === cid && !done) {
        done = true; clearTimeout(timer);
        const t = new SimTransport(this.clock, () => {}, () => {}, this._mk());
        t.sendRaw = (json) => ch.postMessage({ k: 'msg', to: 'host', cid, json });
        t.closeRaw = (r) => { ch.postMessage({ k: 'close', to: 'host', cid, reason: r }); };
        const origClose = t.close.bind(t);
        t.close = (r) => { origClose(r); setTimeout(() => ch.close(), 200); };
        this.__t = t;
        cb.onopen && cb.onopen(t);
      } else if (d.to === cid && d.k === 'msg' && this.__t) this.__t._receive(d.json);
      else if (d.to === cid && d.k === 'close' && this.__t) this.__t._closed(d.reason);
    };
    ch.postMessage({ k: 'join', cid, meta });
    timer = setTimeout(() => { if (!done) { ch.close(); cb.onerror && cb.onerror({ type: 'peer-unavailable', message: 'no room with that code (in this browser)' }); } }, 1500);
    return { cancel() { done = true; clearTimeout(timer); ch.close(); } };
  }
}

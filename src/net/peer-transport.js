// ============================================================================
//  peer-transport.js - the real thing: WebRTC data channels through PeerJS (vendor/peerjs.min.js,
//  loaded as a classic script that defines window.Peer). The public PeerJS broker only does the
//  signalling (finding each other); the game data then flows peer to peer. Public STUN servers
//  only - there is no TURN server, so two strict NATs cannot connect (the lobby says so).
//
//  Channels: the PeerJS data connection is RELIABLE and ordered (handshake, events, intents, pings). On top of it both
//  sides create a second RTCDataChannel on the same RTCPeerConnection with { ordered: false, maxRetransmits: 0 } (a truly
//  unreliable channel: a lost snapshot or input frame is NOT retransmitted, so one lost packet never delays the ones behind it),
//  negotiated with a fixed id so no renegotiation is needed. Snapshots and inputs use it as soon as both sides have proven it
//  works (a tiny probe in each direction); if it has not come up after config.net.unreliableTimeout seconds (or the browser
//  refuses) everything simply uses the reliable one. (PeerJS 1.5 reliable:false is only unordered, it still retransmits.)
//  Strings only (serialization 'raw'): the Transport layer already JSON-encodes messages.
// ============================================================================
import { CONFIG } from '../config.js';
import { Transport } from './transport.js';
import { peerIdForCode } from './room-code.js';

function PeerClass() { return (typeof window !== 'undefined' && window.Peer) || null; }
function peerOptions() { return { debug: 0, config: { iceServers: CONFIG.net.stun.map((urls) => ({ urls })) } }; }

// Can this network reach the matchmaking server? (the lobby's connection test) -> Promise<{ ok, ms, error }>
export function probeBroker(timeoutMs) {
  return new Promise((resolve) => {
    const Peer = PeerClass(); if (!Peer) { resolve({ ok: false, error: 'PeerJS did not load' }); return; }
    const t0 = performance.now(); let peer = null, done = false;
    const fin = (r) => { if (done) return; done = true; clearTimeout(tm); try { peer && peer.destroy(); } catch (e) { /* ignore */ } resolve(r); };
    const tm = setTimeout(() => fin({ ok: false, error: 'no answer after ' + Math.round(timeoutMs / 1000) + ' s' }), timeoutMs);
    try { peer = new Peer(undefined, peerOptions()); } catch (e) { fin({ ok: false, error: String(e) }); return; }
    peer.on('open', () => fin({ ok: true, ms: Math.round(performance.now() - t0) }));
    peer.on('error', (e) => fin({ ok: false, error: e && e.type }));
  });
}

export class PeerTransport extends Transport {
  constructor(reliableConn, peerToDestroy) {
    super();
    this.r = reliableConn; this.u = null; this.peer = peerToDestroy || null;
    this.open = true; this.usingUnreliable = false; this.uReady = false; this.path = null; this.channel = 'reliable only';
    reliableConn.on('data', (d) => { if (typeof d === 'string') this._receive(d); });
    reliableConn.on('close', () => this._closed('closed'));
    reliableConn.on('error', () => this._closed('error'));
    const watchIce = () => {
      const pc = reliableConn.peerConnection;
      if (!pc) return;
      pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed') this._closed('ice-failed'); });
    };
    watchIce(); setTimeout(watchIce, 500);
  }
  // The truly unreliable channel (see the header). Called by both sides once the PeerJS connection is open.
  setupUnreliable() {
    const pc = this.r.peerConnection;
    if (!pc || !pc.createDataChannel) return;
    let ch; try { ch = pc.createDataChannel('rab-fast', { ordered: false, maxRetransmits: 0, negotiated: true, id: 11 }); } catch (e) { return; }
    this.u = ch;
    ch.onmessage = (ev) => {
      const d = ev.data; if (typeof d !== 'string') return;
      if (d === 'U?') { try { ch.send('U!'); } catch (e) { /* ignore */ } this._ready(); return; }    // the other side probes: it exists, answer
      if (d === 'U!') { this._ready(); return; }
      this._receive(d);
    };
    ch.onclose = () => { if (this.u === ch) { this.uReady = false; this.usingUnreliable = false; this.channel = 'reliable only'; } };
    const iv = setInterval(() => {
      if (this.uReady || this.closed || ch.readyState === 'closed') { clearInterval(iv); return; }
      try { if (ch.readyState === 'open') ch.send('U?'); } catch (e) { /* ignore */ }
    }, 120);
    setTimeout(() => clearInterval(iv), CONFIG.net.unreliableTimeout * 1000);
  }
  _ready() { this.uReady = true; this.usingUnreliable = true; this.channel = 'unreliable (maxRetransmits 0)'; }
  send(msg, reliable = true) {
    if (!this.open) return false;
    const json = JSON.stringify(msg);
    const useU = !reliable && this.uReady && this.u && this.u.readyState === 'open';
    try { (useU ? this.u : this.r).send(json); } catch (e) { return false; }
    this.stats.tx++; this.stats.txBytes += json.length;
    return true;
  }
  // Which path the connection really takes: direct (host / server-reflexive candidates) or relayed, from getStats().
  async probePath() {
    const pc = this.r.peerConnection; if (!pc || !pc.getStats) return null;
    try {
      const stats = await pc.getStats(); let pair = null, selId = null;
      stats.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) selId = r.selectedCandidatePairId; });
      stats.forEach((r) => { if (r.type === 'candidate-pair' && ((selId && r.id === selId) || (!selId && r.nominated && r.state === 'succeeded'))) pair = r; });
      if (!pair) return null;
      const lo = stats.get(pair.localCandidateId), re = stats.get(pair.remoteCandidateId);
      this.path = { kind: lo && re && (lo.candidateType === 'relay' || re.candidateType === 'relay') ? 'relayed' : 'direct', local: lo ? lo.candidateType : '?', remote: re ? re.candidateType : '?', protocol: lo ? lo.protocol : '?', rtt: typeof pair.currentRoundTripTime === 'number' ? Math.round(pair.currentRoundTripTime * 1000) : null };
      return this.path;
    } catch (e) { return null; }
  }
  close() {
    if (this.closed) return;
    this._closed('local');
    try { if (this.u) this.u.close(); } catch (e) { /* ignore */ }
    clearInterval(this._pathTimer);
    try { this.r.close(); } catch (e) { /* ignore */ }
    if (this.peer) { const p = this.peer; setTimeout(() => { try { p.destroy(); } catch (e) { /* ignore */ } }, 300); }
  }
}

export class PeerNetwork {
  constructor(opts = {}) { this.opts = opts; }

  // Host: register the room code on the broker and wait for connections.
  startHost({ code }, cb) {
    const Peer = PeerClass();
    if (!Peer) { setTimeout(() => cb.onerror && cb.onerror({ type: 'broker', message: 'PeerJS did not load (vendor/peerjs.min.js).' }), 0); return { close() {} }; }
    let peer, ready = false, dead = false;
    const brokerTimer = setTimeout(() => { if (!ready && !dead) { dead = true; try { peer.destroy(); } catch (e) { /* ignore */ } cb.onerror && cb.onerror({ type: 'broker', message: 'The PeerJS broker did not answer.' }); } }, CONFIG.net.brokerTimeout * 1000);
    try { peer = new Peer(peerIdForCode(code), peerOptions()); } catch (e) { clearTimeout(brokerTimer); setTimeout(() => cb.onerror && cb.onerror({ type: 'broker', message: String(e) }), 0); return { close() {} }; }
    peer.on('open', () => { ready = true; clearTimeout(brokerTimer); cb.onready && cb.onready(); });
    peer.on('error', (err) => {
      if (dead) return;
      if (err.type === 'unavailable-id') { dead = true; clearTimeout(brokerTimer); cb.onerror && cb.onerror({ type: 'id-taken', message: 'That room code is already in use.' }); return; }
      if (!ready) { dead = true; clearTimeout(brokerTimer); cb.onerror && cb.onerror({ type: 'broker', message: 'Could not reach the PeerJS broker (' + err.type + ').' }); }
      // errors after the room is open (a failed client connection attempt, ...) are not fatal
    });
    peer.on('disconnected', () => { if (!dead) { try { peer.reconnect(); } catch (e) { /* ignore */ } } });   // keep the room listed while a match runs
    peer.on('connection', (conn) => {
      const md = conn.metadata || {};
      if (md.chan === 'u') { conn.on('open', () => conn.close()); return; }     // (an older client second connection: not used any more)
      conn.on('open', () => {
        const t = new PeerTransport(conn, null);
        t.setupUnreliable(); t._pathTimer = setInterval(() => t.probePath(), 4000); setTimeout(() => t.probePath(), 800);
        cb.onconnection && cb.onconnection(t, md);
      });
    });
    return { close: () => { dead = true; clearTimeout(brokerTimer); try { peer.destroy(); } catch (e) { /* ignore */ } } };
  }

  // Client: reach the broker, connect to the host's id, report clear errors.
  connectClient({ code, meta }, cb) {
    const Peer = PeerClass();
    if (!Peer) { setTimeout(() => cb.onerror && cb.onerror({ type: 'broker', message: 'PeerJS did not load (vendor/peerjs.min.js).' }), 0); return { cancel() {} }; }
    let peer, finished = false, brokerOpen = false, transport = null;
    const link = Math.random().toString(36).slice(2, 10);
    const fail = (err) => { if (finished) return; finished = true; clearTimeout(brokerTimer); clearTimeout(connTimer); try { peer.destroy(); } catch (e) { /* ignore */ } cb.onerror && cb.onerror(err); };
    const brokerTimer = setTimeout(() => { if (!brokerOpen) fail({ type: 'broker', message: 'The PeerJS broker did not answer.' }); }, CONFIG.net.brokerTimeout * 1000);
    let connTimer = null;
    try { peer = new Peer(undefined, peerOptions()); } catch (e) { clearTimeout(brokerTimer); setTimeout(() => cb.onerror && cb.onerror({ type: 'broker', message: String(e) }), 0); return { cancel() {} }; }
    cb.onstatus && cb.onstatus('reaching the broker');
    peer.on('error', (err) => {
      if (finished) return;
      if (err.type === 'peer-unavailable') fail({ type: 'peer-unavailable', message: 'No room with that code.' });
      else if (!brokerOpen) fail({ type: 'broker', message: 'Could not reach the PeerJS broker (' + err.type + ').' });
      else if (!transport) fail({ type: 'failed', message: 'Connection failed (' + err.type + ').' });
    });
    peer.on('open', () => {
      brokerOpen = true; clearTimeout(brokerTimer);
      cb.onstatus && cb.onstatus('connecting to the host');
      const conn = peer.connect(peerIdForCode(code), { reliable: true, serialization: 'raw', metadata: { chan: 'r', link, ...(meta || {}) } });
      connTimer = setTimeout(() => fail({ type: 'failed', message: 'Connection failed.' }), CONFIG.net.connectTimeout * 1000);
      conn.on('open', () => {
        if (finished) return;
        clearTimeout(connTimer); finished = true;
        transport = new PeerTransport(conn, peer);
        transport.setupUnreliable(); transport._pathTimer = setInterval(() => transport.probePath(), 4000); setTimeout(() => transport.probePath(), 800);
        cb.onopen && cb.onopen(transport);
      });
      conn.on('error', () => { if (!finished) fail({ type: 'failed', message: 'Connection failed.' }); });
      conn.on('close', () => { if (!finished) fail({ type: 'failed', message: 'Connection failed.' }); });
    });
    return { cancel: () => { if (!finished) { finished = true; clearTimeout(brokerTimer); clearTimeout(connTimer); try { peer.destroy(); } catch (e) { /* ignore */ } } } };
  }
}

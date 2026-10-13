// ============================================================================
//  peer-transport.js - the real thing: WebRTC data channels through PeerJS (vendor/peerjs.min.js,
//  loaded as a classic script that defines window.Peer). The public PeerJS broker only does the
//  signalling (finding each other); the game data then flows peer to peer. Public STUN servers
//  only - there is no TURN server, so two strict NATs cannot connect (the lobby says so).
//
//  Channels: every client opens a RELIABLE data connection (handshake, events, intents, pings) and
//  then tries a second, UNORDERED one for snapshots and inputs. If that one has not opened after
//  config.net.unreliableTimeout seconds everything simply uses the reliable one.
//  Strings only (serialization 'raw'): the Transport layer already JSON-encodes messages.
// ============================================================================
import { CONFIG } from '../config.js';
import { Transport } from './transport.js';
import { peerIdForCode } from './room-code.js';

function PeerClass() { return (typeof window !== 'undefined' && window.Peer) || null; }
function peerOptions() { return { debug: 0, config: { iceServers: CONFIG.net.stun.map((urls) => ({ urls })) } }; }

export class PeerTransport extends Transport {
  constructor(reliableConn, peerToDestroy) {
    super();
    this.r = reliableConn; this.u = null; this.peer = peerToDestroy || null;
    this.open = true; this.usingUnreliable = false;
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
  attachUnreliable(conn) {
    this.u = conn;
    conn.on('data', (d) => { if (typeof d === 'string') this._receive(d); });
    conn.on('close', () => { this.u = null; this.usingUnreliable = false; });
    this.usingUnreliable = true;
  }
  send(msg, reliable = true) {
    if (!this.open) return false;
    const json = JSON.stringify(msg);
    const ch = !reliable && this.u && this.u.open ? this.u : this.r;
    try { ch.send(json); } catch (e) { return false; }
    this.stats.tx++; this.stats.txBytes += json.length;
    return true;
  }
  close() {
    if (this.closed) return;
    this._closed('local');
    try { if (this.u) this.u.close(); } catch (e) { /* ignore */ }
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
    const links = new Map();           // link id -> PeerTransport
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
      if (md.chan === 'u') {
        conn.on('open', () => { const t = links.get(md.link); if (t && !t.closed) t.attachUnreliable(conn); else conn.close(); });
        return;
      }
      conn.on('open', () => {
        const t = new PeerTransport(conn, null);
        if (md.link) { links.set(md.link, t); t.onclose = () => {}; }
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
        cb.onopen && cb.onopen(transport);
        // second, unordered channel for snapshots and inputs (optional)
        const u = peer.connect(peerIdForCode(code), { reliable: false, serialization: 'raw', metadata: { chan: 'u', link } });
        const ut = setTimeout(() => { if (!u.open) { try { u.close(); } catch (e) { /* ignore */ } } }, CONFIG.net.unreliableTimeout * 1000);
        u.on('open', () => { clearTimeout(ut); if (transport && !transport.closed) transport.attachUnreliable(u); });
      });
      conn.on('error', () => { if (!finished) fail({ type: 'failed', message: 'Connection failed.' }); });
      conn.on('close', () => { if (!finished) fail({ type: 'failed', message: 'Connection failed.' }); });
    });
    return { cancel: () => { if (!finished) { finished = true; clearTimeout(brokerTimer); clearTimeout(connTimer); try { peer.destroy(); } catch (e) { /* ignore */ } } } };
  }
}

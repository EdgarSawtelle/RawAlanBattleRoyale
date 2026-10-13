// ============================================================================
//  connect.js - the glue the lobby uses: pick a network (real PeerJS or the offline BroadcastChannel
//  loopback), create a room as host, join a room as client, and turn error types into plain words.
// ============================================================================
import { CONFIG } from '../config.js';
import { realClock } from './scheduler.js';
import { BroadcastNetwork } from './transport.js';
import { PeerNetwork } from './peer-transport.js';
import { HostSession } from './host-session.js';
import { GuestSession } from './guest-session.js';
import { TickTimer } from './tick-timer.js';
import { makeRoomCode } from './room-code.js';

// ?local=1 uses the BroadcastChannel loopback (two tabs of the same browser, no internet). The
// artificial network conditions come from ?latency=80&jitter=20&loss=2 (milliseconds, milliseconds, percent).
export function chooseNetwork(params) {
  const clock = realClock();
  const cond = { latency: Number(params.get('latency')) || 0, jitter: Number(params.get('jitter')) || 0, loss: (Number(params.get('loss')) || 0) / 100 };
  if (params.get('local') === '1') return { kind: 'local', clock, network: new BroadcastNetwork({ clock, ...cond }) };
  return { kind: 'peer', clock, network: new PeerNetwork({ clock }) };
}

// Plain-language text for an error (what the lobby shows).
export function describeError(err) {
  switch (err && err.type) {
    case 'peer-unavailable': return 'Room not found. Check the code and make sure the host still has the game open.';
    case 'broker': return 'Cannot reach the matchmaking server (PeerJS). Check your internet connection and try again in a moment.';
    case 'failed': case 'timeout': return 'Connection failed. This usually means a strict network or firewall (NAT) is blocking direct connections. Try another network, for example a phone hotspot.';
    case 'id-taken': return 'That room code is already in use. Try again.';
    case 'full': return 'That room is full.';
    case 'version': return 'The host runs a different version of the game. Refresh the page and try again.';
    default: return (err && err.message) || 'Something went wrong.';
  }
}

// Host: make a room. cb: { onReady(code), onError(err), onStatus(status, text), onEnded(reason) }
export function createRoom(net, { name, getLocalInput, seed, mapId, mapLock }, cb) {
  const { network, clock } = net;
  const host = new HostSession({ clock, name, seed, mapId, mapLock, getLocalInput, onStatus: cb.onStatus, onEnded: cb.onEnded });
  const timer = new TickTimer(() => host.advance(clock.now()));
  let listener = null, tries = 0, code = null, closed = false;
  const attempt = () => {
    code = makeRoomCode();
    listener = network.startHost({ code }, {
      onready: () => { if (closed) return; timer.start(); cb.onReady(code); },
      onerror: (err) => { if (err.type === 'id-taken' && ++tries < 6 && !closed) attempt(); else if (!closed) cb.onError(err); },
      onconnection: (tr, meta) => { if (!closed) host.attach(tr); },
    });
  };
  attempt();
  return {
    host, timer, get code() { return code; },
    close() { closed = true; timer.stop(); if (listener) listener.close(); host.leave(); },
  };
}

// Client: join a room. cb: { onError(err), onStatus(status, text), onEnded(reason) }
export function joinRoom(net, { code, name, token, getLocalInput }, cb) {
  const { network, clock } = net;
  const guest = new GuestSession({
    clock, name, code, token, getLocalInput,
    reconnect: (rcb) => network.connectClient({ code, meta: {} }, rcb),
    onStatus: cb.onStatus, onEnded: (r) => { timer.stop(); cb.onEnded(r); },
  });
  const timer = new TickTimer(() => guest.netTick(clock.now()));
  const conn = network.connectClient({ code, meta: {} }, {
    onstatus: (t) => cb.onStatus && cb.onStatus('connecting', t),
    onopen: (tr) => { timer.start(); guest.attach(tr); },
    onerror: (err) => cb.onError(err),
  });
  return { guest, cancel() { conn.cancel(); timer.stop(); guest.leave(); }, close() { timer.stop(); guest.leave(); } };
}

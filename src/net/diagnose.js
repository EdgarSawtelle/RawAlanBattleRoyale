// ============================================================================
//  diagnose.js - the lobby's "Connection test": which step of getting two browsers talking fails on THIS network, in plain words.
//    1. does the browser have WebRTC at all
//    2. can it reach the matchmaking server (the public PeerJS cloud: only used for the handshake)
//    3. does peer-to-peer traffic get out (STUN over UDP: asks a public server which address the network shows to the outside)
//       and does the router give out one public port for everything, or a new one per destination (a "strict" NAT)
//  The parsing and the verdict are pure functions (tests call them); the runner needs a browser.
// ============================================================================
import { CONFIG } from '../config.js';

// Candidate lines ("candidate:842 1 udp 1677729535 203.0.113.5 54321 typ srflx raddr ...") -> counts and the public ports seen.
export function classifyCandidates(lines) {
  const out = { host: 0, srflx: 0, relay: 0, ports: [], bySocket: {} };
  for (const c of lines || []) {
    const m = /\btyp (host|srflx|prflx|relay)\b/.exec(c || ''); if (!m) continue;
    const kind = m[1] === 'prflx' ? 'srflx' : m[1];
    out[kind]++;
    if (kind === 'srflx') {
      const f = c.split(' '), pub = f[4] + ':' + f[5], ri = f.indexOf('raddr'), pi = f.indexOf('rport'), sock = ri > 0 && pi > 0 ? f[ri + 1] + ':' + f[pi + 1] : 'any';   // (raddr / rport = the local socket that was asked)
      out.ports.push(pub); (out.bySocket[sock] = out.bySocket[sock] || new Set()).add(pub);
    }
  }
  return out;
}

// A strict (symmetric) NAT: the SAME local socket shows up with a different public port for each STUN server it asked.
export function isStrictNat(ice) {
  return Object.values((ice && ice.bySocket) || {}).some((set) => { const byIp = {}; for (const p of set) { const i = p.lastIndexOf(':'); (byIp[p.slice(0, i)] = byIp[p.slice(0, i)] || new Set()).add(p.slice(i + 1)); } return Object.values(byIp).some((ports) => ports.size > 1); });
}

// What it all means. steps = { webrtc: bool, broker: { ok, ms, error }, ice: classifyCandidates() result | null }
export function verdictFor(steps) {
  const hotspot = 'Try a phone hotspot or your home network, or ask your friend to host.';
  if (!steps.webrtc) return { level: 'bad', headline: 'This browser cannot do peer-to-peer connections (no WebRTC).', advice: 'Use a recent Chrome, Edge, Firefox or Safari.' };
  if (!steps.broker || !steps.broker.ok) return { level: 'bad', headline: 'The matchmaking server cannot be reached from this network.', advice: 'Work and school networks often block it. ' + hotspot };
  const ice = steps.ice;
  if (!ice || ice.srflx === 0) return { level: 'bad', headline: 'Peer-to-peer traffic (UDP) looks blocked by this network.', advice: 'Players on this network usually cannot connect to anyone. ' + hotspot };
  if (isStrictNat(ice)) return { level: 'warn', headline: 'Your router uses a strict NAT (a different public port for every destination).', advice: 'Connecting works with most players but can fail when the other side is strict too. If it fails: ' + hotspot };
  return { level: 'good', headline: 'This network looks fine for peer-to-peer play.', advice: 'If joining still fails, the other side\'s network is the problem: ask them to run this test too.' };
}

// "Gather candidates" with a throwaway RTCPeerConnection; resolves with the candidate lines (never rejects).
export function gatherCandidates(RTC, urls, ms) {
  return new Promise((resolve) => {
    const cands = []; let pc = null, finished = false, timer = null;
    const done = (error) => { if (finished) return; finished = true; clearTimeout(timer); try { pc && pc.close(); } catch (e) { /* ignore */ } resolve({ cands, error: error || null }); };
    try { pc = new RTC({ iceServers: urls.map((u) => ({ urls: u })) }); pc.createDataChannel('probe'); } catch (e) { done(String(e)); return; }
    pc.onicecandidate = (ev) => { if (!ev.candidate) done(); else cands.push(ev.candidate.candidate); };
    timer = setTimeout(() => done(), ms);
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch((e) => done(String(e)));
  });
}

// Runs the three steps. probeBroker(ms) -> Promise<{ ok, ms, error }> comes from the peer transport. onStep(step) after each one.
export async function runConnectionTest({ probeBroker, onStep = () => {}, RTC = (typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection : null) } = {}) {
  const steps = { webrtc: !!RTC, broker: null, ice: null }, lines = [];
  const add = (ok, text) => { const l = { ok, text }; lines.push(l); onStep(l); };
  add(steps.webrtc, steps.webrtc ? 'Browser: WebRTC is available' : 'Browser: no WebRTC');
  if (steps.webrtc) {
    steps.broker = await probeBroker(CONFIG.net.brokerTimeout * 1000);
    add(steps.broker.ok, steps.broker.ok ? 'Matchmaking server: reachable (' + steps.broker.ms + ' ms)' : 'Matchmaking server: NOT reachable' + (steps.broker.error ? ' (' + steps.broker.error + ')' : ''));
    const g = await gatherCandidates(RTC, CONFIG.net.stun, 4500);
    steps.ice = classifyCandidates(g.cands);
    add(steps.ice.srflx > 0, steps.ice.srflx > 0
      ? 'Peer-to-peer (STUN): works, your public address was found' + (isStrictNat(steps.ice) ? ' (a different public port per destination: strict NAT)' : '')
      : 'Peer-to-peer (STUN): no answer from the public STUN servers' + (g.error ? ' (' + g.error + ')' : ' (UDP is probably blocked)'));
  }
  const verdict = verdictFor(steps);
  const report = ['RawAlanBattleRoyale connection test', ...lines.map((l) => (l.ok ? '[ok]   ' : '[FAIL] ') + l.text), 'Result: ' + verdict.headline, verdict.advice].join('\n');
  return { steps, lines, verdict, report };
}

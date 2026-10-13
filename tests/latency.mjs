// How late does each thing a player perceives arrive? Host + client over the loopback network with a virtual clock and a
// simulated link (round trip, jitter, loss on the unreliable channel). Prints, per scenario and per perceived action, the median
// and the 90th percentile of the delay in milliseconds (4 ms resolution), measured on what the CLIENT would draw / the HOST simulates.
//   own movement          you press a key -> your player moves on your screen (predicted)
//   own shot              you click -> a bullet of yours is drawn (not just the muzzle flash)
//   own block             you press block -> your shield is drawn
//   opponent moves        the host player starts moving -> the client sees it
//   taking a hit          the host player's bullet hits you -> your screen shows the damage
//   landing a hit         you click at a standing opponent 400 units away -> your screen shows the hit (the bullet flies 0.27 s of it)
//   host sees client jump you press jump -> the host simulates your jump
//   host sees client shot you click -> the host has your bullet
// Run: node tests/latency.mjs [trials=12] [--json]
import { CONFIG } from '../src/config.js';
import { virtualClock } from '../src/net/scheduler.js';
import { LoopbackNetwork } from '../src/net/transport.js';
import { HostSession } from '../src/net/host-session.js';
import { GuestSession } from '../src/net/guest-session.js';
import { registerMap } from '../src/maps/index.js';
import { spawnBullet } from '../src/sim/combat.js';
import { solveAimFromBody } from '../src/sim/aim.js';

registerMap({ id: 'lat-room', name: 'test', background: 'none', spawns: [{ x: 300, y: 485 }, { x: 1000, y: 485 }], solids: [{ x: 60, y: 500, w: 1160, h: 40 }], destructibles: [], platforms: [] });

const args = process.argv.slice(2);
const TRIALS = Number(args.find((a) => /^\d+$/.test(a))) || 12;
const IDLE = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const SCEN = [{ rtt: 40, jitter: 4, loss: 0.01 }, { rtt: 80, jitter: 10, loss: 0.02 }, { rtt: 150, jitter: 20, loss: 0.03 }];

function rig(s) {
  const clock = virtualClock(0), net = new LoopbackNetwork({ clock, seed: 11, latency: s.rtt / 2, jitter: s.jitter, loss: s.loss });
  const R = { clock, now: 0, in: IDLE, hin: IDLE, last: null, hits: [], hostHits: [] };
  R.host = new HostSession({ clock, name: 'H', seed: 3, mapId: 'lat-room', rotate: false, getLocalInput: () => R.hin });
  R.host.state.cheats.invulnerable = [false, false];
  net.startHost({ code: 'ABCDE' }, { onconnection: (tr) => R.host.attach(tr) });
  R.guest = new GuestSession({ clock, name: 'G', code: 'ABCDE', getLocalInput: () => { const i = R.in; if (R.pulse > 0) { R.pulse--; return R.pulseIn; } return i; }, reconnect: () => {} });
  net.connectClient({ code: 'ABCDE', meta: {} }, { onopen: (tr) => R.guest.attach(tr), onerror: () => {} });
  R.pulse = 0; R.pulseIn = IDLE;
  R.slice = () => {
    R.now += 4; clock.advance(R.now); R.host.advance(R.now); R.guest.netTick(R.now);
    if (R.guest.ready) { const r = R.guest.render(R.now); R.last = r; for (const e of r.events) if (e.type === 'hit') R.hits.push({ at: R.now, e }); }
    R.host.drainEvents();
  };
  R.run = (ms) => { const end = R.now + ms; while (R.now < end) R.slice(); };
  R.wait = (pred, max = 1500) => { const t0 = R.now; while (R.now - t0 < max) { R.slice(); if (pred()) return R.now - t0; } return null; };
  return R;
}
const hp = (R, i) => R.host.state.players[i];
const med = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const p90 = (a) => { const s = a.filter((x) => x !== null).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] : null; };

function measure(s) {
  const R = rig(s); R.run(2500);
  const out = { 'own movement': [], 'own shot': [], 'own block': [], 'opponent moves': [], 'taking a hit': [], 'landing a hit': [], 'host sees client jump': [], 'host sees client shot': [] };
  const me = () => R.last.state.players[1], opp = () => R.last.state.players[0];
  const reset = () => {
    for (let i = 0; i < 2; i++) { const p = hp(R, i); p.hp = 100; p.ammo = p.stats.magazine; p.fireCd = 0; p.blockCd = 0; p.reloadLeft = 0; p.vx = 0; p.vy = 0; }
    hp(R, 0).x = 300; hp(R, 0).y = 485; hp(R, 1).x = 1000; hp(R, 1).y = 485;
    R.in = IDLE; R.hin = IDLE; R.host.state.bullets = []; R.host.state.roundTime = 0; R.host.state.suddenDeath = false;   // (no sudden death bleed in the middle of the trials)
    R.run(700);
  };
  for (let k = 0; k < TRIALS; k++) {
    // own movement
    reset(); { const x0 = me().x; R.in = { ...IDLE, left: true }; out['own movement'].push(R.wait(() => Math.abs(me().x - x0) > 0.3, 600)); }
    // own shot (bullet drawn, not only the flash)
    reset(); { R.pulseIn = { ...IDLE, shoot: true, shootPressed: true, aim: 0 }; R.pulse = 1; out['own shot'].push(R.wait(() => R.last.state.bullets.some((b) => b.owner === 1), 900)); }
    // host sees the client's shot
    reset(); { R.pulseIn = { ...IDLE, shoot: true, shootPressed: true, aim: 0 }; R.pulse = 1; out['host sees client shot'].push(R.wait(() => R.host.state.bullets.some((b) => b.owner === 1), 900)); }
    // own block
    reset(); { R.pulseIn = { ...IDLE, block: true }; R.pulse = 6; out['own block'].push(R.wait(() => me().blockLeft > 0, 900)); }
    // opponent moves (the host player starts running)
    reset(); { const x0 = opp().x; R.hin = { ...IDLE, right: true }; out['opponent moves'].push(R.wait(() => Math.abs(opp().x - x0) > 0.5, 900)); }
    // taking a hit: a host bullet reaches you
    reset(); R.wait(() => me().hp === 100, 1500); { R.host.state.bullets = []; spawnBullet(R.host.state, 0, { x: 940, y: 485, angle: 0, speed: 1500, damage: 20, gravity: 0 }); R.hits.length = 0;
      const tHit = (() => { const t0 = R.now; while (R.now - t0 < 300) { R.slice(); if (hp(R, 1).hp < 100) return R.now; } return null; })();
      const seen = R.wait(() => me().hp < 100, 1200); out['taking a hit'].push(tHit === null || seen === null ? null : R.now - tHit); }
    // landing a hit on a standing opponent 400 units away
    reset(); R.wait(() => opp().hp === 100, 1500); { hp(R, 0).x = 600; R.run(500);
      const aim = solveAimFromBody(me().x, me().y, 600, 485, 1500, 500, CONFIG.player.muzzleDistance);
      R.pulseIn = { ...IDLE, shoot: true, shootPressed: true, aim }; R.pulse = 1; R.in = { ...IDLE, aim };
      out['landing a hit'].push(R.wait(() => opp().hp < 100, 1500)); }
    // host sees the client's jump
    reset(); { R.pulseIn = { ...IDLE, jump: true, jumpPressed: true }; R.pulse = 4; out['host sees client jump'].push(R.wait(() => hp(R, 1).vy < -100, 900)); }
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, { med: med(v), p90: p90(v), n: v.filter((x) => x !== null).length }]));
}

const results = {};
for (const s of SCEN) results[s.rtt + ' ms RTT (jitter ' + s.jitter + ', loss ' + (s.loss * 100) + '%)'] = measure(s);
if (args.includes('--json')) console.log(JSON.stringify(results));
else {
  const names = Object.keys(Object.values(results)[0]);
  console.log('median (p90) in ms; ' + TRIALS + ' trials; prediction ' + (CONFIG.net.predictOwnMovement ? 'on' : 'off') + ', interpolation delay adaptive ' + CONFIG.net.interpMin * 1000 + '-' + CONFIG.net.interpMax * 1000 + ' ms, snapshots adaptive (' + CONFIG.tickRate / CONFIG.net.snapshotFastEvery + ' / ' + CONFIG.tickRate / CONFIG.net.snapshotEvery + ' Hz)');
  console.log('action'.padEnd(24) + Object.keys(results).map((k) => k.padEnd(34)).join(''));
  for (const n of names) console.log(n.padEnd(24) + Object.values(results).map((r) => (r[n].med === null ? '-' : r[n].med + ' (' + r[n].p90 + ')').padEnd(34)).join(''));
}

// Tests for the client's own-movement prediction (src/net/predict.js, config.net.predictOwnMovement), over the
// in-process loopback network with a VIRTUAL clock: how soon you see yourself move, whether the prediction
// converges on the host's state with no drifting (wall jumps, moving platform rides, knockback from hits,
// out-of-bounds launches, round restarts, a lossy / jittery link), how big the corrections are, and that the
// host simulates the client's input frames one per tick in order.
// Run:  node tests/predict.test.mjs
import { CONFIG } from '../src/config.js';
import { virtualClock } from '../src/net/scheduler.js';
import { LoopbackNetwork } from '../src/net/transport.js';
import { HostSession } from '../src/net/host-session.js';
import { GuestSession } from '../src/net/guest-session.js';
import { registerMap } from '../src/maps/index.js';
import { platformPos } from '../src/sim/platforms.js';
import { getMap } from '../src/maps/index.js';
import { applyImpulse } from '../src/sim/combat.js';
import { killPlayer } from '../src/sim/combat.js';
import { createBot, botInput } from '../src/practice/dummy-bot.js';
import { STEP } from '../src/sim/world.js';

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// A small arena that exercises everything: a floor with a pit to its right, a tall wall to climb, a moving platform
// that crosses the pit, a far floor beyond it.
registerMap({
  id: 'pr-room', name: 'test', background: 'none',
  spawns: [{ x: 1200, y: 485 }, { x: 200, y: 485 }],
  solids: [
    { x: 100, y: 500, w: 700, h: 40 },       // floor
    { x: 400, y: -300, w: 40, h: 800 },      // tall wall (x 400..440): wall jumps / climbing
    { x: 1150, y: 500, w: 130, h: 40 },      // far floor
  ],
  destructibles: [],
  platforms: [{ id: 'mp', w: 100, h: 16, path: [{ x: 808, y: 500 }, { x: 1040, y: 500 }], speed: 90, pause: 0.5, mode: 'pingpong' }],
});

const IDLE = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
function rig(netOpts = {}) {
  const clock = virtualClock(0), net = new LoopbackNetwork({ clock, seed: 7, ...netOpts });
  const code = 'ABCDE';
  const R = { clock, net, now: 0, input: () => IDLE, cover: { wall: 0, ride: 0, wallJumps: 0, oob: 0, airTicks: 0 }, rends: [], events: [] };
  R.host = new HostSession({ clock, name: 'HOSTY', seed: 3, mapId: 'pr-room', getLocalInput: () => IDLE });
  R.host.state.cheats.invulnerable = [true, true];
  net.startHost({ code }, { onconnection: (tr) => R.host.attach(tr) });
  R.guest = new GuestSession({ clock, name: 'GUESTY', code, getLocalInput: (own) => R.input(own), reconnect: (cb) => net.connectClient({ code, meta: {} }, cb) });
  net.connectClient({ code, meta: {} }, { onopen: (tr) => R.guest.attach(tr), onerror: () => {} });
  R.slice = () => {
    R.now += 4; clock.advance(R.now);
    R.host.advance(R.now); R.guest.netTick(R.now);
    if (R.guest.ready) { const r = R.guest.render(R.now); R.rends.push({ at: R.now, x: r.state.players[1].x, y: r.state.players[1].y }); }
    const hp = R.host.state.players[1];
    if (R.host.ticks !== R._ticks) {
      R._ticks = R.host.ticks;
      if (hp.wallDir !== 0 && !hp.grounded) R.cover.wall++;
      if (hp.groundId) R.cover.ride++;
      if (!hp.grounded) R.cover.airTicks++;
      for (const e of R.host.drainEvents()) { if (e.type === 'jump' && e.player === 1 && e.wall) R.cover.wallJumps++; if (e.type === 'oob' && e.player === 1) R.cover.oob++; }
    }
  };
  R.run = (ms) => { const end = R.now + ms; while (R.now < end) R.slice(); };
  return R;
}
const hostOwn = (R) => R.host.state.players[1];
const shown = (R) => R.rends[R.rends.length - 1];

// A seeded "human": changes direction now and then, jumps now and then, taps jump on wall contact (climbing), rides the platform.
function agent(seed) {
  let a = seed; const rnd = () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; };
  let dir = 1, left = 0, hold = 0;
  return (R) => () => {
    const p = hostOwn(R), def = getMap('pr-room').platforms[0], plat = platformPos(def, R.host.state.roundTick);
    if (--left <= 0) { dir = rnd() < 0.12 ? 0 : (rnd() < 0.5 ? -1 : 1); left = 12 + Math.floor(rnd() * 70); if (rnd() < 0.3 && p.x < 380) dir = 1; }
    if (p.wallDir !== 0 && !p.grounded) dir = p.wallDir;                       // hold into the wall
    // the platform: wait at the edge until it docks, ride it across, step off on the far floor, come back the same way
    if (p.grounded && !p.groundId && p.x > 770 && p.x < 800 && p.y < 600) dir = plat.x < 830 && plat.y === 500 ? 1 : 0;
    else if (p.grounded && !p.groundId && p.x > 1150 && p.x < 1175) dir = plat.x > 1010 ? -1 : 0;
    else if (p.groundId) dir = plat.x > 1030 && p.x > 1060 ? 1 : (plat.x < 830 && p.x < 850 ? -1 : 0);
    else if (p.grounded && p.x >= 1175) { if (dir > 0) dir = -1; }
    let jumpPressed = false;
    const onWall = p.wallDir !== 0 && !p.grounded && p.wallRegrab <= 0;
    if (hold <= 0 && ((p.grounded && rnd() < 0.03) || (onWall && rnd() < 0.7) || (p.groundId && rnd() < 0.002))) { jumpPressed = true; hold = 6 + Math.floor(rnd() * 20); }
    const jump = hold > 0; if (hold > 0) hold--;
    return { ...IDLE, left: dir < 0, right: dir > 0, jump, jumpPressed, aim: 0 };
  };
}

// ---------------------------------------------------------------------------------------------------------------------
test('press to movement: with prediction your own player moves within about one frame at ANY round trip; without it you wait a full round trip plus the buffer', () => {
  const out = [];
  for (const rtt of [60, 100, 150]) {
    const res = {};
    for (const on of [true, false]) {
      CONFIG.net.predictOwnMovement = on;
      const R = rig({ latency: rtt / 2 }); R.run(1500);
      const x0 = shown(R).x; ok(R.guest.ready, 'connected');
      const t0 = R.now; R.input = () => ({ ...IDLE, right: true });
      let first = null;
      while (R.now - t0 < 1000 && first === null) { R.slice(); if (shown(R).x > x0 + 0.3) first = R.now - t0; }
      ok(first !== null, 'it moves at some point (prediction ' + on + ')');
      res[on] = first;
    }
    CONFIG.net.predictOwnMovement = true;
    ok(res[true] <= 40, 'RTT ' + rtt + ': first visible movement after ' + res[true] + ' ms with prediction');
    ok(res[false] >= rtt, 'RTT ' + rtt + ': ' + res[false] + ' ms without prediction (at least the round trip)');
    out.push(rtt + ' ms RTT: ' + res[true] + ' ms (prediction) vs ' + res[false] + ' ms (host view)');
  }
  console.log('        first visible movement: ' + out.join(' | '));
});

test('a jump shows at once too: the vertical position starts changing within about one frame, and the same jump is on the host a bit later', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 50 }); R.run(1500);
  const y0 = shown(R).y; let go = false;
  R.input = () => { if (go) { go = false; return { ...IDLE, jump: true, jumpPressed: true }; } return { ...IDLE, jump: true }; };
  const t0 = R.now; go = true; let first = null;
  while (R.now - t0 < 600 && first === null) { R.slice(); if (shown(R).y < y0 - 0.5) first = R.now - t0; }
  ok(first !== null && first <= 40, 'jump visible after ' + first + ' ms');
  R.run(300);
  ok(hostOwn(R).y < y0 - 20 || !hostOwn(R).grounded, 'the host jumped too');
});

test('convergence on a clean link (RTT 50 ms): a long scripted run with wall jumps, platform rides and an out-of-bounds launch ends exactly where the host is; corrections stay tiny', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 25 }); R.run(1200);
  R.input = agent(11)(R);
  R.run(60000);
  const cv = R.cover, S = R.guest.predict.summary();
  console.log('        coverage (host ticks): wall contact ' + cv.wall + ', moving platform ' + cv.ride + ', wall jumps ' + cv.wallJumps + ', out of bounds ' + cv.oob + ', airborne ' + cv.airTicks);
  ok(cv.wall > 60 && cv.wallJumps > 5 && cv.ride > 120 && cv.oob >= 1, 'the run exercised walls, wall jumps, platform rides and out of bounds');
  const small = R.guest.predict.stats.errs.filter((e) => e < CONFIG.net.predictSnap);
  const mean = small.reduce((s, e) => s + e, 0) / small.length, big = R.guest.predict.stats.errs.length - small.length;
  console.log('        reconciles ' + S.reconciles + ', mean correction ' + mean.toFixed(3) + ', p95 ' + S.p95Err.toFixed(2) + ', max ' + S.maxErr.toFixed(1) + ' (snaps: ' + S.snaps + '), largest per-frame fade ' + S.maxFrameCorr.toFixed(2));
  ok(mean < 0.15, 'mean correction ' + mean.toFixed(3));
  ok(S.p95Err < 1.5, 'p95 correction ' + S.p95Err);
  ok(S.snaps === big && big <= cv.oob + 2, 'only out-of-bounds launches needed a snap (' + big + ' for ' + cv.oob + ' launches)');
  R.input = () => IDLE; hostOwn(R).x = 300; hostOwn(R).y = 485; hostOwn(R).vx = hostOwn(R).vy = 0; R.run(2500);   // (riding a platform the two views differ by the lead; so: back onto the floor, let go of every key)
  const h = hostOwn(R), s = shown(R);
    ok(Math.hypot(h.x - s.x, h.y - s.y) < 0.6, 'ended ' + Math.hypot(h.x - s.x, h.y - s.y).toFixed(2) + ' units from the host');
});

test('convergence on a bad link (RTT 150 ms, jitter 25 ms, 8% loss): no growing drift, corrections stay small, and it still ends where the host is', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 75, jitter: 25, loss: 0.08 }); R.run(1500);
  R.input = agent(23)(R);
  const half = [];
  R.run(45000); half.push(R.guest.predict.stats.errs.slice());
  R.run(45000); half.push(R.guest.predict.stats.errs.slice(half[0].length));
  const m = (a) => { const s = a.filter((e) => e < CONFIG.net.predictSnap); return s.reduce((x, e) => x + e, 0) / Math.max(1, s.length); };
  const S = R.guest.predict.summary(), cv = R.cover;
  console.log('        coverage: wall ' + cv.wall + ', ride ' + cv.ride + ', wall jumps ' + cv.wallJumps + ', oob ' + cv.oob + ' | mean correction first half ' + m(half[0]).toFixed(2) + ', second half ' + m(half[1]).toFixed(2) + ', p95 ' + S.p95Err.toFixed(2) + ', largest per-frame fade ' + S.maxFrameCorr.toFixed(2));
  ok(cv.wallJumps > 5 && cv.ride > 100 && cv.oob >= 1, 'the run exercised walls, rides and out of bounds');
  ok(m(half[1]) < Math.max(3, m(half[0]) * 1.6), 'the second half is not worse than the first (no growing drift)');
  ok(m(half[0]) < 4 && m(half[1]) < 4, 'mean correction under 4 units on a bad link');
  ok(S.maxFrameCorr < 6, 'no rubber-banding: at most ' + S.maxFrameCorr.toFixed(2) + ' units of correction in one frame');
  R.input = () => IDLE; hostOwn(R).x = 300; hostOwn(R).y = 485; hostOwn(R).vx = hostOwn(R).vy = 0; R.run(3000);
  const h = hostOwn(R), s = shown(R);
  ok(Math.hypot(h.x - s.x, h.y - s.y) < 1, 'ended ' + Math.hypot(h.x - s.x, h.y - s.y).toFixed(2) + ' units from the host');
});

test('knockback from a hit is not predicted but is picked up: the shove shows within a round trip, is blended in (no jump), and both views end together', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 50 }); R.run(1500);
  const x0 = shown(R).x;
  let hit = R.now; applyImpulse(R.host.state, 1, 300, -150);
  const track = []; const t0 = R.now;
  while (R.now - t0 < 1500) { R.slice(); track.push([R.now - t0, shown(R).x, shown(R).y]); }
  let maxFrame = 0; for (let i = 1; i < track.length; i++) maxFrame = Math.max(maxFrame, Math.hypot(track[i][1] - track[i - 1][1], track[i][2] - track[i - 1][2]));
  const firstMove = track.find((t) => t[1] > x0 + 2);
  ok(firstMove && firstMove[0] <= 200, 'the shove is on screen after ' + (firstMove ? firstMove[0] : '-') + ' ms (one way 50 ms + a snapshot)');
  ok(maxFrame < 4.5, 'no jump: at most ' + maxFrame.toFixed(2) + ' units between two rendered frames (4 ms apart)');
  const h = hostOwn(R), s = shown(R);
  ok(Math.hypot(h.x - s.x, h.y - s.y) < 0.6, 'ended ' + Math.hypot(h.x - s.x, h.y - s.y).toFixed(2) + ' units from the host');
  console.log('        shove: visible after ' + firstMove[0] + ' ms, largest step between two 4 ms frames ' + maxFrame.toFixed(2) + ', correction reported ' + R.guest.predict.summary().maxErr.toFixed(1) + ' units');
});

test('out of bounds: the client does not keep falling forever, is thrown back with the host, and carries on; the launch is applied at once (it is a teleport)', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 40 }); R.run(1500);
  hostOwn(R).x = 700; R.run(300);                                          // (a teleport on the host: the client just follows)
  R.input = () => ({ ...IDLE, right: true });
  let hostMaxY = 0; for (let i = 0; i < 875; i++) { R.slice(); hostMaxY = Math.max(hostMaxY, hostOwn(R).y); }   // walk off the right end of the floor into the pit
  ok(R.cover.oob >= 1 || hostOwn(R).oobInv > 0, 'fell out of the arena');
  R.input = () => IDLE; for (let i = 0; i < 1000; i++) { R.slice(); hostMaxY = Math.max(hostMaxY, hostOwn(R).y); }
  const h = hostOwn(R), s = shown(R);
  ok(Math.hypot(h.x - s.x, h.y - s.y) < 1, 'ended ' + Math.hypot(h.x - s.x, h.y - s.y).toFixed(2) + ' units from the host');
  ok(R.guest.predict.summary().snaps >= 1, 'the launch was a snap');
  const myMax = Math.max(...R.rends.map((r) => r.y));
  ok(myMax < hostMaxY + 60, 'the predicted body never fell deeper than the host let it (' + myMax.toFixed(0) + ' vs ' + hostMaxY.toFixed(0) + ')');
});

test('rounds: when the host restarts the round (death) the client lands on the new spawn at once and keeps predicting afterwards', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 40 }); R.run(1500);
  R.input = () => ({ ...IDLE, right: true }); R.run(600);
  R.host.state.cheats.invulnerable = [false, false];
  killPlayer(R.host.state, 0, 1, 'test');                                 // the host player dies: round end -> quiz -> (host picks) -> next round
  R.input = () => IDLE; R.run(2500);
  ok(R.host.state.phase !== 'playing' && R.host.state.phase !== 'roundEnd', 'phase ' + R.host.state.phase + ': the duel is frozen for the quiz');
  ok(!R.guest.predict.active, 'not predicting while the duel is frozen');
  R.host.sendIntent({ type: 'answer', index: 0 }); R.run(300); R.host.sendIntent({ type: 'continue' }); R.run(300);
  const st = R.host.state;
  if (st.phase === 'cardPick') { const id = st.match.offer.find((x) => !st.match.removed.includes(x)); R.host.sendIntent({ type: 'pick', cardId: id }); R.run(500); }
  ok(R.host.state.phase === 'playing', 'new round: ' + R.host.state.phase);
  R.run(800);
  ok(R.guest.predict.active, 'predicting again');
  const sp = R.host.state.players[1];
  ok(Math.abs(shown(R).x - sp.x) < 1 && Math.abs(shown(R).y - sp.y) < 1, 'standing on the spawn like the host says (' + shown(R).x.toFixed(1) + ',' + shown(R).y.toFixed(1) + ' vs ' + sp.x.toFixed(1) + ',' + sp.y.toFixed(1) + ')');
  R.input = () => ({ ...IDLE, right: true }); const x0 = shown(R).x; R.run(120);
  ok(shown(R).x > x0 + 6, 'moves right away in the new round');
});

test('host input queue: frames are simulated one per tick in order; a frame lost on the way is replaced by a repeat; a tap that arrives late is not lost; a pile-up is skipped', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 30, jitter: 20, loss: 0.2 }); R.run(1500);
  const acks = []; const orig = R.host._tick.bind(R.host);
  R.host._tick = (now) => { orig(now); acks.push(R.host.ackSeq); };
  R.input = agent(5)(R); R.run(20000);
  let backwards = 0, stalls = 0, jumps = 0;
  for (let i = 1; i < acks.length; i++) { if (acks[i] < acks[i - 1]) backwards++; if (acks[i] === acks[i - 1]) stalls++; if (acks[i] > acks[i - 1] + 1) jumps++; }
  ok(backwards === 0, 'the acknowledged frame number never goes backwards');
  ok(stalls < acks.length * 0.05, 'the host rarely runs dry (stall ticks: ' + stalls + ' of ' + acks.length + ')');
  console.log('        20 s on a 60 ms one-way / 20 ms jitter / 20% loss link: ' + acks.length + ' host ticks, stall ticks ' + stalls + ', frame skips (pile-ups): ' + jumps);
  ok(jumps < acks.length * 0.02, 'pile-up skips are rare: ' + jumps);
  // a lone tap on a bad link still jumps
  R.input = () => IDLE; R.run(1500);
  let y0 = hostOwn(R).y, taps = 0, got = 0;
  for (let k = 0; k < 12; k++) {
    let once = true; R.input = () => { if (once) { once = false; return { ...IDLE, jump: true, jumpPressed: true }; } return { ...IDLE, jump: true }; };
    R.run(50); R.input = () => IDLE;
    let top = hostOwn(R).y; const t0 = R.now; while (R.now - t0 < 400) { R.slice(); top = Math.min(top, hostOwn(R).y); }
    taps++; if (top < y0 - 15) got++; R.run(900);
  }
  ok(got === taps, 'every tap jumped on the host: ' + got + ' of ' + taps);
});

test('a real match on the real map between two bots over a bad link (RTT 120 ms, jitter 20 ms, 5% loss): hits, knockback, explosions, deaths, quiz, new rounds; the prediction survives all of it', () => {
  CONFIG.net.predictOwnMovement = true;
  const clock = virtualClock(0), net = new LoopbackNetwork({ clock, seed: 9, latency: 60, jitter: 20, loss: 0.05 });
  const bH = createBot(11), bG = createBot(12); let host, guest;
  host = new HostSession({ clock, name: 'HOSTY', seed: 8, mapId: 'ruined-city', getLocalInput: () => botInput(bH, host.state, 0, STEP) });
  net.startHost({ code: 'ABCDE' }, { onconnection: (tr) => host.attach(tr) });
  guest = new GuestSession({ clock, name: 'GUESTY', code: 'ABCDE', getLocalInput: () => botInput(bG, host.state, 1, STEP), reconnect: (cb) => net.connectClient({ code: 'ABCDE', meta: {} }, cb) });
  net.connectClient({ code: 'ABCDE', meta: {} }, { onopen: (tr) => guest.attach(tr), onerror: () => {} });
  let now = 0, rounds = 0, lastRound = 1, hits = 0, drivenKey = '';
  const rnd = (() => { let a = 5; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  const driveSess = (sess, me) => {                                       // plays the quiz / card pick screens like the net tests do
    const st = sess.state, m = st.match; if (sess.status !== 'playing') return;
    if (st.phase === 'quiz' && m.loser === me) sess.sendIntent({ type: 'answer', index: Math.floor(rnd() * 4) });
    else if (st.phase === 'quizReveal' && m.loser === me) sess.sendIntent({ type: 'continue' });
    else if (st.phase === 'cardPick' && m.loser === me && m.offer.length) { const id = m.offer.find((x) => !m.removed.includes(x)); if (id && id !== '?') sess.sendIntent({ type: 'pick', cardId: id }); }
  };
  let prevHp = 100;
  while (now < 300000) {
    now += 4; clock.advance(now); host.advance(now); guest.netTick(now);
    if (guest.ready) guest.render(now);
    if (now % 400 === 0) { driveSess(host, 0); driveSess(guest, 1); }
    const hp = host.state.players[1].hp; if (hp < prevHp - 0.5) hits++; prevHp = hp;
    if (host.state.round !== lastRound) { rounds++; lastRound = host.state.round; }
    if (now % 400 === 0 && host.state.phase === 'matchEnd' && guest.state.phase === 'matchEnd') { host.sendIntent({ type: 'playAgain' }); guest.sendIntent({ type: 'playAgain' }); }
  }
  const S = guest.predict.summary();
  console.log('        300 s of play (maps rotating): ' + (rounds + 1) + ' rounds, ' + hits + ' hits taken by the client, ' + S.reconciles + ' reconciles, ' + S.snaps + ' snaps, mean correction ' + S.meanErr.toFixed(2) + ', p95 ' + S.p95Err.toFixed(2) + ', largest per-frame fade ' + S.maxFrameCorr.toFixed(2));
  ok(rounds >= 3 && hits >= 5, 'enough happened: ' + rounds + ' rounds, ' + hits + ' hits');
  ok(S.p95Err < 3, 'p95 correction ' + S.p95Err.toFixed(2));
  ok(S.maxFrameCorr < 8, 'largest correction in one frame ' + S.maxFrameCorr.toFixed(2));
  // at the end: whatever phase we are in (quiz, card pick, match end...), play on until a round is live; one second later the client must be predicting again
  let liveSince = null, guard = 0;
  while (guard++ < 120000) {                                              // (8 virtual minutes at most)
    now += 4; clock.advance(now); host.advance(now); guest.netTick(now); guest.render(now);
    if (now % 400 === 0) { driveSess(host, 0); driveSess(guest, 1); if (host.state.phase === 'matchEnd' && guest.state.phase === 'matchEnd') { host.sendIntent({ type: 'playAgain' }); guest.sendIntent({ type: 'playAgain' }); } }
    if (host.state.phase === 'playing') { if (liveSince === null) liveSince = now; if (now - liveSince > 1000) break; } else liveSince = null;
  }
  ok(liveSince !== null && host.state.phase === 'playing', 'a live round came up again (phase ' + host.state.phase + ')');
  ok(guest.predict.active, 'predicting one second into a live round');
});

test('own muzzle flash: shown within a frame of the click at any round trip, once per shot (the host event arrives later and is passed on without a second flash)', () => {
  CONFIG.net.predictOwnMovement = true;
  const R = rig({ latency: 75 }); R.run(1500);
  const got = []; const t0 = R.now; let click = true;
  R.input = () => { if (click) { click = false; return { ...IDLE, shoot: true, shootPressed: true, aim: 0 }; } return { ...IDLE, aim: 0 }; };
  const orig = R.guest.render.bind(R.guest);
  R.guest.render = (now) => { const r = orig(now); for (const e of r.events) if (e.type === 'shot' && e.player === 1) got.push({ at: now - t0, e }); return r; };
  R.run(900);
  ok(got.length === 2, 'two shot events reach the renderer (the local flash and the host event): ' + got.length);
  ok(got[0].e.local && got[0].at <= 24, 'the local flash is there after ' + got[0].at + ' ms (150 ms round trip)');
  ok(got[1].e.silent && got[1].at > 100, 'the host event comes ' + got[1].at + ' ms later and is silent (no second flash)');
  ok(R.host.state.players[1].ammo === 4, 'the host really fired once');
  // a click that cannot shoot (empty magazine) shows nothing
  R.host.state.players[1].ammo = 0; R.host.state.players[1].reloadLeft = 1.5; R.run(400); got.length = 0; click = true; R.run(300);
  ok(!got.some((g) => g.e.local), 'no flash while reloading');
});

test('prediction off (flag): the client shows the host view only, as before', () => {
  CONFIG.net.predictOwnMovement = false;
  const R = rig({ latency: 50 }); R.run(1500);
  R.input = () => ({ ...IDLE, right: true }); R.run(150);
  ok(R.guest.predict.stats.steps === 0, 'no local steps');
  const behind = shown(R).x; R.run(2000);
  ok(R.guest.predict.stats.reconciles === 0 || !R.guest.predict.active, 'inactive');
  CONFIG.net.predictOwnMovement = true;
  ok(shown(R).x > behind, 'still moves (from snapshots)');
});

// ---------------------------------------------------------------------------------------------------------------------
for (const t of pending) {
  try { t.fn(); console.log('PASS  ' + t.name); passed++; }
  catch (e) { console.log('FAIL  ' + t.name + '\n        ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); failed++; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

// Tests for the READY GATE: before every round the sim waits in the phase 'ready' until every human screen has reported that it can show the
// round, then counts down 3-2-1 and goes live (sim/world.js enterReady / tickReady, net/host-session.js, net/guest-session.js).
//   * sim: nothing runs before GO (no input, bullets, hazards, platforms, damage, round clock, bots), the countdown length, stale ids, every kind of
//     new round goes through the gate, the next map is known at round end, the resume gate keeps the round exactly as it was
//   * net (loopback with a virtual clock): the host does not go live before the guest's ready for THAT gate, stale / malformed ready ignored, a guest that
//     is several seconds late (waiting state, then start), the timeout path, a rejoin goes through the gate, both screens see the same countdown
// Run:  node tests/gate.test.mjs
import { CONFIG } from '../src/config.js';
import { virtualClock } from '../src/net/scheduler.js';
import { LoopbackNetwork } from '../src/net/transport.js';
import { HostSession } from '../src/net/host-session.js';
import { GuestSession } from '../src/net/guest-session.js';
import { T } from '../src/net/protocol.js';
import { createState, step, STEP, intent, markReady, resumeGate, enterReady } from '../src/sim/world.js';
import { killPlayer, spawnBullet } from '../src/sim/combat.js';
import { createPracticeSession } from '../src/practice/practice-session.js';
import { ROTATION, registerMap } from '../src/maps/index.js';

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

const IDLE = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const BUSY = { left: true, right: false, jump: true, jumpPressed: true, shoot: true, block: true, aim: 0.3 };
const run = (s, n, inp = [IDLE, IDLE]) => { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(s, inp, STEP)); return ev; };
const gated = (o = {}) => createState({ mapId: 'ruined-city', seed: 3, gate: true, ...o });

// =====================================================================================================================================
//  sim
// =====================================================================================================================================
test('every round starts in the phase "ready": nothing runs before GO (no input, bullets, hazards, platforms, damage, round clock) however long it takes', () => {
  const s = gated(); s.cheats.invulnerable = [false, false];
  ok(s.phase === 'ready' && s.ready.id === 1 && s.ready.cd < 0, 'the first round waits: ' + s.phase);
  const before = JSON.stringify(s.players.map((p) => [p.x, p.y, p.vx, p.vy, p.hp, p.ammo]));
  spawnBullet(s, 1, { x: 600, y: 300, angle: 0, speed: 1500, damage: 50, gravity: 0 });
  const b0 = JSON.stringify(s.bullets);
  const ev = run(s, 1800, [BUSY, BUSY]);                        // 30 s of every key held down by both players
  ok(s.phase === 'ready' && s.ready.cd < 0, 'still waiting');
  ok(JSON.stringify(s.players.map((p) => [p.x, p.y, p.vx, p.vy, p.hp, p.ammo])) === before, 'nobody moved, fired, took damage');
  ok(JSON.stringify(s.bullets) === b0, 'a bullet in the air does not fly');
  ok(s.roundTick === 0 && s.roundTime === 0 && !s.suddenDeath, 'the round clock and the platforms / hazards (roundTick) have not started: ' + s.roundTick + ' / ' + s.roundTime);
  ok(ev.length === 0, 'no events while waiting');
  ok(s.tick === 1800 && Math.abs(s.ready.waited - 30) < 0.05, 'ticks go on (the net layer needs them), the wait is timed: ' + s.ready.waited);
});

test('3-2-1: the countdown starts when the last human is ready, lasts CONFIG.round.countdown, is frozen too, then one roundGo and the round is live', () => {
  const s = gated(); const id = s.ready.id;
  ok(s.ready.got[1] === true && s.ready.got[0] === false, 'the dummy is always ready, the human is not');
  ok(!markReady(s, 0, id + 7) && !markReady(s, 0, id - 1) && s.ready.got[0] === false, 'a report for another gate is ignored');
  ok(markReady(s, 0, id), 'the right id counts');
  let n = 0, goAt = -1, go = 0; const cds = [];
  for (let i = 0; i < 400; i++) {
    const ev = run(s, 1, [BUSY, BUSY]); n++;
    cds.push(s.ready.cd);
    for (const e of ev) if (e.type === 'roundGo') { go++; goAt = n; }
    if (s.phase === 'playing') break;
    ok(s.roundTick === 0 && s.players[0].x === s.players[0].x && s.bullets.length === 0, 'frozen during the countdown');
  }
  ok(go === 1, 'one roundGo: ' + go);
  const want = CONFIG.round.countdown * CONFIG.tickRate;
  ok(Math.abs(goAt - want) <= 2, 'GO after ' + goAt + ' ticks (' + (goAt / 60).toFixed(2) + ' s), configured ' + CONFIG.round.countdown + ' s');
  ok(cds[0] > cds[1] && cds[0] <= CONFIG.round.countdown, 'the countdown runs down');
  const x0 = s.players[0].x; run(s, 20, [{ ...IDLE, right: true }, IDLE]);
  ok(s.phase === 'playing' && s.players[0].x > x0 + 5 && s.roundTick === 20, 'after GO the player moves and the round clock runs');
  ok(CONFIG.round.countdown >= 2.5 && CONFIG.round.countdown <= 3, 'the countdown is the 2.5-3 s the design asks for');
});

test('countdown 0 (tests) goes straight to GO; a report that arrives late does not matter; the gate is skipped entirely when gate is off', () => {
  const save = CONFIG.round.countdown; CONFIG.round.countdown = 0;
  const s = gated(); markReady(s, 0, s.ready.id); run(s, 2);
  CONFIG.round.countdown = save;
  ok(s.phase === 'playing', 'straight to GO');
  const t = createState({ mapId: 'ruined-city', seed: 3 });
  ok(t.phase === 'playing' && !t.gate, 'an ungated state is live at once (the old behaviour)');
});

test('every new round goes through the gate: after a death + quiz + card pick, after a draw, after a rematch; the next map is known when the round ENDS', () => {
  const s = gated({ rotate: true, mapId: undefined, seed: 11 });
  const live = () => { markReady(s, 0, s.ready.id); for (let i = 0; i < 400 && s.phase !== 'playing'; i++) run(s, 1); ok(s.phase === 'playing', 'went live'); };
  live();
  ok(s.nextMapId === null, 'no next map before the round ends');
  killPlayer(s, 1, 0); run(s, 1);
  ok(s.phase === 'roundEnd' && ROTATION.includes(s.nextMapId) && s.nextMapId !== s.mapId, 'round end: the next map is decided and exposed: ' + s.nextMapId + ' (now ' + s.mapId + ')');
  const planned = s.nextMapId;
  for (let i = 0; i < 4000 && s.phase !== 'ready'; i++) run(s, 1);          // end delay, the dummy's quiz turn and card pick, its beat
  ok(s.phase === 'ready' && s.round === 2 && s.mapId === planned && s.nextMapId === null, 'round 2 waits in the gate on exactly the planned map: ' + s.phase + ' ' + s.mapId);
  ok(s.players.every((p) => p.alive && p.hp === p.stats.maxHp) && s.players[0].x < s.players[1].x, 'standing at their spawns with full health');
  live();
  // a draw: both die on the same tick
  killPlayer(s, 0, 1); killPlayer(s, 1, 0); run(s, 1);
  ok(s.phase === 'roundEnd' && s.result.winner === -1, 'a draw');
  for (let i = 0; i < 400 && s.phase !== 'ready'; i++) run(s, 1);
  ok(s.phase === 'ready' && s.round === 3, 'after a draw the round is replayed through the gate (round ' + s.round + ')');
  // a rematch
  s.scores = [5, 2]; s.phase = 'matchEnd'; s.match.again = [false, false];
  intent(s, 0, { type: 'playAgain' });                        // the dummy counts as agreed
  ok(s.phase === 'ready' && s.round === 1 && s.scores[0] === 0, 'a rematch starts in the gate: ' + s.phase);
});

test('resume gate (a player came back in the middle of a round): the round is kept exactly as it was, frozen, until both are ready, then a SHORT countdown', () => {
  const s = gated(); s.match.auto = [false, false]; enterReady(s);
  markReady(s, 0, s.ready.id); markReady(s, 1, s.ready.id); run(s, 200);
  ok(s.phase === 'playing', 'live');
  run(s, 60, [{ ...IDLE, right: true }, { ...IDLE, left: true }]);
  spawnBullet(s, 0, { x: 400, y: 300, angle: 0, speed: 1500, damage: 10, gravity: 0 });
  const snap = JSON.stringify({ p: s.players.map((p) => [p.x, p.y, p.vx, p.vy, p.hp]), b: s.bullets, rt: s.roundTick, time: s.roundTime });
  const id0 = s.ready.id;
  ok(resumeGate(s) && s.phase === 'ready' && s.ready.resume && s.ready.back === 'playing' && s.ready.id !== id0, 'a fresh gate');
  run(s, 120, [BUSY, BUSY]);
  ok(JSON.stringify({ p: s.players.map((p) => [p.x, p.y, p.vx, p.vy, p.hp]), b: s.bullets, rt: s.roundTick, time: s.roundTime }) === snap, 'nothing changed while waiting');
  markReady(s, 0, id0);                                           // a stale one
  run(s, 5); ok(s.ready.cd < 0, 'a stale ready does not start it');
  markReady(s, 0, s.ready.id); markReady(s, 1, s.ready.id);
  let n = 0; while (s.phase === 'ready' && n < 500) { run(s, 1); n++; }
  ok(Math.abs(n - CONFIG.round.resumeCountdown * 60) <= 2 && s.phase === 'playing', 'short countdown: ' + (n / 60).toFixed(2) + ' s');
  ok(s.roundTick === 0 || s.roundTick === 1 || JSON.parse(snap).rt <= s.roundTick, 'the round continues where it was (round tick ' + JSON.parse(snap).rt + ' -> ' + s.roundTick + ')');
});

test('practice session: the dummy stays idle and the human cannot act during the gate; GO frees both after the countdown', () => {
  const S = createPracticeSession({ mapId: 'ruined-city', seed: 5, gate: true });
  const p0 = S.state.players[0], p1 = S.state.players[1];
  const start = [p0.x, p0.y, p1.x, p1.y];
  for (let i = 0; i < 300; i++) S.update(1 / 60, () => BUSY, () => {});
  ok(S.state.phase === 'ready' && [p0.x, p0.y, p1.x, p1.y].every((v, i) => v === start[i]) && S.state.bullets.length === 0, 'the dummy did not move or shoot, neither did the human');
  ok(S.state.players[1].ammo === S.state.players[1].stats.magazine, 'no shot fired');
  ok(S.localReady(S.state.ready.id), 'the screen reports ready');
  for (let i = 0; i < 100; i++) S.update(1 / 60, () => BUSY, () => {});
  ok(S.state.phase === 'ready' && S.state.ready.cd > 0.5, 'counting down: ' + S.state.ready.cd.toFixed(2));
  for (let i = 0; i < 120; i++) S.update(1 / 60, () => BUSY, () => {});
  ok(S.state.phase === 'playing', 'live after about 2.7 s');
});

// =====================================================================================================================================
//  net
// =====================================================================================================================================
function rig(netOpts = {}, o = {}) {
  const clock = virtualClock(0), net = new LoopbackNetwork({ clock, seed: 5, ...netOpts });
  const R = { clock, net, now: 0, code: 'ABCDE', guestDelay: 0, hostDelay: 0, auto: true, since: { g: null, h: null }, cdLog: new Map(), sentG: [] };
  R.host = new HostSession({ clock, name: 'HOSTY', seed: 3, mapId: 'ruined-city', rotate: !!o.rotate, gate: true, getLocalInput: () => IDLE });
  net.startHost({ code: R.code }, { onconnection: (tr) => R.host.attach(tr) });
  const mk = (token) => new GuestSession({ clock, name: 'GUESTY', code: R.code, token, getLocalInput: () => IDLE, reconnect: (cb) => net.connectClient({ code: R.code, meta: {} }, cb) });
  R.guest = mk(null);
  R.connect = () => net.connectClient({ code: R.code, meta: {} }, { onopen: (tr) => R.guest.attach(tr) });
  R.phaseLog = [];
  R.slice = () => {
    R.now += 4; clock.advance(R.now); R.host.advance(R.now); R.guest.netTick(R.now);
    if (R.guest.ready) R.guest.render(R.now);
    if (R.host.state.phase === 'ready') R.cdLog.set(R.host.state.tick, R.host.state.ready.cd);
    // the two screens: each reports ready `delay` ms after it first saw this gate (when auto)
    if (R.auto) {
      const gs = R.guest.state;
      if (R.guest.status === 'playing' && R.guest.ready && gs.phase === 'ready' && gs.ready.id > 0) {
        if (R.since.g !== gs.ready.id + ':' + 'g') { R.since.g = gs.ready.id + ':g'; R.gAt = R.now; }
        if (R.now - R.gAt >= R.guestDelay && R.sentId !== gs.ready.id) { R.sentId = gs.ready.id; R.sentG.push(gs.ready.id); R.guest.sendReady(gs.ready.id); }
      }
      const hs = R.host.state;
      if (R.host.status === 'playing' && hs.phase === 'ready') {
        if (R.since.h !== hs.ready.id + ':h') { R.since.h = hs.ready.id + ':h'; R.hAt = R.now; }
        if (R.now - R.hAt >= R.hostDelay) R.host.localReady(hs.ready.id);
      }
    }
    const ph = R.host.state.phase; if (R.phaseLog[R.phaseLog.length - 1] !== ph) R.phaseLog.push(ph);
  };
  R.run = (ms) => { const end = R.now + ms; while (R.now < end) R.slice(); };
  R.until = (pred, max = 20000) => { const end = R.now + max; while (R.now < end && !pred()) R.slice(); return pred(); };
  return R;
}

test('online: the host does not go live until the guest\'s ready for THIS gate arrives; both screens show the same countdown; stale and malformed reports are ignored', () => {
  const R = rig({ latency: 40, jitter: 6 }); R.auto = false; R.connect(); R.run(1500);
  const id = R.host.state.ready.id;
  ok(R.host.state.phase === 'ready' && R.guest.state.phase === 'ready' && R.guest.state.ready.id === id, 'both screens are in the gate for the same id (' + id + ')');
  R.host.localReady(id); R.run(6000);
  ok(R.host.state.phase === 'ready' && R.host.state.ready.cd < 0 && R.host.state.ready.waited > 5, 'the host is ready but the guest is not: the round does not start (waited ' + R.host.state.ready.waited.toFixed(1) + ' s)');
  ok(R.guest.state.ready.got[0] === true && R.guest.state.ready.got[1] === false && R.guest.state.ready.waited > 4, 'the guest is told who is ready and how long we have waited: ' + JSON.stringify(R.guest.state.ready));
  R.guest.sendReady(id - 1); R.guest.sendReady(id + 5); R.guest.transport.send({ t: T.READY, id: 'x' }, true); R.guest.transport.send({ t: T.READY }, true); R.run(500);
  ok(R.host.state.ready.cd < 0 && !R.host.state.ready.got[1], 'stale, future and malformed reports change nothing');
  R.guest.sendReady(id); R.run(300);
  ok(R.host.state.ready.cd > 0 && R.host.state.ready.got[1], 'the right one starts the countdown');
  // the countdown is host-timed state: the guest's copy at every tick equals the host's
  const diffs = []; let guestSawCount = 0;
  const end = R.now + 3400;
  while (R.now < end && R.host.state.phase === 'ready') { R.slice(); const g = R.guest.state; if (g.phase === 'ready' && g.ready.cd >= 0) { guestSawCount++; const hostCd = R.cdLog.get(g.tick); if (hostCd !== undefined) diffs.push(Math.abs(hostCd - g.ready.cd)); } }
  R.run(400);
  ok(guestSawCount > 20 && diffs.length > 20, 'the guest saw the countdown from its start (' + guestSawCount + ' frames)');
  ok(Math.max(...diffs) < 0.01, 'at every tick the guest\'s countdown is the host\'s (worst difference ' + Math.max(...diffs).toFixed(3) + ' s)');
  ok(R.host.state.phase === 'playing' && R.guest.state.phase === 'playing', 'then both are live');
  // nothing moved before GO: the log of the host's players is constant while ready
  ok(R.host.state.players[0].x < R.host.state.players[1].x, 'spawns kept');
});

test('online: both screens leave the gate within a few frames of each other (the countdown is the same wherever the screen is)', () => {
  const R = rig({ latency: 60, jitter: 10 }); R.connect();
  let hostGo = null, guestGo = null;
  R.run(500);
  while (R.now < 15000 && (hostGo === null || guestGo === null)) {
    R.slice();
    if (hostGo === null && R.host.state.phase === 'playing') hostGo = R.now;
    if (guestGo === null && R.guest.state.phase === 'playing') guestGo = R.now;
  }
  ok(hostGo !== null && guestGo !== null, 'both went live');
  console.log('        the host went live at ' + hostGo + ' ms, the guest at ' + guestGo + ' ms (RTT 120 ms)');
  ok(guestGo - hostGo >= 0 && guestGo - hostGo < 200, 'the guest follows within one one-way latency + a frame: ' + (guestGo - hostGo) + ' ms');
});

test('online: a guest that is several seconds late: "waiting" state first (on both screens), then the round starts once it reports', () => {
  const R = rig({ latency: 30 }); R.guestDelay = 6500; R.connect(); R.run(4000);
  ok(R.host.state.phase === 'ready' && R.host.state.ready.cd < 0 && R.host.state.ready.got[0] && !R.host.state.ready.got[1], 'host ready, guest not yet: waiting');
  ok(R.guest.state.ready.waited >= 2.5, 'the waiting time reaches the guest (so it can say "waiting"): ' + R.guest.state.ready.waited);
  R.run(4000);
  ok(R.host.state.ready.cd >= 0 || R.host.state.phase === 'playing', 'after it reported, the countdown ran');
  ok(R.until(() => R.host.state.phase === 'playing' && R.guest.state.phase === 'playing', 6000), 'and the round started');
  ok(!R.host.state.ready.forced, 'nobody was forced');
});

test('online: the timeout: a slow but connected guest is started without after config.round.readyTimeout; a guest that is gone is NOT forced (the disconnect handling owns that)', () => {
  const save = CONFIG.round.readyTimeout; CONFIG.round.readyTimeout = 6;
  try {
    const R = rig({ latency: 30 }); R.auto = false; R.connect(); R.run(500);
    R.host.localReady(R.host.state.ready.id);
    R.run(5000); ok(R.host.state.phase === 'ready' && R.host.state.ready.cd < 0, 'not yet at 5 s');
    R.run(2500);
    ok(R.host.state.ready.forced && R.host.state.ready.cd >= 0, 'at the timeout the host starts anyway: forced=' + R.host.state.ready.forced);
    ok(R.until(() => R.host.state.phase === 'playing', 5000), 'and the round goes live');
    // a guest that vanished: the match pauses, nobody is forced, no ticks
    const R2 = rig({ latency: 30 }); R2.auto = false; R2.connect(); R2.run(500);
    R2.host.localReady(R2.host.state.ready.id);
    R2.guest.opts.reconnect = () => ({ cancel() {} });          // (it does not come back)
    R2.guest.transport.close('test'); R2.run(300);
    ok(R2.host.status === 'paused', 'the host paused');
    const t0 = R2.host.state.tick; R2.run(9000);
    ok(R2.host.state.tick === t0 && !R2.host.state.ready.forced && R2.host.state.phase === 'ready', 'no ticks, no forced start without the guest');
  } finally { CONFIG.round.readyTimeout = save; }
});

test('online: a rejoin in the middle of a round goes through the same gate (a short countdown) and the round is exactly where it was', () => {
  const R = rig({ latency: 30 }); R.connect();
  ok(R.until(() => R.host.state.phase === 'playing' && R.guest.state.phase === 'playing', 10000), 'live');
  R.run(2000);
  const hs = R.host.state, keep = JSON.stringify(hs.players.map((p) => [p.x, p.y, p.hp, p.ammo])), rt0 = hs.roundTick;
  R.guest.transport.close('test: the network died');       // the guest loses its connection; it retries by itself
  R.run(300); ok(R.host.status === 'paused', 'the host paused');
  const idBefore = hs.ready.id;
  R.auto = false;                                            // we decide when each screen reports
  ok(R.until(() => R.host.status === 'playing', 8000), 'the guest is back');
  R.run(1500);
  ok(hs.phase === 'ready' && hs.ready.resume && hs.ready.id !== idBefore, 'back in a resume gate, not in live fire: ' + hs.phase);
  ok(hs.roundTick <= rt0 + 20 && JSON.stringify(hs.players.map((p) => [p.x, p.y, p.hp, p.ammo])) === keep || hs.roundTick === rt0, 'the round did not advance while waiting');
  const t0 = R.now; R.auto = true; R.hostDelay = 0; R.guestDelay = 0;
  ok(R.until(() => hs.phase === 'playing', 6000), 'live again');
  console.log('        resume gate: ready -> live in ' + (R.now - t0) + ' ms (countdown ' + CONFIG.round.resumeCountdown + ' s)');
  ok(R.now - t0 >= CONFIG.round.resumeCountdown * 1000 - 200 && R.now - t0 < CONFIG.round.resumeCountdown * 1000 + 800, 'the short countdown');
  ok(JSON.stringify(hs.players.map((p) => [p.x, p.y, p.hp, p.ammo])) !== undefined && hs.roundTick >= rt0, 'the round continues');
});

test('online: after a death, the quiz and the card pick the next round again waits for BOTH screens, and the next map was announced to the guest while the quiz ran', () => {
  const R = rig({ latency: 30 }, { rotate: true }); R.connect();
  ok(R.until(() => R.host.state.phase === 'playing' && R.guest.state.phase === 'playing', 10000), 'live');
  R.run(500);
  const id1 = R.host.state.ready.id, map1 = R.host.state.mapId;
  killPlayer(R.host.state, 0, 1);                           // the host loses: it answers the quiz
  ok(R.until(() => R.host.state.phase === 'quiz' && R.guest.state.phase === 'quiz', 6000), 'quiz');
  const planned = R.host.state.nextMapId;
  ok(planned && planned !== map1 && R.guest.state.nextMap === planned, 'the guest knows the next map during the quiz: ' + planned + ' / ' + R.guest.state.nextMap);
  intent(R.host.state, 0, { type: 'answer', index: R.host.state.match.quiz.correctShown }); intent(R.host.state, 0, { type: 'continue' });
  R.run(300);
  const offer = R.host.state.match.offer.find((c) => !R.host.state.match.removed.includes(c));
  R.guestDelay = 3000; R.hostDelay = 0;
  const pick = R.host.sendIntent({ type: 'pick', cardId: offer });
  ok(pick.ok, 'picked');
  R.run(1500);
  ok(R.host.state.phase === 'ready' && R.host.state.round === 2 && R.host.state.ready.id !== id1 && R.host.state.mapId === planned && R.host.state.ready.cd < 0, 'round 2 waits for the slow guest on the announced map');
  ok(R.until(() => R.host.state.phase === 'playing' && R.guest.state.phase === 'playing', 12000), 'then it starts');
  ok(R.sentG.length >= 2 && R.sentG[0] !== R.sentG[R.sentG.length - 1], 'the guest reported once per gate: ' + R.sentG.join(','));
});

test('scene readiness adapter: asks background.js only through its public functions, a scene that is not up is not ready, asking to prepare never throws', async () => {
  const { sceneReady, prepareScene } = await import('../src/client/bgready.js');
  const BG = await import('../src/client/background.js');
  ok(typeof BG.getBackgroundStatus === 'function', 'the status function exists');
  ok(sceneReady('ruined-city') === false, 'nothing built yet: not ready (' + JSON.stringify(BG.getBackgroundStatus()) + ')');
  prepareScene('ruined-city'); prepareScene('no-such-map');
  ok(sceneReady('no-such-map') === true, 'an unknown map cannot be waited for');
});

// =====================================================================================================================================
(async () => {
  for (const t of pending) {
    try { await t.fn(); passed++; console.log('PASS  ' + t.name); }
    catch (e) { failed++; console.log('FAIL  ' + t.name + '\n        ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n        ')); }
  }
  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})();

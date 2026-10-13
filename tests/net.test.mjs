// Headless tests for the online layer, over the in-process loopback network with a VIRTUAL clock
// (no real waiting): handshake, input delivery with loss, snapshot interpolation, events exactly
// once and in order, whole matches between two bots with latency / jitter / loss (host-loser and
// client-loser quiz turns, card picks), quiz secrecy, the watcher's view, disconnect + rejoin,
// rematch, leaving, malformed input, room codes and invite links.
// Run:  node tests/net.test.mjs
import { CONFIG } from '../src/config.js';
import { virtualClock } from '../src/net/scheduler.js';
import { LoopbackNetwork, SimTransport } from '../src/net/transport.js';
import { HostSession } from '../src/net/host-session.js';
import { GuestSession } from '../src/net/guest-session.js';
import { encodeFrame, decodeFrame, encodeAim, decodeAim, T, VERSION } from '../src/net/protocol.js';
import { makeRoomCode, normaliseCode, isValidCode, inviteLink, codeFromHash, cleanName, peerIdForCode } from '../src/net/room-code.js';
import { createBot, botInput } from '../src/practice/dummy-bot.js';
import { STEP } from '../src/sim/world.js';
import { ROTATION } from '../src/maps/index.js';
import { killPlayer, spawnBullet } from '../src/sim/combat.js';
import { createState, step } from '../src/sim/world.js';
import { matchView } from '../src/sim/match.js';
import { ClientWorld, buildSnap } from '../src/net/snapshot.js';
import { PeerTransport } from '../src/net/peer-transport.js';
import { netQuality, describePath } from '../src/net/quality.js';
import { classifyCandidates, verdictFor, runConnectionTest } from '../src/net/diagnose.js';
import { describeError } from '../src/net/connect.js';
import { registerMap } from '../src/maps/index.js';

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'value') + ': expected ~' + b + ' (+/-' + tol + '), got ' + a); }

// ---------------------------------------------------------------------------------------------------------------------
// harness: a host, a guest and a network on one virtual clock
function rig(netOpts = {}, o = {}) {
  const clock = virtualClock(0), net = new LoopbackNetwork({ clock, seed: 5, ...netOpts });
  const code = 'ABCDE';
  const log = { hostStatus: [], guestStatus: [], hostEnded: null, guestEnded: null };
  const botH = createBot(11), botG = createBot(12);
  const R = { clock, net, code, log, now: 0, intentsOn: true, bots: true, held: null };
  R.host = new HostSession({ clock, name: 'HOSTY', seed: o.seed || 3, mapId: 'ruined-city', rotate: !!o.rotate,
    getLocalInput: (p) => (R.bots ? botInput(botH, R.host.state, 0, STEP) : { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 }),
    onStatus: (s, t) => log.hostStatus.push(s + ':' + t), onEnded: (r) => { log.hostEnded = r; } });
  net.startHost({ code }, { onconnection: (tr) => R.host.attach(tr) });
  R.makeGuest = (token) => new GuestSession({ clock, name: 'GUESTY', code, token,
    getLocalInput: () => (R.held ? R.held : R.bots ? botInput(botG, R.host.state, 1, STEP) : { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 }),
    reconnect: (cb) => net.connectClient({ code, meta: {} }, cb),
    onStatus: (s, t) => log.guestStatus.push(s + ':' + t), onEnded: (r) => { log.guestEnded = r; } });
  R.guest = R.makeGuest(null);
  R.connect = () => net.connectClient({ code, meta: {} }, { onopen: (tr) => R.guest.attach(tr), onerror: (e) => { log.connectError = e; } });
  R.events = []; R.rends = [];
  const rng = (() => { let a = 99; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; })();
  // one 4 ms slice of the world
  R.slice = () => {
    R.now += 4; R.clock.advance(R.now);
    R.host.advance(R.now); R.guest.netTick(R.now);
    if (R.guest.ready) { const r = R.guest.render(R.now); R.rends.push({ at: R.now, rt: r.renderTick, p: r.state.players.map((p) => [p.x, p.y]) }); R.events.push(...r.events.filter((e) => !e.local)); }
    if (R.intentsOn && Math.floor(R.now / 4) % 15 === 0) { drive(R.host, 0, rng); drive(R.guest, 1, rng); }
  };
  R.run = (ms) => { const end = R.now + ms; while (R.now < end) R.slice(); };
  R.runUntil = (pred, maxMs) => { const end = R.now + maxMs; while (R.now < end && !pred()) R.slice(); return pred(); };
  return R;
}

// plays the part of the human at the quiz / card pick / match end screens
function drive(sess, me, rng) {
  const st = sess.state, m = st.match;
  if (sess.status !== 'playing') return;
  const key = st.phase + '|' + st.round + '|' + m.loser + '|' + (m.result ? m.result.picked : '-') + '|' + m.removed.length;
  if (sess._driven === key && (sess._drivenAt = (sess._drivenAt || 0) + 1) < 40) return;      // already answered this screen (wait for the host to move on)
  sess._driven = key; sess._drivenAt = 0;
  if (st.phase === 'quiz' && m.loser === me) sess.sendIntent({ type: 'answer', index: Math.floor(rng() * 4) });
  else if (st.phase === 'quizReveal' && m.loser === me) sess.sendIntent({ type: 'continue' });
  else if (st.phase === 'cardPick' && m.loser === me && m.offer.length) { const id = m.offer.find((x) => !m.removed.includes(x)); if (id && id !== '?') sess.sendIntent({ type: 'pick', cardId: id }); }
}
const hostPhase = (R) => R.host.state.phase;

// ---------------------------------------------------------------------------------------------------------------------
test('protocol: input frames round-trip, aim is quantised finely enough, bad messages are recognised', () => {
  const f = encodeFrame(7, { left: true, right: false, jump: true, jumpPressed: true, shoot: true, shootPressed: false, block: false, blockPressed: true, aim: 1.234 });
  const d = decodeFrame(f);
  ok(d.seq === 7 && d.left && !d.right && d.jump && d.jumpPressed && d.shoot && !d.shootPressed && !d.block && d.blockPressed, 'bits');
  near(d.aim, 1.234, 0.0002, 'aim');
  for (const a of [-Math.PI, -2, 0, 3.1, 3.14159]) near(decodeAim(encodeAim(a)), a, 0.0002, 'aim ' + a);
  ok(JSON.stringify(f).length < 24, 'a frame is tiny: ' + JSON.stringify(f));
});

test('room codes: 5 unambiguous characters, typed input is normalised, invite links work under a sub-path', () => {
  for (let i = 0; i < 200; i++) { const c = makeRoomCode(); ok(c.length === 5 && isValidCode(c) && !/[01OIL]/.test(c), 'code ' + c); }
  ok(normaliseCode(' ab-c d e ') === 'ABCDE', 'normalise: ' + normaliseCode(' ab-c d e '));
  ok(normaliseCode('abcdefgh') === 'ABCDE', 'truncates'); ok(!isValidCode('ABC0E') && !isValidCode('ABCD'), 'invalid codes');
  const loc = { origin: 'https://edgarsawtelle.github.io', pathname: '/RawAlanBattleRoyale/' };
  ok(inviteLink('ABCDE', loc) === 'https://edgarsawtelle.github.io/RawAlanBattleRoyale/#join=ABCDE', 'invite under a sub-path: ' + inviteLink('ABCDE', loc));
  ok(inviteLink('K7M4Q', { origin: 'http://localhost:8123', pathname: '/index.html' }) === 'http://localhost:8123/index.html#join=K7M4Q', 'localhost');
  ok(codeFromHash('#join=abcde') === 'ABCDE' && codeFromHash('#join=XX') === null && codeFromHash('') === null, 'hash parsing');
  ok(peerIdForCode('ABCDE') === 'rawalan-ABCDE', 'peer id');
  ok(cleanName('  <b>Ana</b>!! ', 'X') === 'BANAB', 'names are made pixel-font safe: ' + cleanName('  <b>Ana</b>!! ', 'X'));
  ok(cleanName('', 'EMBER') === 'EMBER' && cleanName('averyveryverylongname', 'X').length === CONFIG.net.maxNameLength, 'fallback and length limit');
});

test('handshake: the client joins, names are exchanged, both sides get the full state; a third client is told the room is full; a wrong version is rejected', () => {
  const R = rig({ latency: 20 }); R.connect(); R.run(500);
  ok(R.host.status === 'playing' && R.guest.status === 'playing' && R.guest.ready, 'both playing: ' + R.host.status + '/' + R.guest.status);
  ok(R.host.names[1] === 'GUESTY' && R.guest.names[0] === 'HOSTY' && R.guest.names[1] === 'GUESTY', 'names: ' + R.guest.names);
  ok(R.guest.state.mapId === 'ruined-city' && R.guest.state.players.length === 2, 'full state applied');
  // third client
  let rejected = null; const g3 = R.makeGuest(null); g3.opts.onEnded = (r) => { rejected = r; };
  R.net.connectClient({ code: R.code, meta: {} }, { onopen: (tr) => g3.attach(tr) }); R.run(500);
  ok(rejected && /full/i.test(rejected), 'third client: ' + rejected);
  // wrong version
  let rej2 = null; const R2 = rig({ latency: 10 }); const tr2 = []; R2.net.connectClient({ code: R2.code, meta: {} }, { onopen: (tr) => { tr.onmessage = (m) => { rej2 = m; }; tr.send({ t: T.HELLO, v: 999, name: 'X', token: null }, true); } }); R2.run(300);
  ok(rej2 && rej2.t === T.REJECT && rej2.reason === 'version', 'version mismatch: ' + JSON.stringify(rej2));
  ok(R2.host.status === 'waiting', 'the host keeps waiting after a rejected hello');
});

test('connecting to a code that does not exist fails with a clear error type', () => {
  const R = rig({ latency: 20 }); let err = null;
  R.net.connectClient({ code: 'ZZZZZ', meta: {} }, { onopen() {}, onerror: (e) => { err = e; } }); R.run(200);
  ok(err && err.type === 'peer-unavailable', 'error: ' + JSON.stringify(err));
});

test('input delivery: the host applies the client\'s inputs even with 30% packet loss (frames are repeated)', () => {
  const R = rig({ latency: 40, jitter: 10, loss: 0.3 }, { seed: 4 }); R.bots = false; R.intentsOn = false; R.connect(); R.run(800);
  const x0 = R.host.state.players[1].x;
  R.held = { left: false, right: true, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 }; R.run(1000);
  const x1 = R.host.state.players[1].x;
  ok(x1 - x0 > 150, 'the client moved right on the host: ' + (x1 - x0).toFixed(0) + ' units in 1 s');
  ok(R.host.stats.inputsRx > 20 && R.host.stats.inputsRx < R.guest.stats.inputsSent, 'some input messages were lost (' + R.host.stats.inputsRx + ' of ' + R.guest.stats.inputsSent + ') yet movement worked');
  // a jump tap shorter than a tick still arrives (edge bit)
  R.held = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 }; R.run(500);
  const y0 = R.host.state.players[1].y;
  R.held = { ...R.held, jump: true, jumpPressed: true }; R.run(16); R.held = { ...R.held, jump: false, jumpPressed: false }; R.run(160);
  ok(R.host.state.players[1].y < y0 - 8 || !R.host.state.players[1].grounded, 'the jump tap arrived');
});

test('snapshots: the client view follows the host closely (interpolated a short, adaptive time behind), smooth, and teleports are not smeared', () => {
  const R = rig({ latency: 50, jitter: 12, loss: 0.05 }); R.intentsOn = false; R.connect();
  const hist = []; // host positions per tick
  const origTick = R.host._tick.bind(R.host);
  R.host._tick = (now) => { origTick(now); hist[R.host.state.tick] = R.host.state.players.map((p) => [p.x, p.y]); };
  R.run(1500);
  let sum = 0, n = 0, worst = 0;
  for (const r of R.rends) {
    if (r.rt < 20) continue;
    const t0 = Math.floor(r.rt), f = r.rt - t0, a = hist[t0], b = hist[t0 + 1];
    if (!a || !b) continue;
    for (let i = 0; i < 1; i++) { const ex = a[i][0] + (b[i][0] - a[i][0]) * f, ey = a[i][1] + (b[i][1] - a[i][1]) * f; const e = Math.hypot(r.p[i][0] - ex, r.p[i][1] - ey); sum += e; n++; worst = Math.max(worst, e); }
  }
  ok(n > 100, 'enough samples ' + n);
  ok(sum / n < 6, 'mean error ' + (sum / n).toFixed(2) + ' units');
  // smoothness: consecutive rendered frames never jump more than a plain run speed allows
  let maxStep = 0; for (let i = 1; i < R.rends.length; i++) for (let k = 0; k < 2; k++) { const d = Math.hypot(R.rends[i].p[k][0] - R.rends[i - 1].p[k][0], R.rends[i].p[k][1] - R.rends[i - 1].p[k][1]); if (d < 100) maxStep = Math.max(maxStep, d); }
  ok(maxStep < 12, 'max per-frame step ' + maxStep.toFixed(1));
  // the render time sits a little behind the newest snapshot (the link's one-way time + the adaptive buffer, 40-150 ms)
  const last = R.rends[R.rends.length - 1];
  const behind = (R.host.state.tick - last.rt) * (1000 / 60);
  ok(behind > 60 && behind < 280, 'renders ' + behind.toFixed(0) + ' ms behind the host (50 ms latency + the adaptive buffer)');
});

test('events: every host event reaches the client exactly once and in order, even with loss and jitter', () => {
  const R = rig({ latency: 70, jitter: 25, loss: 0.2 }, { seed: 6 }); R.connect();
  const hostEvents = []; const origPush = R.host._pushEvents.bind(R.host);
  R.host._pushEvents = (l) => { origPush(l); if (l) hostEvents.push(...l.map((e) => e.type)); };
  R.run(25000);
  R.run(3000);                                                   // let the tail arrive
  ok(hostEvents.length > 40, 'the host produced events: ' + hostEvents.length);
  const got = R.events.map((e) => e.n);
  for (let i = 1; i < got.length; i++) ok(got[i] === got[i - 1] + 1, 'contiguous and ordered at ' + i + ': ' + got[i - 1] + ' -> ' + got[i]);
  ok(new Set(got).size === got.length, 'no duplicates');
  ok(got.length >= hostEvents.length - 4, 'nothing lost: ' + got.length + ' of ' + hostEvents.length);
  ok(R.events.map((e) => e.type).slice(0, 30).join() === hostEvents.slice(0, 30).join(), 'same types in the same order');
});

test('a full match to 5 between two bots over a bad link (80 ms, jitter 20, 5% loss): quiz + card picks on both sides, same score on both screens, then rematch needs both players', () => {
  const R = rig({ latency: 80, jitter: 20, loss: 0.05 }, { seed: 10 }); R.connect();
  // (who wins a round between two bots is chaos: make sure each side loses one by hand so both quiz paths are exercised)
  let forced = 0; R.forceLoss = () => { const st = R.host.state; if (st.phase === 'playing' && st.roundTick > 120 && forced < 2 && st.round === forced + 1) { killPlayer(st, forced, 1 - forced); forced++; } };
  const askers = new Set(), seen = { hostLoser: 0, clientLoser: 0 }; let lastPhase = '';
  const watch = () => { const ph = R.host.state.phase; if (ph === 'quiz' && lastPhase !== 'quiz') { askers.add(R.host.state.match.loser); seen[R.host.state.match.loser === 0 ? 'hostLoser' : 'clientLoser']++; } lastPhase = ph; };
  const origSlice = R.slice; R.slice = () => { origSlice(); R.forceLoss(); watch(); };
  const done = R.runUntil(() => hostPhase(R) === 'matchEnd', 40 * 60 * 1000);
  ok(done, 'the match finished (round ' + R.host.state.round + ', phase ' + hostPhase(R) + ')');
  R.run(2000);
  const hs = R.host.state, gs = R.guest.state;
  ok(Math.max(...hs.scores) === 5, 'someone has 5: ' + hs.scores);
  ok(gs.phase === 'matchEnd' && gs.scores[0] === hs.scores[0] && gs.scores[1] === hs.scores[1], 'the client shows the same final score: ' + gs.scores + ' vs ' + hs.scores);
  ok(seen.hostLoser > 0 && seen.clientLoser > 0, 'quiz turns for both sides: host-loser ' + seen.hostLoser + ', client-loser ' + seen.clientLoser);
  ok(JSON.stringify(gs.players.map((p) => p.cards)) === JSON.stringify(hs.players.map((p) => p.cards)), 'builds match: ' + JSON.stringify(gs.players.map((p) => p.cards)));
  ok(hs.players[0].cards.length + hs.players[1].cards.length >= 3, 'cards were picked');
  // rematch needs both
  R.host.sendIntent({ type: 'playAgain' }); R.run(600);
  ok(hostPhase(R) === 'matchEnd', 'one vote does not restart');
  R.guest.sendIntent({ type: 'playAgain' }); R.run(800);
  ok(hostPhase(R) !== 'matchEnd' && hs.scores[0] === 0 && hs.scores[1] === 0 && hs.players[0].cards.length === 0 && hs.round === 1, 'both voted: a fresh match');
  ok(R.guest.state.scores[0] === 0 && R.guest.state.scores[1] === 0 && R.guest.state.players[0].cards.length === 0, 'the client sees the fresh match too');
});

test('quiz secrecy: nothing sent to the client before the answer contains the correct index, the permutation or the explanation', () => {
  const R = rig({ latency: 30 }, { seed: 9 }); R.connect(); R.run(300);
  const sent = [];                                                // every message the host sends, with the state it was sent in
  const tr = R.host.transport, orig = tr.send.bind(tr);
  tr.send = (m, rel) => { sent.push({ json: JSON.stringify(m), phase: R.host.state.phase, answered: !!R.host.state.match.result, why: R.host.state.match.quiz ? R.host.state.match.quiz.why : '', qid: R.host.state.match.quiz && R.host.state.match.quiz.qid }); return orig(m, rel); };
  R.runUntil(() => R.host.state.round >= 4, 10 * 60 * 1000);
  const before = sent.filter((s) => s.phase === 'quiz' && !s.answered);
  ok(before.length >= 3, 'messages during unanswered quizzes: ' + before.length);
  for (const s of before) {
    ok(!s.json.includes('correctShown') && !s.json.includes('"order"'), 'no correct index / permutation: ' + s.json.slice(0, 120));
    ok(!s.json.includes('"why"') && (!s.why || !s.json.includes(s.why)), 'no explanation before the answer');
  }
  const after = sent.filter((s) => s.phase === 'quizReveal' && s.json.includes('"why"'));
  ok(after.length >= 1, 'the explanation is sent once the question was answered');
  // and the answered view contains the correct index so both screens can highlight it
  ok(sent.some((s) => s.phase === 'quizReveal' && s.json.includes('correctShown')), 'the reveal carries the correct index');
});

test('watcher: the other player sees the question (same answer order), the reveal with the explanation, the face-up offer with removed cards struck out, and the card taken', () => {
  const play = (loserIdx, wrong) => {
    const R = rig({ latency: 40 }, { seed: 12 + loserIdx }); R.connect(); R.intentsOn = false; R.bots = false; R.run(400);
    killPlayer(R.host.state, loserIdx, 1 - loserIdx);
    ok(R.runUntil(() => R.host.state.phase === 'quiz', 8000), 'quiz started: ' + R.host.state.phase);
    R.run(300);
    const answerer = loserIdx === 0 ? R.host : R.guest, watcher = loserIdx === 0 ? R.guest : R.host;
    const hm = R.host.state.match, wm = watcher.state.match;
    ok(watcher.state.phase === 'quiz' && wm.quiz && wm.quiz.answers.length === 4, 'the watcher sees the question');
    ok(JSON.stringify(wm.quiz.answers) === JSON.stringify(hm.quiz.answers) && wm.quiz.q === hm.quiz.q && wm.quiz.category === hm.quiz.category, 'same question, category and answer order');
    ok(wm.result === null && (watcher === R.host || !JSON.stringify(wm).includes('correctShown')), 'no answer yet for the watcher');
    const idx = wrong ? (hm.quiz.correctShown + 1) % 4 : hm.quiz.correctShown;
    answerer.sendIntent({ type: 'answer', index: idx }); R.run(300);
    ok(watcher.state.phase === 'quizReveal' && wm.result && typeof wm.result.correctShown === 'number' && wm.result.why.length > 5, 'the watcher sees the reveal with the explanation');
    ok(wm.result.picked === idx && wm.result.right === !wrong, 'and which answer was picked, right or wrong');
    answerer.sendIntent({ type: 'continue' }); R.run(300);
    ok(watcher.state.phase === 'cardPick' && wm.offer.length === 5 && wm.offer.every((x) => x !== '?'), 'the watcher sees all 5 offered cards face up');
    ok(JSON.stringify(wm.removed) === JSON.stringify(hm.removed), 'with the same removed cards struck out');
    const pick = wm.offer.find((x) => !wm.removed.includes(x)), removedN = wm.removed.length;
    answerer.sendIntent({ type: 'pick', cardId: pick }); R.run(400);
    ok(watcher.state.players[loserIdx].cards.includes(pick), 'and the card that was taken');
    return removedN;
  };
  ok(play(1, true) === 3, 'client loses, answers wrong: three removed, host watched');
  ok(play(0, false) === 0, 'host loses, answers right: nothing removed, client watched');
});

test('intent validation on the host: the client cannot answer or pick when it is not its turn; malformed messages are ignored', () => {
  const R = rig({ latency: 20 }, { seed: 13 }); R.connect(); R.intentsOn = false; R.run(300);
  const before = JSON.stringify(R.host.state.scores);
  R.guest.sendIntent({ type: 'answer', index: 0 }); R.guest.sendIntent({ type: 'pick', cardId: 'pinball' }); R.guest.sendIntent({ type: 'bogus' }); R.run(300);
  ok(R.host.state.phase === 'playing' && JSON.stringify(R.host.state.scores) === before, 'nothing changed');
  const x0 = R.host.state.players[1].x;
  R.host.transport.onmessage({ t: T.IN, f: Array(50).fill([1, 2, 3]) }); R.host.transport.onmessage({ t: T.IN, f: 'x' }); R.host.transport.onmessage({ t: T.IN, f: [[1, 'a', 3]] });
  R.run(100); ok(Number.isFinite(R.host.state.players[1].x), 'still fine after garbage');
});

test('disconnect + rejoin: the host pauses (no ticks), the client retries, the same state resumes (score, builds, phase)', () => {
  const R = rig({ latency: 30 }, { seed: 10 }); R.connect(); R.run(60000);
  const hs = R.host.state; ok(hs.round > 1 || hs.scores[0] + hs.scores[1] > 0, 'some match progress before the drop: round ' + hs.round);
  const snap = JSON.stringify({ s: hs.scores, c: hs.players.map((p) => p.cards), r: hs.round });
  const tr = R.guest.transport; tr.close('wifi died');                 // abrupt end of the connection
  R.run(400);
  ok(R.host.status === 'paused', 'host paused: ' + R.host.status); ok(R.log.hostStatus.some((s) => /paused/.test(s)), 'the host UI was told');
  ok(R.guest.status === 'reconnecting' || R.guest.status === 'playing', 'client noticed: ' + R.guest.status);
  const t0 = hs.tick; R.run(3000);
  ok(hs.tick === t0 || R.host.status === 'playing', 'no simulation ticks while paused');
  // the guest's reconnect loop gets the same token back in
  const resumed = R.runUntil(() => R.host.status === 'playing' && R.guest.status === 'playing', 15000);
  ok(resumed, 'rejoined: host ' + R.host.status + ', guest ' + R.guest.status);
  ok(JSON.stringify({ s: hs.scores, c: hs.players.map((p) => p.cards), r: hs.round }) === snap || hs.round >= JSON.parse(snap).r, 'state kept');
  R.run(1500);
  ok(R.guest.state.scores[0] === hs.scores[0] && R.guest.state.scores[1] === hs.scores[1], 'both screens agree again');
  ok(JSON.stringify(R.guest.state.players.map((p) => p.cards)) === JSON.stringify(hs.players.map((p) => p.cards)), 'builds restored on the client');
  R.run(3000); ok(hs.tick > t0, 'the match continues');
});

test('silent link death (nothing arrives any more) is detected by the timeout on both sides', () => {
  const R = rig({ latency: 30 }, { seed: 15 }); R.connect(); R.run(1500);
  R.net.opts.loss = 1; for (const t of [R.host.transport, R.guest.transport]) t.opts.loss = 1;     // black hole
  R.run(CONFIG.net.timeout * 1000 + 1500);
  ok(R.host.status === 'paused', 'host noticed: ' + R.host.status);
  ok(R.guest.status === 'reconnecting', 'client noticed: ' + R.guest.status);
});

test('the grace period ends: after 30 s without the client the host gives up and tells the UI; a returning client with a wrong token is refused', () => {
  const R = rig({ latency: 30 }, { seed: 16 }); R.connect(); R.run(1500);
  R.guest.opts.reconnect = null; R.guest.transport.close('gone');   // this client never comes back
  R.run(2000); ok(R.host.status === 'paused', 'paused');
  // an impostor (no token) cannot take the empty seat
  let rejected = null; const g2 = R.makeGuest('wrong-token'); g2.opts.onEnded = (r) => { rejected = r; };
  R.net.connectClient({ code: R.code, meta: {} }, { onopen: (tr) => g2.attach(tr) }); R.run(500);
  ok(rejected && /full/i.test(rejected) && R.host.status === 'paused', 'impostor refused: ' + rejected);
  R.run(CONFIG.net.graceSeconds * 1000);
  ok(R.host.status === 'ended' && /did not come back/.test(R.log.hostEnded || ''), 'grace over: ' + R.host.status + ' ' + R.log.hostEnded);
});

test('leaving on purpose: the other side is told immediately (no grace period)', () => {
  let R = rig({ latency: 30 }); R.connect(); R.run(800); R.guest.leave(); R.run(300);
  ok(R.host.status === 'ended' && /left/i.test(R.log.hostEnded), 'host: ' + R.log.hostEnded);
  R = rig({ latency: 30 }); R.connect(); R.run(800); R.host.leave(); R.run(300);
  ok(R.guest.status === 'ended' && /left/i.test(R.log.guestEnded), 'client: ' + R.log.guestEnded);
});

test('ping: both sides measure the round-trip time', () => {
  const R = rig({ latency: 60, jitter: 0 }); R.connect(); R.run(4000);
  near(R.guest.ping, 120, 15, 'client RTT'); near(R.host.ping, 120, 15, 'host RTT');
});

test('feel report: how late your own movement (1.5 units of it) shows up on the client at 60 / 100 / 150 ms round trip, with and without prediction', () => {
  const out = [];
  for (const on of [false, true]) {
    CONFIG.net.predictOwnMovement = on;
    const row = [];
    for (const rtt of [60, 100, 150]) {
      const R = rig({ latency: rtt / 2 }); R.bots = false; R.intentsOn = false; R.connect(); R.run(1500);
      R.held = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 }; R.run(500);
      const x0 = R.guest.state.players[1].x; let tPress = R.now; R.held = { ...R.held, right: true };
      const moved = R.runUntil(() => R.guest.state.players[1].x > x0 + 1.5, 2000);
      ok(moved, 'it moves at some point'); row.push(rtt + ' ms RTT: ' + Math.round(R.now - tPress) + ' ms');
    }
    out.push((on ? 'prediction ON: ' : 'prediction OFF: ') + row.join(', '));
  }
  CONFIG.net.predictOwnMovement = true;
  console.log('        feel: ' + out.join(' | '));
});

test('map rotation online: the host picks a new map every round, the client follows (same map id, its blocks, its name), all maps appear before a repeat', () => {
  const N = ROTATION.length;
  const R = rig({ latency: 40, jitter: 10 }, { seed: 10, rotate: true }); R.connect();
  const seen = []; let mismatch = 0, rounds = 0;
  const origSlice = R.slice; R.slice = () => {
    origSlice(); const h = R.host.state, g = R.guest.state;
    if (h.phase === 'matchEnd' && g.phase === 'matchEnd' && Math.floor(R.now / 4) % 100 === 0) { R.host.sendIntent({ type: 'playAgain' }); R.guest.sendIntent({ type: 'playAgain' }); }   // a rematch also draws a new map
    if (R.guest.ready && h.phase === 'playing' && h.roundTick > 90 && g.phase === 'playing' && g.mapId !== h.mapId) mismatch++;
    if (h.roundTick === 1 && h.phase === 'playing' && seen[seen.length - 1] !== h.round) { seen.push(h.round); rounds++; R.maps = (R.maps || []).concat(h.mapId); }
  };
  R.runUntil(() => (R.maps || []).length >= 2 * N + 1, 40 * 60 * 1000);
  ok((R.maps || []).length >= 2 * N + 1, 'enough rounds were played: ' + (R.maps || []).join());
  const m = R.maps;   // (the first map was given by the host, the shuffled bags start after it)
  for (let b = 0; b < 2; b++) ok(new Set(m.slice(1 + b * N, 1 + b * N + N)).size === N, 'all maps in block ' + b + ': ' + m.slice(1 + b * N, 1 + b * N + N));
  for (let i = 1; i < m.length; i++) ok(m[i] !== m[i - 1], 'no map twice in a row');
  ok(mismatch < 200, 'the client shows the host map (apart from the moment of the switch): ' + mismatch + ' mismatching slices');
  console.log('        maps: ' + m.join(' > '));
});

test('hover: the picker\'s pointed-at card is shown to the watcher (both directions); the watcher cannot set it', () => {
  const run = (loserIdx) => {
    const R = rig({ latency: 30 }, { seed: 20 + loserIdx }); R.connect(); R.intentsOn = false; R.bots = false; R.run(400);
    killPlayer(R.host.state, loserIdx, 1 - loserIdx);
    ok(R.runUntil(() => R.host.state.phase === 'quiz', 8000), 'quiz');
    const a = loserIdx === 0 ? R.host : R.guest, w = loserIdx === 0 ? R.guest : R.host;
    a.sendIntent({ type: 'answer', index: 0 }); R.run(300); a.sendIntent({ type: 'continue' }); R.run(300);
    ok(w.state.phase === 'cardPick', 'card pick');
    a.sendIntent({ type: 'hover', index: 3 }); R.run(300);
    ok(w.state.match.hover === 3, 'the watcher sees hover 3, got ' + w.state.match.hover);
    w.sendIntent({ type: 'hover', index: 1 }); R.run(300);
    ok(w.state.match.hover === 3, 'the watcher cannot move the hover');
    a.sendIntent({ type: 'hover', index: -1 }); R.run(300); ok(w.state.match.hover === -1, 'hover cleared');
  };
  run(1); run(0);
});

test('two players with the same name are told apart', () => {
  const R = rig({ latency: 10 }); R.guest.names[1] = 'HOSTY'; R.connect(); R.run(500);
  ok(R.host.names[0] === 'HOSTY' && R.host.names[1] !== 'HOSTY' && R.guest.names[1] === R.host.names[1], 'names: ' + R.host.names);
});

// ---------------------------------------------------------------------------------------------------------------------
//  Latency work: adaptive interpolation, snapshot rate, the unreliable channel, local echo, lag compensation, host tick rate,
//  the network readout and the connection diagnosis.
// ---------------------------------------------------------------------------------------------------------------------
test('a snapshot that was made before the newest match view and arrives after it cannot bring the old phase back (it froze the client in roundEnd while the host asked the quiz)', () => {
  const st = createState({ mapId: 'ruined-city', seed: 1, rotate: false });
  const w = new ClientWorld();
  const view = (v, phase) => ({ ...matchView(st), v, phase }); delete view(0, 'x').timer;
  w.applyView(view(17, 'roundEnd'));
  const snap = (tick, mvs, ph) => ({ ...buildSnap(st, tick, 0, mvs, 0), tick, ph });
  w.applySnap(snap(100, 17, 'roundEnd'), 0, 16.7);
  ok(w.state.phase === 'roundEnd', 'roundEnd while the views agree');
  w.applyView(view(18, 'quiz'));                                          // the quiz begins: a newer view
  ok(w.state.phase === 'quiz', 'the view moved us to the quiz');
  w.applySnap(snap(101, 17, 'roundEnd'), 16, 16.7);                       // an older snapshot overtakes the view on the unordered channel
  ok(w.state.phase === 'quiz', 'still in the quiz: ' + w.state.phase);
  w.applySnap(snap(102, 18, 'playing'), 32, 16.7);                        // a snapshot under the current view may move the phase (playing <-> roundEnd)
  ok(w.state.phase === 'playing', 'a snapshot made under the current view still moves the phase: ' + w.state.phase);
});

test('adaptive interpolation delay: short on a steady link, longer when the link jitters, always inside the clamp, and it changes smoothly (no time warp)', () => {
  const run = (o) => {
    const R = rig(o, { seed: 3 }); R.intentsOn = false; R.bots = false; R.connect(); R.run(2000);
    const series = []; for (let i = 0; i < 2500; i++) { R.slice(); series.push(R.guest.world.delayMs); }
    let maxUp = 0, maxDown = 0; for (let i = 1; i < series.length; i++) { maxUp = Math.max(maxUp, series[i] - series[i - 1]); maxDown = Math.max(maxDown, series[i - 1] - series[i]); }
    return { d: series[series.length - 1], maxUp, maxDown, R };
  };
  const clean = run({ latency: 20 }), jit = run({ latency: 40, jitter: 40, loss: 0.04 });
  const lo = CONFIG.net.interpMin * 1000, hi = CONFIG.net.interpMax * 1000;
  console.log('        interpolation delay: steady link ' + clean.d.toFixed(0) + ' ms, jittery link (+/-40 ms, 4% loss) ' + jit.d.toFixed(0) + ' ms (clamp ' + lo + '..' + hi + ' ms), largest step per 4 ms frame: up ' + jit.maxUp.toFixed(2) + ', down ' + jit.maxDown.toFixed(2));
  ok(clean.d >= lo && clean.d <= 70, 'steady link: ' + clean.d.toFixed(1) + ' ms (about 1.5 snapshot intervals)');
  ok(jit.d > clean.d + 15 && jit.d <= hi + 0.01, 'jittery link: ' + jit.d.toFixed(1) + ' ms');
  ok(jit.maxUp <= 8.01 && jit.maxDown <= 0.76 && clean.maxDown <= 0.76, 'smooth: per snapshot it grows at most 4 ms and shrinks at most 0.25 ms (a 4 ms frame can carry a burst of 2-3)');
  // against the fixed 100 ms the game used before, on the same links
  const saved = [CONFIG.net.interpMin, CONFIG.net.interpMax]; CONFIG.net.interpMin = CONFIG.net.interpMax = 0.1;
  const fixedJit = run({ latency: 40, jitter: 40, loss: 0.04 }), fixedClean = run({ latency: 20 }); [CONFIG.net.interpMin, CONFIG.net.interpMax] = saved;
  const ex = (x) => x.R.guest.world.stats.extrapolated;
  console.log('        frames drawn by extrapolation (buffer ran dry) in 10 s: steady link adaptive ' + ex(clean) + ' / fixed 100 ms ' + ex(fixedClean) + '; jittery link adaptive ' + ex(jit) + ' / fixed 100 ms ' + ex(fixedJit) + ' (of 2500)');
  ok(ex(clean) <= 5, 'steady link: the short delay does not starve the buffer: ' + ex(clean));
  ok(ex(jit) <= ex(fixedJit) + 10 && ex(jit) < 125, 'jittery link: no worse than the fixed delay and under 5% of the frames: ' + ex(jit) + ' vs ' + ex(fixedJit));
});

test('snapshot rate: 60 Hz while the link is good, 30 Hz when the round trip or the loss is high or the host machine is slow; the client is told', () => {
  const rate = (o, pre) => { const R = rig(o); R.intentsOn = false; R.bots = false; R.connect(); if (pre) pre(R); R.run(6000); return R; };
  const good = rate({ latency: 20 }), far = rate({ latency: 160 }), lossy = rate({ latency: 30, loss: 0.15 }, null);
  ok(good.host.snapEvery === 1 && good.guest.hostSnapEvery === 1, 'good link: every tick (' + good.host.snapEvery + ')');
  ok(far.host.snapEvery === 2 && far.guest.hostSnapEvery === 2, 'a 320 ms round trip: every second tick (' + far.host.snapEvery + ')');
  ok(lossy.host.snapEvery === 2, 'lossy link: every second tick (' + lossy.host.snapEvery + ', snapshot loss seen ' + lossy.guest.snapLoss.toFixed(2) + ')');
  const slow = rate({ latency: 20 }, (R) => { R.host.timeScale = 0.6; });
  ok(slow.host.hostSlow && slow.host.snapEvery === 2, 'a struggling host drops to 30 Hz: ' + slow.host.tickHz.toFixed(1) + ' ticks/s');
  ok(slow.guest.hostSlow && Math.abs(slow.guest.hostHz - slow.host.tickHz) < 3 && slow.guest.netInfo().hostSlow, 'the client knows: it reads ' + slow.guest.hostHz + ' ticks/s from the snapshots');
  ok(!good.host.hostSlow && !good.guest.hostSlow && good.guest.hostHz > 58, 'no warning on a healthy host (' + good.guest.hostHz + ' ticks/s)');
  // message size and traffic at both rates
  const bytes = (R) => R.guest.transport.stats.rxBytes / 6;
  console.log('        traffic to the client: 60 Hz ' + (bytes(good) / 1024).toFixed(1) + ' kB/s, 30 Hz ' + (bytes(far) / 1024).toFixed(1) + ' kB/s; snapshot ' + JSON.stringify({ t: 'snap', ...buildSnap(good.host.state, 1, 1, 1, 1, { hz: 60, se: 1, il: 0 }) }).length + ' bytes');
});

test('lag compensation: a client bullet is tested against where the host player WAS (bounded), so what the client aimed at counts; the host\'s own bullets and the shield are not rewound; a client cannot claim more than lagCompMax', () => {
  registerMap({ id: 'lc-room', name: 'test', background: 'none', spawns: [{ x: 300, y: 485 }, { x: 1000, y: 485 }], solids: [{ x: 60, y: 500, w: 1160, h: 40 }], destructibles: [], platforms: [] });
  const RUN = { left: false, right: true, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 }, IDLE = { ...RUN, right: false };
  // the host player runs right; the bullet sits where it was `back` ticks earlier. Does it count?
  const trial = (owner, lag, back) => {
    const s = createState({ mapId: 'lc-room', seed: 1, rotate: false }); s.cheats.invulnerable = [false, false]; s.lag = [0, 0];
    for (let i = 0; i < 90; i++) step(s, [IDLE, IDLE], STEP);
    s.roundTime = 0;
    for (let i = 0; i < 40; i++) step(s, [RUN, IDLE], STEP);
    const past = s.hist[(s.tick - back) & 15], target = s.players[0];
    ok(past && past[0] === s.tick - back, 'history has the tick');
    const hp0 = target.hp;
    const b = spawnBullet(s, owner, { x: past[1], y: past[2], angle: 0, speed: 0, damage: 20, gravity: 0 }); b.immune = 0;
    s.lag = [0, 0]; s.lag[owner] = lag;
    step(s, [RUN, IDLE], STEP);
    return { hit: target.hp < hp0, moved: Math.abs(target.x - past[1]) };
  };
  const present = trial(1, 0, 6), rewound = trial(1, 6, 6);
  console.log('        the host player had moved ' + present.moved.toFixed(0) + ' units since the client saw it: a bullet at the old spot misses without lag compensation (' + !present.hit + ') and hits with it (' + rewound.hit + ')');
  ok(present.moved > 25, 'the target really moved on: ' + present.moved);
  ok(!present.hit, 'without compensation the bullet at the old spot misses');
  ok(rewound.hit, 'with a rewind of 6 ticks the same bullet hits');
  ok(!trial(1, 1, 6).hit && !trial(1, 12, 6).hit, 'a rewind that does not match where the client saw it does not hit (it is not a bigger hitbox)');
  // bounded: the host clamps what the client reports
  const R = rig({ latency: 20 }); R.intentsOn = false; R.bots = false; R.connect(); R.run(2000);
  R.host._onInput({ f: [[999999, 0, 0]], vd: 100000 }); R.host._measure(R.now);
  ok(R.host.clientVd === CONFIG.net.lagCompMax * 1000 && R.host.lagTicks <= Math.round(CONFIG.net.lagCompMax * CONFIG.tickRate), 'a client claiming 100 s of lag gets ' + R.host.clientVd + ' ms / ' + R.host.lagTicks + ' ticks at most');
  ok(R.host.lagTicks < 16, 'always inside the 16-tick position history');
  R.host._tick(R.now);
  ok(R.host.state.lag[0] === 0 && R.host.state.lag[1] === R.host.lagTicks, 'only the client\'s bullets are rewound, the host\'s own are tested in the present: ' + JSON.stringify(R.host.state.lag));
  R.host._onInput({ f: [[999998, 0, 0]], vd: -50 });
  ok(R.host.clientVd === CONFIG.net.lagCompMax * 1000, 'a negative claim is ignored');
  R.host._onInput({ f: [[999997, 0, 0]], vd: 'lots' });
  ok(R.host.clientVd === CONFIG.net.lagCompMax * 1000, 'a non-number claim is ignored');
});

test('the second, truly unreliable channel: { ordered: false, maxRetransmits: 0 } with a fixed id on the same connection; snapshots and inputs use it only once both sides proved it works; the reliable channel carries the rest and is the fallback', () => {
  const log = { r: [], u: [] }; let chOpts = null, fakeCh = null, throwOnCreate = false;
  const mkConn = () => ({ handlers: {}, on(ev, fn) { this.handlers[ev] = fn; }, send(s) { log.r.push(s); }, close() {}, peerConnection: { addEventListener() {}, createDataChannel(name, o) { if (throwOnCreate) throw new Error('refused'); chOpts = o; fakeCh = { readyState: 'open', send(s) { log.u.push(s); }, close() {} }; return fakeCh; } } });
  const t = new PeerTransport(mkConn(), null); const got = []; t.onmessage = (m) => got.push(m);
  t.setupUnreliable();
  ok(chOpts && chOpts.ordered === false && chOpts.maxRetransmits === 0 && chOpts.negotiated === true && Number.isInteger(chOpts.id), 'options: ' + JSON.stringify(chOpts));
  t.send({ t: 'snap', n: 1 }, false);
  ok(log.r.length === 1 && log.u.length === 0 && t.channel === 'reliable only', 'before the probe is answered everything goes the reliable way');
  fakeCh.onmessage({ data: 'U!' });                                                        // the other side answered our probe
  ok(t.usingUnreliable && /unreliable/.test(t.channel), 'channel label: ' + t.channel);
  t.send({ t: 'snap', n: 2 }, false); t.send({ t: 'ev', n: 3 }, true);
  ok(log.u.length === 1 && JSON.parse(log.u[0]).n === 2 && log.r.length === 2 && JSON.parse(log.r[1]).n === 3, 'snapshots go unreliable, events stay reliable');
  fakeCh.onmessage({ data: JSON.stringify({ t: 'in', f: [[1, 0, 0]] }) }); fakeCh.onmessage({ data: 'U?' });
  ok(got.length === 1 && got[0].t === 'in', 'messages from the fast channel are delivered, probes are not');
  ok(log.u.some((s) => s === 'U!'), 'a probe from the other side is answered');
  fakeCh.onclose(); t.send({ t: 'snap', n: 4 }, false);
  ok(!t.usingUnreliable && log.r.length === 3, 'if the fast channel closes everything falls back to the reliable one');
  throwOnCreate = true; const t2 = new PeerTransport(mkConn(), null); t2.setupUnreliable(); t2.send({ t: 'snap' }, false);
  ok(!t2.usingUnreliable && t2.channel === 'reliable only', 'a browser that refuses the channel keeps working on the reliable one');
  // the selected ICE candidate pair says direct or relayed
  const stats = new Map([['T', { type: 'transport', selectedCandidatePairId: 'P' }], ['P', { type: 'candidate-pair', id: 'P', localCandidateId: 'L', remoteCandidateId: 'M', currentRoundTripTime: 0.042 }], ['L', { type: 'local-candidate', candidateType: 'srflx', protocol: 'udp' }], ['M', { type: 'remote-candidate', candidateType: 'host', protocol: 'udp' }]]);
  const c3 = mkConn(); c3.peerConnection.getStats = async () => stats; const t3 = new PeerTransport(c3, null);
  return t3.probePath().then((p) => {
    ok(p && p.kind === 'direct' && p.local === 'srflx' && p.rtt === 42, 'direct path: ' + JSON.stringify(p));
    stats.get('M').candidateType = 'relay'; return t3.probePath();
  }).then((p) => { ok(p.kind === 'relayed', 'relayed path: ' + JSON.stringify(p)); ok(/relayed/.test(describePath(p)), describePath(p)); t.close('x'); t2.close('x'); t3.close('x'); });
});

test('local echo: your own shot, recoil and shield show at once; the echo agrees with the host on which frames fire; no phantom shots; one bullet per shot on screen', () => {
  const press = { left: false, right: false, jump: false, jumpPressed: false, shoot: true, shootPressed: true, block: false, aim: 0 };
  for (const rtt of [60, 150]) {
    const R = rig({ latency: rtt / 2, jitter: rtt / 10, loss: 0.02 }, { seed: 4 }); R.intentsOn = false; R.bots = false; R.connect(); R.run(2500);
    R.host.state.cheats.invulnerable = [true, true];
    // the first click: a bullet of yours is drawn within a frame or two (not after a round trip)
    let t0 = R.now; R.held = { ...press }; let first = null; const seen = [];
    while (R.now - t0 < 800) { R.slice(); const r = R.guest.render(R.now); if (first === null && r.state.bullets.some((b) => b.owner === 1)) first = R.now - t0; R.held = { ...press, shootPressed: false }; }
    ok(first !== null && first <= 24, 'RTT ' + rtt + ': bullet drawn after ' + first + ' ms');
    // hold the trigger for a while: fire interval, magazine and reload are mirrored, so the client foresees every shot
    R.held = { ...press, shootPressed: false }; const shotsBefore = R.events.filter((e) => e.type === 'shot' && e.player === 1).length, fired0 = R.guest.echo.stats.fired;
    let maxDrawn = 0, maxHost = 0;
    for (let i = 0; i < 2500; i++) { R.slice(); const r = R.guest.render(R.now); maxDrawn = Math.max(maxDrawn, r.state.bullets.filter((b) => b.owner === 1).length); maxHost = Math.max(maxHost, R.host.state.bullets.filter((b) => b.owner === 1).length); }
    R.held = null; R.run(1500);
    const hostShots = R.events.filter((e) => e.type === 'shot' && e.player === 1).length - shotsBefore, foreseen = R.guest.echo.stats.fired - fired0;
    console.log('        RTT ' + rtt + ' ms: first bullet ' + first + ' ms after the click; ' + foreseen + ' shots foreseen of ' + hostShots + ' fired by the host; provisional bullets paired with the host\'s ' + R.guest.echo.stats.paired + '/' + R.guest.echo.stats.spawned + '; most own bullets on screen ' + maxDrawn + ' (host ' + maxHost + ')');
    ok(Math.abs(foreseen - hostShots) <= 1, 'foreseen ' + foreseen + ' vs host ' + hostShots + ' (a phantom shot would show a bullet the host never fired)');
    ok(R.guest.echo.stats.paired >= R.guest.echo.stats.spawned - 2, 'every provisional bullet met its authoritative twin');
    ok(maxDrawn <= maxHost + 1, 'never two bullets drawn for one shot: most own bullets drawn ' + maxDrawn + ', host ' + maxHost);
  }
  // no ammo / reloading / shield up: no echo at all
  { const R = rig({ latency: 40 }, { seed: 4 }); R.intentsOn = false; R.bots = false; R.connect(); R.run(2500);
    R.host.state.players[1].ammo = 0; R.host.state.players[1].reloadLeft = 1.5; R.run(100);
    const f0 = R.guest.echo.stats.fired; R.held = { ...press, shootPressed: false }; R.run(900); R.held = null;
    ok(R.guest.echo.stats.fired === f0, 'reloading: no shot is echoed (' + (R.guest.echo.stats.fired - f0) + ')');
    R.run(2500); const b0 = R.guest.echo.stats.blocked, hb0 = R.events.filter((e) => e.type === 'blockStart' && e.player === 1).length;
    let t0 = R.now; R.held = { ...press, shoot: false, shootPressed: false, block: true }; let shield = null;
    while (R.now - t0 < 600) { R.slice(); const r = R.guest.render(R.now); if (shield === null && r.state.players[1].blockLeft > 0) shield = R.now - t0; if (R.now - t0 > 100) R.held = { ...R.held, block: false }; }
    R.run(1000);
    const hb = R.events.filter((e) => e.type === 'blockStart' && e.player === 1).length - hb0;
    ok(shield !== null && shield <= 16, 'your shield is drawn after ' + shield + ' ms at RTT 80');
    ok(R.guest.echo.stats.blocked - b0 === hb && hb === 1, 'one block, echoed once (' + (R.guest.echo.stats.blocked - b0) + ') and started once by the host (' + hb + ')');
    // holding the button down does not retrigger; the cooldown is mirrored
    R.held = { ...press, shoot: false, shootPressed: false, block: true }; R.run(3000); const b2 = R.guest.echo.stats.blocked; R.held = null;
    ok(R.guest.echo.stats.blocked - b0 <= 2, 'cooldown respected: ' + (b2 - b0) + ' blocks in 3 s'); }
});

test('a quiet bad link: ping with jitter and loss is measured on both sides, the quality colour follows, and the readout names the channel', () => {
  const bad = rig({ latency: 90, jitter: 40, loss: 0.1 }, { seed: 3 }); bad.intentsOn = false; bad.bots = false; bad.connect(); bad.run(12000);
  const fine = rig({ latency: 15, jitter: 2 }, { seed: 3 }); fine.intentsOn = false; fine.bots = false; fine.connect(); fine.run(12000);
  const gb = bad.guest.netInfo(), hb = bad.host.netInfo(), gf = fine.guest.netInfo();
  console.log('        bad link, client view: ping ' + gb.ping.toFixed(0) + ' ms, jitter ' + gb.jitter.toFixed(0) + ' ms, snapshot loss ' + (gb.lossIn * 100).toFixed(1) + '%, input loss ' + (gb.lossOut * 100).toFixed(1) + '%, quality ' + gb.quality + ' | steady link: ' + gf.ping.toFixed(0) + ' ms, quality ' + gf.quality);
  ok(gb.ping > 140 && gb.jitter > 5, 'client ping/jitter: ' + gb.ping + ' / ' + gb.jitter);
  ok(gb.lossIn > 0.03 && gb.lossIn < 0.3, 'snapshot loss measured from sequence numbers: ' + gb.lossIn);
  ok(hb.lossOut > 0.03 && Math.abs(hb.lossOut - gb.lossIn) < 0.06, 'the host hears about it too: ' + hb.lossOut + ' vs ' + gb.lossIn);
  ok(gb.quality === 'poor' && hb.quality !== 'good', 'quality: ' + gb.quality + ' / ' + hb.quality);
  ok(gf.quality === 'good' && gf.snapHz === 60 && gf.interpMs !== null && gf.channel === 'loopback', 'a steady link is good: ' + JSON.stringify(gf));
  ok(netQuality({ ping: null }) === 'unknown' && netQuality({ ping: 50, jitter: 3, loss: 0 }) === 'good' && netQuality({ ping: 100 }) === 'ok' && netQuality({ ping: 50, loss: 0.1 }) === 'poor' && netQuality({ ping: 50, jitter: 60 }) === 'poor', 'thresholds');
  ok(describePath(null) === '-' && /direct \(same network/.test(describePath({ kind: 'direct', local: 'host', remote: 'host', protocol: 'udp' })), 'describePath');
});

test('connection diagnosis: candidate parsing, the verdict for every failing step, and plain-language error texts', () => {
  const c = (typ, ip, port) => 'candidate:1 1 udp 2113937151 ' + ip + ' ' + port + ' typ ' + typ + ' generation 0';
  const open = classifyCandidates([c('host', 'abcd.local', 5000), c('srflx', '203.0.113.7', 40001)]);
  ok(open.host === 1 && open.srflx === 1 && open.ports[0] === '203.0.113.7:40001', 'parse ' + JSON.stringify(open));
  const cr = (ip, port, rport) => 'candidate:1 1 udp 1677729535 ' + ip + ' ' + port + ' typ srflx raddr 0.0.0.0 rport ' + rport + ' generation 0';
  const strict = classifyCandidates([cr('203.0.113.7', 40001, 55000), cr('203.0.113.7', 40002, 55000)]);
  const dual = classifyCandidates([cr('203.0.113.7', 40001, 55000), cr('2001:db8::7', 40001, 55001), cr('203.0.113.7', 40003, 55002)]);   // IPv4 + IPv6, or two local sockets: not strict
  const blocked = classifyCandidates([c('host', 'abcd.local', 5000)]);
  const broker = { ok: true, ms: 120 };
  ok(verdictFor({ webrtc: true, broker, ice: open }).level === 'good' && verdictFor({ webrtc: true, broker, ice: dual }).level === 'good', 'good (also with several local sockets or IPv4 + IPv6)');
  ok(verdictFor({ webrtc: true, broker, ice: strict }).level === 'warn' && /strict NAT/.test(verdictFor({ webrtc: true, broker, ice: strict }).headline), 'strict NAT');
  const noUdp = verdictFor({ webrtc: true, broker, ice: blocked });
  ok(noUdp.level === 'bad' && /blocked/.test(noUdp.headline) && /hotspot/.test(noUdp.advice), 'UDP blocked: ' + noUdp.headline);
  const noBroker = verdictFor({ webrtc: true, broker: { ok: false, error: 'no answer' }, ice: open });
  ok(noBroker.level === 'bad' && /matchmaking/.test(noBroker.headline) && /hotspot/.test(noBroker.advice), 'broker: ' + noBroker.headline);
  ok(verdictFor({ webrtc: false }).level === 'bad', 'no WebRTC');
  for (const [type, re] of [['peer-unavailable', /Room not found/], ['broker', /matchmaking server/], ['failed', /hotspot or your home network/], ['timeout', /peer-to-peer/], ['id-taken', /already in use/], ['full', /full/], ['version', /different version/]]) ok(re.test(describeError({ type })), type + ': ' + describeError({ type }));
  // the runner (with fakes): the report says which step failed
  class FakeRTC { constructor() { this.onicecandidate = null; } createDataChannel() {} createOffer() { return Promise.resolve({}); } setLocalDescription() { setTimeout(() => { this.onicecandidate({ candidate: { candidate: c('host', 'x.local', 1) } }); this.onicecandidate({ candidate: null }); }, 1); return Promise.resolve(); } close() {} }
  return runConnectionTest({ probeBroker: async () => ({ ok: true, ms: 80 }), RTC: FakeRTC }).then((r) => {
    ok(r.lines.length === 3 && r.verdict.level === 'bad' && /\[FAIL\] Peer-to-peer/.test(r.report) && /\[ok\]   Matchmaking server: reachable \(80 ms\)/.test(r.report), 'report:\n' + r.report);
    console.log('        sample report:\n          ' + r.report.split('\n').join('\n          '));
  });
});

// ---------------------------------------------------------------------------------------------------------------------
for (const t of pending) {
  try { await t.fn(); passed++; console.log('PASS  ' + t.name); }
  catch (e) { failed++; console.log('FAIL  ' + t.name + '\n        ' + (e.stack || e.message).split('\n').slice(0, 3).join('\n        ')); }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

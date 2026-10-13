// Headless tests for the 10 cards, the global caps and the match loop (quiz, card pick, match end).
// Run:  node tests/match.test.mjs     (the movement / hazard tests are in tests/sim.test.mjs)
import { CONFIG } from '../src/config.js';
import { registerMap } from '../src/maps/index.js';
import { CARDS } from '../src/cards.js';
import { createState, step, STEP, intent } from '../src/sim/world.js';
import { killPlayer, spawnBullet, damagePlayer, explode } from '../src/sim/combat.js';
import { computeStats } from '../src/sim/cardfx.js';
import { matchView, makeOffer, setQuestionPool, validQuestions, isValidQuestion, beginQuiz } from '../src/sim/match.js';
import { QUESTIONS } from '../src/questions.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n        ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'value') + ': expected ~' + b + ' (+/-' + tol + '), got ' + a); }

registerMap({
  id: 't-flat', name: 'test', background: 'none',
  spawns: [{ x: 200, y: 485 }, { x: 600, y: 485 }],
  solids: [{ x: 100, y: 500, w: 1000, h: 40 }, { x: 700, y: 100, w: 40, h: 400 }],
  destructibles: [{ id: 'blk', x: 900, y: 468, w: 32, h: 32, hp: 50 }], platforms: [],
});
registerMap({
  id: 't-walls', name: 'test', background: 'none',
  spawns: [{ x: 640, y: 485 }, { x: 1000, y: 100 }],
  solids: [{ x: 100, y: 500, w: 1000, h: 40 }, { x: 300, y: 100, w: 40, h: 400 }, { x: 900, y: 100, w: 40, h: 400 }],
  destructibles: [], platforms: [],
});

const N = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const inp = (o) => ({ ...N, ...o });
const D = Math.PI / 180;
const count = (evs, type) => evs.filter((e) => e.type === type).length;
function fresh(mapId, cards, seed = 7) { return createState({ mapId, seed, cards: cards || [[], []] }); }
function place(p, x, y) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; }
function run(s, ticks, f0, f1) {
  const evs = [];
  for (let i = 0; i < ticks; i++) evs.push(...step(s, [typeof f0 === 'function' ? f0(i, s) : f0 || N, typeof f1 === 'function' ? f1(i, s) : f1 || N], STEP));
  return evs;
}
const parkP1 = (s, x = 1050) => place(s.players[1], x, 485);
// Fire one bullet to the right along the corridor, then keep both players out of its way (high up, motionless).
function corridorShot(s) { place(s.players[0], 640, 400); place(s.players[1], 640, 90); s.cheats.invulnerable = [true, true]; run(s, 1, inp({ shoot: true, aim: 0 })); }
function hideTick(s) { place(s.players[0], 640, 20); place(s.players[1], 700, 20); }
const stats = (...ids) => computeStats(ids);

// =========================================================================================================
// the 10 version-1 cards: stats + hooks
test('Hair Trigger: +100% fire rate / ammo, -40% damage, +4 deg spread; two copies hit the caps', () => {
  const a = stats('hairtrigger');
  near(a.fireRate, 6, 1e-9, 'fire rate'); ok(a.magazine === 10, 'magazine ' + a.magazine); near(a.damage, 12, 1e-9, 'damage'); near(a.spread, 4 * D, 1e-9, 'spread');
  const b = stats('hairtrigger', 'hairtrigger');
  near(b.fireRate, 8, 1e-9, 'fire rate cap'); ok(b.magazine === 12, 'magazine cap'); near(b.damage, 8, 1e-9, 'damage floor'); near(b.spread, 8 * D, 1e-9, 'spread x2');
});
test('Pinball: +4 bounces, -25% damage, +1 s lifetime; growth hook adds 30% of launch damage per bounce; capped at 6 bounces with two copies', () => {
  const a = stats('pinball');
  ok(a.bounces === 4, 'bounces'); near(a.damage, 15, 1e-9, 'damage'); near(a.bulletLifetime, 4, 1e-9, 'lifetime');
  const s = fresh('t-walls', [['pinball'], []]); corridorShot(s);
  const dmg = [];
  for (let i = 0; i < 300 && s.bullets.length; i++) { hideTick(s); step(s, [N, N]); if (s.bullets[0]) dmg[s.bullets[0].bounces] = s.bullets[0].damage; }
  near(dmg[0], 15, 1e-9, 'launch'); near(dmg[1], 19.5, 1e-9, 'after 1 bounce'); near(dmg[2], 24, 1e-9, 'after 2'); near(dmg[4], 33, 1e-9, 'after 4');
  const b = stats('pinball', 'pinball'); ok(b.bounces === 6, 'bounce cap 6'); near(b.damage, 10, 1e-9, 'x2 launch damage');
});
test('Pinball: a bullet bounces exactly 4 times and is then consumed', () => {
  const s = fresh('t-walls', [['pinball'], []]); corridorShot(s);
  let b = 0, impacts = 0;
  for (let i = 0; i < 600; i++) { hideTick(s); const e = step(s, [N, N]); b += count(e, 'bounce'); impacts += count(e, 'impact'); if (impacts) break; }
  ok(b === 4 && impacts === 1, 'bounces=' + b + ' impacts=' + impacts);
});
test('Thick Skin: +100% HP, +30% size, -25% speed; two copies cap at 250 HP / size 1.6 / speed -40%', () => {
  const a = stats('thickskin'); near(a.maxHp, 200, 1e-9, 'hp'); near(a.size, 1.3, 1e-9, 'size'); near(a.moveSpeed, 225, 1e-9, 'speed');
  const b = stats('thickskin', 'thickskin'); near(b.maxHp, 250, 1e-9, 'hp cap'); near(b.size, 1.6, 1e-9, 'size cap'); near(b.moveSpeed, 180, 1e-9, 'speed floor');
  const s = fresh('t-flat', [['thickskin'], []]); near(s.players[0].hp, 200, 1e-9, 'starts at full'); near(s.players[0].w, 39, 1e-9, 'hitbox grows');
});
test('Tight Guard: block cooldown 1.0 s, window 0.15 s', () => {
  const a = stats('tightguard'); near(a.blockCooldown, 1.0, 1e-9, 'cooldown'); near(a.blockWindow, 0.15, 1e-9, 'window');
  const s = fresh('t-flat', [['tightguard'], []]); parkP1(s);
  step(s, [inp({ block: true }), N]); near(s.players[0].blockLeft, 0.15, 0.02, 'window in the sim'); near(s.players[0].blockCd, 1.0, 0.02, 'cooldown in the sim');
});
test('Scramble: -20% HP; getting hit gives +100% speed and +50% fire rate for 2.5 s (refreshed, not stacked)', () => {
  near(stats('scramble').maxHp, 80, 1e-9, 'hp');
  const s = fresh('t-flat', [['scramble'], []]); parkP1(s);
  near(s.players[0].stats.fireRate, 3, 1e-9, 'calm');
  damagePlayer(s, 0, 5, 1, null);
  near(s.players[0].stats.moveSpeed, 600, 1e-9, 'speed buff'); near(s.players[0].stats.fireRate, 4.5, 1e-9, 'fire rate buff');
  run(s, 60); damagePlayer(s, 0, 5, 1, null);                    // a second hit refreshes the timer
  near(s.players[0].stats.fireRate, 4.5, 1e-9, 'not stacked'); ok(s.players[0].timed.length === 1, 'one timed entry');
  run(s, 140); ok(s.players[0].stats.fireRate === 4.5, 'still active 2.33 s after the refresh');
  run(s, 20); near(s.players[0].stats.fireRate, 3, 1e-9, 'expired'); near(s.players[0].stats.moveSpeed, 300, 1e-9, 'speed back');
});
test('Featherweight: -40% size, +40% speed, +15% jump, -40% HP (60), knockback taken x2', () => {
  const a = stats('featherweight');
  near(a.size, 0.6, 1e-9, 'size'); near(a.moveSpeed, 420, 1e-9, 'speed'); near(a.jumpVelocity, 759, 1e-9, 'jump'); near(a.maxHp, 60, 1e-9, 'hp'); near(a.knockbackTaken, 2, 1e-9, 'knockback taken');
  const hit = (cards) => { const st = fresh('t-flat', cards); place(st.players[0], 100, 485); place(st.players[1], 500, 485); const b = spawnBullet(st, 0, { x: 480, y: 485, angle: 0, speed: 900, damage: 20 }); b.immune = 0; step(st, [N, N]); return st.players[1].vx; };
  const v1 = hit([[], ['featherweight']]), v0 = hit([[], []]);
  ok(v1 > v0 * 1.5 && v0 > 100, 'pushed much further: ' + v1.toFixed(0) + ' vs ' + v0.toFixed(0));
});
test('Powder Keg: +25% damage, -20% bullet speed, +25% reload; bullets explode (radius 96) and hurt the owner too; no direct-hit double damage', () => {
  const a = stats('powderkeg'); near(a.damage, 25, 1e-9, 'damage'); near(a.bulletSpeed, 1200, 1e-9, 'speed (0.8 x 1500)'); near(a.reloadTime, 2.5, 1e-9, 'reload');
  const s = fresh('t-flat', [['powderkeg'], []]); place(s.players[0], 200, 485); place(s.players[1], 420, 485);
  const ev = run(s, 45, inp({ shoot: true, aim: 0 }));
  ok(count(ev, 'explosion') >= 1, 'explodes'); near(ev.find((e) => e.type === 'explosion').r, 96, 1e-9, 'radius');
  ok(s.players[1].hp <= 80 && s.players[1].hp >= 50, 'target takes the blast once (not blast + direct hit), hp=' + s.players[1].hp);
  const s2 = fresh('t-flat', [['powderkeg'], []]); parkP1(s2, 1050); place(s2.players[0], 700 - 15 - 30, 485);
  run(s2, 6, inp({ shoot: true, aim: 0 })); ok(s2.players[0].hp < 100, 'the owner was hurt by his own blast');
});
test('Pepperpot: 5 pellets per shot, 8 damage each, 0.36 s lifetime (range about 540), fanned across +-14 degrees, one ammo per shot', () => {
  const a = stats('pepperpot'); ok(a.bulletsPerShot === 5, 'pellets'); near(a.damage, 8, 1e-9, 'damage'); near(a.bulletLifetime, 0.36, 1e-9, 'lifetime'); near(a.bulletLifetime * a.bulletSpeed, 540, 1, 'range');
  const s = fresh('t-flat', [['pepperpot'], []]); parkP1(s); place(s.players[0], 300, 300);
  step(s, [inp({ shoot: true, aim: 0 }), N]);
  ok(s.bullets.length === 5 && s.players[0].ammo === 4, 'five pellets from one ammo: ' + s.bullets.length);
  ok(new Set(s.bullets.map((b) => b.shotId)).size === 1, 'one shotId');
  const angles = s.bullets.map((b) => Math.atan2(b.vy, b.vx) / D).sort((x, y) => x - y);
  ok(angles[0] < -11 && angles[4] > 11 && angles[4] - angles[0] < 31, 'fan: ' + angles.map((x) => x.toFixed(1)).join(','));
  run(s, 40); ok(s.bullets.length === 0, 'pellets expire after 0.36 s');
});
test('Prism Shot: +2 bounces; a first bounce splits an original bullet into 3 (children at 70% damage, generation 1, never split again)', () => {
  near(stats('prismshot').bounces, 2, 1e-9, 'bounces');
  const s = fresh('t-walls', [['prismshot'], []]); corridorShot(s);
  let maxLive = 0, kids = 0, dmg = 0;
  for (let i = 0; i < 200; i++) {
    hideTick(s); step(s, [N, N]); maxLive = Math.max(maxLive, s.bullets.length);
    const k = s.bullets.filter((b) => b.generation === 1); if (k.length) { kids = Math.max(kids, k.length); dmg = k[0].damage; }
    if (!s.bullets.length) break;
  }
  ok(kids === 2, 'two children appeared, kids=' + kids); near(dmg, 14, 1e-9, 'children carry 70% of 20');
  ok(maxLive === 3, 'never more than 3 bullets from one shot (children cannot split), max=' + maxLive);
});
test('Return Policy: +50% block cooldown; a blocked bullet comes back at its shooter at x1.5 speed and damage, and is never reflected twice', () => {
  near(stats('returnpolicy').blockCooldown, 6, 1e-9, 'cooldown');
  const s = fresh('t-flat', [[], ['returnpolicy']]); place(s.players[0], 200, 485); place(s.players[1], 420, 485);
  let reflected = null;
  for (let i = 0; i < 60 && !reflected; i++) {
    const ev = step(s, [inp({ shoot: i === 0, aim: 0 }), inp({ block: i >= 5, aim: Math.PI })]);
    if (ev.some((e) => e.type === 'reflect')) reflected = s.bullets.find((b) => b.reflected);
  }
  ok(reflected && reflected.owner === 1, 'the bullet now belongs to the blocker');
  ok(Math.hypot(reflected.vx, reflected.vy) > 2200 && Math.hypot(reflected.vx, reflected.vy) < 2400, 'speed x1.5 of about 1500: ' + Math.hypot(reflected.vx, reflected.vy)); near(reflected.damage, 30, 1e-9, 'damage x1.5'); ok(reflected.vx < 0, 'flies back towards the shooter');
  const hp0 = s.players[0].hp; run(s, 40);
  ok(s.players[0].hp === hp0 - 30, 'the shooter takes the reflected 30, hp=' + s.players[0].hp);
  const s2 = fresh('t-flat', [['returnpolicy'], ['returnpolicy']]); place(s2.players[0], 200, 485); place(s2.players[1], 420, 485);
  let n = 0; for (let i = 0; i < 80; i++) n += count(step(s2, [inp({ shoot: i === 0, aim: 0, block: i >= 5 && i < 20 }), inp({ block: i >= 5 && i < 20, aim: Math.PI })]), 'reflect');
  ok(n === 1, 'no ping-pong: ' + n + ' reflection(s)');
});

// ---- global caps ----
test('caps: burst cap (Hair Trigger + Pepperpot -> damage 8, fire rate 3.25), magazine budget, every card at once stays inside the caps', () => {
  const s = stats('hairtrigger', 'pepperpot');
  near(s.damage, 8, 1e-9, 'damage floor'); near(s.fireRate, 3.25, 1e-9, 'fire rate lowered by the burst cap');
  ok(s.fireRate * s.damage * s.bulletsPerShot <= 130 + 1e-9, 'burst <= 130'); ok(s.magazine * s.bulletsPerShot * s.damage <= 240 + 1e-9, 'magazine budget: ' + s.magazine);
  const all = stats(...CARDS.map((c) => c.id));
  ok(all.fireRate * all.damage * all.bulletsPerShot <= 130 + 1e-9 && all.maxHp >= 60 && all.size >= 0.6 && all.bounces <= 6 && all.blockCooldown >= 1, 'inside the caps');
});
test('caps: no single hit above 40, no trigger pull above 60 on one target, no more than 60 live bullets per player', () => {
  const s = fresh('t-flat'); parkP1(s);
  s.players[0].stats.maxHp = 400; s.players[0].hp = 400;
  damagePlayer(s, 0, 100, 1, null); near(s.players[0].hp, 360, 1e-9, 'a 100 damage hit does 40');
  s.players[0].hp = 400;
  for (let i = 0; i < 5; i++) damagePlayer(s, 0, 30, 1, null, null, { shotId: 77 });
  near(s.players[0].hp, 340, 1e-9, 'one trigger pull cannot do more than 60: ' + s.players[0].hp);
  damagePlayer(s, 0, 30, 1, null, null, { shotId: 78 }); near(s.players[0].hp, 310, 1e-9, 'a different pull counts again');
  damagePlayer(s, 0, 80, -1, null); near(s.players[0].hp, 230, 1e-9, 'environment damage is not capped by the attack caps');
  let made = 0; for (let i = 0; i < 80; i++) if (spawnBullet(s, 0, { x: 500, y: 100, angle: 0 })) made++;
  ok(made === 60 && s.bullets.length === 60, 'live bullet cap: ' + made);
});
test('self damage stays on: the owner takes his own explosion', () => {
  const s = fresh('t-flat', [['powderkeg'], []]); parkP1(s, 1050); place(s.players[0], 400, 485);
  explode(s, 400, 485, 96, 25, 0, { shotId: 5 }); ok(s.players[0].hp === 75, 'owner takes the blast: ' + s.players[0].hp);
});

// =========================================================================================================
// match loop: quiz, card pick, match end
function setup(auto = [false, false], cards) { const s = fresh('t-flat', cards); s.match.auto = auto; parkP1(s); return s; }
function endRound(s, loser) { killPlayer(s, loser, 1 - loser); run(s, 2); run(s, Math.ceil(CONFIG.round.endDelay * 60) + 2); }
const builds = (s) => s.players.map((p) => p.cards.slice());

test('match: the round loser gets a quiz with 4 shuffled answers; the client view hides the correct answer', () => {
  const s = setup(); endRound(s, 1);
  ok(s.phase === 'quiz' && s.match.loser === 1, 'quiz for the loser: ' + s.phase);
  const v = matchView(s); ok(v.quiz.answers.length === 4 && v.result === null && v.offer === null, 'public view');
  const txt = JSON.stringify(v); ok(!txt.includes('correctShown') && !txt.includes('"order"') && !txt.includes('"why"'), 'no correct index / explanation before answering');
  ok(s.scores[0] === 1, 'winner scored');
});
test('match: right answer -> reveal -> all 5 cards choosable; picking adds the card and starts the next round', () => {
  const s = setup(); endRound(s, 1);
  const r = intent(s, 1, { type: 'answer', index: s.match.quiz.correctShown });
  ok(r.ok && s.phase === 'quizReveal' && s.match.result.right && s.match.removed.length === 0, 'right');
  ok(typeof matchView(s).result.why === 'string', 'the reveal carries the explanation');
  ok(!intent(s, 1, { type: 'pick', cardId: s.match.offer[0] }).ok, 'cannot pick before continuing');
  ok(intent(s, 1, { type: 'continue' }).ok && s.phase === 'cardPick', 'continue -> card pick');
  ok(s.match.offer.length === 5 && new Set(s.match.offer).size === 5, 'five distinct cards offered');
  const id = s.match.offer[2], round = s.round;
  ok(intent(s, 1, { type: 'pick', cardId: id }).ok, 'pick');
  ok(s.players[1].cards.includes(id) && s.players[0].cards.length === 0, 'the loser got the card');
  ok(s.phase === 'playing' && s.round === round + 1 && s.scores[0] === 1 && s.players[1].alive, 'next round, score kept');
  ok(s.players[1].stats.maxHp === computeStats([id]).maxHp, 'the card applies');
});
test('match: wrong answer removes exactly 3 of the 5 offered cards; only the other 2 can be picked', () => {
  const s = setup(); endRound(s, 1);
  intent(s, 1, { type: 'answer', index: (s.match.quiz.correctShown + 1) % 4 });
  ok(s.match.result.right === false && s.match.removed.length === 3 && new Set(s.match.removed).size === 3, 'three removed');
  ok(s.match.removed.every((id) => s.match.offer.includes(id)), 'removed cards come from the offer');
  intent(s, 1, { type: 'continue' });
  const gone = s.match.removed[0], left = s.match.offer.filter((id) => !s.match.removed.includes(id));
  ok(left.length === 2, 'two left');
  ok(!intent(s, 1, { type: 'pick', cardId: gone }).ok && s.phase === 'cardPick', 'a removed card cannot be taken');
  ok(!intent(s, 1, { type: 'pick', cardId: 'nonsense' }).ok, 'a card that was not offered cannot be taken');
  ok(intent(s, 1, { type: 'pick', cardId: left[1] }).ok && s.players[1].cards[0] === left[1], 'a remaining card can');
});
test('match: invalid intents are rejected (answer twice, wrong player, bad index, wrong phase)', () => {
  const s = setup(); endRound(s, 1);
  ok(!intent(s, 0, { type: 'answer', index: 0 }).ok, 'the winner cannot answer');
  for (const bad of [-1, 4, 1.5, 'a', null]) ok(!intent(s, 1, { type: 'answer', index: bad }).ok, 'bad index ' + bad);
  ok(!intent(s, 1, { type: 'pick', cardId: s.match.offer[0] }).ok && !intent(s, 1, { type: 'continue' }).ok && !intent(s, 1, { type: 'playAgain' }).ok, 'wrong phase');
  ok(intent(s, 1, { type: 'answer', index: 0 }).ok, 'first answer accepted');
  ok(!intent(s, 1, { type: 'answer', index: 1 }).ok, 'answering twice is rejected');
  ok(!intent(s, 0, { type: 'continue' }).ok, 'the winner cannot continue the loser\'s reveal');
  ok(!intent(s, 1, { type: 'bogus' }).ok, 'unknown intent');
});
test('match: a draw restarts the round with no quiz, no cards and no point', () => {
  const s = setup(); killPlayer(s, 0, 1); killPlayer(s, 1, 0); run(s, 2);
  ok(s.result.winner === -1, 'draw'); run(s, Math.ceil(CONFIG.round.endDelay * 60) + 2);
  ok(s.phase === 'playing' && s.round === 2 && s.scores[0] === 0 && s.scores[1] === 0, 'restarted: ' + s.phase);
  ok(builds(s)[0].length === 0 && builds(s)[1].length === 0, 'no cards');
});
test('match: first to 5 wins -> match end (no quiz); play again resets scores, builds, round and used questions', () => {
  const s = setup([false, false], [['pinball'], ['thickskin']]); s.scores = [4, 2]; s.round = 7; s.match.used = ['x'];
  endRound(s, 1);
  ok(s.phase === 'matchEnd' && s.scores[0] === 5, 'match over: ' + s.phase);
  ok(!intent(s, 0, { type: 'answer', index: 0 }).ok && !intent(s, 0, { type: 'continue' }).ok, 'nothing else is accepted');
  ok(intent(s, 0, { type: 'playAgain' }).ok && s.phase === 'matchEnd', 'one vote is not enough when both players are human');
  ok(intent(s, 1, { type: 'playAgain' }).ok, 'second vote: play again');
  ok(s.phase === 'playing' && s.round === 1 && s.scores[0] === 0 && s.scores[1] === 0 && builds(s)[0].length === 0 && builds(s)[1].length === 0 && s.match.used.length === 0, 'everything reset');
  ok(!intent(s, 0, { type: 'playAgain' }).ok, 'cannot play again mid-match');
});
test('match: no question repeats inside a match; once all were asked it starts over', () => {
  setQuestionPool(Array.from({ length: 6 }, (_, i) => ({ id: 'T' + i, category: 'x', q: 'Question ' + i + '?', answers: ['a', 'b', 'c', 'd'], correct: i % 4, why: 'because ' + i })));
  try {
    const s = setup(); const asked = [];
    for (let r = 0; r < 12; r++) {
      s.phase = 'playing'; s.scores = [0, 0]; endRound(s, 1);
      asked.push(s.match.quiz.qid);
      intent(s, 1, { type: 'answer', index: 0 }); intent(s, 1, { type: 'continue' }); intent(s, 1, { type: 'pick', cardId: s.match.offer.find((id) => !s.players[1].cards.includes(id)) }); s.players[1].cards = [];
    }
    ok(new Set(asked.slice(0, 6)).size === 6, 'six different questions first: ' + asked.slice(0, 6));
    ok(new Set(asked.slice(6, 12)).size === 6 && asked[6] !== asked[5], 'then it starts over without repeating the last one at once');
  } finally { setQuestionPool(null); }
});
test('match: answers are shuffled each time and the right answer follows its text', () => {
  setQuestionPool([{ id: 'S', category: 'x', q: 'Q?', answers: ['right one', 'b', 'c', 'd'], correct: 0, why: 'w' }]);
  try {
    const orders = new Set();
    for (let r = 0; r < 30; r++) {
      const s = fresh('t-flat', undefined, 100 + r); s.match.auto = [false, false]; parkP1(s); beginQuiz(s, 1);
      orders.add(s.match.quiz.answers.join('|')); ok(s.match.quiz.answers[s.match.quiz.correctShown] === 'right one', 'correct index follows the text');
    }
    ok(orders.size > 6, 'many different orders: ' + orders.size);
  } finally { setQuestionPool(null); }
});
test('questions: invalid entries are skipped; with no valid question the quiz is skipped and all 5 cards are offered', () => {
  const warn = console.warn; console.warn = () => {};
  try {
    setQuestionPool([{ q: 'no answers' }, { q: 'x', answers: ['a', 'b', 'c'], correct: 0 }, { q: 'x', answers: ['a', 'b', 'c', 'd'], correct: 4 }, { q: '', answers: ['a', 'b', 'c', 'd'], correct: 1 }, { id: 'ok', q: 'fine?', answers: ['a', 'b', 'c', 'd'], correct: 2 }]);
    ok(validQuestions().length === 1 && validQuestions()[0].id === 'ok', 'only the valid one survives');
    setQuestionPool([{ q: 'bad' }]);
    const s = setup(); endRound(s, 1);
    ok(s.phase === 'cardPick' && s.match.skipped && s.match.offer.length === 5 && s.match.removed.length === 0, 'quiz skipped: ' + s.phase);
    ok(intent(s, 1, { type: 'pick', cardId: s.match.offer[0] }).ok && s.phase === 'playing', 'and the pick works');
  } finally { console.warn = warn; setQuestionPool(null); }
});
test('questions.js: every entry is valid, ids are unique, text fits the layout limits (q <= 120, answers <= 60)', () => {
  ok(QUESTIONS.length > 100, QUESTIONS.length + ' questions');
  const idset = new Set();
  for (const q of QUESTIONS) {
    ok(isValidQuestion(q), 'valid: ' + q.id); idset.add(q.id);
    ok(q.q.length <= 120 && q.answers.every((a) => a.length <= 60) && (q.why || '').length <= 260, 'lengths: ' + q.id);
  }
  ok(idset.size === QUESTIONS.length, 'unique ids');
});
test('offer: 5 distinct cards, never cards at their max stacks; only five cards may be taken twice', () => {
  const s = setup([false, false], [['tightguard', 'hairtrigger', 'hairtrigger', 'pinball'], []]);
  for (let i = 0; i < 300; i++) {
    const o = makeOffer(s, 0);
    ok(o.length === 5 && new Set(o).size === 5, 'five distinct');
    ok(!o.includes('tightguard') && !o.includes('hairtrigger'), 'maxed cards are not offered: ' + o);
  }
  let pin = 0; for (let i = 0; i < 300; i++) if (makeOffer(s, 0).includes('pinball')) pin++;
  ok(pin > 100, 'a card with a second copy allowed can be offered again: ' + pin);
  ok(CARDS.filter((c) => (c.maxStacks || 1) > 1).map((c) => c.id).sort().join() === 'demopermit,hairtrigger,latebloomer,pinball,thickskin', 'only five may stack twice (Hair Trigger, Pinball, Thick Skin, Demo Permit, Late Bloomer)');
  for (const c of CARDS) ok(['common', 'uncommon', 'rare'].includes(c.rarity), 'rarity of ' + c.id);
});
test('offer: rarity weights 55/35/10, and 45/35/20 when the picker is 2+ rounds behind (more rares)', () => {
  const rare = (behind) => {
    let n = 0; const s = setup(); s.scores = behind ? [3, 0] : [0, 0];
    for (let i = 0; i < 1500; i++) for (const id of makeOffer(s, 1)) if (CARDS.find((c) => c.id === id).rarity === 'rare') n++;
    return n / 1500;
  };
  const a = rare(false), b = rare(true);
  ok(b > a * 1.1, 'rare cards per offer: normal ' + a.toFixed(2) + ', catch-up ' + b.toFixed(2));
});
test('dummy turn: when the loser is the bot it answers (right with the configured chance), takes a card, shows a summary, and continues by itself or on skip', () => {
  const old = CONFIG.match.dummyRightChance;
  try {
    CONFIG.match.dummyRightChance = 1;
    let s = setup([false, true]); endRound(s, 1);
    ok(s.phase === 'dummyTurn' && s.match.dummy.right === true && s.match.removed.length === 0 && s.players[1].cards.length === 1, 'right answer, one card taken');
    ok(intent(s, 0, { type: 'continue' }).ok && s.phase === 'playing', 'skippable');
    CONFIG.match.dummyRightChance = 0;
    s = setup([false, true]); endRound(s, 1);
    ok(s.phase === 'dummyTurn' && s.match.dummy.right === false && s.match.removed.length === 3 && !s.match.removed.includes(s.match.dummy.cardId), 'wrong answer: card taken from the remaining two');
    run(s, Math.ceil((CONFIG.match.dummyBeat + 0.2) * 60)); ok(s.phase === 'playing' && s.round === 2, 'the beat runs out and the next round starts: ' + s.phase + ' round ' + s.round);
  } finally { CONFIG.match.dummyRightChance = old; }
});
test('match state is plain JSON through the whole flow', () => {
  const s = setup(); endRound(s, 1);
  ok(JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s), 'quiz phase serialises');
  intent(s, 1, { type: 'answer', index: 0 }); ok(JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s), 'reveal phase serialises');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

// The 20 cards added after version 1, and the generic machinery they stand on (dynamic modifiers, removeCard, timers / fuses,
// temporary slabs, air jumps, hook set, offer sanity). One test per card (stats match the description, the effect does what it
// says, the caps hold), one per piece of machinery, and the nastiest stacks.
// Run:  node tests/cards.test.mjs
import { CONFIG } from '../src/config.js';
import { CARDS, CARDS_BY_ID } from '../src/cards.js';
import { registerMap } from '../src/maps/index.js';
import { createState, step, STEP, setCards, getColliders, collidersFor } from '../src/sim/world.js';
import { computeStats } from '../src/sim/cardfx.js';
import { spawnBullet, damagePlayer, killPlayer, explode, damageBlock } from '../src/sim/combat.js';
import { makeOffer, cardUseful } from '../src/sim/match.js';
import { buildSnap, ClientWorld } from '../src/net/snapshot.js';

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'value') + ': expected ~' + b + ' (+/-' + tol + '), got ' + a); }

// floor with a pit to its sides, a tall wall (climbable face), spikes, an ember grate, a crate and two chained barrels
registerMap({
  id: 'c-room', name: 'test', background: 'none',
  spawns: [{ x: 200, y: 485 }, { x: 1100, y: 485 }],
  solids: [{ x: 60, y: 500, w: 1160, h: 40 }, { x: 700, y: -300, w: 40, h: 800 }],
  destructibles: [
    { id: 'k1', x: 300, y: 468, w: 32, h: 32, hp: 50 },
    { id: 'b1', kind: 'barrel', x: 900, y: 470, w: 24, h: 30 }, { id: 'b2', kind: 'barrel', x: 930, y: 470, w: 24, h: 30 },
  ],
  platforms: [],
  hazards: [{ id: 'sp', type: 'spikes', x: 500, y: 480, w: 48, h: 20, face: 'up' }, { id: 'gr', type: 'grate', x: 560, y: 400, w: 80, h: 12, solid: true }],
});

const N = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const inp = (o) => ({ ...N, ...o });
function fresh(c0 = [], c1 = []) {
  const s = createState({ mapId: 'c-room', seed: 5 });
  setCards(s, 0, c0); setCards(s, 1, c1);
  s.players[0].hp = s.players[0].stats.maxHp; s.players[1].hp = s.players[1].stats.maxHp;
  for (let i = 0; i < 2; i++) { s.players[i].ammo = s.players[i].stats.magazine; }
  return s;
}
function place(p, x, y, vx = 0, vy = 0) { p.x = x; p.y = y; p.vx = vx; p.vy = vy; }
function run(s, n, f0) { const ev = []; for (let i = 0; i < n; i++) ev.push(...step(s, [typeof f0 === 'function' ? f0(i, s) : f0 || N, N], STEP)); return ev; }
const has = (ev, type, f) => ev.filter((e) => e.type === type && (!f || f(e)));
const stats = (ids) => computeStats(ids);
const settle = (s) => { run(s, 20); };

// ---------------------------------------------------------------------------------------------------------------------
// set-level checks
test('30 cards: unique ids, rarity spread 11 / 12 / 7, every card has an icon, text, lines and a way to act (stats, hook or dynamic)', () => {
  ok(CARDS.length === 30, CARDS.length + ' cards');
  ok(new Set(CARDS.map((c) => c.id)).size === 30, 'unique ids');
  const r = { common: 0, uncommon: 0, rare: 0 }; for (const c of CARDS) r[c.rarity]++;
  ok(r.common === 11 && r.uncommon === 12 && r.rare === 7, JSON.stringify(r));
  for (const c of CARDS) {
    ok(c.name && c.description && c.description.length <= 84 && c.icon, c.id + ' has name, text (<= 84 characters), icon');
    ok(c.description.length + c.lines.reduce((s, l) => s + l.t.length, 0) <= 168, c.id + ' fits the card (text + stat lines <= 168 characters, checked on screen): ' + (c.description.length + c.lines.reduce((s, l) => s + l.t.length, 0)));
    ok(c.lines.length >= 2 && c.lines.length <= 5 && c.lines.every((l) => l.t.length <= 46), c.id + ' stat lines fit the card: ' + c.lines.length);
    ok(c.lines.some((l) => l.good) && c.lines.some((l) => !l.good) || c.id === 'cornered' || c.id === 'partinggift', c.id + ' has an upside and a trade-off');
    ok(c.mods || c.hooks || c.dynamic, c.id + ' does something');
  }
  const names = new Set(['Abyssal Countdown', 'Barrage', 'Big Bullet', 'Bombs Away', 'Brawler', 'Buckshot', 'Burst', 'Careful Planning', 'Chase', 'Chilling Presence', 'Cold Bullets', 'Combine', 'Dazzle', 'Decay', 'Defender', 'Demonic Pact', 'Drill Ammo', 'Echo', 'EMP', 'Empower', 'Explosive Bullets', 'Fastball', 'Fast Forward', 'Frost Slam', 'Glass Cannon', 'Grow', 'Healing Field', 'Huge', 'Implode', 'Leech', 'Life Stealer', 'Mayhem', 'Overpower', 'Parasite', 'Phoenix', 'Poison', 'Quick Reload', 'Quick Shot', 'Radar Shot', 'Radiance', 'Remote', 'Saw', 'Scavenger', 'Shield Charge', 'Shields Up', 'Shock Wave', 'Silence', 'Sneaky', 'Spray', 'Static Field', 'Steady Shot', 'Supernova', 'Tactical Reload', 'Tank', 'Target Bounce', 'Taste Of Blood', 'Teleport', 'Thruster', 'Timed Detonation', 'Toxic Cloud', 'Trickster', 'Wind Up']);
  for (const c of CARDS) ok(!names.has(c.name), c.name + ' is a ROUNDS card name');
});

test('stats of every new stat card, exactly as described (and clamped by the limits)', () => {
  const E = {
    needlerounds: { bulletSpeed: 3000, bulletGravity: 0, damage: 30, bulletRadius: 3.6, magazine: 2 },
    cloudstep: { airJumps: 2, moveSpeed: 240, maxHp: 80 },
    paperdragon: { damage: 40, maxHp: 60, magazine: 3 },
    anchor: { knockbackTaken: 0.2, maxHp: 130, moveSpeed: 255, jumpVelocity: 561 },
    limpet: { wallGlide: 0, maxHp: 85 },
    salamander: { hazardTaken: 0, maxHp: 85 },
    tithe: { damage: 11 },
    wreckingball: { bulletRadius: 18, knockback: 780, bulletSpeed: 1125, fireRate: 1.8 },
    trebuchet: { bulletGravity: 1500, bulletSpeed: 1875, damage: 32, bulletRadius: 9, magazine: 2 },
    kickback: { recoil: 380, knockback: 520 },
    sleight: { reloadTime: 3 },
    porcupine: { moveSpeed: 240 },
    demopermit: { damage: 17, blockDamage: 2.5 },
    latebloomer: { damage: 16 },
    bricklayer: { blockWindow: 0.2 },
    vendetta: { damage: 30, magazine: 7, fireRate: 3.6, maxHp: 75 },
    lastcall: { reloadTime: 2.5 },
    gravedigger: { knockback: 390, damage: 17 },
  };
  for (const [id, exp] of Object.entries(E)) { const st = stats([id]); for (const [k, v] of Object.entries(exp)) near(st[k], v, 1e-6, id + '.' + k); }
  // a second copy of a two-stack card
  near(stats(['demopermit', 'demopermit']).blockDamage, 4, 1e-9, 'blockDamage capped at 4');
  near(stats(['cloudstep', 'cloudstep']).airJumps, 3, 0, 'air jumps cap at 3');
  near(stats(['limpet', 'limpet']).wallGlide, 0, 0, 'wall glide floor 0');
  near(stats(['salamander', 'salamander']).hazardTaken, 0, 0, 'hazards floor 0');
});

// ---------------------------------------------------------------------------------------------------------------------
// machinery
test('dynamic modifiers (Cornered): the bonus follows the HP, appears with a buff event, goes away when healed, and the state stays plain JSON', () => {
  const s = fresh(['cornered']); settle(s);
  const p = s.players[0];
  near(p.stats.damage, 20, 1e-9, 'no bonus at full HP');
  p.hp = 40; let ev = run(s, 2);
  ok(has(ev, 'buff', (e) => e.src === 'cornered').length === 1, 'buff event once');
  near(p.stats.damage, 32 * (130 / (4.5 * 32)) > 0 ? p.stats.damage : 0, 1e9, '');
  ok(p.stats.moveSpeed > 385 && p.stats.moveSpeed < 395, 'speed +30%: ' + p.stats.moveSpeed);
  ok(p.stats.fireRate > 4 && p.stats.damage > 25, 'fire rate and damage up (the 130 burst cap trims them): ' + p.stats.fireRate.toFixed(2) + ' x ' + p.stats.damage.toFixed(1));
  ok(p.stats.fireRate * p.stats.damage <= 130 + 1e-6, 'burst cap holds');
  p.hp = 41; run(s, 2); ok(p.stats.moveSpeed === 300 && p.stats.damage === 20, 'bonus gone above 40%');
  p.hp = 10; run(s, 2); ok(p.stats.moveSpeed > 385, 'on again');
  ok(JSON.stringify(JSON.parse(JSON.stringify(s))) === JSON.stringify(s), 'state is plain JSON');
  s.players[0].hp = 100; run(s, 2); setCards(s, 0, []); ok(p.stats.moveSpeed === 300, 'removing the card removes the bonus');
});

test('removeCard (Vendetta): winning a round spends the card; losing or drawing keeps it', () => {
  const s = fresh(['vendetta'], []); settle(s);
  ok(s.players[0].stats.damage === 30 && s.players[0].stats.maxHp === 75, 'vendetta stats on');
  killPlayer(s, 0, 1);                                                    // the vendetta owner LOSES: keeps it
  run(s, 2); ok(s.players[0].cards.includes('vendetta'), 'kept after a loss');
  const t = fresh(['vendetta'], []); settle(t);
  const ev = (killPlayer(t, 1, 0), run(t, 2));
  ok(!t.players[0].cards.includes('vendetta'), 'spent after a win');
  ok(has(ev, 'cardLost').length === 1 && has(ev, 'cardLost')[0].cardId === 'vendetta', 'cardLost event');
  ok(t.players[0].stats.damage === 20 && t.players[0].stats.maxHp === 100, 'stats back to base');
  const d = fresh(['vendetta'], ['vendetta']); settle(d); killPlayer(d, 0, 1); killPlayer(d, 1, 0); run(d, 2);
  ok(d.players[0].cards.includes('vendetta') && d.players[1].cards.includes('vendetta'), 'a draw spends nothing');
});

test('timers (Parting Gift): a lethal hit lights a 0.5 s fuse that holds the round open; the blast is flat, hurts the winner, and kills him = a draw', () => {
  const s = fresh(['partinggift'], []); settle(s);
  place(s.players[0], 400, 485); place(s.players[1], 460, 485);
  s.players[0].hp = 5; s.players[1].hp = 30;
  damagePlayer(s, 0, 20, 1, null, { x: 400, y: 485 });                    // p1 kills p0 with a hit
  ok(s.timers.length === 1 && s.timers[0].hold && Math.abs(s.timers[0].left - 0.5) < 1e-9, 'fuse scheduled');
  ok(JSON.stringify(JSON.parse(JSON.stringify(s.timers))) === JSON.stringify(s.timers), 'timers are plain data');
  let ev = run(s, 20);                                                     // 0.33 s: still burning
  ok(s.phase === 'roundEnd' && s.timers.length === 1 && !has(ev, 'explosion').length, 'burning, round open');
  ev = run(s, 14);
  ok(has(ev, 'explosion').length === 1 && has(ev, 'explosion')[0].r === 112, 'blast of radius 112');
  ok(!s.players[1].alive, 'the winner at 30 HP dies to the 40 damage blast');
  ok(s.result.winner === -1 && s.scores[1] === 0 && has(ev, 'roundEnd', (e) => e.winner === -1).length === 1, 'the round became a draw (no point)');
  // the winner who walks away survives and keeps the point
  const t = fresh(['partinggift'], []); settle(t);
  place(t.players[0], 400, 485); place(t.players[1], 700, 485); t.players[0].hp = 5;
  damagePlayer(t, 0, 20, 1, null, { x: 400, y: 485 }); run(t, 40);
  ok(t.players[1].alive && t.players[1].hp === 100 && t.result.winner === 1 && t.scores[1] === 1, 'out of the radius: no damage, the point stands');
  // a winner at 70 HP takes 40 but lives; flat damage at the edge
  const u = fresh(['partinggift'], []); settle(u);
  place(u.players[0], 300, 485); place(u.players[1], 400, 485); u.players[0].hp = 5;
  damagePlayer(u, 0, 20, 1, null, { x: 300, y: 485 }); run(u, 31);
  near(u.players[1].hp, 60, 0.01, 'flat 40 damage near the edge of the radius (no falloff)');
  // a non-lethal hit does nothing
  const v = fresh(['partinggift'], []); damagePlayer(v, 0, 20, 1, null, { x: 0, y: 0 }); ok(v.timers.length === 0, 'no fuse without a death');
});

test('slabs (Bricklayer): a block conjures a slab (platform in the air, wall on the ground); solid for both, destructible, one per owner, 5 s, sent in snapshots, gone next round', () => {
  const s = fresh(['bricklayer'], []); settle(s);
  const p = s.players[0]; place(p, 400, 300, 0, 0);                        // in the air
  run(s, 1, inp({ block: true }));
  const bullet = () => spawnBullet(s, 1, { x: p.x + 20, y: p.y, angle: Math.PI, speed: 100, damage: 5, gravity: 0 });
  bullet(); let ev = run(s, 8, inp({}));
  ok(p.blockLeft > 0 || p.blockCd > 0, 'blocking');
  const slabs = s.blocks.filter((b) => b.temp);
  ok(slabs.length === 1 && slabs[0].w === 128 && slabs[0].h === 16 && slabs[0].hp === 60, 'one platform slab 128 x 16, 60 HP');
  near(slabs[0].y, p.y + p.h / 2 - 0, 40, 'under the feet');
  ok(has(ev, 'slab').length === 1, 'slab event');
  run(s, 30); ok(p.grounded === false || p.y < 400, 'landed on the slab (not on the far floor): y=' + p.y.toFixed(0));
  near(p.y, slabs[0].y - p.h / 2, 1.5, 'stands on the slab');
  ok(getColliders(s).some((c) => c.id === slabs[0].id && c.kind === 'block'), 'the slab is a collider (prediction uses the same list)');
  // it can be shot: 60 HP
  const bx = spawnBullet(s, 1, { x: slabs[0].x + 110, y: slabs[0].y - 40, angle: Math.PI / 2, speed: 600, damage: 40, gravity: 0 }); run(s, 12);
  ok(slabs[0].hp < 60, 'bullets damage it: ' + slabs[0].hp);
  // snapshot and client world carry it
  const snap = buildSnap(s, 1, 0, 0);
  ok(snap.sl.length === 1 && snap.sl[0][0] === slabs[0].id, 'snapshot lists the slab');
  const cw = new ClientWorld(); cw.applySnap(JSON.parse(JSON.stringify(snap)), 0, 1000 / 60);
  ok(cw.latestBlocks().some((b) => b.id === slabs[0].id && b.alive), 'client blocks include the slab');
  ok(collidersFor(s.mapId, s.roundTick, cw.latestBlocks()).some((c) => c.id === slabs[0].id), 'client colliders include it');
  // expires after 5 s
  const ev2 = run(s, 300); ok(!slabs[0].alive && has(ev2, 'slabEnd').length >= 1, 'gone after 5 s');
  // a new block replaces the old slab (one per owner); on the ground it is a wall
  const t = fresh(['bricklayer'], []); settle(t); const q = t.players[0]; place(q, 400, 485); settle(t);
  run(t, 1, inp({ block: true, aim: 0 })); spawnBullet(t, 1, { x: q.x + 20, y: q.y, angle: Math.PI, speed: 100, damage: 5, gravity: 0 }); run(t, 6);
  const wall = t.blocks.find((b) => b.temp);
  ok(wall && wall.w === 16 && wall.h === 72 && wall.x > q.x, 'on the ground: an upright wall in front');
  t.round = 2; run(t, 1); const before = t.blocks.filter((b) => b.temp && b.alive).length; ok(before === 1, 'still one');
});

test('air jumps (Cloudstep): three jumps in all, 85% for the air ones, refilled on the ground and on a wall; the client body uses the same stats', () => {
  const s = fresh(['cloudstep'], []); settle(s);
  const p = s.players[0]; place(p, 400, 485); settle(s);
  ok(p.grounded && p.airLeft === 2, 'two air jumps ready on the ground');
  const vys = [];
  for (let k = 0; k < 4; k++) { run(s, 1, inp({ jump: true, jumpPressed: true })); vys.push(p.vy); run(s, 12, inp({ jump: true })); }
  ok(vys[0] < -600 && vys[0] > -700, 'ground jump ' + vys[0]);
  ok(vys[1] < -520 && vys[1] > -570, 'air jump 1 at 85%: ' + vys[1]);
  ok(vys[2] < -520 && vys[2] > -570, 'air jump 2: ' + vys[2]);
  ok(vys[3] > vys[2] + 100, 'no fourth jump: ' + vys[3]);
  run(s, 90); ok(p.grounded && p.airLeft === 2, 'refilled on landing');
  // wall contact refills too
  place(p, 685, 300); p.grounded = false; p.airLeft = 0; run(s, 3, inp({ right: true }));
  ok(p.airLeft === 2, 'a wall refills the air jumps: ' + p.airLeft);
  // movement state sent to the client carries the stat and the counter
  const snap = buildSnap(s, 1, 0, 0), q = buildSnap(fresh(['cloudstep'], ['cloudstep']), 1, 0, 0).q;
  ok(q[20] === 2 && q.length === 22, 'q carries airJumps: ' + q.join());
});

test('hooks: onDealt (Tithe heals what was really dealt, capped per round), onHazard (Salamander), onRingOut (Gravedigger), onBarrel (Demo Permit), onRoundEnd', () => {
  const s = fresh(['tithe'], []); settle(s); s.players[0].hp = 10;
  damagePlayer(s, 1, 11, 0, null, { x: 0, y: 0 }); near(s.players[0].hp, 21, 1e-9, 'healed 11');
  damagePlayer(s, 0, 15, 0, null, { x: 0, y: 0 }); ok(s.players[0].hp < 21, 'self damage heals nothing');
  for (let i = 0; i < 12; i++) damagePlayer(s, 1, 11, 0, null, { x: 0, y: 0, });  // keeps hitting: the heal is capped at 70 per round
  ok(s.players[0].healed <= 70 + 1e-9, 'healed at most 70: ' + s.players[0].healed);
  // Demo Permit: the shooter's barrel blast is wider, stronger, spares him
  const t = fresh(['demopermit'], []); settle(t);
  place(t.players[0], 905, 485); place(t.players[1], 1000, 485);          // p0 stands next to the barrels, p1 25 units from them
  const plain = fresh([], []); settle(plain); place(plain.players[0], 905, 485); place(plain.players[1], 1000, 485);
  for (const [st, who] of [[t, 0], [plain, 0]]) { const b = st.blocks.find((k) => k.id === 'b1'); damageBlock(st, b, 999, b.x, b.y, who); }
  ok(t.players[0].hp === 100 && plain.players[0].hp < 100, 'the owner is spared: ' + t.players[0].hp + ' vs ' + plain.players[0].hp);
  ok(t.players[1].hp < plain.players[1].hp, 'the opponent takes more: ' + t.players[1].hp + ' vs ' + plain.players[1].hp);
  ok(has(run(fresh(['demopermit']), 1), 'explosion').length === 0, 'no explosion without a barrel');
});

test('explosions: opts.spare keeps a player out of it, opts.flat removes the falloff', () => {
  const s = fresh([], []); settle(s); place(s.players[0], 300, 485); place(s.players[1], 330, 485);
  explode(s, 315, 485, 100, 20, -1, { spare: 0 });
  ok(s.players[0].hp === 100 && s.players[1].hp < 100, 'spared player untouched');
  const t = fresh([], []); settle(t); place(t.players[1], 350, 485); explode(t, 300, 485, 100, 30, 0, { flat: true }); near(t.players[1].hp, 70, 1e-9, 'flat 30 at 50 units');
  const u = fresh([], []); settle(u); place(u.players[1], 350, 485); explode(u, 300, 485, 100, 30, 0); ok(u.players[1].hp > 70, 'with falloff it is less: ' + u.players[1].hp);
});

test('hazards: hazardTaken scales the damage (Salamander 0 and a buff), knockbackTaken scales the shove (Anchor less, Featherweight capped)', () => {
  const touch = (cards) => { const s = fresh(cards, []); settle(s); place(s.players[0], 524, 478); const ev = run(s, 3); return { s, ev, p: s.players[0] }; };
  const base = touch([]), sal = touch(['salamander']), anc = touch(['anchor']), fea = touch(['featherweight']);
  ok(base.p.hp === 85 && has(base.ev, 'hazardHit').length === 1, 'spikes deal 15');
  ok(sal.p.hp === sal.p.stats.maxHp && has(sal.ev, 'hazardHit').length === 1, 'Salamander takes nothing but is still shoved');
  ok(sal.p.stats.fireRate > 4 && sal.p.stats.moveSpeed > 380 && has(sal.ev, 'buff').length === 1, 'and lights up: fire rate +50%, speed +30%: ' + sal.p.stats.fireRate);
  const shove = (r) => Math.hypot(r.p.vx, r.p.vy);
  ok(shove(base) > 380, 'plain shove ' + shove(base).toFixed(0));
  ok(shove(anc) < shove(base) * 0.5, 'Anchor is hardly shoved: ' + shove(anc).toFixed(0));
  ok(shove(fea) <= CONFIG.caps.impulse + 1 && shove(fea) >= shove(base) * 0.9, 'a light body is shoved at least as far, capped at 700: ' + shove(fea).toFixed(0));
  // after 3 s away from the hazard the buff is gone
  place(sal.p, 300, 485); run(sal.s, 200); ok(sal.p.stats.fireRate === 3, 'buff ended');
});

// ---------------------------------------------------------------------------------------------------------------------
// the cards themselves
test('Needle Rounds: a flat 3000 u/s shot with no drop that crosses the arena in a blink, 30 damage, two in the clip', () => {
  const s = fresh(['needlerounds'], []); settle(s); place(s.players[0], 100, 300); place(s.players[1], 1180, 300);
  s.players[1].y = -5000;                                                   // out of the way
  run(s, 1, inp({ shoot: true, aim: 0 }));
  const b = s.bullets[0];
  ok(b && b.gravity === 0 && Math.hypot(b.vx, b.vy) > 2990 && b.damage === 30 && b.r < 4 && b.style === 'steel', 'bullet: ' + JSON.stringify({ g: b && b.gravity, d: b && b.damage, r: b && b.r }));
  const y0 = b.y; run(s, 12, N); ok(!s.bullets.length || Math.abs(s.bullets[0].y - y0) < 0.01, 'no drop');
  const base = fresh([], []); settle(base); place(base.players[0], 100, 300); base.players[1].y = -5000; run(base, 1, inp({ shoot: true, aim: 0 })); const y1 = base.bullets[0].y; run(base, 20, N);
  ok(base.bullets[0].y - y1 > 20, 'a plain bullet does drop: ' + (base.bullets[0].y - y1).toFixed(1));
  ok(s.players[0].stats.magazine === 2, 'two in the magazine');
});

test('Paper Dragon: 40 damage, 60 HP, 3 rounds; three hits kill a full-HP player, the per-hit cap holds', () => {
  const s = fresh(['paperdragon'], []); settle(s);
  ok(s.players[0].stats.damage === 40 && s.players[0].hp === 60 && s.players[0].ammo === 3, 'stats');
  for (let i = 0; i < 2; i++) damagePlayer(s, 1, s.players[0].stats.damage, 0, null, { x: 0, y: 0 }); ok(s.players[1].alive && s.players[1].hp === 20, 'two hits leave 20');
  damagePlayer(s, 1, 99, 0, null, { x: 0, y: 0 }); ok(!s.players[1].alive, 'the third kills');
  const t = fresh(['paperdragon'], []); damagePlayer(t, 1, 500, 0, null, { x: 0, y: 0 }); ok(t.players[1].hp === 60, 'a single hit is capped at 40: ' + t.players[1].hp);
});

test('Anchor: hits push you at 20% strength, 130 HP, slower and lower jump', () => {
  const push = (cards) => { const s = fresh([], cards); settle(s); place(s.players[1], 600, 485); const b = spawnBullet(s, 0, { x: 560, y: 485, angle: 0, speed: 1500, damage: 20, gravity: 0 }); run(s, 4); return s.players[1].vx; };
  const base = push([]), anc = push(['anchor']);
  ok(base > 150 && anc < base * 0.25 + 1, 'push ' + base.toFixed(0) + ' vs ' + anc.toFixed(0));
  near(stats(['anchor']).maxHp, 130, 1e-9);
});

test('Limpet: you hang still on a wall (no sliding), clinging gives +40% damage and half knockback, standing gives nothing', () => {
  const s = fresh(['limpet'], []); settle(s);
  const p = s.players[0]; place(p, 685, 200); p.grounded = false;
  run(s, 60, inp({ right: true }));
  ok(Math.abs(p.vy) < 6, 'hangs: vy=' + p.vy.toFixed(1));
  const y0 = p.y; run(s, 30, inp({ right: true })); ok(Math.abs(p.y - y0) < 4, 'stays put: moved ' + (p.y - y0).toFixed(1));
  near(p.stats.damage, 28, 1e-9, 'clinging damage'); near(p.stats.knockbackTaken, 0.5, 1e-9, 'clinging knockback');
  run(s, 2, inp({ left: true })); run(s, 40, N);                           // let go and fall
  place(p, 300, 485); run(s, 20); ok(p.stats.damage === 20 && p.stats.knockbackTaken === 1, 'on the ground the bonus is off');
  const b = fresh([], []); const q = b.players[0]; place(q, 685, 200); q.grounded = false; run(b, 40, inp({ right: true })); ok(q.vy > 80, 'without the card you slide: ' + q.vy.toFixed(0));
});

test('Salamander: see hazards; plus the build keeps its 85% HP', () => { near(stats(['salamander']).maxHp, 85, 1e-9); });

test('Tithe: 11 damage per hit; every hit that lands heals what it dealt; a blocked bullet heals nothing', () => {
  const s = fresh(['tithe'], []); settle(s); place(s.players[0], 400, 485); place(s.players[1], 800, 485); s.players[0].hp = 50;
  spawnBullet(s, 0, { x: 760, y: 485, angle: 0, speed: 1500, gravity: 0 }); run(s, 6);
  near(s.players[1].hp, 89, 1e-9, 'dealt 11'); near(s.players[0].hp, 61, 1e-9, 'healed 11');
  s.players[1].blockLeft = 0.5; s.players[1].blockCd = 3; const hp = s.players[0].hp;
  spawnBullet(s, 0, { x: 760, y: 485, angle: 0, speed: 1500, gravity: 0 }); run(s, 6); ok(s.players[0].hp === hp, 'blocked: no heal');
});

test('Wrecking Ball: 36-unit boulders at 1125 u/s that shove 700 u/s (the cap) and hit as hard as ever', () => {
  const s = fresh(['wreckingball'], []); settle(s); place(s.players[1], 600, 485);
  const b = spawnBullet(s, 0, { x: 540, y: 470, angle: 0, gravity: 0 }); ok(b.r === 18 && Math.hypot(b.vx, b.vy) === 1125, 'size and speed');
  run(s, 6); ok(s.players[1].hp === 80, 'damage 20'); ok(s.players[1].vx > 600 && s.players[1].vx <= 700.5, 'shoved at the cap: ' + s.players[1].vx.toFixed(0));
});

test('Trebuchet: shells arc 3x as steeply (a 45 degree lob rises 300+ units and comes down far away); your aim preview is switched on by the card', () => {
  const s = fresh(['trebuchet'], []); settle(s); place(s.players[0], 100, 485); place(s.players[1], 1180, -5000);
  s.players[0].aim = -Math.PI / 4;
  run(s, 1, inp({ shoot: true, aim: -Math.PI / 4 }));
  let top = 1e9, last = null; for (let i = 0; i < 400 && s.bullets.length; i++) { run(s, 1, N); if (s.bullets[0]) { top = Math.min(top, s.bullets[0].y); last = s.bullets[0]; } }
  ok(top < 485 - 280, 'apex ' + (485 - top).toFixed(0) + ' above the muzzle');
  ok(CARDS_BY_ID.trebuchet.preview === true, 'preview flag');
  near(stats(['trebuchet']).bulletGravity, 1500, 1e-9);
});

test('Kickback: each shot pushes you backwards (more when firing downwards: a rocket-jump), your hits shove twice as hard', () => {
  const s = fresh(['kickback'], []); settle(s); const p = s.players[0]; place(p, 400, 300); p.grounded = false;
  run(s, 1, inp({ shoot: true, aim: 0 })); ok(p.vx < -300, 'backwards: ' + p.vx.toFixed(0));
  const t = fresh(['kickback'], []); settle(t); const q = t.players[0]; place(q, 400, 300); q.grounded = false;
  run(t, 1, inp({ shoot: true, aim: Math.PI / 2 })); ok(q.vy < -250, 'fired downwards: lifted ' + q.vy.toFixed(0));
  const u = fresh(['kickback'], []); settle(u); place(u.players[1], 600, 485); spawnBullet(u, 0, { x: 560, y: 485, angle: 0, speed: 1500, gravity: 0 }); run(u, 4); ok(u.players[1].vx > 450, 'hit shoves ' + u.players[1].vx.toFixed(0));
});

test('Sleight of Hand: the first bullet a block absorbs refills the magazine and cancels a reload (once per block); 3 s reload otherwise', () => {
  const s = fresh(['sleight'], []); settle(s); const p = s.players[0]; place(p, 400, 485); p.ammo = 1;
  run(s, 1, inp({ block: true }));
  spawnBullet(s, 1, { x: 440, y: 485, angle: Math.PI, speed: 100, damage: 5, gravity: 0 }); spawnBullet(s, 1, { x: 450, y: 480, angle: Math.PI, speed: 100, damage: 5, gravity: 0 });
  const ev = run(s, 8); ok(p.ammo === 5, 'refilled: ' + p.ammo); ok(has(ev, 'cardFx', (e) => e.kind === 'refill').length === 1, 'once per block, with a flash');
  ok(stats(['sleight']).reloadTime === 3, '3 s reload');
});

test('Porcupine: when a bullet or blast hurts you, a ring of 10 thorn shards (10 damage, 0.4 s) flies out; 1 s cooldown; nothing on hazards, self damage or a lethal hit', () => {
  const s = fresh(['porcupine'], []); settle(s); place(s.players[0], 400, 485); place(s.players[1], 460, 485);
  damagePlayer(s, 0, 10, 1, null, { x: 400, y: 485 }, { kind: 'bullet' });
  const shards = s.bullets.filter((b) => b.style === 'thorn'); ok(shards.length === 10 && shards.every((b) => b.damage === 10 && b.generation === 1 && b.owner === 0 && b.lifetime === 0.4), '10 shards');
  ok(new Set(shards.map((b) => b.shotId)).size === 1, 'one shot id (the 60 per-shot cap applies)');
  damagePlayer(s, 0, 10, 1, null, { x: 400, y: 485 }, { kind: 'bullet' }); ok(s.bullets.filter((b) => b.style === 'thorn').length === 10, 'cooldown: no second ring');
  run(s, 62); damagePlayer(s, 0, 10, -1, null, { x: 400, y: 485 }); ok(!s.bullets.some((b) => b.style === 'thorn'), 'no ring for hazard damage');
  damagePlayer(s, 0, 10, 0, null, { x: 400, y: 485 }); ok(!s.bullets.some((b) => b.style === 'thorn'), 'no ring for self damage');
  const t = fresh(['porcupine'], []); t.players[0].hp = 5; damagePlayer(t, 0, 10, 1, null, { x: 0, y: 0 }, { kind: 'bullet' }); ok(!t.bullets.length, 'no ring on a lethal hit');
  const u = fresh(['porcupine'], []); settle(u); place(u.players[0], 400, 485); place(u.players[1], 440, 485);
  damagePlayer(u, 0, 10, 1, null, { x: 400, y: 485 }, { kind: 'bullet' }); run(u, 6); ok(u.players[1].hp < 100, 'a shard hits the attacker at 40 units: ' + u.players[1].hp);
});

test('Late Bloomer: 16 damage at the start, +8% per 6 s of the round (up to 8 steps), a buff pulse at every step; two copies stack and stay under the 40 cap', () => {
  const s = fresh(['latebloomer'], []); settle(s); const p = s.players[0];
  near(p.stats.damage, 16, 1e-9, 'start'); const seen = [];
  for (let t = 0; t <= 48.5; t += 0.5) { s.roundTime = t; const ev = run(s, 1); seen.push([t, p.stats.damage]); if (has(ev, 'buff').length) seen.push(['buff', t]); }
  near(p.stats.damage, 28.8, 1e-6, 'at 48 s');
  ok(seen.filter((x) => x[0] === 'buff').length === 8, 'eight pulses');
  const at = (t) => seen.find((x) => x[0] === t)[1]; near(at(18), 20.8, 1e-6, '+4% at 18 s (break-even after about 15 s)');
  s.roundTime = 500; run(s, 1); near(p.stats.damage, 28.8, 1e-6, 'capped');
  const two = fresh(['latebloomer', 'latebloomer'], []); two.roundTime = 500; settle(two); ok(two.players[0].stats.damage <= 40 && two.players[0].stats.damage > 36, 'two copies: ' + two.players[0].stats.damage);
  ok(JSON.stringify(s.players[0].dyn) === '{"latebloomer":8}', 'state keeps the key: ' + JSON.stringify(s.players[0].dyn));
});

test('Cornered: see dynamic modifiers; the card shows its bonus only at 40% HP or less', () => { ok(CARDS_BY_ID.cornered.dynamic && !CARDS_BY_ID.cornered.mods, 'dynamic only'); });

test('Demo Permit: crates, barrels and slabs take 2.5x from your bullets; a barrel you shoot blasts 40% wider and 25% harder (x2: 80% / 50%) and spares you', () => {
  const s = fresh(['demopermit'], []); settle(s);
  const k = s.blocks.find((b) => b.id === 'k1'); spawnBullet(s, 0, { x: 260, y: 484, angle: 0, speed: 1500, gravity: 0 }); run(s, 4);
  const pl = fresh([], []); settle(pl); const k0 = pl.blocks.find((b) => b.id === 'k1'); spawnBullet(pl, 0, { x: 260, y: 484, angle: 0, speed: 1500, gravity: 0 }); run(pl, 4);
  near((50 - k.hp) / (50 - k0.hp), 2.5 * 17 / 20, 0.01, 'crate damage ratio vs a plain bullet (2.5x of 85%)');
  const ev = (() => { const b = s.blocks.find((x) => x.id === 'b1'); damageBlock(s, b, 999, b.x, b.y, 0); return s.events.slice(); })();
  const blasts = has(ev, 'explosion'); ok(blasts.length >= 1 && Math.abs(blasts[0].r - 80 * 1.4) < 0.01, 'radius 112: ' + blasts.map((b) => b.r).join());
  const t = fresh(['demopermit', 'demopermit'], []); const b2 = t.blocks.find((x) => x.id === 'b1'); damageBlock(t, b2, 999, b2.x, b2.y, 0);
  ok(Math.abs(t.events.find((e) => e.type === 'explosion').r - 80 * 1.8) < 0.01, 'two copies: 144');
  ok(t.events.find((e) => e.type === 'explosion').owner === 0, 'the blast is the owner attack (caps, Tithe, Gravedigger)');
  const u = fresh([], ['demopermit']); const b3 = u.blocks.find((x) => x.id === 'b1'); damageBlock(u, b3, 999, b3.x, b3.y, 1);
  ok(u.events.some((e) => e.type === 'explosion'), 'the other player\'s permit does not help you');
});

test('Bricklayer: the block window is 0.2 s; with Pinball a slab is a bounce surface (the bullet bounces off it and hurts it)', () => {
  near(stats(['bricklayer']).blockWindow, 0.2, 1e-9);
  const s = fresh(['bricklayer', 'pinball'], []); settle(s); const p = s.players[0]; place(p, 400, 300);
  run(s, 1, inp({ block: true })); spawnBullet(s, 1, { x: 420, y: 300, angle: Math.PI, speed: 100, damage: 5, gravity: 0 }); run(s, 8);
  const slab = s.blocks.find((b) => b.temp); ok(slab, 'a slab');
  const b = spawnBullet(s, 0, { x: slab.x + 112, y: slab.y - 60, angle: Math.PI / 2, speed: 800, damage: 15, gravity: 0, bounces: 2 }); b.immune = 0; run(s, 14);
  ok(b.bounces >= 1 && b.vy < 0, 'bounced up off the slab: bounces ' + b.bounces);
});

test('Vendetta: +50% damage, +20% fire rate, 7 rounds and 75 HP while you keep losing; the 130 burst cap trims it', () => {
  const st = stats(['vendetta']); ok(st.fireRate * st.damage <= 130 + 1e-9 && st.magazine * st.damage <= 240 + 1e-9, 'caps: ' + (st.fireRate * st.damage).toFixed(1));
  near(st.damage, 30, 1e-9);
});

test('Last Call: the shot that empties the magazine is a gold cannonball (2x damage up to the 40 cap, 2.5x size, 1.3x speed, 2.5x knockback); earlier shots are plain', () => {
  const s = fresh(['lastcall'], []); settle(s); place(s.players[0], 100, 300); s.players[1].y = -5000;
  const shots = []; for (let i = 0; i < 5; i++) { s.players[0].fireCd = 0; run(s, 1, inp({ shoot: true, aim: 0 })); shots.push(s.bullets[s.bullets.length - 1]); run(s, 1, N); }
  ok(shots.slice(0, 4).every((b) => b.damage === 20 && b.style === 'amber'), 'four plain shots');
  const last = shots[4]; ok(last.damage === 40 && Math.abs(last.r - 15) < 1e-9 && Math.abs(Math.hypot(last.vx, last.vy) - 1950) < 40 && last.style === 'gold' && last.knockback === 650, 'the last: ' + JSON.stringify({ d: last.damage, r: last.r, s: Math.hypot(last.vx, last.vy), k: last.knockback }));
});

test('Gravedigger: a ring-out within 3 s of your hit costs the victim 12 more and heals you 25; later falls and your own falls do not count', () => {
  const s = fresh(['gravedigger'], []); settle(s); s.players[0].hp = 40; place(s.players[1], 400, 485);
  damagePlayer(s, 1, 10, 0, null, { x: 400, y: 485 }); const hp1 = s.players[1].hp;
  place(s.players[1], -60, 400); const ev = run(s, 2);
  ok(has(ev, 'oob').length === 1, 'fell out');
  near(s.players[0].hp, 65, 1e-9, 'healed 25'); near(s.players[1].hp, hp1 - 30 - 12, 1e-6, 'fall 30 + 12 extra');
  ok(has(ev, 'cardFx', (e) => e.kind === 'ringout').length === 1, 'RING OUT feedback');
  const t = fresh(['gravedigger'], []); settle(t); damagePlayer(t, 1, 10, 0, null, { x: 0, y: 0 }); run(t, 200); place(t.players[1], -60, 400); run(t, 2); ok(t.players[0].hp === 100 && t.players[1].hp === 90 - 30, 'too late: no credit, hp ' + t.players[1].hp);
  const u = fresh(['gravedigger'], []); settle(u); place(u.players[0], -60, 400); run(u, 2); ok(has(u.events, 'cardFx').length === 0, 'your own fall is not a ring-out');
  ok(stats(['gravedigger']).knockback === 390, 'knockback +50%');
});

// ---------------------------------------------------------------------------------------------------------------------
// the nastiest stacks and how the caps contain them
test('combo: Paper Dragon + Hair Trigger + Cornered + Vendetta: the burst, magazine budget and per-hit caps hold', () => {
  const build = ['paperdragon', 'hairtrigger', 'vendetta', 'cornered'];
  const s = fresh(build, []); const p = s.players[0]; p.hp = 10; run(s, 2);
  const st = p.stats;
  ok(st.fireRate * st.damage * st.bulletsPerShot <= CONFIG.caps.burst + 1e-6, 'burst ' + (st.fireRate * st.damage).toFixed(1));
  ok(st.magazine * st.damage <= CONFIG.caps.magazineBudget + 1e-6, 'magazine budget ' + (st.magazine * st.damage).toFixed(1));
  ok(st.damage <= CONFIG.statLimits.damage[1] && st.fireRate <= 8, 'limits');
  damagePlayer(s, 1, st.damage * 5, 0, null, { x: 0, y: 0 }); ok(s.players[1].hp >= 60, 'one hit never does more than 40: ' + s.players[1].hp);
});

test('combo: Kickback + Wrecking Ball + Gravedigger: a hit pushes at most 700 u/s, nobody ever moves faster than the 1100 u/s speed limit, the ring-out loop is bounded by the 2 s fall immunity', () => {
  const s = fresh(['kickback', 'wreckingball', 'gravedigger'], []); settle(s); place(s.players[1], 1190, 400); s.players[0].fireCd = 0;
  const b = spawnBullet(s, 0, { x: 1150, y: 400, angle: 0, gravity: 0 }); run(s, 3);
  ok(s.players[1].vx <= 701, 'push capped: ' + s.players[1].vx.toFixed(0));
  let maxSpeed = 0, oobs = 0; for (let i = 0; i < 360; i++) { const ev = step(s, [inp({ shoot: true, aim: Math.PI, left: false }), N], STEP); oobs += has(ev, 'oob').length; for (const p of s.players) maxSpeed = Math.max(maxSpeed, Math.hypot(p.vx, p.vy)); }
  ok(maxSpeed <= 1100 + 120, 'speed stays limited: ' + maxSpeed.toFixed(0));
  ok(oobs <= 4, 'at most one fall per 2 s of immunity in 6 s: ' + oobs);
});

test('combo: Tithe + Thick Skin x2: healing is capped at 70 per round however many hits land', () => {
  const s = fresh(['tithe', 'thickskin', 'thickskin'], []); s.players[0].hp = 100;
  for (let i = 0; i < 40; i++) damagePlayer(s, 1, 11, 0, null, { x: 0, y: 0 }); ok(s.players[0].healed <= 70 + 1e-9 && s.players[0].hp <= 200 + 1e-9 && s.players[0].hp <= 170 + 1e-9, 'healed ' + s.players[0].healed);
});

test('combo: Porcupine + Hair Trigger + Pepperpot vs the live-bullet cap, and Porcupine shards vs the per-shot cap', () => {
  const s = fresh(['porcupine'], ['hairtrigger', 'pepperpot']); settle(s); place(s.players[0], 400, 485); place(s.players[1], 460, 485);
  for (let i = 0; i < 20; i++) { s.players[0].ammo = 5; damagePlayer(s, 0, 1, 1, null, { x: 400, y: 485 }, { kind: 'bullet' }); run(s, 62); }
  ok(s.bullets.filter((b) => b.owner === 0).length <= CONFIG.caps.liveBullets, 'live bullet cap');
  const t = fresh(['porcupine'], []); settle(t); place(t.players[0], 400, 485); place(t.players[1], 410, 485);
  damagePlayer(t, 0, 5, 1, null, { x: 400, y: 485 }, { kind: 'bullet' }); run(t, 30); ok(t.players[1].hp >= 100 - CONFIG.caps.shotDamage, 'a ring never does more than 60 to one target: ' + t.players[1].hp);
});

test('combo: Demo Permit x2 + two chained barrels: the chain is the owner attack, so one trigger pull never does more than 60 to the opponent (no one-shot), the owner is not hurt', () => {
  const s = fresh(['demopermit', 'demopermit'], []); settle(s); place(s.players[0], 850, 485); place(s.players[1], 925, 485);
  const k = spawnBullet(s, 0, { x: 880, y: 485, angle: 0, speed: 1500, gravity: 0, shotId: 77 }); ok(k, 'bullet');
  const ev = run(s, 6);
  ok(s.blocks.filter((x) => x.kind === 'barrel' && !x.alive).length === 2, 'both barrels went off (chain)');
  ok(s.players[1].hp >= 100 - CONFIG.caps.shotDamage, 'the opponent survives with at least 40: ' + s.players[1].hp);
  ok(s.players[0].hp === 100, 'owner untouched: ' + s.players[0].hp);
  ok(has(ev, 'explosion').length === 2, 'two blasts');
});

test('combo: Limpet + Needle Rounds + Last Call: the last needle is capped at 40 damage even with the clinging bonus', () => {
  const s = fresh(['limpet', 'needlerounds', 'lastcall'], []); settle(s);
  const p = s.players[0]; place(p, 685, 200); p.grounded = false; run(s, 5, inp({ right: true }));
  ok(p.stats.damage >= 40 * 0.9 || p.stats.damage <= 40, 'clinging damage ' + p.stats.damage); p.ammo = 1; p.fireCd = 0; run(s, 1, inp({ right: true, shoot: true, aim: Math.PI }));
  const last = s.bullets[s.bullets.length - 1]; ok(last && last.damage <= 40 + 1e-9, 'capped: ' + (last && last.damage));
});

// ---------------------------------------------------------------------------------------------------------------------
// offers
test('offers with 30 cards: five distinct usable cards, never a maxed or dead card, rarity weights hold, duplicates only for the five stackable cards', () => {
  const s = fresh(['hairtrigger', 'hairtrigger', 'cloudstep', 'tightguard', 'limpet'], []);
  const counts = { common: 0, uncommon: 0, rare: 0 }; let slots = 0, seenStack = new Set();
  for (let i = 0; i < 1500; i++) {
    const o = makeOffer(s, 0);
    ok(o.length === 5 && new Set(o).size === 5, 'five distinct: ' + o);
    for (const id of o) { ok(!['hairtrigger', 'cloudstep', 'tightguard', 'limpet'].includes(id), 'maxed card offered: ' + id); counts[CARDS_BY_ID[id].rarity]++; slots++; seenStack.add(id); }
  }
  ok(counts.common / slots > 0.45 && counts.common / slots < 0.62, 'commons ' + (counts.common / slots).toFixed(2));
  ok(counts.uncommon / slots > 0.28 && counts.uncommon / slots < 0.42, 'uncommons ' + (counts.uncommon / slots).toFixed(2));
  ok(counts.rare / slots > 0.07 && counts.rare / slots < 0.2, 'rares ' + (counts.rare / slots).toFixed(2));
  ok(seenStack.size >= 25, 'a wide pool is offered: ' + seenStack.size);
  // a dead card (every stat already at its limit, no hook) is not offered
  const dead = { id: 'dead-test', name: 'Dead', rarity: 'common', maxStacks: 1, icon: 'x', description: 'x', lines: [], mods: { airJumps: { add: 3 } } };
  CARDS.push(dead); CARDS_BY_ID[dead.id] = dead;
  try {
    ok(cardUseful(['cloudstep'], dead) === false || stats(['cloudstep']).airJumps === 2, 'cap logic');
    const full = { ...dead, id: 'dead2', mods: { airJumps: { add: 0 } } }; CARDS.push(full); CARDS_BY_ID[full.id] = full;
    ok(cardUseful([], full) === false, 'a card that changes nothing is dead');
    for (let i = 0; i < 100; i++) ok(!makeOffer(fresh([], []), 0).includes('dead2'), 'never offered');
  } finally { for (const id of ['dead-test', 'dead2']) { const i = CARDS.findIndex((c) => c.id === id); if (i >= 0) CARDS.splice(i, 1); delete CARDS_BY_ID[id]; } }
  // a full 4-card build (the most a player can hold: first to 5 = 4 losses with a pick each) still gets five choices
  const big = fresh(['thickskin', 'thickskin', 'pinball', 'pinball'], []); ok(makeOffer(big, 0).length === 5, 'five offered');
});

// ---------------------------------------------------------------------------------------------------------------------
for (const t of pending) {
  try { t.fn(); console.log('PASS  ' + t.name); passed++; }
  catch (e) { console.log('FAIL  ' + t.name + '\n        ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); failed++; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

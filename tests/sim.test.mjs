// Headless tests for the pure simulation.   Run:  node tests/sim.test.mjs
// They build tiny synthetic maps, drive the sim with scripted inputs and assert the basics.
import { CONFIG } from '../src/config.js';
import { registerMap, MAPS, getMap } from '../src/maps/index.js';
import { CARDS } from '../src/cards.js';
import { createState, step, setCards, getColliders, STEP } from '../src/sim/world.js';
import { platformPos } from '../src/sim/platforms.js';
import { solveAimFromBody } from '../src/sim/aim.js';
import { getHazards } from '../src/sim/hazards.js';
import { reachable } from './reach.mjs';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n        ' + e.message); }
}
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function near(a, b, tol, msg) { if (!(Math.abs(a - b) <= tol)) throw new Error((msg || 'value') + ': expected ~' + b + ' (+/-' + tol + '), got ' + a); }

// --- test maps -----------------------------------------------------------------------------------
// floor top at y=500; a wall (x 700..740, y 100..500); a destructible block at x 900; a moving platform.
registerMap({
  id: 't-flat', name: 'test', background: 'none',
  spawns: [{ x: 200, y: 485 }, { x: 600, y: 485 }],
  solids: [{ x: 100, y: 500, w: 1000, h: 40 }, { x: 700, y: 100, w: 40, h: 400 }],
  destructibles: [{ id: 'blk', x: 900, y: 468, w: 32, h: 32, hp: 50 }],
  platforms: [{ id: 'mp', w: 100, h: 16, path: [{ x: 300, y: 400 }, { x: 500, y: 400 }], speed: 100, pause: 0, mode: 'pingpong' }],
});
registerMap({   // open arena for falling tests: a single small island
  id: 't-island', name: 'test', background: 'none',
  spawns: [{ x: 600, y: 485 }, { x: 650, y: 485 }],
  solids: [{ x: 560, y: 500, w: 200, h: 40 }], destructibles: [], platforms: [],
});
registerMap({   // narrow corridor to test bouncing: two walls facing each other
  id: 't-walls', name: 'test', background: 'none',
  spawns: [{ x: 640, y: 485 }, { x: 1000, y: 100 }],
  solids: [{ x: 100, y: 500, w: 1000, h: 40 }, { x: 300, y: 100, w: 40, h: 400 }, { x: 900, y: 100, w: 40, h: 400 }],
  destructibles: [], platforms: [],
});

registerMap({   // hazards: spikes, a grate, a saw and two barrels next to a crate
  id: 't-haz', name: 'test', background: 'none',
  spawns: [{ x: 150, y: 485 }, { x: 1000, y: 485 }],
  solids: [{ x: 100, y: 500, w: 1000, h: 40 }],
  destructibles: [
    { id: 'ba1', kind: 'barrel', x: 300, y: 470, w: 24, h: 30 },
    { id: 'ba2', kind: 'barrel', x: 330, y: 470, w: 24, h: 30 },
    { id: 'cr', x: 360, y: 468, w: 32, h: 32, hp: 50 },
  ],
  platforms: [],
  hazards: [
    { id: 'sp', type: 'spikes', x: 400, y: 490, w: 60, h: 10, face: 'up' },
    { id: 'gr', type: 'grate', x: 600, y: 440, w: 100, h: 12, solid: true },
    { id: 'saw', type: 'saw', r: 14, path: [{ x: 800, y: 470 }, { x: 950, y: 470 }], speed: 100, pause: 0, mode: 'pingpong' },
  ],
});

const N = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const inp = (o) => ({ ...N, ...o });

function fresh(mapId, cards) {
  const s = createState({ mapId, seed: 7, cards: cards || [[], []] });
  return s;
}
function place(p, x, y) { p.x = x; p.y = y; p.vx = 0; p.vy = 0; }
function run(s, ticks, f0, f1) {
  const evs = [];
  for (let i = 0; i < ticks; i++) {
    const a = typeof f0 === 'function' ? f0(i, s) : f0, b = typeof f1 === 'function' ? f1(i, s) : f1;
    evs.push(...step(s, [a || N, b || N], STEP));
  }
  return evs;
}
const count = (evs, type) => evs.filter((e) => e.type === type).length;
// keep player 1 out of the way (high above the floor, sitting still is not possible) - park it far on the floor
function parkP1(s, x = 1050) { place(s.players[1], x, 485); }

// ---------------------------------------------------------------------------------------------------------
test('gravity pulls a falling player down and he lands on the floor', () => {
  const s = fresh('t-flat'); parkP1(s);
  place(s.players[0], 200, 300);
  run(s, 20);
  ok(s.players[0].y > 300 && !s.players[0].grounded, 'should be falling after 20 ticks');
  run(s, 80);
  near(s.players[0].y, 500 - s.players[0].h / 2, 0.01, 'resting y');
  ok(s.players[0].grounded, 'grounded');
  near(s.players[0].vy, 0, 0.01, 'vy');
});

test('jump height is about 115-135 units (held), much lower when tapped', () => {
  let s = fresh('t-flat'); parkP1(s);
  run(s, 5);
  const y0 = s.players[0].y; let minY = y0;
  run(s, 90, (i) => inp({ jump: true, jumpPressed: i === 0 }));
  // measure
  s = fresh('t-flat'); parkP1(s); run(s, 5);
  const base = s.players[0].y; minY = base;
  for (let i = 0; i < 90; i++) { step(s, [inp({ jump: true, jumpPressed: i === 0 }), N]); minY = Math.min(minY, s.players[0].y); }
  const held = base - minY;
  ok(held > 105 && held < 140, 'held jump height ' + held.toFixed(1));
  s = fresh('t-flat'); parkP1(s); run(s, 5);
  minY = s.players[0].y;
  for (let i = 0; i < 90; i++) { step(s, [inp({ jump: i < 2, jumpPressed: i === 0 }), N]); minY = Math.min(minY, s.players[0].y); }
  const tap = base - minY;
  ok(tap < held * 0.5 && tap > 8, 'tap jump height ' + tap.toFixed(1) + ' vs held ' + held.toFixed(1));
});

test('horizontal run speed reaches moveSpeed, and the player stops quickly', () => {
  const s = fresh('t-flat'); parkP1(s);
  run(s, 30, inp({ right: true }));
  near(s.players[0].vx, 300, 0.5, 'run speed');
  run(s, 10);
  near(s.players[0].vx, 0, 0.01, 'stopped within 10 ticks');
});

test('wall-jump: touching a wall in the air and pressing jump kicks away from it and upward', () => {
  const s = fresh('t-flat'); parkP1(s);
  place(s.players[0], 700 - 15, 440);                 // hugging the left face of the wall, in the air
  run(s, 4, inp({ right: true }));
  ok(s.players[0].wallDir === 1, 'wall detected on the right, got ' + s.players[0].wallDir);
  step(s, [inp({ right: true, jump: true, jumpPressed: true }), N]);
  ok(s.players[0].vx < -200 && s.players[0].vx > -240, 'kicked away from the wall (ROUNDS 1:2 ratio, 220) vx=' + s.players[0].vx);
  ok(s.players[0].vy < -590 && s.players[0].vy > -620, 'kicked upward (0.92 x 660) vy=' + s.players[0].vy);
  // chain: climb the same wall by wall-jumping repeatedly is possible when pressing back in
  const y0 = s.players[0].y;
  run(s, 12, inp({ right: true, jump: true }));
  ok(s.players[0].y < y0, 'rising after wall jump');
});

test('wall slide limits the fall speed while pressing into a wall', () => {
  const s = fresh('t-flat'); parkP1(s);
  place(s.players[0], 700 - 15, 150);
  run(s, 40, inp({ right: true }));
  ok(s.players[0].vy <= CONFIG.move.wallSlideSpeed + 1 && s.players[0].vy > 50, 'wall slide vy=' + s.players[0].vy);
});

test('shooting consumes ammo at the fire rate; empty magazine reloads automatically after 2 s', () => {
  const s = fresh('t-flat'); parkP1(s);
  const p = s.players[0];
  ok(p.ammo === 5, 'starts with 5');
  const ev = run(s, 60, inp({ shoot: true, aim: 0 }));       // hold fire for 1 s
  ok(count(ev, 'shot') === 3, 'shots in 1 s at 3/s: ' + count(ev, 'shot'));
  ok(p.ammo === 2, 'ammo after 3 shots: ' + p.ammo);
  run(s, 40, inp({ shoot: true, aim: 0 }));                  // 2 more shots -> empty
  ok(p.ammo === 0 && p.reloadLeft > 0, 'empty and reloading: ammo=' + p.ammo + ' reload=' + p.reloadLeft);
  const ev2 = run(s, 60, inp({ shoot: true }));              // still holding the trigger: cannot shoot while reloading
  ok(count(ev2, 'shot') === 0, 'no shots while reloading');
  run(s, 70, inp({ shoot: true }));
  ok(count(run(s, 0), 'x') === 0);
  ok(p.ammo > 0, 'reloaded: ammo=' + p.ammo);
});

test('reload takes ~2.0 s and refills the whole magazine', () => {
  const s = fresh('t-flat'); parkP1(s);
  const p = s.players[0];
  p.ammo = 0;
  let t = 0;
  while (p.ammo === 0 && t < 400) { step(s, [N, N]); t++; }
  near(t / 60, 2.0, 0.05, 'reload time');
  ok(p.ammo === 5, 'full magazine');
});

test('a bullet deals 20 damage; five hits kill; the round ends (shots are aimed along the arc)', () => {
  const s = fresh('t-flat');
  place(s.players[0], 200, 485); place(s.players[1], 500, 485);
  const aimAt = (st) => solveAimFromBody(st.players[0].x, st.players[0].y, st.players[1].x, st.players[1].y, st.players[0].stats.bulletSpeed, st.players[0].stats.bulletGravity, CONFIG.player.muzzleDistance);
  let ev = run(s, 25, (i, st) => inp({ shoot: true, aim: aimAt(st) }));
  ok(s.players[1].hp === 80, 'hp after one hit: ' + s.players[1].hp);
  ok(count(ev, 'hit') === 1, 'one hit event');
  // keep firing until dead (reload in between)
  ev = run(s, 600, (i, st) => inp({ shoot: true, aim: aimAt(st) }));
  ok(!s.players[1].alive || s.phase === 'roundEnd' || s.round > 1 || s.scores[0] === 1, 'player 1 died, scores=' + s.scores);
});

test('block negates a bullet (no damage, blocked event); shield lasts 0.3 s then a 4 s cooldown', () => {
  const s = fresh('t-flat');
  place(s.players[0], 200, 485); place(s.players[1], 420, 485);
  // p1 raises the shield just before the bullet arrives (travel ~ 190/900 = 0.21 s)
  const evs = [];
  for (let i = 0; i < 30; i++) {
    evs.push(...step(s, [inp({ shoot: i === 0, aim: 0 }), inp({ block: i >= 5, aim: Math.PI })]));
  }
  ok(count(evs, 'blocked') === 1, 'blocked events: ' + count(evs, 'blocked'));
  ok(s.players[1].hp === 100, 'no damage while blocking, hp=' + s.players[1].hp);
  ok(s.players[1].blockCd > 3.0, 'cooldown running: ' + s.players[1].blockCd);
  // block window really ends after 0.3 s
  run(s, 20, N, inp({ block: true }));
  ok(s.players[1].blockLeft === 0, 'shield down after the window');
});

test('self damage: own bounced bullet hurts the shooter, but never at the muzzle', () => {
  const s = fresh('t-walls', [['pinball'], []]);
  place(s.players[0], 640, 485); place(s.players[1], 1000, 100);
  // 1) firing straight at a wall 300 units away: the bullet needs a while to come back
  const evs = run(s, 3, inp({ shoot: true, aim: Math.PI }));
  ok(s.players[0].hp === 100, 'no self hit at the muzzle');
  // let the bullet bounce off the left wall (x=340) and come back
  let bounced = false, hurt = false;
  for (let i = 0; i < 200; i++) {
    const e = step(s, [N, N]);
    if (count(e, 'bounce')) bounced = true;
    if (e.some((x) => x.type === 'hit' && x.player === 0)) hurt = true;
  }
  ok(bounced, 'bullet bounced');
  ok(hurt && s.players[0].hp < 100, 'own bounced bullet hurt the shooter, hp=' + s.players[0].hp);
});

test('Powder Keg: explosion damages and destroys destructible blocks', () => {
  const s = fresh('t-flat', [['powderkeg'], []]);
  place(s.players[0], 800, 485); parkP1(s, 150);
  let evs = run(s, 40, inp({ shoot: true, aim: 0 }));           // shoot right at the block (x=900..932)
  ok(count(evs, 'explosion') >= 1, 'explosion event');
  const blk = s.blocks.find((b) => b.id === 'blk');
  ok(!blk.alive && count(evs, 'blockBreak') === 1, 'block destroyed, hp=' + blk.hp);
  ok(!getColliders(s).some((c) => c.id === 'blk'), 'destroyed block no longer collides');
});

test('Powder Keg: the owner is hurt by his own explosion when standing close', () => {
  const s = fresh('t-flat', [['powderkeg'], []]);
  place(s.players[0], 700 - 15 - 28, 485); parkP1(s, 150);       // 28 units from the wall's left face
  const evs = run(s, 6, inp({ shoot: true, aim: 0 }));
  ok(count(evs, 'explosion') === 1, 'explosion');
  ok(s.players[0].hp < 100, 'owner hurt: hp=' + s.players[0].hp);
});

test('Powder Keg explosion far from the player does no damage to him', () => {
  const s = fresh('t-flat', [['powderkeg'], []]);
  place(s.players[0], 300, 485); parkP1(s, 150);
  const evs = run(s, 40, inp({ shoot: true, aim: 0 }));          // wall is 400 away
  ok(count(evs, 'explosion') >= 1 && s.players[0].hp === 100, 'safe at range, hp=' + s.players[0].hp);
});

test('plain bullets chip destructible blocks (3 hits to destroy a 50 HP block)', () => {
  const s = fresh('t-flat');
  place(s.players[0], 800, 485); parkP1(s, 150);
  run(s, 25, inp({ shoot: true, aim: 0 }));
  const blk = s.blocks.find((b) => b.id === 'blk');
  ok(blk.hp === 30 || blk.hp === 10, 'block damaged hp=' + blk.hp);
  run(s, 60, inp({ shoot: true, aim: 0 }));
  ok(!blk.alive, 'broken after three hits');
});

test('every card in cards.js has the required fields', () => {
  for (const c of CARDS) ok(c.id && c.name && c.rarity && c.description, 'card ' + c.id);
  ok(new Set(CARDS.map((c) => c.id)).size === CARDS.length, 'unique ids');
});

test('falling out of the bottom: 15% max HP damage, thrown back up and towards the centre', () => {
  const s = fresh('t-island'); place(s.players[1], 650, 485);
  place(s.players[0], 480, 400);                                  // not above the island: falls into the pit
  let evs = run(s, 100);
  ok(count(evs, 'oob') === 1, 'oob event: ' + count(evs, 'oob'));
  near(s.players[0].hp, 85, 0.001, 'hp after the fall');
  ok(s.players[0].vy < 0 || s.players[0].y < 720, 'back inside / launched');
  evs = run(s, 20);
  ok(s.players[0].vx > 0 || s.players[0].x > 480, 'moved towards the centre');
  ok(s.players[0].oobInv > 0 || s.players[0].hp === 85, 'invulnerability prevents instant re-damage');
  ok(s.players[0].alive, 'still alive');
});

test('falling out of the side: damage + thrown back inside', () => {
  const s = fresh('t-island'); place(s.players[1], 650, 485);
  place(s.players[0], 1320, 300); s.players[0].vx = 200;
  const evs = run(s, 4);
  ok(count(evs, 'oob') === 1, 'oob event');
  near(s.players[0].hp, 85, 0.001, 'hp');
  ok(s.players[0].vx < 0 && s.players[0].x < 1280, 'launched back to the left, x=' + s.players[0].x + ' vx=' + s.players[0].vx);
  const s2 = fresh('t-island'); place(s2.players[1], 650, 485);
  place(s2.players[0], -50, 300);
  run(s2, 2);
  ok(s2.players[0].vx > 0 && s2.players[0].x > 0, 'left side launches to the right');
});

test('real map (Old Plaza): falling into the pit at any x puts the player back on a platform (rarely more than one fall)', () => {
  let single = 0, total = 0;
  for (let x = 40; x <= 1240; x += 40) {
    const s = fresh('old-plaza'); place(s.players[1], -500, 400); s.cheats.invulnerable[1] = true;
    place(s.players[0], x, 700); s.players[0].vy = 300;
    const evs = run(s, 360);
    total++; if (count(evs.filter((e) => e.player === 0), 'oob') === 1 && s.players[0].grounded) single++;
  }
  ok(single / total >= 0.80, single + ' of ' + total + ' falls ended with exactly one fall and a safe landing');
});

test('going above the top of the screen is free (no damage, no oob)', () => {
  const s = fresh('t-island'); place(s.players[1], 650, 485);
  place(s.players[0], 640, -400); s.players[0].vy = -100;
  const evs = run(s, 20);
  ok(count(evs, 'oob') === 0 && s.players[0].hp === 100, 'no penalty at the top');
  ok(s.players[0].y < 0 || s.players[0].vy > -100, 'still up there or falling back');
});

test('out of bounds damage can kill and ends the round', () => {
  const s = fresh('t-island'); place(s.players[1], 650, 485);
  place(s.players[0], 300, 400); s.players[0].hp = 12;
  const evs = run(s, 120);
  ok(!s.players[0].alive || s.phase === 'roundEnd', 'dead from the fall');
  ok(s.result && s.result.winner === 1 && s.scores[1] === 1, 'player 1 scores, result=' + JSON.stringify(s.result));
});

test('death ends the round, short pause, then the match loop takes over (the loser gets a quiz / card turn)', () => {
  const s = fresh('t-flat');
  place(s.players[0], 200, 485); place(s.players[1], 500, 485); s.players[1].hp = 15;
  let evs = run(s, 30, inp({ shoot: true, aim: 0 }));
  ok(count(evs, 'death') === 1 && count(evs, 'roundEnd') === 1, 'death + roundEnd');
  ok(s.phase === 'roundEnd' && s.result.winner === 0 && s.scores[0] === 1, 'phase roundEnd, winner 0');
  evs = run(s, Math.ceil(CONFIG.round.endDelay * 60) + 2);
  ok(s.phase === 'dummyTurn' || s.phase === 'quiz', 'the loser is now in the quiz / dummy turn: ' + s.phase);
});

test('draw: both players die on the same tick -> restart, nobody scores', () => {
  const s = fresh('t-flat', [['powderkeg'], []]);
  // P0 right in front of the wall, P1 on the other side of the explosion point... both within radius
  place(s.players[0], 700 - 15 - 20, 485); place(s.players[1], 700 - 15 - 20, 440);
  s.players[0].hp = 5; s.players[1].hp = 5;
  const evs = run(s, 6, inp({ shoot: true, aim: 0 }));
  ok(count(evs, 'death') === 2, 'two deaths: ' + count(evs, 'death'));
  ok(s.result && s.result.winner === -1, 'draw result');
  ok(s.scores[0] === 0 && s.scores[1] === 0, 'nobody scored');
  run(s, Math.ceil(CONFIG.round.endDelay * 60) + 2);
  ok(s.phase === 'playing' && s.players[0].alive && s.players[1].alive, 'restarted');
});

test('moving platforms: position is a pure function of the tick, and riders are carried', () => {
  const def = getMap('t-flat').platforms[0];
  const a = platformPos(def, 0), b = platformPos(def, 120);                 // 2 s at 100 u/s = the far end
  near(a.x, 300, 0.001, 'start'); near(b.x, 500, 0.5, 'far end after 2 s');
  near(platformPos(def, 240).x, 300, 0.5, 'back again after 4 s (ping-pong)');
  const s = fresh('t-flat'); parkP1(s);
  place(s.players[0], 350, 400 - 15 - 0.01);                                   // standing on the platform
  run(s, 30);
  ok(s.players[0].grounded && s.players[0].groundId === 'mp', 'grounded on the platform');
  const x0 = s.players[0].x;
  run(s, 60);
  ok(s.players[0].x - x0 > 80, 'carried along: moved ' + (s.players[0].x - x0).toFixed(1));
});

test('the state is plain JSON and the simulation is deterministic', () => {
  const play = () => {
    const s = fresh('t-flat', [['powderkeg'], ['hairtrigger']]);
    run(s, 300, (i) => inp({ right: i % 90 < 45, left: i % 90 >= 45, shoot: i % 50 < 25, jump: i % 70 === 0, jumpPressed: i % 70 === 0, aim: (i % 100) * 0.06 }),
                (i) => inp({ shoot: i % 30 < 15, aim: Math.PI + (i % 40) * 0.01, block: i % 120 === 60 }));
    return s;
  };
  const a = play(), b = play();
  ok(JSON.stringify(a) === JSON.stringify(b), 'two runs with the same inputs give identical state');
  const copy = JSON.parse(JSON.stringify(a));
  ok(JSON.stringify(copy) === JSON.stringify(a), 'JSON round trip is lossless');
  // a copy can keep simulating and stays identical to the original
  run(a, 60); run(copy, 60);
  ok(JSON.stringify(copy) === JSON.stringify(a), 'restored copy continues identically');
});

test('map data: every map is valid (spawns free, unique ids, destructibles and a moving platform or hazard)', () => {
  for (const m of MAPS) {
    if (m.id.startsWith('t-')) continue;
    ok(m.spawns.length === 2, 'two spawns');
    const s = createState({ mapId: m.id });
    const cols = getColliders(s);
    for (const p of s.players) ok(!cols.some((c) => Math.abs(p.x - (c.x + c.w / 2)) < (p.w + c.w) / 2 && Math.abs(p.y - (c.y + c.h / 2)) < (p.h + c.h) / 2), 'spawn free of terrain');
    const ids = [...m.destructibles.map((d) => d.id), ...m.platforms.map((d) => d.id)];
    ok(new Set(ids).size === ids.length, 'unique ids');
    ok(m.destructibles.length > 0 && (m.platforms.length > 0 || m.hazards.length > 0), m.id + ' has destructibles and a moving platform or a hazard');
    // players land on their spawn islands (grounded after settling)
    run(s, 30);
    ok(s.players.every((p) => p.grounded), 'both spawns stand on solid ground');
  }
});

// ---------------------------------------------------------------------------------------------------------
// hazards
test('spikes: damage + shove along the spike direction + short re-hit cooldown', () => {
  const s = fresh('t-haz'); parkP1(s, 1050);
  place(s.players[0], 430, 485);
  const ev = run(s, 2);
  ok(count(ev, 'hazardHit') === 1, 'hazardHit event');
  near(s.players[0].hp, 85, 0.001, 'spikes deal 15');
  ok(s.players[0].vy < -400, 'shoved upward, vy=' + s.players[0].vy);
  ok(s.players[0].hazardCd > 0.5, 're-hit cooldown running');
  // put him back into the spikes while the cooldown runs: nothing happens
  place(s.players[0], 430, 485); run(s, 10);
  near(s.players[0].hp, 85, 0.001, 'no second hit during the cooldown');
  // after the cooldown a new touch hurts again
  run(s, 40); place(s.players[0], 430, 485); run(s, 3);
  near(s.players[0].hp, 70, 0.001, 'hurts again after the cooldown');
  ok(s.players[0].alive, 'cannot be melted instantly');
});

test('spikes shove sideways away from the zone when hit from the side', () => {
  const s = fresh('t-haz'); parkP1(s, 1050);
  place(s.players[0], 475, 485);                      // just right of the zone centre (430), overlapping its edge
  run(s, 2);
  ok(s.players[0].vx > 0 || s.players[0].x > 475, 'pushed away to the right, vx=' + s.players[0].vx);
});

test('grate: a solid platform that hurts when touched', () => {
  const s = fresh('t-haz'); parkP1(s, 1050);
  ok(getColliders(s).some((c) => c.id === 'gr' && c.kind === 'hazard'), 'grate is a collider');
  place(s.players[0], 650, 300); let maxY = 0;
  const ev = [];
  for (let i = 0; i < 40; i++) { ev.push(...step(s, [N, N])); maxY = Math.max(maxY, s.players[0].y); if (count(ev, 'hazardHit')) break; }
  ok(count(ev, 'hazardHit') === 1, 'hurt on landing');
  ok(maxY <= 440 - 15 + 0.5, 'did not sink into it, maxY=' + maxY);
  near(s.players[0].hp, 90, 0.001, 'grate deals 10');
});

test('saw: moves along its path (pure function of the tick), damages and shoves away from its centre', () => {
  const def = getMap('t-haz').hazards[2];
  near(platformPos(def, 0).x, 800, 0.01, 'start'); near(platformPos(def, 90).x, 950, 0.5, 'far end after 1.5 s');
  const s = fresh('t-haz'); parkP1(s, 1050);
  place(s.players[0], 825, 485);                       // to the right of the starting position
  const ev = run(s, 3);
  ok(count(ev, 'hazardHit') === 1 && ev.find((e) => e.type === 'hazardHit').kind === 'saw', 'saw hit');
  near(s.players[0].hp, 80, 0.001, 'saw deals 20');
  ok(s.players[0].vx > 300, 'shoved away (to the right), vx=' + s.players[0].vx);
  // the saw comes to the player at the far end of its path
  const s2 = fresh('t-haz'); parkP1(s2, 1050);
  place(s2.players[0], 960, 485);
  const evs = run(s2, 140);
  const hit = evs.find((e) => e.type === 'hazardHit');
  ok(hit && hit.tick > 50, 'the moving saw reached him later, tick=' + (hit && hit.tick));
});

test('explosive barrels: shooting one blows it up, chains into the next barrel and the crate, hurts nearby players as environment damage', () => {
  const s = fresh('t-haz'); parkP1(s, 1050);
  place(s.players[0], 250, 485);
  const ev = run(s, 45, inp({ shoot: true, aim: 0 }));
  ok(count(ev, 'explosion') >= 2, 'chain reaction: ' + count(ev, 'explosion') + ' explosions');
  ok(s.blocks.find((b) => b.id === 'cr').alive === false, 'the crate was destroyed too');
  const envHit = ev.find((e) => e.type === 'hit' && e.player === 0 && e.source === -1);
  ok(envHit && s.players[0].hp < 100, 'the shooter standing close was hurt by the environment explosion, hp=' + s.players[0].hp);
  // a barrel far from anyone hurts nobody
  const s2 = fresh('t-haz'); parkP1(s2, 1050); place(s2.players[0], 150, 485);
  run(s2, 60, inp({ shoot: true, aim: 0 }));
  ok(s2.players[0].hp === 100, 'far away: no damage, hp=' + s2.players[0].hp);
});

test('hazard damage is environment damage: it can kill and the round goes to the other player', () => {
  const s = fresh('t-haz'); place(s.players[1], 1050, 485);
  place(s.players[0], 430, 485); s.players[0].hp = 10;
  const ev = run(s, 3);
  ok(count(ev, 'death') === 1 && ev.find((e) => e.type === 'death').source === -1, 'environment death');
  ok(s.result && s.result.winner === 1 && s.scores[1] === 1, 'player 1 wins the round');
});

test('hazards: a same-tick double death is a draw (restart, nobody scores)', () => {
  const s = fresh('t-haz');
  place(s.players[0], 420, 485); place(s.players[1], 445, 485);
  s.players[0].hp = 10; s.players[1].hp = 10;
  const ev = run(s, 3);
  ok(count(ev, 'death') === 2, 'two deaths');
  ok(s.result.winner === -1 && s.scores[0] === 0 && s.scores[1] === 0, 'draw, no points');
  run(s, Math.ceil(CONFIG.round.endDelay * 60) + 2);
  ok(s.phase === 'playing' && s.players[0].alive && s.players[1].alive, 'restarted');
});

test('hazards in a non-hazard map file: maps without a hazards list still work', () => {
  const s = fresh('t-flat'); parkP1(s);
  ok(getHazards(s).length === 0, 'no hazards');
  run(s, 5);
});

// ---------------------------------------------------------------------------------------------------------
// round timer / sudden death
test('round clock: sudden death starts after the time limit and both players lose HP steadily', () => {
  const s = fresh('t-flat'); parkP1(s);
  ok(!s.suddenDeath && s.roundTime === 0, 'starts calm');
  run(s, Math.round(CONFIG.round.timeLimit * 60) - 5);
  ok(!s.suddenDeath && s.players[0].hp === 100, 'still calm just before the limit');
  const ev = run(s, 10);
  ok(count(ev, 'suddenDeath') === 1 && s.suddenDeath, 'suddenDeath event fired once');
  const hp0 = s.players[0].hp;
  run(s, 60);
  near(hp0 - s.players[0].hp, CONFIG.round.suddenDeathDps, 0.05, 'loses 2 HP per second');
  near(s.players[1].hp, s.players[0].hp, 0.001, 'both lose HP at the same rate');
});

test('sudden death: the player with less HP dies first and the other wins the round', () => {
  const s = fresh('t-flat'); parkP1(s); s.roundTime = CONFIG.round.timeLimit; s.players[1].hp = 3;
  const ev = run(s, 150);
  ok(count(ev, 'death') === 1 && ev.find((e) => e.type === 'death').player === 1, 'player 1 died of sudden death');
  ok(ev.find((e) => e.type === 'death').reason === 'suddenDeath', 'reason recorded');
  ok(s.result.winner === 0 && s.scores[0] === 1, 'player 0 wins the round');
});

test('sudden death: a same-tick double death is a draw (restart, no point); the clock resets', () => {
  const s = fresh('t-flat'); parkP1(s); s.roundTime = CONFIG.round.timeLimit;
  s.players[0].hp = 3; s.players[1].hp = 3;
  const ev = run(s, 150);
  ok(count(ev, 'death') === 2, 'both died');
  ok(s.result.winner === -1 && s.scores[0] === 0 && s.scores[1] === 0, 'draw, nobody scores');
  run(s, Math.ceil(CONFIG.round.endDelay * 60) + 2);
  ok(s.phase === 'playing' && !s.suddenDeath && s.roundTime < 2, 'new round, clock and sudden death reset');
});

test('the round clock stops during the end-of-round pause', () => {
  const s = fresh('t-flat'); parkP1(s); s.players[1].hp = 1; s.players[1].hp = 0.5;
  s.roundTime = 10; s.players[0].hp = 100;
  place(s.players[0], 200, 485); place(s.players[1], 500, 485); s.players[1].hp = 15;
  run(s, 30, inp({ shoot: true, aim: 0 }));
  ok(s.phase === 'roundEnd', 'round over');
  const t0 = s.roundTime; run(s, 20);
  ok(s.roundTime === t0, 'clock frozen');
});

// ---------------------------------------------------------------------------------------------------------
// map validity (hazards)
test('real map: spawns are safe (not in or near hazards or barrels) and reachable platforms cover the whole map', () => {
  const map = getMap('ruined-city'), s = createState({ mapId: 'ruined-city' });
  const hz = getHazards(s);
  for (const sp of map.spawns) {
    for (const h of hz) {
      if (h.shape === 'rect') {
        const dx = Math.max(h.x - sp.x, 0, sp.x - (h.x + h.w)), dy = Math.max(h.y - sp.y, 0, sp.y - (h.y + h.h));
        ok(Math.hypot(dx, dy) > 80, 'spawn too close to hazard ' + h.id);
      } else {
        const def = map.hazards.find((x) => x.id === h.id);
        for (let tick = 0; tick < 1800; tick += 10) { const c = platformPos(def, tick); ok(Math.hypot(c.x - sp.x, c.y - sp.y) > 80 + h.r, 'saw ' + h.id + ' passes too close to a spawn'); }
      }
    }
    for (const d of map.destructibles) if (d.kind === 'barrel') ok(Math.hypot(d.x + d.w / 2 - sp.x, d.y + d.h / 2 - sp.y) > 140, 'barrel ' + d.id + ' too close to a spawn');
  }
  // mirror image: the right spawn sees the same safety (checked above); across the rotation spikes and saws are used somewhere (the layouts are sparse now: a map has 0-3 pieces)
  const types = new Set(MAPS.filter((m) => !m.id.startsWith('t-')).flatMap((m) => m.hazards.map((h) => h.type))); ok(types.has('spikes') && types.has('saw'), 'spikes and saws are used by some map (ember grates have their own tests above)');
  ok(map.destructibles.some((d) => d.kind === 'barrel'), 'has barrels');
  // ids are unique across everything
  const ids = [...map.destructibles.map((d) => d.id), ...map.platforms.map((p) => p.id), ...map.hazards.map((h) => h.id)];
  ok(new Set(ids).size === ids.length, 'unique ids');
  // crates, barrels and hazard zones do not overlap solids; saw paths stay clear of terrain
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (const d of map.destructibles) for (const so of map.solids) ok(!overlap(d, so), d.id + ' overlaps a solid');
  for (const h of map.hazards) {
    if (h.type === 'saw') { for (let tick = 0; tick < 1800; tick += 5) { const c = platformPos(h, tick); for (const so of map.solids) ok(!overlap({ x: c.x - h.r, y: c.y - h.r, w: 2 * h.r, h: 2 * h.r }, so), 'saw touches terrain'); } }
    else if (h.solid) for (const so of map.solids) ok(!overlap(h, so), h.id + ' overlaps a solid');
  }
  // moving platforms never sweep through terrain
  for (const p of map.platforms) for (let tick = 0; tick < 1800; tick += 5) { const c = platformPos(p, tick); for (const so of map.solids) ok(!overlap({ x: c.x, y: c.y, w: p.w, h: p.h }, so), p.id + ' sweeps through terrain'); }
  // approximate reachability (single jumps <= 95 up / 150 across, lifts, tram) from each spawn island
  for (const sp of map.spawns) {
    const { all, seen } = reachable(map, (x) => sp.x >= x.x0 && sp.x <= x.x1 && Math.abs(x.top - (sp.y + 15)) < 2);
    const bad = all.filter((x) => !seen.has(x.name)).map((x) => x.name);
    ok(bad.length === 0, 'unreachable surfaces: ' + bad.join(','));
  }
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

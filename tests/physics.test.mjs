// Tests for the ROUNDS-like physics pass (docs/PHYSICS.md, preset R): wall grip and glide, regrab lockout,
// wall-jump climbing, the stored jump charge, corner forgiveness, momentum carry, the bullet arc and the bot's aim.
// Run:  node tests/physics.test.mjs
import { CONFIG } from '../src/config.js';
import { registerMap } from '../src/maps/index.js';
import { createState, step, STEP } from '../src/sim/world.js';
import { applyImpulse, spawnBullet } from '../src/sim/combat.js';
import { solveAim, solveAimFromBody, dropAt } from '../src/sim/aim.js';
import { createBot, botInput } from '../src/practice/dummy-bot.js';
import { reachable } from './reach.mjs';
import { getMap } from '../src/maps/index.js';

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS  ' + name); } catch (e) { failed++; console.log('FAIL  ' + name + '\n        ' + e.message); } }
function ok(c, m) { if (!c) throw new Error(m || 'assertion failed'); }
function near(a, b, tol, m) { if (!(Math.abs(a - b) <= tol)) throw new Error((m || 'value') + ': expected ~' + b + ' (+/-' + tol + '), got ' + a); }

// floor top y=500; wall x 700..740 from y=100 down to the floor; steps for the ledge test; a ceiling block for the head-bump test
registerMap({
  id: 'p-room', name: 'test', background: 'none',
  spawns: [{ x: 200, y: 485 }, { x: 1000, y: 485 }],
  solids: [
    { x: 100, y: 500, w: 1000, h: 40 },
    { x: 700, y: -300, w: 40, h: 800 },
    { x: 300, y: 494, w: 50, h: 10 },       // step 6 units high (sits on the floor)
    { x: 400, y: 488, w: 50, h: 12 },       // step 12 units high
    { x: 800, y: 390, w: 100, h: 30 },      // ceiling block: bottom at y=420
  ],
  destructibles: [], platforms: [],
});
registerMap({ id: 'p-open', name: 'test', background: 'none', spawns: [{ x: 200, y: 485 }, { x: 1000, y: 485 }], solids: [{ x: 60, y: 500, w: 1160, h: 40 }], destructibles: [], platforms: [] });

const N = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
const inp = (o) => ({ ...N, ...o });
const M = CONFIG.move;
function fresh(mapId = 'p-room') { const s = createState({ mapId, seed: 3 }); place(s.players[1], 1150, 485); s.cheats.invulnerable = [true, true]; return s; }
function place(p, x, y, vx = 0, vy = 0) { p.x = x; p.y = y; p.vx = vx; p.vy = vy; }
function run(s, n, f0) { for (let i = 0; i < n; i++) step(s, [typeof f0 === 'function' ? f0(i, s) : f0 || N, N], STEP); }

test('wall grip needs input INTO the wall: without it you fall normally, with it you glide at about 112 u/s', () => {
  let s = fresh(); const p = s.players[0]; place(p, 685, 150);
  run(s, 30);                                                        // no input: plain falling along the wall
  ok(p.vy > 600, 'free fall without input, vy=' + p.vy.toFixed(0));
  s = fresh(); const q = s.players[0]; place(q, 685, 150);
  run(s, 30, inp({ right: true }));
  ok(q.vy > 90 && q.vy < 130, 'gliding at the grip terminal speed after 0.5 s: ' + q.vy.toFixed(1));
  s = fresh(); const r = s.players[0]; place(r, 685, 150);
  run(s, 30, inp({ left: true }));                                   // pressing AWAY from the wall: no grip
  ok(r.vy > 600, 'pressing away does not grip, vy=' + r.vy.toFixed(0));
  near(M.wallSlideAccel / M.wallScrub, 112.5, 0.1, 'configured terminal speed');
});

test('wall glide: arriving at full fall speed is brought down to the slide speed within a fraction of a second (never above 160 once gripped)', () => {
  const s = fresh(); const p = s.players[0]; place(p, 685, 120, 0, 900);
  let maxAfterGrip = 0;
  for (let i = 0; i < 40; i++) { step(s, [inp({ right: true }), N], STEP); if (i >= 2) maxAfterGrip = Math.max(maxAfterGrip, p.vy); }
  ok(maxAfterGrip <= M.wallSlideMax + 1, 'never above the safety clamp once gripped: ' + maxAfterGrip.toFixed(0));
  ok(p.vy > 100 && p.vy < 125, 'settled at ' + p.vy.toFixed(1));
});

test('wall grip is only for a body in the air (a standing player is not "gripping")', () => {
  const s = fresh(); const p = s.players[0]; place(p, 685, 485);
  run(s, 20, inp({ right: true }));
  ok(p.grounded && p.vy === 0, 'standing next to the wall, pressing into it, is just standing');
});

test('regrab lockout: after a wall jump the wall cannot be gripped / refill the jump for 0.15 s', () => {
  const s = fresh(); const p = s.players[0]; place(p, 685, 300);
  run(s, 4, inp({ right: true })); ok(p.wallDir === 1 && p.wallCoyote > 0, 'on the wall');
  step(s, [inp({ right: true, jump: true, jumpPressed: true }), N], STEP);
  ok(p.wallRegrab > 0.13 && p.wallCoyote === 0, 'locked right after the jump');
  run(s, 3, inp({ right: true, jump: true }));
  ok(p.wallRegrab > 0 && p.wallCoyote === 0, 'still locked after 3 ticks (' + p.wallRegrab.toFixed(3) + ')');
  run(s, 8, inp({ right: true, jump: true }));
  ok(p.wallRegrab === 0, 'lockout over after 0.15 s');
});

test('wall jump kick is ROUNDS-like: 220 sideways, 607 up (1:2.76), no steering lock, and it carries', () => {
  const s = fresh(); const p = s.players[0]; place(p, 685, 300);
  run(s, 4, inp({ right: true }));
  step(s, [inp({ right: true, jump: true, jumpPressed: true }), N], STEP);
  near(p.vx, -220, 1, 'vx'); near(p.vy, -0.92 * 660, 1, 'vy'); ok(p.carry > 0.25, 'carry set');
  run(s, 6, inp({ right: true, jump: true }));                       // holding INTO the wall right away is allowed (no lock) and pulls back
  ok(p.vx > -220, 'steering back toward the wall works at once: vx=' + p.vx.toFixed(0));
});

test('one-wall climb: holding into the wall and tapping jump whenever it is touched (jump key kept down, like a player) climbs it at about 200 units/s', () => {
  const s = fresh(); const p = s.players[0]; place(p, 685, 485);
  const y0 = p.y; let prev = false, worstGap = 0;
  run(s, 180, (i, st) => {
    const want = (p.grounded || p.wallCoyote > 0) && p.wallRegrab <= 0;
    const f = inp({ right: true, jump: true, jumpPressed: want && !prev }); prev = want;
    worstGap = Math.max(worstGap, 700 - (p.x + 15));
    return f;
  });
  const climbed = y0 - p.y;
  ok(climbed > 300, 'climbed ' + climbed.toFixed(0) + ' units in 3 s');
  ok(worstGap < 45, 'never drifted far from the wall (max gap ' + worstGap.toFixed(0) + ')');
  console.log('        climb rate: ' + (climbed / 3).toFixed(0) + ' units/s (about ' + (climbed / 3 / 3).toFixed(0) + ' per hop)');
});

test('stored jump charge: walking off a ledge keeps ONE jump (used later in the air), a second air jump is not possible', () => {
  const s = fresh('p-open'); const p = s.players[0]; place(p, 1190, 485);
  run(s, 30, inp({ right: true }));                                  // walk off the right end of the floor (x 1220)
  ok(!p.grounded && p.jumpCharge === 1, 'in the air with the charge kept (grounded=' + p.grounded + ', charge=' + p.jumpCharge + ')');
  run(s, 30);                                                        // fall for 0.5 s: far beyond the coyote time
  const vyBefore = p.vy;
  step(s, [inp({ jump: true, jumpPressed: true }), N], STEP);
  ok(p.vy < -600 && vyBefore > 0, 'the stored jump fires in mid-air, vy=' + p.vy.toFixed(0));
  run(s, 20, inp({ jump: true }));
  step(s, [inp({ jump: true, jumpPressed: true }), N], STEP);
  const vy2 = p.vy;
  run(s, 3, inp({ jump: true }));
  ok(p.vy > vy2 - 1, 'no second air jump: gravity keeps acting (' + p.vy.toFixed(0) + ' vs ' + vy2.toFixed(0) + ')');
  ok(p.jumpCharge === 0, 'charge spent');
});

test('the jump charge refills on the ground (jump, land, jump again)', () => {
  const s = fresh('p-open'); const p = s.players[0]; place(p, 300, 485);
  run(s, 5); step(s, [inp({ jump: true, jumpPressed: true }), N], STEP); ok(p.jumpCharge === 0, 'spent');
  run(s, 80); ok(p.grounded && p.jumpCharge === 1, 'refilled after landing');
});

test('ledge pop: running into a 6-unit step climbs it, a 12-unit step stops you; head-bump nudge slides you round a ceiling corner', () => {
  let s = fresh(); let p = s.players[0]; place(p, 250, 485);
  run(s, 60, inp({ right: true }));
  ok(p.x > 360, 'walked over the 6-unit step (x=' + p.x.toFixed(0) + ')');
  s = fresh(); p = s.players[0]; place(p, 360, 485);
  run(s, 60, inp({ right: true }));
  ok(p.x < 400 && p.x > 370, 'stopped at the 12-unit step (x=' + p.x.toFixed(0) + ')');
  // head bump: ceiling bottom y=420, left corner x=800. Jump from x=790 (body overlaps the corner by 5).
  const climb = (x, nudge) => {
    const old = M.cornerNudge; M.cornerNudge = nudge;
    try { const st = fresh(); const q = st.players[0]; place(q, x, 485); let minY = 1e9; run(st, 5); for (let i = 0; i < 60; i++) { step(st, [inp({ jump: true, jumpPressed: i === 0 }), N], STEP); minY = Math.min(minY, q.y); } return minY; }
    finally { M.cornerNudge = old; }
  };
  ok(climb(790, 8) < 395, 'with the nudge (5 units of overlap) the jump slides round the corner and rises on');
  ok(climb(790, 0) > 430, 'without it the head stops against the ceiling');
  ok(climb(803, 8) > 430, 'an overlap of 18 units (more than the nudge) is a real ceiling');
});

test('momentum carry: a 260 shove on the ground glides about 40 units (was 14); running, stopping and turning are unchanged', () => {
  const s = fresh('p-open'); const p = s.players[0]; place(p, 300, 485); run(s, 5);
  const x0 = p.x; applyImpulse(s, 0, 260, 0); run(s, 40);
  ok(p.x - x0 > 33 && p.x - x0 < 55, 'glided ' + (p.x - x0).toFixed(1) + ' units');
  const old = M.carryTime; M.carryTime = 0;
  try { const t = fresh('p-open'); const q = t.players[0]; place(q, 300, 485); run(t, 5); const xx = q.x; applyImpulse(t, 0, 260, 0); q.carry = 0; run(t, 40); ok(q.x - xx < 20, 'without carry only ' + (q.x - xx).toFixed(1)); } finally { M.carryTime = old; }
  // plain run / stop / turn
  const r = fresh('p-open'); const a = r.players[0]; place(a, 300, 485); run(r, 5);
  run(r, 30, inp({ right: true })); near(a.vx, 300, 0.5, 'run speed'); run(r, 8); near(a.vx, 0, 0.5, 'stops within 8 ticks');
  run(r, 30, inp({ right: true })); run(r, 8, inp({ left: true })); ok(a.vx < 0, 'turns around in 8 ticks (vx=' + a.vx.toFixed(0) + ')');
  // overspeed decays slowly
  const o = fresh('p-open'); const b = o.players[0]; place(b, 300, 485, 500, 0); run(o, 6);
  ok(b.vx > 330 && b.vx < 420, 'speed above run speed decays at about 1100/s on the ground: ' + b.vx.toFixed(0));
});

test('air control: airAccel 1000 / airDrag 600', () => {
  ok(M.airAccel === 1000 && M.airDrag === 600, 'config');
  const s = fresh('p-open'); const p = s.players[0]; place(p, 300, 200, 300, 0);
  run(s, 30);                                                         // no input in the air
  near(p.vx, 0, 1, 'drifts to a stop in 0.5 s');
});

test('base recoil is 0: shooting does not push the body', () => {
  const s = fresh('p-open'); const p = s.players[0]; place(p, 300, 485); run(s, 5);
  step(s, [inp({ shoot: true, aim: 0 }), N], STEP); ok(p.vx === 0, 'no recoil, vx=' + p.vx);
});

// ---- bullets ------------------------------------------------------------------------------------------------------------
test('bullet drop matches the PHYSICS.md worked example: 10 / 40 / 90 units at 300 / 600 / 900 range (speed 1500, gravity 500)', () => {
  const s = createState({ mapId: 'p-open', seed: 1 }); s.cheats.invulnerable = [true, true];
  place(s.players[0], 100, -2000); place(s.players[1], 1150, -2000);
  const b = spawnBullet(s, 0, { x: 50, y: 100, angle: 0 }); b.immune = 9;
  const path = [[b.x, b.y]]; let guard = 0;
  while (b.x < 960 && guard++ < 200) { step(s, [N, N], STEP); path.push([b.x, b.y]); }
  const yAt = (x) => { for (let i = 1; i < path.length; i++) if (path[i][0] >= x) { const [x0, y0] = path[i - 1], [x1, y1] = path[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); } return NaN; };
  const got = { 300: yAt(350) - 100, 600: yAt(650) - 100, 900: yAt(950) - 100 };
  near(got[300], 10, 1.6, 'drop at 300'); near(got[600], 40, 3, 'drop at 600'); near(got[900], 90, 5, 'drop at 900');
  near(dropAt(300, 1500, 500), 10, 0.01, 'formula 300'); near(dropAt(600, 1500, 500), 40, 0.01, 'formula 600'); near(dropAt(900, 1500, 500), 90, 0.01, 'formula 900');
  near(Math.sqrt(2 * 30 * 1500 * 1500 / 500), 520, 1, 'range at which the drop equals one body height (30): about 520');
});

test('aim solver: 5.12 degrees up to hit a same-height target 800 units away (aim 71.7 above)', () => {
  const a = solveAim(0, 0, 800, 0, 1500, 500);
  near(-a * 180 / Math.PI, 5.12, 0.02, 'elevation');
  near(Math.tan(-a) * 800, 71.7, 0.6, 'aim point above the target');
  near(solveAim(800, 0, 0, 0, 1500, 500), Math.PI - a, 1e-9, 'mirrored when the target is on the left');
  ok(solveAim(0, 0, 5000, 0, 1500, 500) === -Math.PI / 4, 'out of range lobs at 45 degrees');
});

test('the dummy bot\'s arc aim hits a stationary target 800 units away (error and reaction delay switched off)', () => {
  const s = createState({ mapId: 'p-open', seed: 4 }); s.match.auto = [false, false];
  place(s.players[0], 200, 485); place(s.players[1], 1000, 485); s.cheats.invulnerable = [false, true];
  const bot = createBot(5, { aimErrorDeg: 0, reactionTime: 0, needLineOfSight: true, blockChance: 0 });
  let hits = 0, shots = 0;
  for (let i = 0; i < 400; i++) {
    const in1 = botInput(bot, s, 1, STEP);
    place(s.players[1], 1000, 485);                                  // a stationary bot (it only aims here)
    in1.left = in1.right = in1.jump = false;
    const ev = step(s, [N, in1], STEP);
    for (const e of ev) { if (e.type === 'shot') shots++; if (e.type === 'hit' && e.player === 0) hits++; }
    place(s.players[0], 200, 485);
  }
  ok(shots >= 4 && hits >= shots - 2, 'shots ' + shots + ', hits ' + hits);
});

test('the same shot at 800 units with a plain flat aim (no arc compensation) misses by more than a body height', () => {
  const s = createState({ mapId: 'p-open', seed: 4 }); place(s.players[0], 200, 485); place(s.players[1], 1000, 485);
  let hit = false;
  for (let i = 0; i < 90; i++) { place(s.players[1], 1000, 485); const ev = step(s, [inp({ shoot: i === 0, aim: 0 }), N], STEP); if (ev.some((e) => e.type === 'hit' && e.player === 1)) hit = true; }
  ok(!hit, 'a flat shot drops about 90 units and misses');
});

test('fast bullets still collide properly: a 1500 u/s bullet cannot tunnel through a 20-unit slab', () => {
  const s = createState({ mapId: 'p-room', seed: 1 }); s.cheats.invulnerable = [true, true];
  place(s.players[0], 100, -2000); place(s.players[1], 1150, -2000);
  const b = spawnBullet(s, 0, { x: 750, y: 405, angle: Math.PI / 2, speed: 3000 }); b.immune = 9;  // straight down onto the ceiling block (x 800..900)
  b.x = 850; b.y = 300;
  let hit = false; for (let i = 0; i < 20; i++) { const ev = step(s, [N, N], STEP); if (ev.some((e) => e.type === 'impact')) { hit = true; break; } }
  ok(hit && b.y < 400, 'stopped at the block top (y=' + b.y.toFixed(1) + ')');
});

test('reachability: wall climbing adds edges (a tall wall can be climbed), and the real map needs no wall climbing at all', () => {
  const m = { solids: [{ x: 0, y: 500, w: 300, h: 40 }, { x: 330, y: 150, w: 40, h: 350 }, { x: 400, y: 150, w: 200, h: 20 }], destructibles: [], platforms: [] };
  const start = (s) => s.name === 'solid0';
  ok(!reachable(m, start, false).seen.has('solid2'), 'unreachable by jumping alone');
  ok(reachable(m, start, true).seen.has('solid2'), 'reachable by climbing the 350-unit wall next to it');
  const real = getMap('ruined-city'), sp = real.spawns[0];
  const st = (s) => sp.x >= s.x0 && sp.x <= s.x1 && Math.abs(s.top - (sp.y + 15)) < 2;
  const a = reachable(real, st, false), b = reachable(real, st, true);
  ok(a.all.every((s) => a.seen.has(s.name)), 'every surface of Overgrown Downtown is reachable by single jumps and lifts');
  ok(b.seen.size === a.seen.size, 'wall climbing adds nothing');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

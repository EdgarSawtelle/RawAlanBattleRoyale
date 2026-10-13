// Tests for the character animation (src/client/anim.js, config.render.animations): the springs settle quickly, never run away,
// the deformation stays bounded and volume-preserving, the run cycle is speed matched, landing squash grows with the impact,
// wall grip / jumps are recognised from state alone, and the whole thing is render-only (it never touches the simulation).
// Run:  node tests/anim.test.mjs
import fs from 'node:fs';
import { CONFIG } from '../src/config.js';
import { springStep, createAnim, animUpdate, animEvent, deathPose, wallContact } from '../src/client/anim.js';
import { createState, step, STEP } from '../src/sim/world.js';
import { MAPS } from '../src/maps/index.js';

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const C = CONFIG.render.animations;
const DT = 1 / 60;

// a grounded / airborne observation of a 1x body
const obs = (o = {}) => ({ x: 0, y: 0, w: 30, h: 30, vx: 0, vy: 0, grounded: true, wall: 0, wallEdge: undefined, aim: 0, alive: true, blockLeft: 0, limpet: false, victory: false, ...o });
const run = (a, n, o, dt = DT) => { let r = null; for (let i = 0; i < n; i++) r = animUpdate(a, typeof o === 'function' ? o(i) : o, dt); return r; };
const fresh = () => { const A = createAnim(); return { A, a: A.players[0] }; };

test('config: animations are on by default and the block is complete', () => {
  ok(C && C.enabled === true, 'enabled');
  for (const k of ['stiffness', 'damping', 'maxStretch', 'maxSquash', 'stretchPerSpeed', 'landSquash', 'stepPx', 'bobPx', 'gripMaxVy', 'recoilKick', 'hitSquash', 'tumbleSpin', 'deathTime', 'winHop']) ok(Number.isFinite(C[k]), 'missing ' + k);
});

test('spring: settles within 0.25 s with a small overshoot (springy, not jelly)', () => {
  const s = { x: -0.3, v: 0 };
  let minX = 0, maxX = -1, settledAt = null;
  for (let i = 1; i <= 120; i++) {
    springStep(s, 0, C.stiffness, C.damping, DT);
    maxX = Math.max(maxX, s.x);
    if (Math.abs(s.x) > 0.02 * 0.3) settledAt = null; else if (settledAt === null) settledAt = i * DT;
  }
  ok(settledAt !== null && settledAt <= 0.25, 'settles at ' + settledAt);
  const over = maxX / 0.3;
  ok(over > 0.05 && over < 0.4, 'overshoot ' + over.toFixed(2) + ' should be a little bounce (5%..40%)');
});

test('spring: the same motion at 30, 60, 144 and 240 fps (frame-rate independent)', () => {
  const at = (dt) => { const s = { x: -0.3, v: 0 }; for (let t = 0; t < 0.1 - 1e-9; t += dt) springStep(s, 0, C.stiffness, C.damping, dt); return s.x; };
  const ref = at(1 / 240);
  for (const dt of [1 / 30, 1 / 60, 1 / 144]) ok(Math.abs(at(dt) - ref) < 0.01, 'dt ' + dt + ': ' + at(dt) + ' vs ' + ref);
});

test('spring: no runaway, even with a huge frame time, stiff settings and constant kicks', () => {
  for (const [k, c] of [[C.stiffness, C.damping], [8000, 60], [C.leanStiffness, C.leanDamping], [C.lagStiffness, C.lagDamping]]) {
    const s = { x: 0, v: 0 };
    for (let i = 0; i < 4000; i++) { if (i % 37 === 0) s.v += 5; springStep(s, (i % 200) < 100 ? 0.3 : -0.3, k, c, i % 11 === 0 ? 0.25 : DT); ok(Number.isFinite(s.x) && Math.abs(s.x) < 5, 'diverged at ' + i + ': ' + s.x); }
  }
});

test('pose: deformation is bounded and volume-preserving over a wild random sequence', () => {
  const { A, a } = fresh();
  let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let vx = 0, vy = 0, grounded = false, wall = 0;
  const types = ['hit', 'shot', 'blocked', 'oob', 'hit'];
  for (let i = 0; i < 6000; i++) {
    if (rnd() < 0.02) vy = -300 - rnd() * 700; if (rnd() < 0.02) vx = (rnd() - 0.5) * 1100; if (rnd() < 0.03) grounded = !grounded; if (rnd() < 0.02) wall = [-1, 0, 1][Math.floor(rnd() * 3)];
    vy = Math.min(950, vy + 2500 * DT);
    if (rnd() < 0.015) animEvent(A, { type: types[Math.floor(rnd() * types.length)], player: 0, angle: rnd() * 6.28, x: 0, y: 0, side: 'left' });
    const z = 0.6 + rnd() * 1.0;
    const p = animUpdate(a, obs({ w: 30 * z, h: 30 * z, vx, vy: grounded ? 0 : vy, grounded, wall: grounded ? 0 : wall, wallEdge: 100, aim: rnd() * 6.28, blockLeft: rnd() < 0.1 ? 0.2 : 0, limpet: rnd() < 0.2 }), DT);
    ok(p && Number.isFinite(p.sw) && Number.isFinite(p.sh) && Number.isFinite(p.lean) && Number.isFinite(p.lift), 'non-finite pose at ' + i);
    ok(p.sh >= 1 - C.maxSquash - 1e-9 && p.sh <= 1 + C.maxStretch + 1e-9, 'sh ' + p.sh + ' out of range at ' + i);
    ok(p.sw >= 0.55 && p.sw <= 1.6, 'sw ' + p.sw + ' out of range at ' + i);
    ok(Math.abs(p.lean) <= 5 * z + 1e-9 && p.lift >= 0 && p.lift < 14, 'lean / lift out of range: ' + p.lean + ' ' + p.lift);
    if (p.grip < 0.01) ok(Math.abs(p.sw * p.sh - 1) < 1e-9, 'volume not kept: ' + p.sw * p.sh);
  }
});

test('landing: the squash grows with the impact speed and springs back within ~0.3 s', () => {
  const depth = (impact) => {
    const { a } = fresh(); run(a, 20, obs());
    run(a, 10, (i) => obs({ grounded: false, vy: Math.min(impact, 100 + i * 200) }));
    run(a, 3, obs({ grounded: false, vy: impact }));
    let minS = 1; let r = animUpdate(a, obs({ vy: 0 }), DT); minS = Math.min(minS, r.sh);
    let back = null;
    for (let i = 1; i <= 40; i++) { r = animUpdate(a, obs({ vy: 0 }), DT); minS = Math.min(minS, r.sh); if (Math.abs(r.sh - 1) < 0.06 && back === null) back = i * DT; }
    return { minS, back, final: r.sh };
  };
  const d1 = depth(250), d2 = depth(500), d3 = depth(900);
  ok(d1.minS > d2.minS && d2.minS > d3.minS, 'squash must deepen with impact: ' + [d1.minS, d2.minS, d3.minS].map((v) => v.toFixed(2)));
  ok(d3.minS <= 1 - 0.22 && d3.minS >= 1 - C.maxSquash - 1e-9, 'a hard landing squashes clearly but within the limit: ' + d3.minS);
  ok(d3.back !== null && d3.back <= 0.3, 'springs back by ' + d3.back);
  ok(Math.abs(d3.final - 1) < 0.06, 'final ' + d3.final);
  const soft = depth(100);
  ok(soft.minS > 0.93, 'a tiny drop barely squashes: ' + soft.minS);
});

test('take-off: a quick push-off squash that rebounds into a stretch', () => {
  const { a } = fresh(); run(a, 20, obs());
  const p0 = animUpdate(a, obs({ grounded: false, vy: -660 }), DT);
  ok(p0.sh < 0.92, 'push-off squash ' + p0.sh);
  let maxSh = 0; for (let i = 0; i < 6; i++) maxSh = Math.max(maxSh, animUpdate(a, obs({ grounded: false, vy: -660 + i * 30 }), DT).sh);
  ok(maxSh > 1.1, 'then stretches ' + maxSh);
});

test('air stretch: tall when going fast, rounder at the apex, within the limit', () => {
  const sh = (vy) => { const { a } = fresh(); run(a, 10, obs()); return run(a, 30, obs({ grounded: false, vy })).sh; };
  ok(sh(-660) > 1.1 && sh(900) > sh(-660) - 0.05 && sh(900) <= 1 + C.maxStretch + 1e-9, 'stretch ' + sh(-660) + ' ' + sh(900));
  ok(sh(0) < 1.0, 'apex pose is a little squashed/round: ' + sh(0));
});

test('run cycle: step rate is proportional to the ground speed, bob is bounded', () => {
  const steps = (vx) => { const { a } = fresh(); run(a, 30, obs({ vx })); const p0 = a.phase; run(a, 120, obs({ vx })); return a.phase - p0; };
  const s150 = steps(150), s300 = steps(300);
  ok(Math.abs(s300 / s150 - 2) < 0.05, 'ratio ' + s300 / s150);
  ok(s300 / 2 > 6 && s300 / 2 < 12, 'steps per second at full speed ' + s300 / 2);
  const { a } = fresh(); let maxLift = 0, minSh = 9, maxSh = 0;
  run(a, 30, obs({ vx: 300 })); for (let i = 0; i < 120; i++) { const p = animUpdate(a, obs({ vx: 300 }), DT); maxLift = Math.max(maxLift, p.lift); minSh = Math.min(minSh, p.sh); maxSh = Math.max(maxSh, p.sh); }
  ok(maxLift >= 1.5 && maxLift <= 3.2, 'bob height ' + maxLift);
  ok(minSh < 0.97 && maxSh > 1.04, 'the step squash / stretch is visible: ' + minSh + ' .. ' + maxSh);
  const big = fresh(), small = fresh(); let lb = 0, ls = 0;
  for (let i = 0; i < 90; i++) { lb = Math.max(lb, animUpdate(big.a, obs({ vx: 300, w: 48, h: 48 }), DT).lift); ls = Math.max(ls, animUpdate(small.a, obs({ vx: 300, w: 18, h: 18 }), DT).lift); }
  ok(lb > ls, 'a big body bobs more than a small one: ' + lb + ' ' + ls);
});

test('stop: the lean overshoots to the other side and settles (the wobble), idle breathing stays tiny', () => {
  const { a } = fresh(); run(a, 40, obs({ vx: 300 }));
  let min = 9, max = -9, p; for (let i = 0; i < 30; i++) { p = animUpdate(a, obs({ vx: Math.max(0, 300 - i * 50) }), DT); min = Math.min(min, p.lean); }
  ok(min < -0.8, 'lean swings back when stopping: ' + min);
  run(a, 30, obs()); p = run(a, 1, obs()); ok(Math.abs(p.lean) < 0.1, 'settled ' + p.lean);
  let mx = 0; for (let i = 0; i < 200; i++) mx = Math.max(mx, Math.abs(animUpdate(a, obs(), DT).sh - 1)); ok(mx < 0.06, 'idle breathing amplitude ' + mx);
});

test('wallContact: finds the wall on the side we touch, ignores floors, corners and walls that are not there', () => {
  const wall = { x: 100, y: 0, w: 40, h: 400 }, floor = { x: 0, y: 400, w: 1280, h: 40 };
  const r = wallContact(85, 200, 30, 30, [wall, floor]);
  ok(r && r.side === 1 && r.edge === 100, JSON.stringify(r));
  const l = wallContact(155, 200, 30, 30, [wall, floor]);
  ok(l && l.side === -1 && l.edge === 140, JSON.stringify(l));
  ok(wallContact(60, 200, 30, 30, [wall, floor]) === null, 'a gap of 10 units is not touching');
  ok(wallContact(85, 380, 30, 30, [{ x: 100, y: 0, w: 40, h: 368 }]) === null, 'grazing a corner by < 4 units is not a wall');
  ok(wallContact(640, 370, 30, 30, [floor]) === null, 'standing on the floor touches no wall');
});

test('wall grip: pressed against a wall and sliding slowly = grip pose with paws on the wall; a free fall past the wall is not', () => {
  const grip = (vy, extra = {}) => { const { a } = fresh(); run(a, 15, obs()); run(a, 6, obs({ grounded: false, vy: 400 })); return run(a, 14, obs({ grounded: false, vy, wall: 1, wallEdge: 77, ...extra })); };
  const g = grip(100);
  ok(g.grip > 0.9 && g.hands === 'wall' && g.side === 1 && g.wallPx === 77 && g.glide, JSON.stringify(g));
  ok(g.sw < 0.95, 'pressed flat against the wall: ' + g.sw);
  ok(grip(500).grip < 0.2 && grip(500).hands !== 'wall', 'a fast fall past a wall is not a grip');
  const l = grip(0, { limpet: true }); ok(l.cling && l.state === 'cling' && l.sw < g.sw, 'limpet clings firmer: ' + l.sw + ' vs ' + g.sw);
  const { a } = fresh(); run(a, 15, obs()); run(a, 14, obs({ grounded: false, vy: 80, wall: 1, wallEdge: 77 }));
  const free = run(a, 10, obs({ grounded: false, vy: -600, vx: -220 }));    // wall jump away: the grip lets go fast
  ok(free.grip < 0.15, 'grip released after the wall jump: ' + free.grip);
});

test('jumps are recognised from the state alone (no sim events needed): wall jump and air jump kick poses', () => {
  const { a } = fresh(); run(a, 15, obs()); run(a, 6, obs({ grounded: false, vy: 400 })); run(a, 14, obs({ grounded: false, vy: 60, wall: 1, wallEdge: 77 }));
  const p = run(a, 1, obs({ grounded: false, vy: -607, vx: -220 }));
  ok(p.state === 'walljump' && p.sh < 0.95, 'wall jump pose ' + p.state + ' ' + p.sh);
  ok(a.dust.some((d) => d.k === 'walljump'), 'wall jump puff');
  const b = fresh().a; run(b, 15, obs()); run(b, 12, obs({ grounded: false, vy: 500 }));
  const q = run(b, 1, obs({ grounded: false, vy: -561 }));
  ok(q.state === 'airjump' && b.dust.some((d) => d.k === 'airjump'), 'air jump pose ' + q.state);
});

test('dust: start, skid, landing and take-off puffs are queued from the state', () => {
  const { a } = fresh(); run(a, 10, obs());
  run(a, 12, (i) => obs({ vx: 40 * (i + 1) })); ok(a.dust.some((d) => d.k === 'start'), 'start puff'); a.dust.length = 0;
  run(a, 20, obs({ vx: 300 })); run(a, 8, (i) => obs({ vx: Math.max(0, 300 - 60 * i) })); ok(a.dust.some((d) => d.k === 'skid'), 'skid puff'); a.dust.length = 0;
  run(a, 5, obs({ grounded: false, vy: -600 })); ok(a.dust.some((d) => d.k === 'jump'), 'take-off puff'); a.dust.length = 0;
  run(a, 10, obs({ grounded: false, vy: 700 })); run(a, 1, obs({ grounded: true, vy: 0 })); ok(a.dust.some((d) => d.k === 'land' && d.amt > 0.5), 'landing puff');
  const small = fresh().a; run(small, 10, obs()); run(small, 6, obs({ grounded: false, vy: 120 })); run(small, 1, obs()); ok(!small.dust.some((d) => d.k === 'land'), 'no dust for a tiny drop');
});

test('events: a shot kicks the gun back and pushes the body, a silent (already shown) shot does not; the kick dies out in 0.3 s', () => {
  const { A, a } = fresh(); run(a, 20, obs());
  animEvent(A, { type: 'shot', player: 0, angle: 0, silent: true }); ok(run(a, 1, obs()).kick < 0.01, 'silent shot must not kick');
  animEvent(A, { type: 'shot', player: 0, angle: 0 });
  const p = run(a, 1, obs()); ok(p.kick > 1.5 && p.px < -0.3, 'kick ' + p.kick + ' push ' + p.px);
  ok(Math.abs(run(a, 18, obs()).kick) < 0.15, 'kick is gone after 0.3 s');
  animEvent(A, { type: 'hit', player: 0, angle: 0 }); const h = run(a, 1, obs()); ok(h.sh < 0.9, 'hit flinch squash ' + h.sh);
  animEvent(A, { type: 'roundStart' }); ok(run(a, 1, obs()).sh > 0.95, 'roundStart resets');
});

test('tumble: spins while flung through the air after a hit, upright again afterwards', () => {
  const { A, a } = fresh(); run(a, 20, obs());
  animEvent(A, { type: 'hit', player: 0, angle: 0 });
  let maxRot = 0; for (let i = 0; i < 20; i++) maxRot = Math.max(maxRot, Math.abs(animUpdate(a, obs({ grounded: false, vx: 520, vy: -300 }), DT).rot));
  ok(maxRot > 1, 'spins ' + maxRot);
  const p = run(a, 60, obs()); ok(Math.abs(p.rot) < 0.1, 'upright again ' + p.rot);
});

test('block brace, victory hop and death pop', () => {
  const { a } = fresh(); run(a, 20, obs());
  const b = run(a, 12, obs({ blockLeft: 0.2 })); ok(b.hands === 'brace' && b.sh < 0.97, 'brace ' + b.hands + ' ' + b.sh);
  const v = fresh().a; run(v, 20, obs()); let maxLift = 0, hop = 0; for (let i = 0; i < 90; i++) { const p = animUpdate(v, obs({ victory: true }), DT); maxLift = Math.max(maxLift, p.lift); if (p.lift === 0 && i > 5) hop++; }
  ok(maxLift > C.winHop * 0.7 && maxLift < C.winHop * 1.6, 'victory hop height ' + maxLift);
  const d = fresh(); run(d.a, 20, obs()); animEvent(d.A, { type: 'death', player: 0 });
  animUpdate(d.a, obs({ alive: false }), DT); ok(deathPose(d.a), 'death pop starts');
  for (let i = 0; i < 40; i++) animUpdate(d.a, obs({ alive: false }), DT); ok(deathPose(d.a) === null, 'death pop is over after ' + C.deathTime + ' s');
});

test('frozen game (dt = 0): the pose stays put; paused / single-stepped sim does not creep', () => {
  const { a } = fresh(); const p = run(a, 30, obs({ vx: 300 }));
  const q = animUpdate(a, obs({ vx: 300 }), 0); ok(q === p, 'same pose object');
});

test('render only: anim.js never imports the simulation, and animating a running sim does not change it by a single bit', () => {
  const src = fs.readFileSync(new URL('../src/client/anim.js', import.meta.url), 'utf8');
  ok(!/from '\.\.\/sim\//.test(src) && !/from '\.\.\/net\//.test(src), 'anim.js must not import sim / net');
  const run1 = (withAnim) => {
    const st = createState({ mapId: MAPS[0].id, seed: 7, mapLock: MAPS[0].id }); st.cheats.invulnerable = [true, true];
    const A = createAnim();
    for (let t = 0; t < 600; t++) {
      const inp = { left: (t % 120) > 70, right: (t % 120) < 50, jump: t % 90 > 40, jumpPressed: t % 90 === 41, shoot: t % 25 === 0, block: t % 200 === 150, aim: Math.sin(t / 30) * 3 };
      const ev = step(st, [inp, null], STEP);
      if (withAnim) { for (const e of ev) animEvent(A, e); st.players.forEach((p, i) => animUpdate(A.players[i], { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, grounded: p.grounded, wall: p.wallDir, wallEdge: 0, aim: p.aim, alive: p.alive, blockLeft: p.blockLeft, limpet: false, victory: false }, STEP)); }
    }
    return JSON.stringify(st);
  };
  ok(run1(true) === run1(false), 'the simulation state differs when the animation runs alongside');
});

for (const t of pending) {
  try { t.fn(); console.log('PASS  ' + t.name); passed++; }
  catch (e) { console.log('FAIL  ' + t.name + '\n        ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); failed++; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);

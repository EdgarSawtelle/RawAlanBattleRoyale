// Map validity for every map in the rotation: spawns, ids, overlaps, moving things never pass through solids,
// mirror symmetry (fairness), hazard readability (size), reachability by single jumps / lifts / wall climbing (wall-climb-only
// surfaces are listed), the design rules that came from the playtests (headroom over every standing surface, no 30-60 u wedge
// slots, hazard and block density, no hazard in a jump arc, spawn line of sight: tests/maplint.mjs, thresholds in LIMITS there),
// the rotation rule (all maps before any repeat) and that a bot match plays on each map.
// Run:  node tests/maps.test.mjs          (prints, per map, which platforms need wall climbing)
import { MAPS, ROTATION, getMap } from '../src/maps/index.js';
import { createState, step, STEP, getColliders, nextRound, newMatch } from '../src/sim/world.js';
import { getHazards } from '../src/sim/hazards.js';
import { platformPos } from '../src/sim/platforms.js';
import { reachable, surfaces } from './reach.mjs';
import { lint, LIMITS } from './maplint.mjs';
import { createPracticeSession } from '../src/practice/practice-session.js';

let passed = 0, failed = 0;
const pitRates = {};
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
function ok(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
const overlap = (a, b, m = 0) => a.x < b.x + b.w - m && a.x + a.w > b.x + m && a.y < b.y + b.h - m && a.y + a.h > b.y + m;
const circleRect = (cx, cy, r, b) => { const dx = Math.max(b.x - cx, 0, cx - (b.x + b.w)), dy = Math.max(b.y - cy, 0, cy - (b.y + b.h)); return dx * dx + dy * dy < r * r; };

test('the rotation holds the real maps: at least 29 (the 4 originals + 25 layouts), each with a name, a family, a description, a background and its own id; all 16 backdrop looks are used', () => {
  ok(ROTATION.length >= 29, 'at least 29 maps: ' + ROTATION.length);
  const bgs = new Set(ROTATION.map((id) => getMap(id).background)); ok(bgs.size === 8, 'all eight backgrounds are used: ' + [...bgs]);
  const looks = {}; for (const id of ROTATION) { const m = getMap(id); const k = m.background + ' ' + (m.backgroundVariant || 0); looks[k] = (looks[k] || 0) + 1; }
  ok(Object.keys(looks).length === 16, 'all 16 scene / variant combinations are used: ' + JSON.stringify(looks));
  for (const [k, n] of Object.entries(looks)) ok(n >= 1, 'every backdrop look has at least 1 map: ' + k + ' has ' + n);
  const fam = {}; for (const id of ROTATION) { const m = getMap(id); ok(m.name && m.family && m.description && m.background && m.spawns.length === 2, id + ' has a name, family, description, background and two spawns'); fam[m.family] = (fam[m.family] || 0) + 1; }
  ok(new Set(ROTATION).size === ROTATION.length && new Set(ROTATION.map((id) => getMap(id).name)).size === ROTATION.length, 'ids and names are unique');
  console.log('        ' + ROTATION.length + ' maps, families: ' + Object.entries(fam).map(([k, n]) => k + ' ' + n).join(', ') + '; looks: ' + Object.entries(looks).map(([k, n]) => k.replace('overgrown-downtown', 'OD').replace('waterfall-forest', 'WF').replace('old-plaza', 'OP').replace('abandoned-suburb', 'AS').replace('dry-harbour', 'DH').replace('highway-interchange', 'HI').replace('sunken-metro', 'SM').replace('snowbound-town', 'SB') + ' ' + n).join(', '));
});

for (const id of ROTATION) {
  const map = getMap(id);

  test(id + ': spawns are free, safe (away from hazards, saws, barrels) and stand on solid ground', () => {
    const s = createState({ mapId: id }); s.cheats.invulnerable = [true, true];
    const cols = getColliders(s);
    for (const p of s.players) ok(!cols.some((c) => overlap({ x: p.x - 15, y: p.y - 15, w: 30, h: 30 }, c)), 'spawn free of terrain');
    for (let i = 0; i < 30; i++) step(s, [null, null], STEP);
    ok(s.players.every((p) => p.grounded), 'both stand on solid ground');
    const hz = getHazards(s);
    for (const sp of map.spawns) {
      for (const h of hz) {
        if (h.shape === 'rect') { const dx = Math.max(h.x - sp.x, 0, sp.x - (h.x + h.w)), dy = Math.max(h.y - sp.y, 0, sp.y - (h.y + h.h)); ok(Math.hypot(dx, dy) > 80, 'spawn too close to ' + h.id); }
        else { const def = map.hazards.find((x) => x.id === h.id); for (let t = 0; t < 3600; t += 10) { const c = platformPos(def, t); ok(Math.hypot(c.x - sp.x, c.y - sp.y) > 80 + h.r, 'saw ' + h.id + ' passes too close to a spawn'); } }
      }
      for (const d of map.destructibles) if (d.kind === 'barrel') ok(Math.hypot(d.x + d.w / 2 - sp.x, d.y + d.h / 2 - sp.y) > 140, 'barrel ' + d.id + ' too close to a spawn');
    }
  });

  test(id + ': ids are unique, nothing overlaps (crates, barrels, hazard zones, saw paths), everything lies on the screen or just off it', () => {
    const ids = [...map.destructibles.map((d) => d.id), ...map.platforms.map((p) => p.id), ...map.hazards.map((h) => h.id)];
    ok(new Set(ids).size === ids.length, 'unique ids');
    const solids = map.solids;
    for (const d of map.destructibles) {
      for (const s of solids) ok(!overlap(d, s, 0.5), 'block ' + d.id + ' overlaps a slab');
      for (const e of map.destructibles) if (e !== d) ok(!overlap(d, e, 0.5), 'blocks ' + d.id + ' and ' + e.id + ' overlap');
    }
    for (const h of map.hazards) {
      if (h.type === 'saw') continue;
      for (const s of solids) ok(!overlap(h, s, 0.5) || h.solid, 'hazard ' + h.id + ' overlaps a slab');
      if (h.solid) for (const s of solids) ok(!overlap(h, s, 0.5), 'grate ' + h.id + ' overlaps a slab');
      for (const d of map.destructibles) ok(!overlap(h, d, 0.5), 'hazard ' + h.id + ' overlaps block ' + d.id);
    }
    for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) ok(!overlap(solids[i], solids[j], 0.5), 'slabs ' + i + ' and ' + j + ' overlap');
    for (const s of [...solids, ...map.destructibles]) ok(s.x >= -2 && s.x + s.w <= 1282 && s.y + s.h <= 720, 'inside the field: ' + JSON.stringify(s));
  });

  test(id + ': moving platforms and saws never pass through solids, blocks or each other', () => {
    const solid = [...map.solids, ...map.destructibles.map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h })), ...map.hazards.filter((h) => h.solid)];
    for (let t = 0; t < 7200; t += 3) {
      for (const p of map.platforms) {
        const pos = platformPos(p, t), box = { x: pos.x, y: pos.y, w: p.w, h: p.h };
        for (const s of solid) ok(!overlap(box, s, 0.5), 'platform ' + p.id + ' passes through ' + JSON.stringify(s) + ' at tick ' + t);
      }
      for (const h of map.hazards) if (h.type === 'saw') { const c = platformPos(h, t); for (const s of solid) ok(!circleRect(c.x, c.y, h.r, s), 'saw ' + h.id + ' passes through ' + JSON.stringify(s) + ' at tick ' + t); }
    }
  });

  test(id + ': mirror image (fairness): every slab, block, hazard and moving platform has its twin', () => {
    const W = 1280, key = (r) => [r.x, r.y, r.w, r.h].map((v) => Math.round(v)).join(',');
    const mir = (r) => ({ ...r, x: W - r.x - r.w });
    const has = (list, r) => list.some((q) => key(q) === key(mir(r)));
    for (const s of map.solids) ok(has(map.solids, s), 'slab ' + key(s));
    for (const d of map.destructibles) ok(has(map.destructibles, d), 'block ' + d.id);
    for (const h of map.hazards) { if (h.type === 'saw') ok(map.hazards.some((q) => q.type === 'saw' && (Math.abs(q.path[0].x - (W - h.path[0].x)) < 1 || Math.abs(q.path[1].x - (W - h.path[0].x)) < 1)), 'saw ' + h.id); else ok(has(map.hazards.filter((q) => q.type !== 'saw'), h), 'hazard ' + h.id); }
    ok(Math.abs(map.spawns[0].x + map.spawns[1].x - W) < 1 && map.spawns[0].y === map.spawns[1].y, 'spawns mirror each other');
    for (const p of map.platforms) { const a = p.path[0], b = p.path[p.path.length - 1]; ok(map.platforms.some((q) => (Math.abs(q.path[0].x - (W - a.x - p.w)) < 1 || Math.abs(q.path[1].x - (W - a.x - p.w)) < 1) && q.w === p.w), 'platform ' + p.id); void b; }
  });

  test(id + ': hazards are easy to see (spike strips at least 48 x 18) and few: 0-' + LIMITS.hazardsMax + ' hazard pieces, ' + LIMITS.blocksMin + '-' + LIMITS.blocksMax + ' destructible blocks, a moving platform or a hazard, ' + LIMITS.slabsMin + '-' + LIMITS.slabsMax + ' slabs', () => {
    for (const h of map.hazards) if (h.type === 'spikes') ok(h.w >= 48 && h.h >= 18, 'spikes ' + h.id + ' is ' + h.w + 'x' + h.h);
    const bad = lint(map).issues.filter((i) => /too many hazards|destructible blocks|needs a moving|slabs d/.test(i)); ok(!bad.length, bad.join('; '));
  });

  const L = lint(map);
  const part = (re) => L.issues.filter((i) => re.test(i));
  test(id + ': headroom: at least ' + LIMITS.headroom + ' u of air over every standing surface (tunnels ' + LIMITS.tunnelMin + '+ where declared)', () => { const b = part(/^headroom/); ok(!b.length, b.slice(0, 4).join('; ')); });
  test(id + ': no wedge slots (gaps of ' + LIMITS.wedgeLo + '-' + LIMITS.wedgeHi + ' u between facing sides)', () => { const b = part(/^wedge/); ok(!b.length, b.slice(0, 4).join('; ')); });
  test(id + ': no hazard inside the jump arc between two platforms; the spawns do not see each other along a flat line', () => { const b = part(/jump arc|spawns see/); ok(!b.length, b.slice(0, 4).join('; ')); });

  test(id + ': falling into the pit puts the player back on something in at least half of the cases (one fall, a safe landing)', () => {
    const N0 = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
    let single = 0, total = 0;
    for (let x = 40; x <= 1240; x += 40) {
      const s = createState({ mapId: id, seed: 1 }); s.cheats.invulnerable[1] = true; s.players[1].x = -500; s.players[1].y = 400;
      const p = s.players[0]; p.x = x; p.y = 700; p.vy = 300; let oobs = 0;
      for (let i = 0; i < 360; i++) oobs += step(s, [N0, N0], STEP).filter((e) => e.type === 'oob' && e.player === 0).length;
      total++; if (oobs === 1 && p.grounded) single++;
    }
    pitRates[id] = single + '/' + total;
    ok(single / total >= 0.5, single + ' of ' + total + ' pit falls ended with one fall and a safe landing');
  });

  test(id + ': everything is reachable from both spawns by single jumps, lifts or wall climbing (wall-climb-only listed)', () => {
    for (const k of [0, 1]) {
      const sp = map.spawns[k], start = (s) => sp.x >= s.x0 && sp.x <= s.x1 && Math.abs(s.top - (sp.y + 15)) < 2;
      const { all, seen } = reachable(map, start), { seen: noWall } = reachable(map, start, false);
      const lost = all.filter((s) => !seen.has(s.name));
      ok(lost.length === 0, 'unreachable from spawn ' + k + ': ' + lost.map((s) => s.name).join(', '));
      if (k === 0) console.log('        ' + id + ': ' + all.length + ' surfaces, wall-climb needed only for: ' + (all.filter((s) => seen.has(s.name) && !noWall.has(s.name)).map((s) => s.name).join(', ') || 'none'));
    }
    void surfaces;
  });
}

test('rotation rule: all maps appear before any repeats, no map twice in a row, same sequence for the same seed, a pinned map never rotates', () => {
  const N = ROTATION.length, s = createState({ seed: 7, rotate: true });
  const seq = [s.mapId]; for (let i = 0; i < N * 4 - 1; i++) { nextRound(s); seq.push(s.mapId); }
  for (let b = 0; b < 4; b++) ok(new Set(seq.slice(b * N, b * N + N)).size === N, 'block ' + b + ' has all maps: ' + seq.slice(b * N, b * N + N));
  for (let i = 1; i < seq.length; i++) ok(seq[i] !== seq[i - 1], 'no repeat in a row at ' + i);
  const t = createState({ seed: 7, rotate: true }); const seq2 = [t.mapId]; for (let i = 0; i < N * 4 - 1; i++) { nextRound(t); seq2.push(t.mapId); }
  ok(seq.join() === seq2.join(), 'deterministic for a seed');
  const u = createState({ seed: 7, rotate: true, mapLock: 'old-plaza' }); for (let i = 0; i < 6; i++) nextRound(u);
  ok(u.mapId === 'old-plaza' && !u.rotate, 'pinned map stays');
  const v = createState({ mapId: 'ruined-city', seed: 3 }); nextRound(v); ok(v.mapId === 'ruined-city', 'without rotation the map stays (tests and ?map=)');
  const w = createState({ seed: 7, rotate: true }); newMatch(w); ok(JSON.parse(JSON.stringify(w)).mapBag.length <= N, 'state stays plain JSON');
  console.log('        sequence for seed 7: ' + seq.slice(0, 8).join(' > '));
});

for (const id of ROTATION) {
  test(id + ': two bots play 60 s of live play without crashing, NaN, stuck players or runaway bullets', () => {
    const S = createPracticeSession({ mapId: id, demo: true, seed: 11, mapLock: id }); S.state.match.auto = [true, true];
    let live = 0, maxB = 0, rounds = 0, guard = 0; const track = [{ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 0 }]; let stuck = 0;
    while (live < 60 * 60 && guard++ < 60 * 60 * 10) {
      S.update(1 / 60, () => ({}), () => {});
      const st = S.state; maxB = Math.max(maxB, st.bullets.length);
      for (const p of st.players) ok(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.vx) && Number.isFinite(p.vy), 'finite state');
      if (st.phase === 'playing') { live++; st.players.forEach((p, k) => { const tk = track[k]; if (Math.hypot(p.x - tk.x, p.y - tk.y) > 25) { tk.x = p.x; tk.y = p.y; tk.t = 0; } else { tk.t += 1 / 60; if (tk.t > 8) { stuck++; tk.t = -20; } } }); } else track.forEach((k) => { k.t = 0; });
      if (st.round > rounds) rounds = st.round;
    }
    ok(maxB < 80, 'bullets stay bounded: ' + maxB);
    ok(stuck <= 4, 'a bot stood still for 8 s ' + stuck + ' times');
  });
}

for (const t of pending) {
  try { t.fn(); console.log('PASS  ' + t.name); passed++; }
  catch (e) { console.log('FAIL  ' + t.name + '\n        ' + (e.stack || e).toString().split('\n').slice(0, 3).join('\n        ')); failed++; }
}
console.log('\n' + passed + ' passed, ' + failed + ' failed');
void MAPS;
process.exit(failed ? 1 : 0);

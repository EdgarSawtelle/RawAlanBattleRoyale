// Approximate reachability check of a map: platforms are nodes, an edge exists when a single jump can
// get from one top surface to another (up <= 95, horizontal gap <= 150; falling down allows up to 190 gap).
// With wallClimb (default on) there is a second kind of edge: a surface A next to the face of a taller
// block B (gap <= 40, B's face reaches down to A's top, climb <= 400) can climb B by wall-jumping: holding
// into the wall and tapping jump gains about 68 units per hop, 200 units per second, with no height limit
// (see tests/physics.test.mjs). It ignores head-bumps, so it is a sanity check, not a proof.
import { getMap } from '../src/maps/index.js';

export function surfaces(map) {
  const s = [];
  map.solids.forEach((r, i) => s.push({ name: 'solid' + i, x0: r.x, x1: r.x + r.w, top: r.y, bottom: r.y + r.h }));
  for (const d of map.destructibles) if (d.kind !== 'barrel') s.push({ name: d.id, x0: d.x, x1: d.x + d.w, top: d.y, bottom: d.y + d.h, crate: true });
  for (const p of map.platforms) {
    const a = p.path[0], b = p.path[p.path.length - 1];
    const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 70));
    for (let i = 0; i <= n; i++) { const t = i / n; const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; s.push({ name: p.id + '@' + i, x0: x, x1: x + p.w, top: y, moving: true }); }
  }
  return s;
}
export function reachable(map, startNames, wallClimb = true) {
  const S = surfaces(map);
  const gap = (a, b) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const can = (a, b) => {
    const up = a.top - b.top, g = gap(a, b);
    if (up >= 0 ? (up <= 95 && g <= 150) : (g <= 190)) return true;
    if (wallClimb && up > 95 && up <= 400 && g <= 40 && b.bottom !== undefined && b.bottom >= a.top - 2) return true;   // wall climb
    return false;
  };
  const start = S.filter((s) => startNames(s));
  const seen = new Set(start.map((s) => s.name)), q = [...start];
  while (q.length) { const a = q.pop(); for (const b of S) if (!seen.has(b.name) && can(a, b)) { seen.add(b.name); q.push(b); } }
  return { all: S, seen };
}
if (process.argv[1] && process.argv[1].endsWith('reach.mjs')) {
  const map = getMap(process.argv[2] || 'ruined-city');
  const sp = map.spawns[0];
  const start = (s) => sp.x >= s.x0 && sp.x <= s.x1 && Math.abs(s.top - (sp.y + 15)) < 2;
  const { all, seen } = reachable(map, start);
  const { seen: seenNoWall } = reachable(map, start, false);
  console.log('reachable only by wall-climbing:', all.filter((s) => seen.has(s.name) && !seenNoWall.has(s.name)).map((s) => s.name).join(', ') || 'none');
  console.log('unreachable:', all.filter((s) => !seen.has(s.name)).map((s) => s.name + '(' + s.x0 + '..' + s.x1 + ' top ' + s.top + ')').join(', ') || 'none');
}

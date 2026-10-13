// Approximate reachability check of a map: surfaces are nodes, an edge exists when a single running jump (or a fall) can
// get from one top surface to another. The limits come from the real sim (node tests/jumpreach.mjs, table below) minus a
// comfort margin of 25 u of gap, and a step up is at most 105 u.
// With wallClimb (default on) there is a second kind of edge: a surface A next to the face of a taller block B (gap <= 40,
// B's face reaches down to A's top, climb <= 460) can climb B by wall-jumping: holding into the wall and tapping jump gains about
// 68 units per hop (see tests/physics.test.mjs). A climb needs a CLEAN face: nothing may overhang the wall's face within 40 u
// beside it (the head would bump). Lifts count as surfaces at several points of their path.
// It ignores head-bumps on ordinary jumps (tests/maplint.mjs checks headroom separately), so it is a sanity check, not a proof.
import { getMap } from '../src/maps/index.js';

// measured max gap of a running jump from the edge for a step up of `up` units (negative = down): jumpreach.mjs
const TABLE = [[-100, 245], [-60, 235], [-30, 225], [0, 215], [30, 200], [60, 190], [90, 175], [105, 160], [115, 150]];
const MARGIN = 25;
export const maxStepUp = 105;
export function maxGap(up) {
  if (up > maxStepUp) return -1;
  if (up <= TABLE[0][0]) return TABLE[0][1] - MARGIN;
  for (let i = 1; i < TABLE.length; i++) if (up <= TABLE[i][0]) { const [u0, g0] = TABLE[i - 1], [u1, g1] = TABLE[i]; return g0 + (g1 - g0) * (up - u0) / (u1 - u0) - MARGIN; }
  return -1;
}

export function surfaces(map) {
  const s = [];
  map.solids.forEach((r, i) => s.push({ name: 'solid' + i, x0: r.x, x1: r.x + r.w, top: r.y, bottom: r.y + r.h }));
  for (const d of map.destructibles) if (d.kind !== 'barrel') s.push({ name: d.id, x0: d.x, x1: d.x + d.w, top: d.y, bottom: d.y + d.h, crate: true });
  for (const h of map.hazards || []) if (h.solid) s.push({ name: h.id, x0: h.x, x1: h.x + h.w, top: h.y, bottom: h.y + h.h, grate: true });
  for (const p of map.platforms) {
    const pts = p.path;
    for (let k = 0; k + 1 < pts.length || (p.mode === 'loop' && k < pts.length); k++) {
      const a = pts[k], b = pts[(k + 1) % pts.length];
      const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 70));
      for (let i = 0; i <= n; i++) { const t = i / n; const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t; s.push({ name: p.id + '@' + k + '.' + i, x0: x, x1: x + p.w, top: y, bottom: y + p.h, moving: true }); }
    }
  }
  return s;
}

// is the face of wall B (seen from surface A) free of overhangs between B's top and A's top?
function cleanFace(map, A, B) {
  const left = (A.x0 + A.x1) / 2 < (B.x0 + B.x1) / 2, face = left ? B.x0 : B.x1;
  const band = left ? { x0: face - 40, x1: face } : { x0: face, x1: face + 40 };
  for (const r of map.solids) {
    if (r.x === B.x0 && r.y === B.top && r.w === B.x1 - B.x0) continue;                    // the wall itself
    const bottom = r.y + r.h;
    if (r.x + r.w > band.x0 && r.x < band.x1 && bottom < A.top - 20 && bottom > B.top) return false;   // a floating slab hangs in the climbing column
  }
  return true;
}

export function reachable(map, startNames, wallClimb = true) {
  const S = surfaces(map);
  const gap = (a, b) => Math.max(0, Math.max(a.x0, b.x0) - Math.min(a.x1, b.x1));
  const can = (a, b) => {
    const up = a.top - b.top, g = gap(a, b);
    if (up <= maxStepUp && g <= maxGap(up)) return true;
    if (wallClimb && up > maxStepUp && up <= 460 && g <= 40 && b.bottom !== undefined && b.bottom >= a.top - 2 && cleanFace(map, a, b)) return true;   // wall climb
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

// Map design lint: the checks that came from the playtest feedback ("platforms too close together, hard to move up and down",
// "obstacles too dense"). Used by tests/maps.test.mjs; run `node tests/maplint.mjs [map-id ...]` to see every finding of a map.
//
//   headroom   free air above every standing surface (solid slab, grate, crate): at least HEADROOM (120) u unless the x range is
//              declared a tunnel in the map (`tunnels: [{ x0, x1 }]`), where at least TUNNEL_MIN (80) u is needed. Never less than 64.
//   wedge      no gap of 30 .. 60 u between two facing sides that overlap vertically by 40 u or more (a body is 30 wide, 48 with Thick Skin)
//   density    0..3 hazard pieces, 4..10 destructible blocks, at least one moving platform or hazard, 3..20 slabs
//   arc        no spikes / grate / saw inside the straight jump arc between two platforms that can be jumped between
//   spawn      the two spawns do not see each other along a straight line (terrain or blocks in between) or are 760+ u apart
import { getMap, ROTATION } from '../src/maps/index.js';
import { platformPos } from '../src/sim/platforms.js';
import { maxGap, maxStepUp } from './reach.mjs';

export const LIMITS = { headroom: 120, tunnelMin: 80, absoluteMin: 64, wedgeLo: 30, wedgeHi: 60, wedgeOverlap: 40, hazardsMax: 3, blocksMin: 4, blocksMax: 10, slabsMin: 3, slabsMax: 20, spawnSight: 760 };

const rectOf = (r, kind, id) => ({ x: r.x, y: r.y, w: r.w, h: r.h, kind, id: id || r.id });
function obstacles(map) {
  const o = [];
  map.solids.forEach((s, i) => o.push(rectOf(s, 'solid', 's' + i)));
  const cr = map.destructibles.filter((d) => d.kind !== 'barrel').map((d) => ({ ...d })).sort((a, b) => a.x - b.x || a.y - b.y);
  for (let i = 0; i < cr.length; i++) for (let j = 0; j < cr.length; j++) {           // a stack of crates is one tall block
    if (i !== j && cr[i] && cr[j] && cr[i].x === cr[j].x && cr[i].w === cr[j].w && Math.abs(cr[i].y + cr[i].h - cr[j].y) < 1) { cr[i] = { ...cr[i], h: cr[i].h + cr[j].h }; cr[j] = null; j = -1; }
  }
  for (const d of cr) if (d) o.push(rectOf(d, 'crate'));
  for (const h of map.hazards || []) if (h.solid) o.push(rectOf(h, 'grate'));
  return o;
}
function inTunnel(map, x0, x1) { return (map.tunnels || []).some((t) => x0 >= t.x0 - 0.5 && x1 <= t.x1 + 0.5); }
const xOverlap = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);

export function lint(map) {
  const issues = [], notes = {};
  const O = obstacles(map);
  const where = (r) => (r.kind === 'solid' ? 'slab ' : r.kind + ' ') + (r.id || '') + ' (' + r.x + ',' + r.y + ' ' + r.w + 'x' + r.h + ')';

  // ---- headroom ----
  let minHead = Infinity;
  for (const L of O) for (const U of O) {
    if (L === U) continue;
    const ov = xOverlap(L, U); if (ov < 8) continue;
    const gap = L.y - (U.y + U.h); if (gap < 2) continue;                       // not above, or touching (a stack / a wall standing on the floor)
    if (gap >= LIMITS.headroom) continue;
    const x0 = Math.max(L.x, U.x), x1 = Math.min(L.x + L.w, U.x + U.w);
    if (O.some((C) => C !== L && C !== U && C.x <= x0 + 0.5 && C.x + C.w >= x1 - 0.5 && C.y < L.y && C.y + C.h > U.y + U.h)) continue;   // another body fills the column between them: L is not exposed there
    const tunnel = inTunnel(map, x0, x1);
    minHead = Math.min(minHead, gap);
    if (gap < LIMITS.absoluteMin || (!tunnel && gap < LIMITS.headroom) || (tunnel && gap < LIMITS.tunnelMin)) issues.push('headroom ' + Math.round(gap) + ' u above ' + where(L) + ' under ' + where(U));
  }
  // moving platforms: head room along the whole path (and the platform as a ceiling over static surfaces)
  for (const p of map.platforms) {
    const seenKeys = new Set();
    for (let t = 0; t < 7200; t += 20) {
      const pos = platformPos(p, t), M = { x: pos.x, y: pos.y, w: p.w, h: p.h, kind: 'mover', id: p.id };
      for (const U of O) {
        if (xOverlap(M, U) >= 8) {
          const g1 = M.y - (U.y + U.h), g2 = U.y - (M.y + M.h);
          const g = g1 >= 0 ? g1 : g2 >= 0 ? g2 : -1;
          if (g >= 0 && g < LIMITS.headroom && !(g1 >= 0 && inTunnel(map, Math.max(M.x, U.x), Math.min(M.x + M.w, U.x + U.w)))) { const k = p.id + U.id + (g1 >= 0 ? 'u' : 'd'); if (!seenKeys.has(k)) { issues.push('headroom ' + Math.round(g) + ' u between moving platform ' + p.id + ' and ' + where(U)); seenKeys.add(k); } }
        }
      }
    }
  }

  // ---- wedge slots ----
  for (const A of O) for (const B of O) {
    if (A === B) continue;
    const g = B.x - (A.x + A.w); if (g < LIMITS.wedgeLo || g >= LIMITS.wedgeHi) continue;
    const vo = Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y);
    const slot = { x0: A.x + A.w, x1: B.x, y0: Math.max(A.y, B.y), y1: Math.min(A.y + A.h, B.y + B.h) };
    if (O.some((C) => C !== A && C !== B && C.x < slot.x1 && C.x + C.w > slot.x0 && C.y < slot.y1 && C.y + C.h > slot.y0)) continue;   // something stands in the slot: it is not a slot
    if (vo >= LIMITS.wedgeOverlap) issues.push('wedge slot ' + Math.round(g) + ' u wide between ' + where(A) + ' and ' + where(B));
  }

  // ---- density ----
  const hz = (map.hazards || []).length, blocks = map.destructibles.length;
  if (hz > LIMITS.hazardsMax) issues.push('too many hazards: ' + hz + ' (max ' + LIMITS.hazardsMax + ')');
  if (blocks < LIMITS.blocksMin || blocks > LIMITS.blocksMax) issues.push('destructible blocks ' + blocks + ' (want ' + LIMITS.blocksMin + '..' + LIMITS.blocksMax + ')');
  if (map.platforms.length + hz < 1) issues.push('needs a moving platform or a hazard');
  if (map.solids.length < LIMITS.slabsMin || map.solids.length > LIMITS.slabsMax) issues.push('slabs ' + map.solids.length + ' (want ' + LIMITS.slabsMin + '..' + LIMITS.slabsMax + ')');

  // ---- no hazard in a jump arc ----
  const hazRects = [], hazSaws = [];
  for (const h of map.hazards || []) {
    if (h.type === 'saw') { const pts = []; for (let t = 0; t < 7200; t += 30) pts.push(platformPos(h, t)); hazSaws.push({ h, pts }); }
    else hazRects.push(h);
  }
  const slabs = map.solids;
  for (const A of slabs) for (const B of slabs) {
    if (A === B || A.x + A.w > B.x) continue;                                    // A is the left one of the pair
    const g = B.x - (A.x + A.w); if (g < 8) continue;
    const up1 = A.y - B.y, up2 = B.y - A.y;
    const ok1 = up1 <= maxStepUp && g <= maxGap(up1), ok2 = up2 <= maxStepUp && g <= maxGap(up2);
    if (!ok1 && !ok2) continue;                                                  // cannot be jumped between: no arc
    const box = { x: A.x + A.w, w: g, y: Math.min(A.y, B.y) - 130, h: Math.max(A.y, B.y) - Math.min(A.y, B.y) + 130 };
    for (const h of hazRects) if (h.x < box.x + box.w && h.x + h.w > box.x && h.y < box.y + box.h && h.y + h.h > box.y) issues.push('hazard ' + h.id + ' (' + h.type + ') sits in the jump arc between slab (' + A.x + ',' + A.y + ') and slab (' + B.x + ',' + B.y + ')');
    for (const s of hazSaws) if (s.pts.some((c) => { const dx = Math.max(box.x - c.x, 0, c.x - (box.x + box.w)), dy = Math.max(box.y - c.y, 0, c.y - (box.y + box.h)); return dx * dx + dy * dy < s.h.r * s.h.r; })) issues.push('saw ' + s.h.id + ' sweeps through the jump arc between slab (' + A.x + ',' + A.y + ') and slab (' + B.x + ',' + B.y + ')');
  }

  // ---- spawn line of sight ----
  const [s0, s1] = map.spawns, dist = Math.hypot(s1.x - s0.x, s1.y - s0.y);
  let blocked = false;
  const wall = [...O, ...map.platforms.map((p) => { const q = platformPos(p, 0); return { x: q.x, y: q.y, w: p.w, h: p.h }; })];
  for (let i = 1; i < 200 && !blocked; i++) { const x = s0.x + (s1.x - s0.x) * i / 200, y = s0.y + (s1.y - s0.y) * i / 200; if (wall.some((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h)) blocked = true; }
  notes.spawnLine = blocked ? 'blocked' : (dist >= LIMITS.spawnSight ? 'open but ' + Math.round(dist) + ' u apart' : 'OPEN');
  if (!blocked && dist < LIMITS.spawnSight) issues.push('the spawns see each other along a straight line, ' + Math.round(dist) + ' u apart');

  notes.minHeadroom = Number.isFinite(minHead) ? Math.round(minHead) : null;
  notes.counts = { solids: map.solids.length, blocks: blocks, movers: map.platforms.length, hazards: hz };
  return { issues, notes };
}

if (process.argv[1] && process.argv[1].endsWith('maplint.mjs')) {
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : ROTATION;
  let bad = 0;
  for (const id of ids) {
    const { issues, notes } = lint(getMap(id));
    console.log((issues.length ? 'FAIL ' : 'ok   ') + id.padEnd(22) + JSON.stringify(notes.counts) + ' spawns ' + notes.spawnLine);
    for (const i of issues) console.log('        ' + i);
    if (issues.length) bad++;
  }
  console.log(bad + ' of ' + ids.length + ' maps have findings');
}

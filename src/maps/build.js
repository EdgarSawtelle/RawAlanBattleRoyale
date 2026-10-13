// ============================================================================
//  maps/build.js - a small builder so a map file is ONE readable block of data.
//  You write the LEFT half of the arena (x from 0 to 640); the builder mirrors it for fairness, names every
//  piece, builds the two spawns and returns the object the game wants (see docs/ADDING-CONTENT.md).
//
//    buildMap({
//      id, name, family, description,              the short one-line description lives in the file
//      background, backgroundVariant, hazardStyle,  one of the four backgrounds (variant 0 or 1) and the hazard colours
//      spawn: { x, top },                          LEFT spawn: x of the body centre, `top` = y of the surface it stands on
//      left:   { solids, crates, barrels, hazards, platforms },   mirrored to the right half
//      centre: { solids, crates, barrels, hazards, platforms },   pieces on the middle line, written once (optional)
//      tunnels: [{ x0, x1 }],                      x ranges where the roof is deliberately low (see tests/maps.test.mjs)
//    })
//    solids     { x, y, w, h }                     x, y = top-left corner, y grows DOWNWARD
//    crates     [x, y]  or  [x, y, hp]             32 x 32 destructible block (50 HP)
//    barrels    [x, y]                             24 x 30 explosive drum (blows up when destroyed)
//    hazards    { type: 'spikes', x, y, w, h, face } | { type: 'grate', x, y, w, h, solid: true } | { type: 'saw', r, path, speed, pause, mode }
//    platforms  { w, h, path: [{x, y}, {x, y}], speed, pause, mode }     moving platforms (path = top-left corners)
//  Shorthands for the lists above:  slab(x, y, w, h)   crateRow(x, y, n)   crateStack(x, y, cols, rows)   stairs({ x, y, steps, w, rise, base, dir })
// ============================================================================
import { W, mirrorRect } from './mirror.js';

const rid = (id) => (/\d$/.test(id) ? String(id).replace(/(\d+)$/, 'r$1') : id + 'R');

/** A slab shorthand: slab(x, y, w, h = 16) is { x, y, w, h }. */
export const slab = (x, y, w, h = 16) => ({ x, y, w, h });
/** n crates side by side, the first one with its top-left corner at (x, y). */
export const crateRow = (x, y, n) => Array.from({ length: n }, (_, i) => [x + 32 * i, y]);
/** cols x rows crates, the top-left one at (x, y). */
export const crateStack = (x, y, cols, rows) => { const o = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) o.push([x + 32 * c, y + 32 * r]); return o; };
/**
 * A solid staircase: `steps` blocks of width `w`, each one `rise` higher than the one before, every block reaching down to `base`
 * (so it is one solid mass: no gap under a step), or only `depth` deep when you give one (lighter look). `y` = top of the LOWEST step. dir 1 climbs towards +x (default), dir -1 towards -x
 * (then `x` is the right edge of the lowest step). Steps touch side by side, so nothing overhangs.
 */
export function stairs({ x, y, steps, w, rise, base, depth, dir = 1 }) {
  const out = [];
  for (let i = 0; i < steps; i++) {
    const top = y - i * rise;
    out.push({ x: dir > 0 ? x + i * w : x - (i + 1) * w, y: top, w, h: depth ? Math.min(depth, base - top) : base - top });
  }
  return out;
}

export function buildMap(def) {
  const { left = {}, centre = {}, spawn } = def;
  const solids = [], destructibles = [], hazards = [], platforms = [];
  const n = { c: 0, b: 0, h: 0, p: 0 };
  // ---- the left half and its mirror image ----
  for (const s of left.solids || []) solids.push({ ...s });
  for (const s of left.solids || []) solids.push(mirrorRect(s));
  for (const [x, y, hp] of left.crates || []) {
    const id = 'c' + (++n.c), b = { id, x, y, w: 32, h: 32, hp: hp || 50 };
    destructibles.push(b, { ...mirrorRect(b), id: rid(id) });
  }
  for (const [x, y] of left.barrels || []) {
    const id = 'b' + (++n.b), b = { id, kind: 'barrel', x, y, w: 24, h: 30 };
    destructibles.push(b, { ...mirrorRect(b), id: rid(id) });
  }
  for (const h of left.hazards || []) {
    const id = h.id || 'h' + (++n.h);
    if (h.type === 'saw') hazards.push({ ...h, id }, { ...h, id: rid(id), path: h.path.map((p) => ({ x: W - p.x, y: p.y })) });
    else hazards.push({ ...h, id }, { ...mirrorRect(h), id: rid(id), face: h.face === 'left' ? 'right' : h.face === 'right' ? 'left' : h.face });
  }
  for (const p of left.platforms || []) {
    const id = p.id || 'p' + (++n.p);
    platforms.push({ ...p, id }, { ...p, id: rid(id), path: p.path.map((q) => ({ x: W - q.x - p.w, y: q.y })) });
  }
  // ---- the middle line (written once) ----
  for (const s of centre.solids || []) solids.push({ ...s });
  let k = 0;
  for (const [x, y, hp] of centre.crates || []) destructibles.push({ id: 'cm' + (++k), x, y, w: 32, h: 32, hp: hp || 50 });
  k = 0;
  for (const [x, y] of centre.barrels || []) destructibles.push({ id: 'bm' + (++k), kind: 'barrel', x, y, w: 24, h: 30 });
  k = 0;
  for (const h of centre.hazards || []) hazards.push({ ...h, id: h.id || 'hm' + (++k) });
  k = 0;
  for (const p of centre.platforms || []) platforms.push({ ...p, id: p.id || 'pm' + (++k) });

  const out = {
    id: def.id, name: def.name, family: def.family, description: def.description,
    background: def.background, backgroundVariant: def.backgroundVariant || 0,
    spawns: [{ x: spawn.x, y: spawn.top - 15 }, { x: W - spawn.x, y: spawn.top - 15 }],
    solids, destructibles, platforms, hazards,
  };
  if (def.hazardStyle) out.hazardStyle = def.hazardStyle;
  if (def.tunnels) out.tunnels = def.tunnels;
  return out;
}

// ============================================================================
//  maps/mirror.js - helpers for writing a map as its LEFT HALF only: every list is mirrored around
//  x = 640 so both players get the same arena (fairness). Used by the map files next to this one.
//  Names given to the mirrored copies get an 'r' suffix before the number ('br1' -> 'brr1').
//    mirrored(solids)            static slabs                  { x, y, w, h }
//    mirroredBlocks(blocks)      destructibles (crates, barrels) { id, x, y, w, h, hp?, kind? }
//    mirroredHazards(list)       spikes / grates / saws          (spikes facing left / right swap)
//    mirroredPlatforms(list)     moving platforms                (path points are top-left corners)
//  Add the centre pieces (things that are their own mirror image) by hand.
// ============================================================================
export const W = 1280;
const rid = (id) => (/\d$/.test(id) ? String(id).replace(/(\d+)$/, 'r$1') : id + 'R');   // 'br1' -> 'brr1', 'lift' -> 'liftR'
const SWAP = { left: 'right', right: 'left' };

export const mirrorRect = (r) => ({ ...r, x: W - r.x - r.w });
export const mirrored = (list) => [...list, ...list.map(mirrorRect)];
export const mirroredBlocks = (list) => [...list, ...list.map((b) => ({ ...mirrorRect(b), id: rid(b.id) }))];
export const mirroredHazards = (list) => [...list, ...list.map((h) => {
  if (h.type === 'saw') return { ...h, id: rid(h.id), path: h.path.map((p) => ({ x: W - p.x, y: p.y })) };
  return { ...mirrorRect(h), id: rid(h.id), face: SWAP[h.face] || h.face };
})];
export const mirroredPlatforms = (list) => [...list, ...list.map((p) => ({ ...p, id: rid(p.id), path: p.path.map((q) => ({ x: W - q.x - p.w, y: q.y })) }))];

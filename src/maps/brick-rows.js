// ============================================================================
//  Map: "Brick Rows"  (floating rows)   brick rows over a pit, like a platformer's floating blocks
//  Each side has a long floor with a step block, and a row of four crates floating 150 above it (reach it from the step).
//  The two rows are joined by a plank in the middle. Shoot the crates out and the middle is an island. A slow raft drifts in the pit.
// ============================================================================
import { buildMap, slab, crateRow } from './build.js';

export default buildMap({
  id: 'brick-rows', name: 'Brick Rows', family: 'floating rows',
  description: 'Rows of crates float over the pit: run across them, or shoot them out from under someone.',
  background: 'dry-harbour', backgroundVariant: 1, hazardStyle: 'iron',
  spawn: { x: 150, top: 540 },
  left: {
    solids: [slab(60, 540, 430, 26), slab(300, 470, 90, 70)],           // the floor; a step block (70 up) beside the row
    crates: crateRow(400, 384, 4),                                      // the brick row, 156 above the floor
  },
  centre: {
    solids: [slab(560, 384, 160)],                                      // the plank the two rows meet on
    barrels: [[628, 354]],
    platforms: [{ id: 'raft', w: 140, h: 14, path: [{ x: 540, y: 620 }, { x: 600, y: 620 }], speed: 30, pause: 2.0, mode: 'pingpong' }],   // a slow raft in the pit: a fall can land on it, and it is 80 below the floors (a normal hop back)
  },
});

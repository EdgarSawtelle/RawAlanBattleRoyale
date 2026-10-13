// ============================================================================
//  Map: "Lucky Row"  (floating rows)   one long row of "question" crates in the sky
//  A low floor, three big steps up, then a row of three crates and a middle plank: a bridge in the sky that you can shoot
//  away. A slow raft drifts in the pit, so a fall in the middle is not the end.
// ============================================================================
import { buildMap, slab, stairs, crateRow } from './build.js';

export default buildMap({
  id: 'lucky-row', name: 'Lucky Row', family: 'floating rows',
  description: 'A low floor, three steps, a sky bridge of crates: shoot it and the middle plank is an island.',
  background: 'overgrown-downtown', backgroundVariant: 1, hazardStyle: 'rust',
  spawn: { x: 160, top: 600 },
  left: {
    solids: [slab(50, 600, 260, 26), ...stairs({ x: 310, y: 540, steps: 3, w: 56, rise: 70, base: 626, depth: 150 })],
    crates: crateRow(488, 330, 3),
  },
  centre: {
    solids: [slab(600, 330, 80)],
    barrels: [[628, 300]],
    platforms: [{ id: 'raft', w: 140, h: 14, path: [{ x: 540, y: 650 }, { x: 600, y: 650 }], speed: 30, pause: 2.0, mode: 'pingpong' }],   // a slow raft in the pit (50 under the floors)
  },
});

// ============================================================================
//  Map: "Drifting Boxes"  (bold shapes)   a few big boxes hanging in open air
//  Two wide floors, then boxes that climb towards a bigger box in the middle (steps of 70 / 80 / 60 up, short hops, nothing
//  overhangs anything). Plenty of open sky above; a saw patrols the pit under the middle box.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'drifting-boxes', name: 'Drifting Boxes', family: 'bold shapes',
  description: 'Big floating boxes climbing to a bigger one in the middle, open sky on all sides.',
  background: 'abandoned-suburb', backgroundVariant: 1, hazardStyle: 'brick',
  spawn: { x: 190, top: 540 },
  left: {
    solids: [slab(50, 540, 290, 26), slab(400, 470, 100, 90), slab(520, 390, 60, 90)],
    crates: crateStack(250, 476, 1, 2),
    barrels: [[430, 440]],
  },
  centre: {
    solids: [slab(590, 330, 100, 100)],
    crates: [[608, 298], [640, 298]],
    hazards: [{ type: 'saw', r: 14, path: [{ x: 470, y: 620 }, { x: 810, y: 620 }], speed: 80, pause: 0.3, mode: 'pingpong' }],
  },
});

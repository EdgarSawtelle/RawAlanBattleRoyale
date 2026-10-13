// ============================================================================
//  Map: "Crate Wall"  (bold shapes)   two long floors, and a wall of crates standing in the gap between them
//  The wall is 2 crates wide and 4 high: you can hop onto it from either floor (a 96 step), or shoot it away to open the
//  sight line (then the gap is 140: a jump). A waist-high block and a perch on each floor, a saw far below the wall.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'crate-wall', name: 'Crate Wall', family: 'bold shapes',
  description: 'A wall of crates fills the gap between two long floors; shoot it open or hop on top.',
  background: 'abandoned-suburb', backgroundVariant: 1, hazardStyle: 'brick',
  spawn: { x: 110, top: 520 },
  left: {
    solids: [slab(50, 520, 540, 30), slab(300, 450, 70, 70), slab(180, 380, 120)],   // floor; cover block (70 high); perch beside the block
    barrels: [[480, 490]],
  },
  centre: {
    crates: crateStack(608, 424, 2, 4),
    hazards: [{ type: 'saw', r: 14, path: [{ x: 540, y: 620 }, { x: 740, y: 620 }], speed: 80, pause: 0.3, mode: 'pingpong' }],
  },
});

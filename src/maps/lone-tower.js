// ============================================================================
//  Map: "Lone Tower"  (king of the hill)   one tall tower in the middle, a lift on each side up to its top
//  Spawn floors, a ledge at the foot of the tower, and a lift beside the tower on each side (3 s ride). The tower faces are
//  clean, so you can also climb them. The top is a 100-wide platform with crates: whoever holds it shoots down on the other lift.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'lone-tower', name: 'Lone Tower', family: 'king of the hill',
  description: 'One tall tower, a lift on each side, a crate-covered top to fight over.',
  background: 'waterfall-forest', backgroundVariant: 1, hazardStyle: 'thorn',
  spawn: { x: 160, top: 540 },
  left: {
    solids: [slab(60, 540, 300, 26), slab(400, 500, 110)],           // spawn floor; ledge at the foot of the lift
    crates: crateStack(290, 476, 1, 2),
    barrels: [[430, 470]],
    platforms: [{ w: 72, h: 14, path: [{ x: 512, y: 500 }, { x: 512, y: 300 }], speed: 65, pause: 1.2, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(590, 300, 100, 340)],
    crates: [[608, 268], [640, 268]],
  },
});

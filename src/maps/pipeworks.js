// ============================================================================
//  Map: "Pipeworks"  (pillars)   pipes of three heights rising towards the middle, like a platformer's warp pipes
//  A long floor on each side, then pipes 64, 96 and 128 high with a 66-wide valley between them (wide enough to walk and turn,
//  too wide to wedge in). The tallest pipe is climbed from the one before it. A plank floats over the pit between the sides.
//  A slow lift bobs in the gap between the floors (up at floor level it is a bridge, down it catches a fall).
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'pipeworks', name: 'Pipeworks', family: 'pillars',
  description: 'Pipes of three heights climb towards the middle; the valleys between are wide.',
  background: 'overgrown-downtown', backgroundVariant: 0, hazardStyle: 'rust',
  spawn: { x: 130, top: 560 },
  left: {
    solids: [slab(60, 560, 520, 26), slab(240, 496, 64, 64), slab(370, 464, 64, 96), slab(500, 432, 64, 128)],
    crates: [...crateStack(190, 496, 1, 2), [380, 432]],
    barrels: [[520, 402]],
  },
  centre: {
    solids: [slab(590, 380, 100)],
    crates: [[608, 348], [640, 348]],
    platforms: [{ id: 'gaplift', w: 80, h: 14, path: [{ x: 600, y: 640 }, { x: 600, y: 560 }], speed: 40, pause: 1.5, mode: 'pingpong' }],   // in the gap between the floors: rises to floor level, so it is also a bridge
  },
});

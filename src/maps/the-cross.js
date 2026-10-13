// ============================================================================
//  Map: "The Cross"  (bold shapes)   a plus-shaped structure floating in the middle: a tall post and two arms
//  Two stairs of two steps lead from the spawn floors to the arms (70 up each). The post stands 130 above the arms:
//  climb its clean face (hold into the wall, tap jump). A wide slow raft under the arms catches a fall. Few crates, lots of air.
// ============================================================================
import { buildMap, slab, stairs, crateStack } from './build.js';

export default buildMap({
  id: 'the-cross', name: 'The Cross', family: 'bold shapes',
  description: 'A big plus floats in the pit: stairs to the arms, a wall to climb to the top of the post.',
  background: 'abandoned-suburb', backgroundVariant: 1, hazardStyle: 'brick',
  spawn: { x: 130, top: 540 },
  left: {
    solids: [slab(50, 540, 250, 26), ...stairs({ x: 300, y: 470, steps: 2, w: 60, rise: 70, base: 540, depth: 90 }), slab(480, 330, 130)],
    crates: crateStack(200, 476, 1, 2),
    barrels: [[320, 440]],
  },
  centre: {
    solids: [slab(610, 200, 60, 300)],
    crates: [[624, 168]],
    platforms: [{ id: 'raft', w: 280, h: 14, path: [{ x: 400, y: 620 }, { x: 600, y: 620 }], speed: 40, pause: 2.0, mode: 'pingpong' }],   // a wide slow raft under the cross: it catches a fall (80 under the floors)
  },
});

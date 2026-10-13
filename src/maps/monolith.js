// ============================================================================
//  Map: "Monolith"  (bold shapes)   one huge block floating in the middle of a wide pit
//  Two wide floors, a ledge at the foot of the monolith on each side, and the monolith itself (220 high, clean faces:
//  climb it by holding into the wall and tapping jump). The top is a two-crate perch. A saw crawls in the pit.
//  Spawns cannot see each other (the monolith is in the way); the fight is about who takes the top.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'monolith', name: 'Monolith', family: 'bold shapes',
  description: 'One giant block in a wide pit: climb it, shoot over it, do not fall beside it.',
  background: 'overgrown-downtown', backgroundVariant: 1, hazardStyle: 'rust',
  spawn: { x: 200, top: 520 },
  left: {
    solids: [slab(60, 520, 340, 28), slab(470, 470, 138, 16)],       // the floor; the ledge at the foot of the monolith
    crates: crateStack(330, 456, 1, 2),                              // two-high cover near the pit edge
    barrels: [[510, 440]],
  },
  centre: {
    solids: [slab(608, 250, 64, 310)],                               // the monolith (climb it)
    crates: [[608, 218], [640, 218]],                                // cover on top
    hazards: [{ type: 'saw', r: 14, path: [{ x: 470, y: 610 }, { x: 810, y: 610 }], speed: 80, pause: 0.3, mode: 'pingpong' }],
  },
});

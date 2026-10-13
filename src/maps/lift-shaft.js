// ============================================================================
//  Map: "Lift Shaft"  (lifts)   the high deck in the middle can only be reached by the two big lifts
//  Low floors on both sides and a small low island in the middle. A lift stands between each floor and the deck: ride it up
//  (about 4 s) to a long, open deck with crates and barrels, or hop across to the low island. Shots fly freely between the levels.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'lift-shaft', name: 'Lift Shaft', family: 'lifts',
  description: 'Two big lifts are the way up to a long deck; a small island sits low in the middle.',
  background: 'waterfall-forest', backgroundVariant: 0, hazardStyle: 'thorn',
  spawn: { x: 150, top: 580 },
  left: {
    solids: [slab(50, 580, 280, 26)],                               // the floor
    crates: crateStack(230, 516, 1, 2),
    barrels: [[480, 270]],
    platforms: [{ w: 80, h: 14, path: [{ x: 332, y: 580 }, { x: 332, y: 300 }], speed: 70, pause: 1.2, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(420, 300, 440), slab(520, 580, 240, 26)],       // the long deck; the small low island
    crates: [[608, 268], [640, 268]],
  },
});

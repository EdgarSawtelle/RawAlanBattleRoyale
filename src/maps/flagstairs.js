// ============================================================================
//  Map: "Flag Stairs"  (staircase)   the end staircase of a platformer level, twice, facing each other
//  Each side: a low spawn floor and four big steps up (70 each, solid masses, so you simply run and hop). Between the two
//  staircases is a pit that is a bit too wide for one jump: use the plank in the middle (crates on it) or drop to the bobbing lift.
// ============================================================================
import { buildMap, slab, stairs } from './build.js';

export default buildMap({
  id: 'flag-stairs', name: 'Flag Stairs', family: 'staircase',
  description: 'Two big staircases face each other across a pit; a plank and a lift in the middle.',
  background: 'sunken-metro', backgroundVariant: 1, hazardStyle: 'brick',
  spawn: { x: 170, top: 560 },
  left: {
    solids: [slab(50, 560, 260, 26), ...stairs({ x: 310, y: 490, steps: 4, w: 56, rise: 70, base: 586 })],
    crates: [[326, 458]],
    barrels: [[440, 320]],
  },
  centre: {
    solids: [slab(580, 330, 120)],
    crates: [[608, 298], [640, 298]],
    platforms: [{ w: 100, h: 14, path: [{ x: 590, y: 500 }, { x: 590, y: 640 }], speed: 60, pause: 1.0, mode: 'pingpong' }],
  },
});

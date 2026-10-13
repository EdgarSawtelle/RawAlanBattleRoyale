// ============================================================================
//  Map: "Cloud Tops"  (island chain)   no big floor at all: clouds of different widths, like a mushroom level
//  Small spawn islands, then a zig-zag of clouds (50 to 80 up each, always hopping SIDEWAYS so nothing hangs over the next
//  one) to a wide cloud in the middle. A wide slow raft below the middle catches a fall. Long open lines of sight between the spawns.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'cloud-tops', name: 'Cloud Tops', family: 'island chain',
  description: 'Clouds of every width zig-zag up to a wide one in the middle; nothing hangs over anything.',
  background: 'snowbound-town', backgroundVariant: 1, hazardStyle: 'brick',
  spawn: { x: 150, top: 500 },
  left: {
    solids: [slab(60, 500, 190), slab(310, 450, 110), slab(470, 390, 70), slab(380, 310, 70), slab(250, 230, 90)],
    crates: [[482, 358]],
    barrels: [[330, 420]],
  },
  centre: {
    solids: [slab(560, 330, 160)],
    crates: [[608, 298], [640, 298]],
    platforms: [{ id: 'raft', w: 200, h: 14, path: [{ x: 480, y: 540 }, { x: 600, y: 540 }], speed: 30, pause: 2.0, mode: 'pingpong' }],   // a wide slow raft under the middle: it catches a fall, and the first hop up is 90
  },
});

// ============================================================================
//  Map: "Carousel"  (lifts / loop)   a big platform rides a rectangle around a small middle island
//  The carousel (loop path, slow) passes the spawn floors at the bottom, the middle island on both sides and the sniper
//  perches at the top. Step on at the bottom, hop off at the island or ride up to a perch. The route is only as fast as the ride.
//  A low slab beside each floor catches a fall.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'carousel', name: 'Carousel', family: 'lifts',
  description: 'One platform rides a loop around a middle island, past the floors and the high perches.',
  background: 'abandoned-suburb', backgroundVariant: 0, hazardStyle: 'brick',
  spawn: { x: 150, top: 560 },
  left: {
    solids: [slab(50, 560, 260, 26), slab(250, 230, 120), slab(330, 620, 90)],     // spawn floor; sniper perch (reach it from the carousel); a low recovery slab beside the floor
    crates: [[262, 198]],
    barrels: [[330, 200]],
  },
  centre: {
    solids: [slab(560, 400, 160)],
    crates: [[608, 368], [640, 368]],
    platforms: [{ w: 100, h: 14, path: [{ x: 430, y: 540 }, { x: 750, y: 540 }, { x: 750, y: 230 }, { x: 430, y: 230 }], speed: 110, pause: 0.6, mode: 'loop' }],
  },
});

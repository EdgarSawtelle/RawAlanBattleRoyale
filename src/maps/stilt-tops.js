// ============================================================================
//  Map: "Stilt Tops"  (mushroom platforms)   tables on thin stems, each a different width, rising towards the middle
//  Spawn on a wide table, hop to a smaller one (60 up), then to the wide one in the middle (60 up). A small cloud plank above
//  the spawn table is the sniper nest (reach it from the second table). A slow raft drifts under the middle table, to catch a fall.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'stilt-tops', name: 'Stilt Tops', family: 'mushroom platforms',
  description: 'Tables on stems of different widths climb to a wide one in the middle; a sniper plank above.',
  background: 'waterfall-forest', backgroundVariant: 1, hazardStyle: 'thorn',
  spawn: { x: 175, top: 520 },
  left: {
    solids: [slab(60, 520, 230, 24), slab(150, 544, 40, 100), slab(350, 450, 120, 24), slab(390, 474, 40, 150), slab(220, 360, 100)],
    crates: [[100, 488]],
    barrels: [[420, 420]],
  },
  centre: {
    solids: [slab(540, 360, 200, 24)],
    crates: [[608, 328], [640, 328]],
    platforms: [{ id: 'raft', w: 160, h: 14, path: [{ x: 500, y: 550 }, { x: 620, y: 550 }], speed: 30, pause: 2.0, mode: 'pingpong' }],   // a raft in the middle, 100 under the second tables
  },
});

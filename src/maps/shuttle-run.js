// ============================================================================
//  Map: "Shuttle Run"  (lifts / ferries)   two ferries carry you over a wide pit to a small island in the middle
//  Each side: a floor with a waist-high wall for cover (a crate on top). The ferry shuttles between the floor edge
//  and the island (slow, 1.5 s pause at each dock, so you can always step on). No safety net: the pit matters.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'shuttle-run', name: 'Shuttle Run', family: 'lifts',
  description: 'Ferries cross a wide pit to a middle island; a cover wall on each floor.',
  background: 'old-plaza', backgroundVariant: 0, hazardStyle: 'iron',
  spawn: { x: 110, top: 500 },
  left: {
    solids: [slab(50, 500, 230, 30), slab(200, 430, 56, 70)],
    crates: [[212, 398]],
    barrels: [[574, 470]],             // on the end of the island, next to the dock
    platforms: [{ w: 110, h: 14, path: [{ x: 290, y: 500 }, { x: 450, y: 500 }], speed: 70, pause: 1.5, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(570, 500, 140, 30)],
    crates: [[608, 468], [640, 468]],
  },
});

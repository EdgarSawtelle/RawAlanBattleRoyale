// ============================================================================
//  Map: "Waterfall Forest"  (the original VERTICAL map, re-spaced after the playtests)
//  A cliff wall rises from each spawn island (340 high, clean face: climb it by holding into the wall and tapping jump), an edge
//  lift carries you to a ledge beside it (one 70 hop to the wall top), a log bridge of crates and a plank link the wall tops,
//  a small island sits low under the bridge, and one nasty saw hangs between. Fewer crates, one hazard, nothing stacked.
// ============================================================================
import { buildMap, slab, crateStack, crateRow } from './build.js';

export default buildMap({
  id: 'waterfall-forest', name: 'Waterfall Forest', family: 'cliffs and lifts',
  description: 'Cliff walls to climb or lift up, a log bridge between the wall tops, a saw hanging below.',
  background: 'waterfall-forest', backgroundVariant: 0, hazardStyle: 'thorn',
  spawn: { x: 220, top: 570 },
  left: {
    solids: [
      slab(130, 570, 250, 28),         // spawn island
      slab(380, 230, 40, 340),         // the cliff wall (clean face)
      slab(130, 300, 180),             // ledge reached by the edge lift; 70 hop to the wall top
    ],
    crates: [...crateStack(270, 506, 1, 2), ...crateRow(420, 230, 2)],     // cover on the island; the first logs of the bridge
    barrels: [[250, 270]],
    platforms: [{ id: 'lift', w: 70, h: 14, path: [{ x: 40, y: 570 }, { x: 40, y: 300 }], speed: 70, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(540, 230, 200), slab(560, 560, 160, 20)],             // the plank of the bridge; the pit island
    hazards: [{ type: 'saw', r: 14, path: [{ x: 640, y: 340 }, { x: 640, y: 470 }], speed: 80, pause: 0.4, mode: 'pingpong' }],
  },
});

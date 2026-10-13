// ============================================================================
//  Map: "The Bowl"  (valley)   two high rims, three big steps down each side to a low floor, a plank over the middle
//  Open sight lines across the valley (the spawns are 900 apart: a flat shot falls 90 units), cover on the rims and on
//  the plank. A slow skyway shuttles over the whole bowl from rim to rim.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'the-bowl', name: 'The Bowl', family: 'bowl / valley',
  description: 'High rims, big steps down to a low floor, a skyway shuttle overhead.',
  background: 'old-plaza', backgroundVariant: 1, hazardStyle: 'iron',
  spawn: { x: 180, top: 330 },
  left: {
    solids: [slab(50, 330, 260, 50), slab(310, 400, 70, 60), slab(380, 470, 70, 60), slab(450, 540, 70, 40)],
    crates: crateStack(250, 266, 1, 2),
    barrels: [[400, 440]],
  },
  centre: {
    solids: [slab(520, 540, 240, 30), slab(540, 380, 200)],                  // the low floor; the plank over it
    barrels: [[628, 510]],
    platforms: [{ w: 110, h: 16, path: [{ x: 340, y: 240 }, { x: 830, y: 240 }], speed: 90, pause: 1.5, mode: 'pingpong' }],
  },
});

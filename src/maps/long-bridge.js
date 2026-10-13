// ============================================================================
//  Map: "Long Bridge"  (bridge)   solid ends, a causeway, and a crate bridge in the middle you can shoot away
//  Each end is a wide floor with a waist-high cover block. A solid causeway leads out over the pit, then crates (shoot them out
//  and the middle is gone for good, there is nothing to catch you), then four crates in the middle. A pair of sky ferries run
//  above the bridge (from the cover block, 60 up) and meet in the middle: the high route, and the way across once the bridge is shot.
// ============================================================================
import { buildMap, slab, crateRow } from './build.js';

export default buildMap({
  id: 'long-bridge', name: 'Long Bridge', family: 'bridge',
  description: 'Solid ends, a bridge of crates over a deep pit: shoot it out and the sides are cut apart.',
  background: 'old-plaza', backgroundVariant: 1, hazardStyle: 'iron',
  spawn: { x: 130, top: 520 },
  left: {
    solids: [slab(50, 520, 300, 30), slab(250, 440, 60, 80), slab(350, 520, 100)],   // end floor; cover block (80 high); causeway
    crates: crateRow(450, 520, 2),
    barrels: [[262, 410]],
    platforms: [{ id: 'sky', w: 110, h: 14, path: [{ x: 320, y: 380 }, { x: 520, y: 380 }], speed: 70, pause: 1.5, mode: 'pingpong' }],   // a sky ferry over the bridge: step on from the cover block, meet the other one in the middle
  },
  centre: {
    crates: crateRow(576, 520, 4),
  },
});

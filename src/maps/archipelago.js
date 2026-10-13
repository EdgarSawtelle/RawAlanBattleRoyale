// ============================================================================
//  Map: "Archipelago"  (island chain)   islands in a wave: a low chain along the bottom, a high chain above it
//  Every hop is 50 to 90 up and sideways, nothing hangs over the next island. The high chain ends on a wide plank in the middle.
//  A slow drifting platform under the low chain catches a fall. Crates on the islands, one barrel.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'archipelago', name: 'Archipelago', family: 'island chain',
  description: 'A low chain and a high chain of islands in a wave; a drifting platform catches the fallen.',
  background: 'waterfall-forest', backgroundVariant: 1, hazardStyle: 'thorn',
  spawn: { x: 150, top: 520 },
  left: {
    solids: [slab(50, 520, 220), slab(330, 470, 120), slab(520, 420, 100), slab(220, 380, 90), slab(330, 290, 90)],
    crates: [[350, 438], [240, 348]],
    barrels: [[540, 390]],
    platforms: [{ w: 90, h: 14, path: [{ x: 360, y: 620 }, { x: 540, y: 620 }], speed: 50, pause: 0.8, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(560, 280, 160)],
    crates: [[608, 248], [640, 248]],
  },
});

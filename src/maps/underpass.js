// ============================================================================
//  Map: "Underpass"  (low tunnels, open sky)   one long floor, a roof deck over the middle, a crawl-space tunnel below it
//  Fight on the open floor, crawl through the 96-high tunnel (declared with `tunnels`) or take the lift beside the tunnel mouth
//  up to the roof deck: the sky above the roof is free. The shaft beside each lift is a 70-wide gap while the lift is up.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'underpass', name: 'Underpass', family: 'low tunnels',
  description: 'A long floor with a crawl-space tunnel under a roof deck; lifts at the tunnel mouths.',
  background: 'old-plaza', backgroundVariant: 0, hazardStyle: 'iron',
  spawn: { x: 160, top: 540 },
  tunnels: [{ x0: 430, x1: 850 }],
  left: {
    solids: [slab(50, 540, 296, 26)],                                // the open floor
    crates: [[250, 508]],
    barrels: [[300, 510]],
    platforms: [{ w: 70, h: 14, path: [{ x: 348, y: 540 }, { x: 348, y: 430 }], speed: 55, pause: 1.2, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(420, 540, 440, 26), slab(430, 430, 420, 24)],      // the tunnel floor; the roof deck (96 over it)
    crates: [[608, 398], [640, 398]],
  },
});

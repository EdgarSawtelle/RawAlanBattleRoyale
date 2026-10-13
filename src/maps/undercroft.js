// ============================================================================
//  Map: "Undercroft"  (low tunnels, open sky)   a long low tunnel under each spawn roof, a small island in the middle
//  Spawn on a wide, open roof (sky above, nothing to bump). Underneath is a low tunnel: 90 high, a deliberate crawl-space
//  (declared with `tunnels`), entered from the outer lift or from the island. A barrel sits in each tunnel.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'undercroft', name: 'Undercroft', family: 'low tunnels',
  description: 'Open roofs with a low tunnel beneath each; a small island in the middle and a lift at each edge.',
  background: 'highway-interchange', backgroundVariant: 1, hazardStyle: 'rust',
  spawn: { x: 220, top: 450 },
  tunnels: [{ x0: 120, x1: 520 }, { x0: 760, x1: 1160 }],
  left: {
    solids: [slab(120, 450, 400, 20), slab(120, 560, 400, 26)],      // the roof (spawn on top); the tunnel floor (90 under the roof)
    crates: [[330, 418]],
    barrels: [[300, 530]],
    platforms: [{ w: 70, h: 14, path: [{ x: 40, y: 560 }, { x: 40, y: 450 }], speed: 60, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(570, 520, 140, 26)],
    crates: [[608, 488], [640, 488]],
  },
});

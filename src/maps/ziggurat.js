// ============================================================================
//  Map: "Ziggurat"  (staircase / pyramid)   a stepped pyramid hangs over the pit between two spawn floors
//  Three solid steps up each side to a small peak (no overhangs: each step is one solid mass, so you just hop up).
//  A sniper perch sits above each spawn floor; an edge lift carries you up to it. Few crates, no hazards.
// ============================================================================
import { buildMap, slab, stairs } from './build.js';

export default buildMap({
  id: 'ziggurat', name: 'Ziggurat', family: 'staircase',
  description: 'A stepped pyramid over the pit, a lift and a sniper perch on each outer side.',
  background: 'snowbound-town', backgroundVariant: 0, hazardStyle: 'rust',
  spawn: { x: 240, top: 540 },
  left: {
    solids: [
      slab(140, 540, 200, 26),                                                // spawn floor
      slab(140, 300, 130),                                                    // sniper perch (up by the edge lift)
      ...stairs({ x: 430, y: 500, steps: 3, w: 56, rise: 80, base: 560, depth: 130 }),    // steps of the pyramid, tops 500 / 420 / 340
    ],
    crates: [[432, 468]],
    barrels: [[500, 390]],
    platforms: [{ w: 80, h: 14, path: [{ x: 40, y: 540 }, { x: 40, y: 300 }], speed: 70, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(598, 260, 84, 200)],                                        // the peak
    crates: [[608, 228], [640, 228]],
  },
});

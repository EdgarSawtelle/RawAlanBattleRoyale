// ============================================================================
//  Map: "The Peak"  (staircase / mountain)   a big mountain in the middle, five steps up each side
//  A grounded, wide mountain: the whole middle is solid, so nobody sees the other spawn. The apex is a narrow tower, one
//  crate high. Edge lifts take you to a perch above each spawn floor for an arcing shot over the slope.
// ============================================================================
import { buildMap, slab, stairs } from './build.js';

export default buildMap({
  id: 'the-peak', name: 'The Peak', family: 'staircase',
  description: 'A five-step mountain with a narrow apex; edge lifts lead to sniper perches.',
  background: 'snowbound-town', backgroundVariant: 0, hazardStyle: 'thorn',
  spawn: { x: 225, top: 590 },
  left: {
    solids: [slab(130, 590, 190, 26), slab(130, 330, 110), ...stairs({ x: 320, y: 520, steps: 5, w: 58, rise: 68, base: 640, depth: 190 })],
    crates: [[336, 488]],
    barrels: [[450, 354]],
    platforms: [{ w: 70, h: 14, path: [{ x: 40, y: 590 }, { x: 40, y: 330 }], speed: 80, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(610, 180, 60, 280)],
    crates: [[624, 148]],
  },
});

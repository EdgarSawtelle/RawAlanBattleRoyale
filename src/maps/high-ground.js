// ============================================================================
//  Map: "High Ground"  (asymmetric heights)   each player's spawn is a high cliff; the fight is on the low floor between
//  A cliff on each side (240 above the floor), a lift in the notch beside it, and a wide low floor with a waist-high block in
//  the middle. Shoot down from the cliff, or ride down and fight on the floor; going back up takes the lift.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'high-ground', name: 'High Ground', family: 'asymmetric heights',
  description: 'Spawn on a high cliff, fight on the low floor, ride the lift back up.',
  background: 'overgrown-downtown', backgroundVariant: 1, hazardStyle: 'rust',
  spawn: { x: 140, top: 320 },
  left: {
    solids: [slab(50, 320, 230, 60)],
    crates: [[200, 288], ...crateStack(450, 496, 1, 2)],
    barrels: [[520, 530]],
    platforms: [{ w: 70, h: 14, path: [{ x: 290, y: 560 }, { x: 290, y: 320 }], speed: 75, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(370, 560, 540, 26), slab(600, 480, 80, 80)],
    crates: [[624, 448]],
  },
});

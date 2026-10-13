// ============================================================================
//  Map: "Old Plaza"  (the original WIDE map, re-spaced after the playtests)
//  Two long plaza floors with a tram that crosses the gap in the middle (it is short: step on at one dock, step off at the
//  other) and a saw lane deep under it. On each side a low cover wall with crates doubles as the step up to a balcony over the
//  spawn (a sniper nest with a long, arcing view across the plaza: a shot drops 40 units over 600). Barrels in the yard.
//  Few crates, one hazard, nothing hangs low: the balcony is 140 above the floor.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'old-plaza', name: 'Old Plaza', family: 'wide floors and a tram',
  description: 'Long floors and balconies, a short tram over the middle gap, a saw lane below.',
  background: 'old-plaza', backgroundVariant: 0, hazardStyle: 'iron',
  spawn: { x: 160, top: 480 },
  left: {
    solids: [
      slab(40, 480, 480, 30),          // plaza floor (spawn)
      slab(270, 420, 70, 60),          // cover wall, and the first step (60 up)
      slab(70, 340, 200),              // balcony over the spawn (80 above the wall, 140 above the floor)
    ],
    crates: [[290, 388], ...crateStack(410, 416, 1, 2)],
    barrels: [[480, 450]],
  },
  centre: {
    hazards: [{ type: 'saw', r: 14, path: [{ x: 540, y: 610 }, { x: 740, y: 610 }], speed: 90, pause: 0.3, mode: 'pingpong' }],
    platforms: [{ id: 'tram', w: 112, h: 16, path: [{ x: 528, y: 480 }, { x: 640, y: 480 }], speed: 60, pause: 1.5, mode: 'pingpong' }],
  },
});

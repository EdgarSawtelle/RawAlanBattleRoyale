// ============================================================================
//  Map: "Overgrown Downtown"  (the original map, re-spaced after the playtests)
//  Two wide islands joined by a tram, a crate bridge into a central platform with crates, a perch and a high perch on each side
//  (the outer lift takes you to the perch), a saw under the centre. Same ideas as before, but with real room: every standing
//  surface has 120+ units of air above it, the steps are offset sideways instead of stacked, and there are far fewer crates
//  and hazards (just the one saw).
//  The format is documented in docs/ADDING-CONTENT.md; this file uses the small builder in build.js (left half written, mirrored).
// ============================================================================
import { buildMap, slab, crateRow } from './build.js';

export default buildMap({
  id: 'ruined-city', name: 'Overgrown Downtown', family: 'islands and lifts',
  description: 'Two wide islands with a tram between them, a crate bridge to the centre, two perches, a saw below.',
  background: 'overgrown-downtown', backgroundVariant: 0,
  spawn: { x: 220, top: 484 },
  left: {
    solids: [
      slab(100, 484, 340, 32),         // island (spawn)
      slab(380, 414, 60, 70),          // step block at the island's end (70 up): cover, and the way to the centre
      slab(110, 340, 120),             // perch above the island (the edge lift ends here)
      slab(280, 250, 100),             // high perch (90 up from the perch)
    ],
    crates: crateRow(456, 330, 2),     // the crate bridge: shoot it out and the step to the centre platform is 80 higher and 80 away
    barrels: [[540, 300]],             // on the centre platform
    platforms: [{ id: 'lift', w: 56, h: 14, path: [{ x: 36, y: 484 }, { x: 36, y: 340 }], speed: 60, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(520, 330, 240, 20)],                                  // the centre platform
    crates: [[608, 298], [640, 298]],
    hazards: [{ type: 'saw', r: 14, path: [{ x: 560, y: 400 }, { x: 720, y: 400 }], speed: 90, pause: 0.3, mode: 'pingpong' }],
    platforms: [{ id: 'tram', w: 112, h: 16, path: [{ x: 448, y: 484 }, { x: 720, y: 484 }], speed: 80, pause: 1.0, mode: 'pingpong' }],
  },
});

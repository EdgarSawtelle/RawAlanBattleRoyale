// ============================================================================
//  Map: "Abandoned Suburb"  (the original SMALL-ISLANDS map, re-spaced after the playtests)
//  No big floor: small spawn islands over a big pit, a short chain of little platforms (always hopping sideways and 50 to 90 up,
//  so nothing hangs over the next one), a crate bridge to a central island (shoot it out: the gap is still a jump, but you lose
//  the cover), a low recovery slab, and an edge lift to a perch with rebar on its outer half. One saw hangs deep in the middle.
//  Falling is the main danger: knockback and the pit decide fights here.
// ============================================================================
import { buildMap, slab, crateRow } from './build.js';

export default buildMap({
  id: 'abandoned-suburb', name: 'Abandoned Suburb', family: 'small islands',
  description: 'Small islands over a big pit: a short chain, a crate bridge to the middle, an edge lift to a perch.',
  background: 'abandoned-suburb', backgroundVariant: 0, hazardStyle: 'brick',
  spawn: { x: 190, top: 500 },
  left: {
    solids: [
      slab(106, 500, 180),             // spawn island
      slab(340, 450, 90),              // I1
      slab(450, 400, 80),              // I2 (the crate bridge starts here)
      slab(230, 360, 80),              // I3  (90 up from I1, over the spawn island with 124 of air)
      slab(110, 270, 90),              // I4  perch (the edge lift ends here)
      slab(400, 600, 100),             // low recovery slab
    ],
    crates: [[140, 468], ...crateRow(536, 400, 2)],
    barrels: [[370, 420]],
    hazards: [{ type: 'spikes', x: 148, y: 250, w: 48, h: 20, face: 'up' }],      // rebar on the outer half of the perch
    platforms: [{ id: 'lift', w: 56, h: 14, path: [{ x: 40, y: 500 }, { x: 40, y: 270 }], speed: 60, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(606, 400, 68)],
    crates: [[608, 368], [640, 368]],
    hazards: [{ type: 'saw', r: 14, path: [{ x: 640, y: 490 }, { x: 640, y: 620 }], speed: 70, pause: 0.4, mode: 'pingpong' }],
  },
});

// ============================================================================
//  Map: "Waterfall Forest"  (background: waterfall-forest)   a VERTICAL map
//  Two tall cliff walls rise from the spawn islands; the outer side of each wall is a staircase of ledges,
//  the inner sides face a log bridge (destructible crates) that links the wall tops. A lift at each open
//  edge, one nasty saw hanging in the middle under the bridge. Few hazards, but they hurt.
//  The wall face is clean (nothing overhangs it), so it can be CLIMBED: hold into the wall and tap jump,
//  about 68 units per hop. Only the left half is written; src/maps/mirror.js mirrors it.
//    spawn island -> stairs S1..S4 (single jumps) -> wall top -> bridge          (no wall climbing needed)
//    spawn island -> climb the wall (330 high) -> bridge                         (shortcut, wall-climb)
//    ledges N1 / N2 on the inner side hang off the wall: reachable from the bridge / the pit island
// ============================================================================
import { mirrored, mirroredBlocks, mirroredHazards, mirroredPlatforms } from './mirror.js';

const solids = [
  ...mirrored([
    { x: 60, y: 560, w: 312, h: 28 },    // spawn island
    { x: 372, y: 230, w: 36, h: 330 },   // the cliff wall (clean face: climbable)
    { x: 70, y: 468, w: 110, h: 16 },    // S1  stairs on the outer side
    { x: 206, y: 378, w: 100, h: 16 },   // S2
    { x: 76, y: 290, w: 100, h: 16 },    // S3  (thorns on its outer half)
    { x: 206, y: 204, w: 100, h: 16 },   // S4  top of the stairs, next to the wall top
    { x: 420, y: 355, w: 90, h: 16 },    // N1  inner ledge hanging off the wall
    { x: 430, y: 450, w: 80, h: 16 },    // N2
  ]),
  { x: 560, y: 520, w: 160, h: 20 },     // C0  pit island under the bridge
  { x: 590, y: 640, w: 100, h: 16 },     // pit slab (recovery)
];
const bridge = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ id: 'lg' + (i + 1), x: 416 + 32 * i, y: 230, w: 32, h: 32, hp: 50 }));   // log bridge: shoot it out from under someone
const crates = [
  { id: 'cr1', x: 250, y: 528, w: 32, h: 32, hp: 50 }, { id: 'cr2', x: 250, y: 496, w: 32, h: 32, hp: 50 },    // cover on the spawn island
  { id: 'cr3', x: 140, y: 258, w: 32, h: 32, hp: 50 },   // on S3 (inner half, away from the thorns)
];
const barrels = [
  { id: 'ba1', kind: 'barrel', x: 270, y: 348, w: 24, h: 30 },    // on S2
  { id: 'ba2', kind: 'barrel', x: 476, y: 420, w: 24, h: 30 },    // on N2
];
const destructibles = [...mirroredBlocks(bridge), ...mirroredBlocks(crates), ...mirroredBlocks(barrels)];
const hazards = [
  ...mirroredHazards([{ id: 'sp1', type: 'spikes', x: 76, y: 270, w: 60, h: 20, face: 'up' }]),      // thorns on the outer half of S3
  { id: 'saw1', type: 'saw', r: 14, path: [{ x: 640, y: 320 }, { x: 640, y: 480 }], speed: 80, pause: 0.4, mode: 'pingpong' },   // under the bridge, over the pit island
];
const platforms = mirroredPlatforms([
  { id: 'lift', w: 56, h: 14, path: [{ x: 4, y: 556 }, { x: 4, y: 200 }], speed: 70, pause: 1.0, mode: 'pingpong' },    // the edge lift: island level up to the top ledge
]);

export default {
  id: 'waterfall-forest',
  name: 'Waterfall Forest',
  background: 'waterfall-forest',
  backgroundVariant: 0,                   // 0 morning mist, 1 dusk
  hazardStyle: 'thorn',
  spawns: [{ x: 170, y: 545 }, { x: 1110, y: 545 }],
  solids, destructibles, platforms, hazards,
};

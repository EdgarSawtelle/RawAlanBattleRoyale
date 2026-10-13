// ============================================================================
//  Map: "Abandoned Suburb"  (background: abandoned-suburb)   SMALL ISLANDS over a big pit
//  No big floor: the spawn islands are small, everything else is a little platform. Crate bridges join the
//  centre island (shoot them out and it is cut off), a lift at each open edge carries you up, ember grates
//  are risky stepping stones and a saw hangs in the jump path. Falling is the main danger: knockback and
//  the pit decide fights here. Left half written, mirrored by src/maps/mirror.js.
//    spawn -> I1 -> I2 -> bridge -> centre island C -> UC ;  I2 -> I3 -> I4 -> I5 -> I6 ;  I3 -> grate G1 -> UC
//    spawn -> edge lift -> I5 ;  low recovery slab LP -> grate G2
// ============================================================================
import { mirrored, mirroredBlocks, mirroredHazards, mirroredPlatforms } from './mirror.js';

const solids = [
  ...mirrored([
    { x: 110, y: 500, w: 160, h: 24 },   // spawn island
    { x: 300, y: 452, w: 72, h: 16 },    // I1
    { x: 410, y: 404, w: 72, h: 16 },    // I2
    { x: 300, y: 352, w: 72, h: 16 },    // I3
    { x: 180, y: 318, w: 80, h: 16 },    // I4  (rebar on it)
    { x: 60, y: 250, w: 80, h: 16 },     // I5
    { x: 190, y: 178, w: 80, h: 16 },    // I6
    { x: 440, y: 560, w: 60, h: 14 },    // LP  low recovery slab over the pit
  ]),
  { x: 560, y: 404, w: 160, h: 18 },     // C   centre island
  { x: 590, y: 312, w: 100, h: 16 },     // UC  above the centre
  { x: 590, y: 610, w: 100, h: 14 },     // pit slab
];
const crates = [
  { id: 'br1', x: 490, y: 404, w: 32, h: 32, hp: 50 }, { id: 'br2', x: 522, y: 404, w: 32, h: 32, hp: 50 },    // the bridge to the centre island (shoot it out)
  { id: 'cr1', x: 238, y: 468, w: 32, h: 32, hp: 50 },       // cover on the spawn island
  { id: 'cr2', x: 100, y: 218, w: 32, h: 32, hp: 50 },       // on I5
];
const centre = [
  { id: 'c1', x: 592, y: 372, w: 32, h: 32, hp: 50 }, { id: 'c2', x: 624, y: 372, w: 32, h: 32, hp: 50 }, { id: 'c3', x: 656, y: 372, w: 32, h: 32, hp: 50 },   // crates on the centre island
];
const barrels = [{ id: 'ba1', kind: 'barrel', x: 330, y: 422, w: 24, h: 30 }];       // on I1
const destructibles = [...mirroredBlocks(crates), ...centre, ...mirroredBlocks(barrels)];
const hazards = mirroredHazards([
  { id: 'sp1', type: 'spikes', x: 186, y: 298, w: 48, h: 20, face: 'up' },       // rebar on I4
  { id: 'gr1', type: 'grate', x: 480, y: 300, w: 64, h: 12, solid: true },       // risky stepping stone between I3 and UC
  { id: 'gr2', type: 'grate', x: 455, y: 506, w: 70, h: 12, solid: true },       // low grate over the pit (recovery, but it burns)
  { id: 'saw1', type: 'saw', r: 14, path: [{ x: 430, y: 236 }, { x: 430, y: 330 }], speed: 70, pause: 0.4, mode: 'pingpong' },   // hangs in the jump from I3 to the grate
]);
const platforms = mirroredPlatforms([
  { id: 'lift', w: 56, h: 14, path: [{ x: 0, y: 496 }, { x: 0, y: 296 }], speed: 60, pause: 1.0, mode: 'pingpong' },   // edge lift from the spawn level up to I5
]);

export default {
  id: 'abandoned-suburb',
  name: 'Abandoned Suburb',
  background: 'abandoned-suburb',
  backgroundVariant: 0,                   // 0 late afternoon, 1 misty morning
  hazardStyle: 'brick',
  spawns: [{ x: 190, y: 485 }, { x: 1090, y: 485 }],
  solids, destructibles, platforms, hazards,
};

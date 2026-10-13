// ============================================================================
//  Map: "Old Plaza"  (background: old-plaza)   a WIDE, HORIZONTAL map
//  Two long plaza floors with low crate cover and a gap in the middle that a tram crosses; balconies and a
//  sniper perch on each side give long, arcing sight lines (a shot drops 40 units over 600). A saw patrols
//  the pit under the tram, ember grates are the high route, barrels sit by the cover.
//  Left half written, mirrored by src/maps/mirror.js.
//    floor -> step crate -> M1 -> centre platform ; floor -> B1 -> B2 -> B3 ; B2 -> grate -> centre platform
//    (single jumps only; no wall climbing)
// ============================================================================
import { mirrored, mirroredBlocks, mirroredHazards } from './mirror.js';

const solids = [
  ...mirrored([
    { x: 40, y: 480, w: 480, h: 30 },    // plaza floor (spawn)
    { x: 60, y: 390, w: 140, h: 16 },    // B1 balcony
    { x: 270, y: 312, w: 150, h: 16 },   // B2 balcony
    { x: 110, y: 228, w: 130, h: 16 },   // B3 sniper perch
    { x: 470, y: 372, w: 110, h: 16 },   // M1 plinth
    { x: 520, y: 610, w: 100, h: 16 },   // pit slabs (recovery)
  ]),
  { x: 590, y: 300, w: 100, h: 16 },     // centre platform
];
const crates = [
  { id: 'cv1', x: 300, y: 448, w: 32, h: 32, hp: 50 }, { id: 'cv2', x: 332, y: 448, w: 32, h: 32, hp: 50 }, { id: 'cv3', x: 316, y: 416, w: 32, h: 32, hp: 50 },   // low cover pyramid
  { id: 'cv4', x: 200, y: 448, w: 32, h: 32, hp: 50 },       // single cover crate
  { id: 'st1', x: 448, y: 448, w: 32, h: 32, hp: 50 },       // step crate to the plinth
  { id: 'cv5', x: 120, y: 358, w: 32, h: 32, hp: 50 },       // on B1
];
const barrels = [
  { id: 'ba1', kind: 'barrel', x: 400, y: 450, w: 24, h: 30 },   // beside the cover
  { id: 'ba2', kind: 'barrel', x: 380, y: 282, w: 24, h: 30 },   // on B2
];
const destructibles = [...mirroredBlocks(crates), ...mirroredBlocks(barrels)];
const hazards = [
  ...mirroredHazards([
    { id: 'sp1', type: 'spikes', x: 300, y: 328, w: 72, h: 20, face: 'down' },    // iron spikes hanging under B2
    { id: 'sp2', type: 'spikes', x: 110, y: 208, w: 60, h: 20, face: 'up' },      // on the sniper perch
    { id: 'gr1', type: 'grate', x: 440, y: 250, w: 70, h: 12, solid: true },      // ember grate: the high route to the centre
  ]),
  { id: 'saw1', type: 'saw', r: 14, path: [{ x: 545, y: 556 }, { x: 735, y: 556 }], speed: 100, pause: 0.3, mode: 'pingpong' },   // the saw lane under the tram
];
const platforms = [
  { id: 'tram', w: 112, h: 16, path: [{ x: 524, y: 480 }, { x: 644, y: 480 }], speed: 90, pause: 1.2, mode: 'pingpong' },
];

export default {
  id: 'old-plaza',
  name: 'Old Plaza',
  background: 'old-plaza',
  backgroundVariant: 0,                   // 0 golden afternoon, 1 foggy dawn
  hazardStyle: 'iron',
  spawns: [{ x: 130, y: 465 }, { x: 1150, y: 465 }],
  solids, destructibles, platforms, hazards,
};

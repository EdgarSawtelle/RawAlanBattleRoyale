// ============================================================================
//  Map: "Overgrown Downtown"
//  Logical field 1280 x 720, y grows downward. The arena is OPEN: nothing surrounds the
//  screen. Players who fall off the bottom or leave through the sides get hurt and thrown back.
//
//  Map data format (all coordinates are the top-left corner of a rectangle):
//    id, name, background   background = id of a painted backdrop (see client/background.js)
//    spawns[2]              where the two players start (x, y = body CENTRE)
//    solids[]               static solid platforms        { x, y, w, h }
//    destructibles[]        blocks with HP               { id, x, y, w, h, hp }  (crates, 50 HP by default)
//                           kind: 'barrel' makes an explosive drum (blows up when destroyed)
//    platforms[]            moving solid platforms       { id, w, h, path:[{x,y},..], speed, pause, mode }
//                           mode: 'pingpong' | 'loop'; speed in units/s; pause in s at every path point
//                           (its position is a pure function of the round tick, see sim/platforms.js)
//    hazards[]              things that hurt on contact (see sim/hazards.js, numbers in config.js):
//                             { id, type:'spikes', x, y, w, h, face }      rebar spikes, a damage zone
//                             { id, type:'grate', x, y, w, h, solid:true } ember grate, a solid platform that burns
//                             { id, type:'saw', r, path, speed, pause, mode } saw blade (path = blade centre)
//
//  Player is 30 x 30, a jump rises ~115 units, a flat jump crosses ~190. Layout rules used here:
//    * every platform is reachable from the spawn islands with single jumps (vertical steps <= 95,
//      horizontal gaps <= 150), a lift, or a short wall-jump
//    * hazards sit beside the routes, never on the spawn islands or the main walking lines
//    * the map is a mirror image around x = 640 (the left half is written out, the right half is derived)
// ============================================================================
const W = 1280;
const mx = (r) => W - r.x - r.w;                 // mirrored left edge of a rect
const flip = (r, id) => ({ ...r, id, x: mx(r) });

// ---- left half (everything here is mirrored to the right half below) ----
const leftSolids = [
  { x: 60, y: 480, w: 380, h: 32 },     // island (spawn)
  { x: 330, y: 416, w: 40, h: 64 },     // pillar: cover + wall-jump, one jump gets onto it
  { x: 80, y: 392, w: 100, h: 18 },     // ledge above the island (up the outer lift or from the island)
  { x: 250, y: 330, w: 90, h: 18 },     // step 1
  { x: 100, y: 268, w: 100, h: 18 },    // perch (rusty spikes on its outer half)
  { x: 210, y: 190, w: 90, h: 18 },     // high perch
  { x: 370, y: 236, w: 90, h: 18 },     // high step above the crate bridge
  { x: 470, y: 570, w: 80, h: 18 },     // pit slab (recovery, reachable back up to the island)
];
const leftCrates = [
  { id: 'wa1', x: 256, y: 448, w: 32, h: 32 },   // 2-high crate wall on the island
  { id: 'wa2', x: 256, y: 416, w: 32, h: 32 },
  { id: 'br1', x: 380, y: 330, w: 32, h: 32 },   // crate BRIDGE (shoot it out from under someone)
  { id: 'br2', x: 412, y: 330, w: 32, h: 32 },
  { id: 'br3', x: 444, y: 330, w: 32, h: 32 },
  { id: 'br4', x: 476, y: 330, w: 32, h: 32 },
];
const leftBarrels = [
  { id: 'ba1', kind: 'barrel', x: 84, y: 362, w: 24, h: 30 },    // on the ledge
  { id: 'ba2', kind: 'barrel', x: 528, y: 300, w: 24, h: 30 },   // on the centre platform, next to the crates
];
const leftHazards = [
  { id: 'sp1', type: 'spikes', x: 100, y: 248, w: 60, h: 20, face: 'up' },     // rebar on the perch's outer half
  { id: 'sp2', type: 'spikes', x: 526, y: 350, w: 60, h: 20, face: 'down' },    // ceiling spikes under the centre platform
  { id: 'gr1', type: 'grate', x: 500, y: 236, w: 70, h: 12, solid: true },     // ember grate stepping stone on the high route
];

const solids = [
  ...leftSolids,
  ...leftSolids.map((r) => ({ ...r, x: mx(r) })),
  { x: 520, y: 330, w: 240, h: 20 },    // centre platform
  { x: 600, y: 236, w: 80, h: 18 },     // centre perch above the crates
  { x: 590, y: 560, w: 100, h: 18 },    // centre pit slab
];
const destructibles = [
  ...leftCrates.map((c) => ({ ...c, hp: 50 })),
  ...leftCrates.map((c) => ({ ...flip(c, c.id.replace(/\d$/, (d) => 'r' + d)), hp: 50 })),
  { id: 'c1', x: 576, y: 298, w: 32, h: 32, hp: 50 },   // crates on the centre platform (centred on x = 640)
  { id: 'c2', x: 608, y: 298, w: 32, h: 32, hp: 50 },
  { id: 'c3', x: 640, y: 298, w: 32, h: 32, hp: 50 },
  { id: 'c4', x: 672, y: 298, w: 32, h: 32, hp: 50 },
  ...leftBarrels,
  ...leftBarrels.map((b) => flip(b, b.id.replace(/\d$/, (d) => 'r' + d))),
];
const hazards = [
  ...leftHazards,
  ...leftHazards.map((h) => flip(h, h.id.replace(/\d$/, (d) => 'r' + d))),
  // a saw patrolling under the centre platform (between the platform and the tram)
  { id: 'saw1', type: 'saw', r: 14, path: [{ x: 585, y: 402 }, { x: 695, y: 402 }], speed: 90, pause: 0.3, mode: 'pingpong' },
];
const platforms = [
  // The tram shuttles between the islands and docks 8 units from each edge (its top is level with the islands).
  { id: 'm1', w: 112, h: 16, path: [{ x: 448, y: 480 }, { x: 720, y: 480 }], speed: 80, pause: 1.0, mode: 'pingpong' },
  // Outer lifts at the screen sides carry players up to the ledge level and above.
  { id: 'lift1', w: 56, h: 14, path: [{ x: 0, y: 470 }, { x: 0, y: 300 }], speed: 60, pause: 1.0, mode: 'pingpong' },
  { id: 'lift2', w: 56, h: 14, path: [{ x: 1224, y: 470 }, { x: 1224, y: 300 }], speed: 60, pause: 1.0, mode: 'pingpong' },
];

export default {
  id: 'ruined-city',
  name: 'Overgrown Downtown',
  background: 'overgrown-downtown',     // animated backdrop id (client/backgrounds/registry.js)
  backgroundVariant: 0,                  // optional look: 0 golden hour, 1 overcast after rain
  spawns: [
    { x: 215, y: 465 },   // standing on the left island (top at y=480, body half-height 15)
    { x: 1065, y: 465 },  // standing on the right island
  ],
  solids,
  destructibles,
  platforms,
  hazards,
};

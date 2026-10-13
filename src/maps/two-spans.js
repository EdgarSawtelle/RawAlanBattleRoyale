// ============================================================================
//  Map: "Two Spans"  (bridge, two levels)   a high span of crates and planks, a low span of planks underneath
//  Spawn on a tall tower. The high span starts with a short crate bridge, then a long deck in the middle. Next to each tower a
//  lift joins the high span to the low one (it also bridges the little gap beside the tower while it is down). The low span
//  is two ledges and a plank. Shoot the crates and the high span breaks into three.
// ============================================================================
import { buildMap, slab, crateRow } from './build.js';

export default buildMap({
  id: 'two-spans', name: 'Two Spans', family: 'bridge',
  description: 'A high span and a low span, tower lifts between them, crates you can shoot out of the high one.',
  background: 'abandoned-suburb', backgroundVariant: 1, hazardStyle: 'brick',
  spawn: { x: 150, top: 340 },
  left: {
    solids: [slab(50, 340, 200, 130), slab(340, 560, 110)],          // the tower (spawn on top); the low ledge
    crates: crateRow(340, 340, 3),
    platforms: [{ w: 72, h: 14, path: [{ x: 262, y: 560 }, { x: 262, y: 340 }], speed: 70, pause: 1.2, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(520, 340, 240), slab(540, 560, 200)],              // the long deck; the low plank
    barrels: [[628, 310]],
  },
});

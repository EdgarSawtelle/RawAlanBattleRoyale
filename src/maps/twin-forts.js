// ============================================================================
//  Map: "Twin Forts"  (two fortresses)   a fort on each side, a small no-man's-land island in the middle
//  Each fort: a long yard, a front wall (100 high, hop up it) and a roof (60 above the wall top) over the spawn with 144 of
//  air under it. A crate stack and a barrel in the yard; crates on the middle island. A saw sits in the pit below it.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'twin-forts', name: 'Twin Forts', family: 'fortress',
  description: 'Two forts with a front wall and a roof, a small island between them, a saw in the pit.',
  background: 'overgrown-downtown', backgroundVariant: 0, hazardStyle: 'rust',
  spawn: { x: 180, top: 540 },
  left: {
    solids: [slab(50, 540, 470, 26), slab(300, 440, 60, 100), slab(90, 380, 210)],     // yard; front wall; roof over the spawn
    crates: crateStack(440, 476, 1, 2),
    barrels: [[400, 510]],
  },
  centre: {
    solids: [slab(580, 540, 120, 26)],
    crates: [[608, 508], [640, 508]],
    hazards: [{ type: 'saw', r: 14, path: [{ x: 540, y: 650 }, { x: 740, y: 650 }], speed: 80, pause: 0.3, mode: 'pingpong' }],
  },
});

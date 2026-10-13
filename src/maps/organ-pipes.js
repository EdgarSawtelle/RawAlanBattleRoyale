// ============================================================================
//  Map: "Organ Pipes"  (pillars)   a long low floor with tall pillars on it, each a little higher than the last, 76 apart
//  The floor runs nearly the whole width: pillars (64 wide, 70 / 60 / 60 higher each) climb to a middle pillar, the valleys
//  between them are wide enough to walk and turn. Hop from top to top, or climb the faces. A lift at each outer edge carries you
//  up to a perch over the spawn. Crates and barrels sit on the pillar tops, so the high ground is where the fight is.
// ============================================================================
import { buildMap, slab } from './build.js';

export default buildMap({
  id: 'organ-pipes', name: 'Organ Pipes', family: 'pillars',
  description: 'Pillars of rising height on a long floor; hop top to top or climb the faces.',
  background: 'highway-interchange', backgroundVariant: 0, hazardStyle: 'iron',
  spawn: { x: 215, top: 600 },
  left: {
    solids: [slab(326, 530, 64, 70), slab(466, 470, 64, 130), slab(120, 330, 110)],   // pillars 70 / 130 high (tops 530 / 470), the perch
    crates: [[340, 498]],
    barrels: [[480, 440]],
    platforms: [{ w: 70, h: 14, path: [{ x: 40, y: 600 }, { x: 40, y: 330 }], speed: 75, pause: 1.0, mode: 'pingpong' }],
  },
  centre: {
    solids: [slab(130, 600, 1020, 28), slab(608, 410, 64, 190)],        // the floor; the middle pillar (top 410)
    crates: [[608, 378], [640, 378]],
  },
});

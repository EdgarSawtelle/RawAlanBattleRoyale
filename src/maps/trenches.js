// ============================================================================
//  Map: "Trenches"  (fortress / sunken)   two plateaus, a deep trench in the middle with cover, a plank walk above it
//  Spawn on a plateau, drop 100 into the trench (climbing out is a normal 100 hop). A waist-high barricade with spikes on
//  its top splits the trench; crates and barrels give cover; two planks over the trench are the sniper route.
// ============================================================================
import { buildMap, slab, crateStack } from './build.js';

export default buildMap({
  id: 'trenches', name: 'Trenches', family: 'fortress',
  description: 'Two plateaus over a trench with cover, a barricade, and a plank walk above.',
  background: 'sunken-metro', backgroundVariant: 0, hazardStyle: 'iron',
  spawn: { x: 150, top: 480 },
  left: {
    solids: [slab(50, 480, 330, 120), slab(400, 400, 110)],          // plateau (a thick block); the first plank
    crates: [...crateStack(250, 416, 1, 2), [470, 548]],
    barrels: [[520, 550]],
  },
  centre: {
    solids: [slab(380, 580, 520, 26), slab(608, 500, 64, 80), slab(560, 330, 160)],     // trench floor; barricade; the middle plank
    hazards: [{ type: 'spikes', x: 608, y: 480, w: 64, h: 20, face: 'up' }],
  },
});

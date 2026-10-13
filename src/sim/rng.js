// Seeded random numbers (mulberry32). The generator state is one integer stored in the
// simulation state (`state.rng`), so the simulation stays deterministic and serialisable.
// NEVER call Math.random() inside src/sim.
export function rand(state) {
  state.rng = (state.rng + 0x6D2B79F5) | 0;
  let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function randRange(state, a, b) { return a + (b - a) * rand(state); }

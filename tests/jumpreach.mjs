// Measures what one jump can do with the current physics (for map builders): for a platform B that is `up` units
// higher (negative = lower) than the start platform, the largest horizontal gap that a run-up + jump can cross.
// Run: node tests/jumpreach.mjs
import { registerMap } from '../src/maps/index.js';
import { createState, step, STEP } from '../src/sim/world.js';
const N = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };
function tryJump(gap, up, holdTicks = 40) {
  const id = 'jr-' + gap + '-' + up;
  registerMap({ id, name: 't', background: 'none', spawns: [{ x: 200, y: 485 }, { x: 1000, y: 485 }],
    solids: [{ x: 0, y: 500, w: 600, h: 40 }, { x: 600 + gap, y: 500 - up, w: 400, h: 40 }], destructibles: [], platforms: [] });
  const s = createState({ mapId: id, seed: 1 }); s.cheats.invulnerable = [true, true]; const p = s.players[0]; p.x = 400; p.y = 485; s.players[1].x = 1500; s.players[1].y = 100;
  let jumped = false;
  for (let i = 0; i < 200; i++) {
    const atEdge = p.x + 15 >= 600 - 3;                      // jump from the very edge of the start platform
    const jp = !jumped && p.grounded && atEdge; if (jp) jumped = true;
    step(s, [{ ...N, right: true, jump: jumped && i < 400, jumpPressed: jp }, N], STEP);
    if (jumped && p.grounded && p.x > 600 + gap - 15) return true;
    if (p.y > 700) return false;
  }
  return false;
}
console.log('step-up (units)  max gap crossable by a running jump');
for (const up of [-100, -60, -30, 0, 30, 60, 90, 105, 115, 125, 135, 145, 155]) {
  let best = -1; for (let g = 0; g <= 400; g += 5) if (tryJump(g, up)) best = g;
  console.log(String(up).padStart(6) + '            ' + (best < 0 ? 'cannot reach even with gap 0' : best));
}

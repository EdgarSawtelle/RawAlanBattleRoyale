// Stuck detector: two bots play for a while; reports any bot that stays within 25 units for more than 6 s of live play.
// Run: node tests/stuck.mjs [seconds] [seeds] [map-id]      (without a map id: every map of the rotation)
import { createPracticeSession } from '../src/practice/practice-session.js';
import { ROTATION } from '../src/maps/index.js';
const secs = Number(process.argv[2]) || 240, seeds = Number(process.argv[3]) || 6;
const maps = process.argv[4] ? [process.argv[4]] : ROTATION;
let stuck = 0;
for (const id of maps) {
  let n = 0;
  for (let sd = 1; sd <= seeds; sd++) {
    const S = createPracticeSession({ mapId: id, mapLock: id, demo: true, seed: sd * 7 });
    S.state.match.auto = [true, true];
    const track = [{ x: 0, y: 0, t: 0 }, { x: 0, y: 0, t: 0 }];
    for (let i = 0; i < secs * 60; i++) {
      S.update(1 / 60, () => ({}), () => {});
      const st = S.state; if (st.phase !== 'playing') { track.forEach((k) => { k.t = 0; }); continue; }
      st.players.forEach((p, k) => {
        const tk = track[k];
        if (!p.alive) { tk.t = 0; return; }
        if (Math.hypot(p.x - tk.x, p.y - tk.y) > 25) { tk.x = p.x; tk.y = p.y; tk.t = 0; } else tk.t += 1 / 60;
        if (tk.t > 6 && st.players[1 - k].alive) { n++; console.log(id + ' seed ' + sd + ': player ' + k + ' stuck at (' + Math.round(p.x) + ', ' + Math.round(p.y) + ') for 6 s, round ' + st.round + ' t=' + st.roundTime.toFixed(0)); tk.t = -30; }
      });
    }
  }
  console.log(id + ': ' + n + ' stuck events in ' + seeds + ' x ' + secs + ' s');
  stuck += n;
}
console.log('stuck events: ' + stuck);

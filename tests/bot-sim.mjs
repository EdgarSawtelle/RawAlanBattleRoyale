// Soak test: two bots play each other for a few minutes of game time; prints what happened.
// Run: node tests/bot-sim.mjs [seconds]
import { createPracticeSession } from '../src/practice/practice-session.js';
const secs = Number(process.argv[2]) || 180;
const S = createPracticeSession({ mapId: 'ruined-city', demo: true, seed: Number(process.argv[3]) || 5 });
S.state.match.auto = [true, true];   // both bots also answer the quiz / pick cards by themselves
const counts = {}; const xs = [[], []];
let round = 1;
for (let i = 0; i < secs * 60; i++) {
  S.update(1 / 60, () => ({}), (evs) => { for (const e of evs) counts[e.type] = (counts[e.type] || 0) + 1; });
  if (i % 30 === 0) S.state.players.forEach((p, k) => xs[k].push(Math.round(p.x / 100)));
}
console.log('simulated', secs, 's; rounds played:', S.state.round, 'scores:', S.state.scores);
console.log('events:', JSON.stringify(counts));
for (const k of [0, 1]) console.log('player', k, 'x-bucket histogram:', [...new Set(xs[k])].sort((a, b) => a - b).map((b) => b + ':' + xs[k].filter((v) => v === b).length).join(' '));

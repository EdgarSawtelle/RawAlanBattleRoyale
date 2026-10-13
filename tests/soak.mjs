// Soak test: two bots play whole matches against each other (quiz + card picks resolved by the
// bots). With --chaos both players are also given random card builds every round, to hunt for
// crashes, NaNs, runaway bullet counts and degenerate rounds (very short ones, never-ending ones).
// The maps rotate as in the real game (a new map every round, shuffled); --map=id pins one map.
// Run: node tests/soak.mjs [matches] [--chaos] [--map=old-plaza] [seed]
import { createPracticeSession } from '../src/practice/practice-session.js';
import { intent, setCards } from '../src/sim/world.js';
import { CARDS } from '../src/cards.js';
import { CONFIG } from '../src/config.js';

const args = process.argv.slice(2);
const chaos = args.includes('--chaos');
const mapArg = (args.find((a) => a.startsWith('--map=')) || '').slice(6) || null;
const nums = args.filter((a) => /^\d+$/.test(a)).map(Number);
const matches = nums[0] || 5, seed0 = nums[1] || 1;

let totalRounds = 0, quizzes = 0, maxBullets = 0, bad = 0, maxSpeed = 0;
const events = {}, cardPicks = {}, t0 = Date.now(), perMap = {};
for (let m = 0; m < matches; m++) {
  const S = createPracticeSession({ mapId: mapArg || undefined, mapLock: mapArg, rotate: !mapArg, demo: true, seed: seed0 * 1000 + m });
  S.state.match.auto = [true, true];
  let guard = 0, lastRound = 0, roundMap = S.state.mapId;
  S.beforeTick = (sess) => {
    const st = sess.state;
    if (chaos && st.phase === 'playing' && st.roundTick === 1) {           // random builds, up to 5 cards each
      for (const p of st.players) {
        const ids = []; const n = Math.floor(Math.random() * 6);              // Math.random is fine here: this is the harness, not the sim
        for (let i = 0; i < n; i++) { const c = CARDS[Math.floor(Math.random() * CARDS.length)]; if (ids.filter((x) => x === c.id).length < (c.maxStacks || 1)) ids.push(c.id); }
        setCards(st, p.index, ids);
      }
    }
  };
  while (S.state.phase !== 'matchEnd' && guard++ < 60 * 60 * 30) {          // at most 30 simulated minutes per match
    S.update(1 / 60, () => ({}), (evs) => {
      for (const e of evs) {
        events[e.type] = (events[e.type] || 0) + 1;
        if (e.type === 'quiz') quizzes++;
        if (e.type === 'cardPicked') cardPicks[e.cardId] = (cardPicks[e.cardId] || 0) + 1;
        if (e.type === 'roundStart') roundMap = e.mapId;
        if (e.type === 'roundEnd') { const k = (perMap[roundMap] = perMap[roundMap] || { rounds: 0, secs: 0, short: 0, long: 0, draws: 0, min: 1e9 }), t = S.state.roundTime; k.rounds++; k.secs += t; k.min = Math.min(k.min, t); if (t < 2) k.short++; if (t >= CONFIG.round.timeLimit) k.long++; if (e.winner < 0) k.draws++; }
      }
    });
    const st = S.state;
    maxBullets = Math.max(maxBullets, st.bullets.length);
    for (const p of st.players) {
      if (![p.x, p.y, p.vx, p.vy, p.hp].every(Number.isFinite)) bad++;
      maxSpeed = Math.max(maxSpeed, Math.hypot(p.vx, p.vy));
    }
    for (const b of st.bullets) if (![b.x, b.y, b.vx, b.vy, b.damage].every(Number.isFinite)) bad++;
    lastRound = st.round;
  }
  totalRounds += lastRound;
  const r = intent(S.state, 0, { type: 'playAgain' });
  if (S.state.phase !== 'matchEnd' && !r.ok) { /* ok */ }
  if (guard >= 60 * 60 * 30) { console.log('match ' + m + ' did not finish!'); bad++; }
}
console.log((chaos ? 'CHAOS ' : '') + 'soak' + (mapArg ? ' on ' + mapArg : ' (rotating maps)') + ': ' + matches + ' matches finished, ' + totalRounds + ' rounds, ' + quizzes + ' quizzes, ' + (Date.now() - t0) + ' ms');
console.log('max live bullets (both players): ' + maxBullets + ' (cap per player ' + CONFIG.caps.liveBullets + '), max player speed ' + Math.round(maxSpeed) + ', NaN/Infinity states: ' + bad);
console.log('round length per map: ' + Object.entries(perMap).map(([k, v]) => k + ' ' + v.rounds + ' rounds, avg ' + (v.secs / v.rounds).toFixed(1) + ' s, shortest ' + v.min.toFixed(1) + ' s, under 2 s: ' + v.short + ', sudden death: ' + v.long + ', draws: ' + v.draws).join(' | '));
console.log('events: ' + JSON.stringify(events));
console.log('cards picked: ' + JSON.stringify(cardPicks));
process.exit(bad ? 1 : 0);

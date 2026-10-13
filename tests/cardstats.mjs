// Card balance probe (a tool, not a pass/fail test): two bots play rounds on the rotating maps; one of them carries ONE card
// (alternating sides every round to cancel the side bias) against a bare opponent. Prints, per card, the win rate of the
// carrier, the average round length, how many rounds ended under 3 s, draws, and how often the card visibly fired (events).
// The bots are weak at long range and do not use cards on purpose, so this shows what a card does to the outcome, not how good a human is with it.
// Run: node tests/cardstats.mjs [rounds-per-card=60] [card-id ...]
import { createPracticeSession } from '../src/practice/practice-session.js';
import { intent, setCards } from '../src/sim/world.js';
import { CARDS } from '../src/cards.js';

const args = process.argv.slice(2);
const rounds = Number(args.find((a) => /^\d+$/.test(a))) || 60;
const only = args.filter((a) => !/^\d+$/.test(a));
const list = only.length ? CARDS.filter((c) => only.includes(c.id)) : [null, ...CARDS];     // null = no card on either side (the bias of the bots)
const rows = [];
for (const card of list) {
  const S = createPracticeSession({ demo: true, seed: 4242, rotate: true }); S.state.match.auto = [true, true];
  let n = 0, wins = 0, draws = 0, short = 0, secs = 0, fx = 0, round = 0, guard = 0, sudden = 0;
  S.beforeTick = (sess) => {
    const st = sess.state;
    if (st.phase === 'playing' && st.roundTick === 1) { round++; const carrier = round % 2; setCards(st, 0, []); setCards(st, 1, []); if (card) setCards(st, carrier, [card.id]); st.carrier = carrier; }
  };
  while (n < rounds && guard++ < 60 * 60 * 120) {
    S.update(1 / 60, () => ({}), (evs) => {
      for (const e of evs) {
        if (e.type === 'cardFx' || e.type === 'buff' || e.type === 'heal' || e.type === 'slab' || e.type === 'cardLost' || (e.type === 'explosion' && e.owner >= 0)) fx++;
        if (e.type === 'suddenDeath') sudden++;
        if (e.type === 'roundEnd') {
          n++; const t = S.state.roundTime; secs += t; if (t < 3) short++;
          if (e.winner < 0) draws++; else if (card && e.winner === S.state.carrier) wins++; else if (!card && e.winner === 0) wins++;
        }
      }
    });
    if (S.state.phase === 'matchEnd') intent(S.state, 0, { type: 'playAgain' });
  }
  rows.push({ id: card ? card.id : '(none)', rarity: card ? card.rarity : '-', win: n ? wins / n : 0, avg: secs / Math.max(1, n), short, draws, sudden, fx: fx / Math.max(1, n), n });
}
console.log('card'.padEnd(16) + 'rarity'.padEnd(10) + 'win%'.padEnd(7) + 'avg s'.padEnd(8) + '<3s'.padEnd(5) + 'draws'.padEnd(7) + 'sudden'.padEnd(8) + 'fx/round');
for (const r of rows) console.log(r.id.padEnd(16) + r.rarity.padEnd(10) + (r.win * 100).toFixed(0).padEnd(7) + r.avg.toFixed(1).padEnd(8) + String(r.short).padEnd(5) + String(r.draws).padEnd(7) + String(r.sudden).padEnd(8) + r.fx.toFixed(1));

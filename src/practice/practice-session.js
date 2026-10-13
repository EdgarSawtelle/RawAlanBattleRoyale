// ============================================================================
//  practice-session.js - runs the simulation locally: a fixed 60 Hz accumulator loop, the human's
//  input for player 0 and the dummy bot's input for player 1. This is exactly the role the online
//  host session will play later (it also owns the state and calls step()).
//  It also keeps the previous tick's positions so the renderer can interpolate between ticks.
// ============================================================================
import { CONFIG } from '../config.js';
import { createState, step, STEP } from '../sim/world.js';
import { createBot, botInput } from './dummy-bot.js';

export function createPracticeSession({ mapId, cards = [[], []], seed = 12345, demo = false, rotate = false, mapLock = null } = {}) {
  const S = {
    state: createState({ mapId, seed, cards, rotate, mapLock }),
    bot: createBot(seed + 1),                       // drives player 1 (the dummy)
    demoBot: demo ? createBot(seed + 2, { reactionTime: 0.15, aimErrorDeg: 4, blockChance: 0.25 }) : null,  // drives player 0 when ?demo=1
    paused: false, stepOnce: false, timeScale: 1,
    acc: 0, prev: null, ticks: 0,
    stopAfterTicks: Infinity,                       // test helper: freeze after N ticks
    beforeTick: null,                               // optional hook (scenarios): (session) => void
    scripted: null,                                 // optional (session) => input for player 0 (test scenarios)
  };

  function capture() {
    const s = S.state;
    return { players: s.players.map((p) => ({ x: p.x, y: p.y })), bullets: new Map(s.bullets.map((b) => [b.id, { x: b.x, y: b.y }])) };
  }

  // Advance one tick. Returns the events produced.
  function tick(getHumanInput) {
    if (S.beforeTick) S.beforeTick(S);
    S.prev = capture();
    const st = S.state;
    const live = st.phase === 'playing' || st.phase === 'roundEnd';          // quiz / card pick / match end: the duel is frozen
    const in0 = !live ? null : S.scripted ? S.scripted(S) : S.demoBot ? botInput(S.demoBot, st, 0, STEP) : getHumanInput(st.players[0]);
    const in1 = live ? botInput(S.bot, st, 1, STEP) : null;
    S.ticks += 1;
    return step(st, [in0, in1], STEP);
  }

  // Called once per rendered frame with the real elapsed seconds. Returns { events: [...per tick arrays] }.
  S.update = function (dtReal, getHumanInput, onTickEvents) {
    let n = 0;
    if (S.paused && !S.stepOnce) { S.acc = 0; return; }
    if (S.stepOnce) { S.stepOnce = false; if (S.ticks < S.stopAfterTicks) onTickEvents(tick(getHumanInput)); S.acc = 0; return; }
    S.acc += Math.min(dtReal, 0.25) * S.timeScale;
    while (S.acc >= STEP && n < CONFIG.maxCatchUpTicks) {
      if (S.ticks >= S.stopAfterTicks) { S.acc = 0; break; }
      onTickEvents(tick(getHumanInput));
      S.acc -= STEP; n++;
    }
    if (n === CONFIG.maxCatchUpTicks) S.acc = 0;     // we are too slow: drop the backlog instead of spiralling
  };

  // 0..1: how far we are into the next tick (for render interpolation)
  S.alpha = function () { return (S.paused || S.ticks >= S.stopAfterTicks) ? 1 : Math.min(1, S.acc / STEP); };
  return S;
}

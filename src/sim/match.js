// ============================================================================
//  match.js - the match loop AFTER a round ends: quiz, card pick, match end.
//  Pure data + validated "intents". Nothing here touches the DOM, and the UI never mutates this
//  state directly: it sends an intent (answerQuiz / pickCard / continue / playAgain) and reads the
//  state back. Online, the host runs these functions and the client only sends intents and
//  receives state / events (use matchView() to build what a client may see: it hides the correct
//  answer until the question has been answered, and the card ids until the pick).
//
//  state.phase (one plain string, shared with sim/world.js):
//    'ready'      the gate before every round: map shown, nobody can act, waiting for every screen to be ready, then 3-2-1 (world.js)
//    'playing'    the duel is running (world.js)
//    'roundEnd'   somebody died; short banner pause (world.js)
//    'quiz'       the round loser answers one question (no time limit)
//    'quizReveal' right/wrong + the explanation, waiting for "continue"
//    'cardPick'   the loser takes one of the offered cards
//    'dummyTurn'  the loser is a bot: it answers and picks by itself, a summary is shown
//    'matchEnd'   somebody reached the win target
//  state.match holds everything else (see createMatch). It lives inside the sim state, so it is
//  serialisable and snapshot-able like the rest.
// ============================================================================
import { CONFIG } from '../config.js';
import { CARDS } from '../cards.js';
import { QUESTIONS } from '../questions.js';
import { rand } from './rng.js';
import { emit } from './combat.js';
import { setPlayerCards } from './player.js';
import { countCards, computeStats } from './cardfx.js';

// ---- question pool -----------------------------------------------------------------------------------
let pool = null;      // validated questions (cached)
let override = null;  // tests can swap the list

// A question is valid with a text, exactly 4 non-empty answers and `correct` an integer 0-3.
export function isValidQuestion(q) {
  return !!q && typeof q.q === 'string' && q.q.trim().length > 0 &&
    Array.isArray(q.answers) && q.answers.length === 4 && q.answers.every((a) => typeof a === 'string' && a.trim().length > 0) &&
    Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3;
}
export function validQuestions() {
  if (pool) return pool;
  const src = override || QUESTIONS || [];
  pool = [];
  src.forEach((q, i) => {
    if (isValidQuestion(q)) pool.push({ ...q, id: q.id || 'q' + i });
    else console.warn('questions.js: skipping invalid question #' + i + (q && q.id ? ' (' + q.id + ')' : ''));
  });
  return pool;
}
export function setQuestionPool(list) { override = list; pool = null; }

// ---- creation ------------------------------------------------------------------------------------------
export function createMatch(auto = [false, true]) {
  return {
    winTarget: CONFIG.match.winTarget,
    auto,                 // which players are resolved by a bot (the dummy)
    loser: -1,            // the round loser: answers the quiz and picks the card
    quiz: null,           // { qid, category, q, answers[4] (shuffled), order[4], correctShown }   order/correctShown are PRIVATE
    result: null,         // { picked, correctShown, right, why }   exists only after the answer
    offer: [],            // card ids offered (5)
    removed: [],          // offered cards struck out by a wrong answer
    skipped: false,       // true when there was no valid question (all 5 cards offered)
    dummy: null,          // summary of the bot's turn { qid, q, answers, picked, correctShown, right, cardId, why, category, skipped }
    used: [],             // question ids already asked in this match
    timer: 0,             // seconds left on the dummy-turn beat
    pickedCard: null,     // the card taken this turn
    again: [false, false],// "play again" votes at the match end (a bot counts as agreed)
    hover: -1,            // index of the offered card the picker is pointing at (cosmetic: the watcher sees it)
  };
}

// What a client may see. The correct answer is only included once the question was answered.
export function matchView(state) {
  const m = state.match, ph = state.phase;
  const revealed = !!m.result;
  return {
    phase: ph, round: state.round, scores: state.scores, winTarget: m.winTarget, auto: m.auto, loser: m.loser, skipped: m.skipped, nextMap: state.nextMapId,
    quiz: m.quiz ? { qid: m.quiz.qid, category: m.quiz.category, q: m.quiz.q, answers: m.quiz.answers } : null,
    result: m.result ? { ...m.result } : null,
    offerCount: m.offer.length,
    offer: (ph === 'cardPick' || ph === 'dummyTurn' || ph === 'matchEnd') ? m.offer : null,
    removed: (revealed || ph === 'dummyTurn') ? m.removed : [],
    dummy: m.dummy, timer: m.timer, again: m.again, hover: m.hover,
    builds: state.players.map((p) => p.cards),
    winner: state.result ? state.result.winner : -1,
  };
}

// ---- offer ------------------------------------------------------------------------------------------------
// Is this card worth offering to a player who owns `owned`? Not when it is maxed out, and not when taking it would change nothing
// (every stat it edits is already at its floor / cap and it has no hook): the picker is never offered a dead card.
export function cardUseful(owned, card) {
  const counts = countCards(owned);
  if ((counts[card.id] || 0) >= (card.maxStacks || 1)) return false;
  if (card.hooks || card.dynamic) return true;
  const a = computeStats(owned), b = computeStats([...owned, card.id]);
  return Object.keys(a).some((k) => a[k] !== b[k]);
}

// 5 distinct cards drawn slot by slot with the rarity weights (catch-up weights when the picker is
// 2+ rounds behind). Cards the picker already owns up to their maxStacks, or that would change nothing, are not offered.
export function makeOffer(state, picker) {
  const M = CONFIG.match, p = state.players[picker];
  const left = CARDS.filter((c) => cardUseful(p.cards, c));
  const behind = state.scores[1 - picker] - state.scores[picker];
  const w = behind >= M.catchUpRounds ? M.catchUpWeights : M.rarityWeights;
  const offer = [];
  while (offer.length < M.offerSize && left.length) {
    const tiers = ['common', 'uncommon', 'rare'].filter((r) => left.some((c) => c.rarity === r));
    let total = 0; for (const r of tiers) total += w[r];
    let roll = rand(state) * total, tier = tiers[tiers.length - 1];
    for (const r of tiers) { if (roll < w[r]) { tier = r; break; } roll -= w[r]; }
    const cands = left.filter((c) => c.rarity === tier);
    const card = cands[Math.floor(rand(state) * cands.length)];
    offer.push(card.id);
    left.splice(left.indexOf(card), 1);
  }
  return offer;
}

// ---- starting a quiz -------------------------------------------------------------------------------------------
function pickQuestion(state, qid) {
  const m = state.match, all = validQuestions();
  if (!all.length) return null;
  if (qid) return all.find((q) => q.id === qid) || null;
  let unused = all.filter((q) => !m.used.includes(q.id));
  if (!unused.length) {                                  // everything was asked: start over (not the last one again)
    const last = m.used[m.used.length - 1];
    m.used = [];
    unused = all.filter((q) => q.id !== last);
    if (!unused.length) unused = all;
  }
  return unused[Math.floor(rand(state) * unused.length)];
}

function shuffle4(state) {
  const a = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rand(state) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;                                              // a[shownSlot] = original answer index
}

// The round loser gets a question (or, with no valid question, the card pick straight away).
export function beginQuiz(state, loser, qid) {
  const m = state.match;
  m.loser = loser; m.result = null; m.removed = []; m.dummy = null; m.pickedCard = null; m.skipped = false; m.hover = -1;
  m.offer = makeOffer(state, loser);
  const q = pickQuestion(state, qid);
  if (!q) {                                              // no valid questions: skip the quiz, offer all cards
    m.quiz = null; m.skipped = true;
    state.phase = 'cardPick';
    emit(state, 'cardPick', { loser });
    if (m.auto[loser]) autoResolve(state);
    return;
  }
  if (!qid) m.used.push(q.id);
  const order = shuffle4(state);
  m.quiz = { qid: q.id, category: q.category || '', q: q.q, why: q.why || '', answers: order.map((i) => q.answers[i]), order, correctShown: order.indexOf(q.correct) };
  state.phase = 'quiz';
  emit(state, 'quiz', { loser, qid: q.id });
  if (m.auto[loser]) autoResolve(state);
}

function resolveAnswer(state, shownIndex) {
  const m = state.match, qz = m.quiz;
  const right = shownIndex === qz.correctShown;
  m.result = { picked: shownIndex, correctShown: qz.correctShown, right, why: qz.why };
  m.removed = [];
  if (!right) {                                          // wrong: 3 of the offered cards are removed at random
    const ids = [...m.offer];
    for (let k = 0; k < CONFIG.match.wrongRemoves && ids.length > 1; k++) m.removed.push(ids.splice(Math.floor(rand(state) * ids.length), 1)[0]);
  }
  emit(state, 'quizAnswered', { loser: m.loser, right });
}

function takeCard(state, cardId) {
  const m = state.match, p = state.players[m.loser];
  setPlayerCards(p, [...p.cards, cardId]);
  m.pickedCard = cardId;
  m.hover = -1;
  emit(state, 'cardPicked', { player: m.loser, cardId });
}

// The dummy answers (right with CONFIG.match.dummyRightChance) and takes a random remaining card.
function autoResolve(state) {
  const m = state.match;
  if (m.quiz) {
    const right = rand(state) < CONFIG.match.dummyRightChance;
    let idx = m.quiz.correctShown;
    if (!right) { const wrong = [0, 1, 2, 3].filter((i) => i !== m.quiz.correctShown); idx = wrong[Math.floor(rand(state) * wrong.length)]; }
    resolveAnswer(state, idx);
  }
  const choices = m.offer.filter((id) => !m.removed.includes(id));
  const cardId = choices[Math.floor(rand(state) * choices.length)];
  takeCard(state, cardId);
  m.dummy = m.quiz ? { qid: m.quiz.qid, category: m.quiz.category, q: m.quiz.q, answers: m.quiz.answers, picked: m.result.picked, correctShown: m.result.correctShown, right: m.result.right, why: m.result.why, cardId, skipped: false }
                   : { skipped: true, cardId };
  m.timer = CONFIG.match.dummyBeat;
  state.phase = 'dummyTurn';
}

// ---- after a round ended (called by world.js when the banner pause is over) -----------------------------------------------
// Returns 'restart' (a draw: replay the round) or 'wait' (the match loop took over).
export function enterAfterRound(state) {
  const w = state.result ? state.result.winner : -1;
  if (w < 0) return 'restart';                                   // draw: no point, no quiz, no cards
  if (state.scores[w] >= state.match.winTarget) {
    state.phase = 'matchEnd';
    emit(state, 'matchEnd', { winner: w });
    return 'wait';
  }
  beginQuiz(state, 1 - w);
  return 'wait';
}

// ---- intents (the only way the UI changes the match) -----------------------------------------------------------------------------
// Each returns { ok: true, action } or { ok: false, error }. action tells world.js what to do next:
// 'startRound' (next round begins) | 'newMatch' | null.
export function answerQuiz(state, player, index) {
  const m = state.match;
  if (state.phase !== 'quiz') return { ok: false, error: 'not in the quiz' };
  if (player !== m.loser) return { ok: false, error: 'not your question' };
  if (!Number.isInteger(index) || index < 0 || index > 3) return { ok: false, error: 'bad answer index' };
  if (m.result) return { ok: false, error: 'already answered' };
  resolveAnswer(state, index);
  state.phase = 'quizReveal';
  return { ok: true, action: null };
}

export function continueIntent(state, player) {
  const m = state.match;
  if (state.phase === 'quizReveal') {
    if (player !== m.loser) return { ok: false, error: 'not your turn' };
    state.phase = 'cardPick';
    emit(state, 'cardPick', { loser: m.loser });
    return { ok: true, action: null };
  }
  if (state.phase === 'dummyTurn') return { ok: true, action: 'startRound' };
  return { ok: false, error: 'nothing to continue' };
}

export function pickCard(state, player, cardId) {
  const m = state.match;
  if (state.phase !== 'cardPick') return { ok: false, error: 'not picking a card' };
  if (player !== m.loser) return { ok: false, error: 'not your pick' };
  if (!m.offer.includes(cardId)) return { ok: false, error: 'card not offered' };
  if (m.removed.includes(cardId)) return { ok: false, error: 'card was removed' };
  takeCard(state, cardId);
  return { ok: true, action: 'startRound' };
}

// Both human players have to agree (a bot counts as agreed): each vote is an intent.
// The picker points at an offered card (index 0-4, or -1 for none). Purely cosmetic, so the other screen can follow along.
export function hoverCard(state, player, index) {
  const m = state.match;
  if (state.phase !== 'cardPick' || player !== m.loser) return { ok: false, error: 'not picking a card' };
  if (!Number.isInteger(index) || index < -1 || index >= m.offer.length) return { ok: false, error: 'bad index' };
  m.hover = index;
  return { ok: true, action: null };
}

export function playAgain(state, player = 0) {
  const m = state.match;
  if (state.phase !== 'matchEnd') return { ok: false, error: 'the match is not over' };
  if (player !== 0 && player !== 1) return { ok: false, error: 'bad player' };
  m.again[player] = true;
  const all = [0, 1].every((i) => m.again[i] || m.auto[i]);
  return { ok: true, action: all ? 'newMatch' : null };
}

// The dummy-turn beat runs out by itself (called from world.js every step while in that phase).
export function tickMatch(state, dt) {
  if (state.phase === 'dummyTurn') {
    state.match.timer -= dt;
    if (state.match.timer <= 0) return 'startRound';
  }
  return null;
}

// ---- debug helpers (bypass the normal flow, used by the debug panel / URL params) -------------------------------------------------------
export function debugQuiz(state, loser, qid) { state.phase = 'playing'; beginQuiz(state, loser, qid); }
// Jump straight to the card pick as if the quiz was answered right / wrong.
export function debugCardPick(state, loser, right) {
  const m = state.match, auto = m.auto;
  m.auto = [false, false];                                       // a human-style quiz for whoever is the loser
  beginQuiz(state, loser);
  m.auto = auto;
  if (state.phase === 'quiz') {
    const idx = right ? m.quiz.correctShown : (m.quiz.correctShown + 1) % 4;
    resolveAnswer(state, idx);
    state.phase = 'cardPick';
  }
}

export function debugMatchEnd(state, winner) {
  state.result = { winner };
  state.scores[winner] = Math.max(state.scores[winner], state.match.winTarget);
  state.phase = 'matchEnd';
}
export function debugSetScore(state, a, b) { state.scores = [a, b]; }

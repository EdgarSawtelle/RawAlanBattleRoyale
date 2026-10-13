// The simulation: step(state, inputsByPlayer, dt). Pure and input-driven.
//   * no DOM, no canvas, no Math.random (seeded RNG lives in state.rng)
//   * the whole state is plain serialisable data (JSON.stringify works)
//   * the same code will run on the online host
// The renderer only READS the state. Things that happened during a step are returned (and also
// kept in state.events) as a list of event objects the renderer turns into effects.
import { CONFIG } from '../config.js';
import { getMap, ROTATION } from '../maps/index.js';
import { rand } from './rng.js';
import { platformPos } from './platforms.js';
import { createPlayer, resetPlayerForRound, stepPlayer, checkOutOfBounds, setPlayerCards } from './player.js';
import { stepBullets } from './bullet.js';
import { emit, killPlayer, fireHook, stepTimers, stepSlabs } from './combat.js';
import { updateDynamic } from './cardfx.js';
import { createMatch, enterAfterRound, tickMatch, answerQuiz, continueIntent, pickCard, playAgain, hoverCard } from './match.js';
import { getHazards, solidHazardColliders, stepHazards } from './hazards.js';

export const STEP = 1 / CONFIG.tickRate;

// ---- creating / resetting ---------------------------------------------------------------------------
export function createState({ mapId, seed = 1, cards = [[], []], rotate = false, mapLock = null } = {}) {
  const state = {
    tick: 0,                // total ticks since creation
    roundTick: 0,           // ticks since the round started (drives moving platforms)
    rng: seed | 0,          // seeded RNG state
    nextId: 1,              // id counter for bullets
    nextShot: 1,            // id counter for trigger pulls (per-shot damage cap)
    mapId: mapId || mapLock || ROTATION[0],
    rotate: !!rotate && !mapLock,   // map rotation: a new map every round (see drawMap); off for tests and pinned maps
    mapLock: mapLock || null,       // pinned map (debug panel / ?map=): wins over the rotation
    mapBag: [],                     // the maps not yet played in the current shuffle
    phase: 'playing',       // 'playing' | 'roundEnd' | 'quiz' | 'quizReveal' | 'cardPick' | 'dummyTurn' | 'matchEnd' (see sim/match.js)
    overTimer: 0,
    result: null,           // { winner: 0 | 1 | -1 (draw) } after a round ended
    roundTime: 0,           // seconds of live play this round (drives the round clock / sudden death)
    suddenDeath: false,
    round: 1,
    scores: [0, 0],
    players: [createPlayer(0, cards[0] || []), createPlayer(1, cards[1] || [])],
    bullets: [],
    blocks: [],
    timers: [],             // delayed card effects (see combat.js schedule)
    lag: [0, 0],            // lag compensation (online host only): ticks to rewind the OTHER player for each player's bullets (0 = none)
    hist: [],               // ring of the last 16 ticks of body positions [tick, x0, y0, x1, y1] (what lag compensation rewinds to)
    cheats: { invulnerable: [false, false] },   // set by the debug panel
    match: createMatch(),   // quiz / card pick / match end state (sim/match.js)
    events: [],
  };
  if (state.rotate && !mapId) state.mapId = drawMap(state);
  startRound(state);
  state.events = [];
  return state;
}

// MAP ROTATION: the maps are played in a shuffled order; all of them appear before any repeats (a new shuffle never starts
// with the map just played). Seeded with the match RNG, so the host's choice is plain state that the clients simply receive.
export function drawMap(state) {
  if (state.mapLock) return state.mapLock;
  if (!state.mapBag.length) {
    const bag = ROTATION.slice();
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand(state) * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    if (bag.length > 1 && bag[0] === state.mapId) { const t = bag[0]; bag[0] = bag[bag.length - 1]; bag[bag.length - 1] = t; }
    state.mapBag = bag;
  }
  return state.mapBag.shift();
}

// Reset everything for a new round on the current map (cards are kept, HP/ammo/blocks reset).
export function startRound(state) {
  const map = getMap(state.mapId);
  state.phase = 'playing'; state.overTimer = 0; state.result = null;
  Object.assign(state.match, { quiz: null, result: null, offer: [], removed: [], dummy: null, pickedCard: null, loser: -1, skipped: false, again: [false, false] });
  state.roundTick = 0; state.roundTime = 0; state.suddenDeath = false;
  state.bullets = []; state.timers = []; state.hist = [];
  state.blocks = map.destructibles.map((d) => {
    const hp = d.hp ?? (d.kind === 'barrel' ? CONFIG.hazards.barrel.hp : 50);
    return { id: d.id, kind: d.kind || 'crate', x: d.x, y: d.y, w: d.w, h: d.h, hp, maxHp: hp, alive: true };
  });
  for (let i = 0; i < 2; i++) resetPlayerForRound(state.players[i], map.spawns[i]);
  emit(state, 'roundStart', { round: state.round, mapId: state.mapId });
}

export function loadMap(state, mapId) {
  state.mapId = mapId;
  startRound(state);
}

export function setCards(state, playerIndex, cardIds) {
  setPlayerCards(state.players[playerIndex], cardIds);
}

// ---- colliders -----------------------------------------------------------------------------------------
const staticCache = new WeakMap();
function staticColliders(map) {
  let list = staticCache.get(map);
  if (!list) {
    list = map.solids.map((s, i) => ({ x: s.x, y: s.y, w: s.w, h: s.h, kind: 'solid', id: 's' + i }));
    staticCache.set(map, list);
  }
  return list;
}

// Everything solid right now: static slabs + living destructible blocks + moving platforms
// (with the displacement they made this tick, so riders can be carried).
export function getColliders(state) { return collidersFor(state.mapId, state.roundTick, state.blocks); }

// The same list from the three things it depends on (so the online client can build exactly the same
// colliders for its movement prediction): the map, the round tick (moving platforms) and the blocks.
export function collidersFor(mapId, roundTick, blocks) {
  const map = getMap(mapId);
  const out = staticColliders(map).slice();
  for (const b of blocks) if (b.alive) out.push({ x: b.x, y: b.y, w: b.w, h: b.h, kind: 'block', id: b.id });
  out.push(...solidHazardColliders(getHazards({ mapId }, roundTick)));
  for (const def of map.platforms || []) {
    const pos = platformPos(def, roundTick), prev = platformPos(def, Math.max(0, roundTick - 1));
    out.push({ x: pos.x, y: pos.y, w: def.w, h: def.h, kind: 'platform', id: def.id, dx: pos.x - prev.x, dy: pos.y - prev.y });
  }
  return out;
}

// ---- the step ------------------------------------------------------------------------------------------------
const NEUTRAL = { left: false, right: false, jump: false, jumpPressed: false, shoot: false, block: false, aim: 0 };

// Start the next round (after a draw, or after the loser took a card). Cards are kept.
export function nextRound(state) { state.round += 1; if (state.rotate) state.mapId = drawMap(state); startRound(state); }

// "Play again": scores, builds and the used-question list are reset; round 1 starts.
export function newMatch(state) {
  state.scores = [0, 0]; state.round = 1; state.match.used = [];
  for (const p of state.players) setPlayerCards(p, []);
  if (state.rotate) state.mapId = drawMap(state);
  startRound(state);
}

// The UI (or, online, the client) never changes the match directly: it sends an intent.
//   { type: 'answer', index }   { type: 'pick', cardId }   { type: 'continue' }   { type: 'playAgain' }
// Returns { ok, error?, events }.
export function intent(state, player, it) {
  const before = state.events.length;
  let r;
  switch (it && it.type) {
    case 'answer': r = answerQuiz(state, player, it.index); break;
    case 'continue': r = continueIntent(state, player); break;
    case 'pick': r = pickCard(state, player, it.cardId); break;
    case 'playAgain': r = playAgain(state, player); break;
    case 'hover': r = hoverCard(state, player, it.index); break;
    default: r = { ok: false, error: 'unknown intent' };
  }
  if (r.ok) { if (r.action === 'startRound') nextRound(state); else if (r.action === 'newMatch') newMatch(state); }
  return { ...r, events: state.events.slice(before) };
}

export function step(state, inputs, dt = STEP) {
  state.events = [];
  // quiz / card pick / dummy turn / match end: the duel is frozen, only the match loop runs
  if (state.phase !== 'playing' && state.phase !== 'roundEnd') {
    state.tick += 1;
    if (tickMatch(state, dt) === 'startRound') nextRound(state);
    return state.events;
  }
  state.tick += 1;
  state.roundTick += 1;

  stepSlabs(state, dt);                                        // slabs run out, delayed card effects (fuses) go off
  stepTimers(state, dt);
  for (const p of state.players) {                             // dynamic cards (low HP, clinging, seconds into the round)
    if (!p.alive || !p.cards.length) continue;
    const ch = updateDynamic(state, p);
    if (ch) for (const [id, o, k] of ch) if (k > o) emit(state, 'buff', { player: p.index, src: id, x: p.x, y: p.y, level: k });
  }
  const colliders = getColliders(state);

  for (let i = 0; i < 2; i++) stepPlayer(state, state.players[i], (inputs && inputs[i]) || NEUTRAL, colliders, dt);
  state.hist[state.tick & 15] = [state.tick, state.players[0].x, state.players[0].y, state.players[1].x, state.players[1].y];
  stepBullets(state, colliders, dt);
  for (let i = 0; i < 2; i++) checkOutOfBounds(state, state.players[i], colliders);
  stepHazards(state, getHazards(state));

  // ---- round clock and sudden death: after the time limit both players bleed HP steadily ----
  if (state.phase === 'playing') {
    state.roundTime += dt;
    if (!state.suddenDeath && state.roundTime >= CONFIG.round.timeLimit) {
      state.suddenDeath = true;
      emit(state, 'suddenDeath', {});
    }
    if (state.suddenDeath) {
      for (const p of state.players) {
        if (!p.alive || state.cheats.invulnerable[p.index]) continue;
        p.hp -= CONFIG.round.suddenDeathDps * (p.stats.maxHp / CONFIG.base.maxHp) * dt;     // a fraction of MAX HP: 2 HP/s at 100, so a tank does not win sudden death just by having more HP (soak: Thick Skin won 89%)
        if (p.hp <= 0) killPlayer(state, p.index, -1, 'suddenDeath');
      }
    }
  }

  // ---- round flow ----
  if (state.phase === 'playing') {
    const dead = state.players.filter((p) => !p.alive);
    if (dead.length > 0) {
      state.phase = 'roundEnd';
      state.overTimer = CONFIG.round.endDelay;
      const winner = dead.length === 2 ? -1 : state.players.findIndex((p) => p.alive);   // both dead on the same tick = draw
      state.result = { winner };
      if (winner >= 0) state.scores[winner] += 1;                                       // a draw scores nothing
      emit(state, 'roundEnd', { winner });
      for (let i = 0; i < 2; i++) fireHook(state, 'onRoundEnd', i, { won: winner === i });
    }
  } else {
    const w = state.result ? state.result.winner : -1;
    if (w >= 0 && !state.players[w].alive) {                   // the winner died to the loser's last blast (Parting Gift): both are dead = a draw
      state.scores[w] -= 1; state.result = { winner: -1 };
      emit(state, 'roundEnd', { winner: -1, converted: true });
    }
    if (!state.timers.some((t) => t.hold)) state.overTimer -= dt;   // a fuse that is still burning holds the round open
    if (state.overTimer <= 0 && enterAfterRound(state) === 'restart') nextRound(state);   // a draw restarts; otherwise the quiz / match end takes over
  }
  return state.events;
}

// Cheats / helpers used by the debug panel (kept next to the sim so they stay valid).
export function healAll(state) {
  for (const p of state.players) if (p.alive) { p.hp = p.stats.maxHp; p.ammo = p.stats.magazine; p.reloadLeft = 0; }
}

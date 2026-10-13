// Card machinery: (1) stats = base config + the player's cards (+ timed + dynamic modifiers), clamped by the
// global balance caps, (2) hook dispatch. Cards themselves live in src/cards.js; this file never
// needs to change when a card is added.
import { CONFIG } from '../config.js';
import { CARDS_BY_ID } from '../cards.js';
import { rand } from './rng.js';

// Stacking rule (CARDS.md "Global balance rules"):
//   value = clamp( (base + sum of all `add`) * (1 + sum of (mul - 1)) )
// Percentages from different cards ADD (two cards with mul 2 give x3, not x4), so extreme cards
// cannot compound. Taking the same card twice applies its mods twice (up to its maxStacks).
// `timed` = temporary modifiers [{ src, mods, left }] (e.g. Scramble's speed burst).
// `dyn`   = the current key of every DYNAMIC card { cardId: key } (see updateDynamic): a card with
//           `dynamic: { key(p, state) -> integer, mods(key) -> mods }` changes its modifiers when the key changes
//           (Cornered: low HP, Limpet: clinging to a wall, Late Bloomer: seconds into the round).
export function computeStats(cardIds, timed = [], dyn = null) {
  const stats = { ...CONFIG.base };
  const add = {}, mulSum = {};
  const apply = (mods) => {
    for (const [key, m] of Object.entries(mods || {})) {
      if (m.add) add[key] = (add[key] || 0) + m.add;
      if (m.mul !== undefined) mulSum[key] = (mulSum[key] || 0) + (m.mul - 1);
    }
  };
  for (const id of cardIds) {
    const card = CARDS_BY_ID[id]; if (!card) continue;
    apply(card.mods);
    if (card.dynamic && dyn && dyn[id]) apply(card.dynamic.mods(dyn[id]));
  }
  for (const t of timed) apply(t.mods);
  for (const key of Object.keys(stats)) {
    let v = (stats[key] + (add[key] || 0)) * (1 + (mulSum[key] || 0));
    const lim = CONFIG.statLimits[key];
    if (lim) v = Math.max(lim[0], Math.min(lim[1], v));
    stats[key] = v;
  }
  stats.magazine = Math.round(stats.magazine);
  stats.bulletsPerShot = Math.round(stats.bulletsPerShot);
  stats.airJumps = Math.round(stats.airJumps);

  // Derived limits, in this order (CARDS.md):
  // 1. burst cap: fireRate * damage * bulletsPerShot <= 130 (lower damage first, then fire rate)
  const C = CONFIG.caps, L = CONFIG.statLimits;
  if (stats.fireRate * stats.damage * stats.bulletsPerShot > C.burst) {
    stats.damage = Math.max(L.damage[0], C.burst / (stats.fireRate * stats.bulletsPerShot));
    if (stats.fireRate * stats.damage * stats.bulletsPerShot > C.burst) stats.fireRate = C.burst / (stats.damage * stats.bulletsPerShot);
  }
  // 2. magazine budget: magazine * bulletsPerShot * damage <= 240 (lower the magazine)
  if (stats.magazine * stats.bulletsPerShot * stats.damage > C.magazineBudget) {
    stats.magazine = Math.max(1, Math.floor(C.magazineBudget / (stats.bulletsPerShot * stats.damage)));
  }
  return stats;
}

// How many copies of each card a player has: { id: count }
export function countCards(ids) {
  const out = {};
  for (const id of ids) out[id] = (out[id] || 0) + 1;
  return out;
}

// Call a hook on every card the player owns (or only on `only`, a card id: used by timers).
// `api` is the set of simulation operations the hook may use (spawnBullet, explode, heal, ...), supplied by combat.js.
export function runHook(state, hookName, ownerIndex, extra, api, only) {
  const owner = state.players[ownerIndex];
  if (!owner || !owner.cards.length) return;
  const counts = countCards(owner.cards);
  for (const id of Object.keys(counts)) {
    if (only && id !== only) continue;
    const hook = CARDS_BY_ID[id] && CARDS_BY_ID[id].hooks && CARDS_BY_ID[id].hooks[hookName];
    if (!hook) continue;
    if (!owner.cardState[id]) owner.cardState[id] = {};
    const ctx = {
      state,
      cardId: id,
      owner, ownerIndex,
      target: null, targetIndex: -1,
      bullet: null, bullets: null, amount: 0, source: null,
      ...extra,
      stacks: counts[id],
      store: owner.cardState[id],
      rng: () => rand(state),
      spawnBullet: (opts) => api.spawnBullet(state, ownerIndex, opts),
      explode: (x, y, radius, damage, opts) => api.explode(state, x, y, radius, damage, ownerIndex, opts),
      heal: (player, n) => api.heal(state, player.index, n),
      hurt: (player, n) => api.hurt(state, ownerIndex, player.index, n),
      applyImpulse: (player, vx, vy) => api.applyImpulse(state, player.index, vx, vy),
      reflect: (bullet, opts) => api.reflect(state, ownerIndex, bullet, opts),
      addTimed: (mods, duration) => api.addTimed(state, ownerIndex, id, mods, duration),
      removeCard: () => api.removeCard(state, ownerIndex, id),
      schedule: (delay, tag, data, opts) => api.schedule(state, ownerIndex, id, delay, tag, data, opts),
      spawnSlab: (opts) => api.spawnSlab(state, ownerIndex, opts),
      fx: (kind, data) => api.fx(state, ownerIndex, id, kind, data),
    };
    hook(ctx);
  }
}

// Recompute a player's derived stats after a timed / dynamic modifier started or ended.
export function refreshStats(p) {
  p.stats = computeStats(p.cards, p.timed, p.dyn);
  p.hp = Math.min(p.hp, p.stats.maxHp);
  p.ammo = Math.min(p.ammo, p.stats.magazine);
}

// Dynamic cards: evaluate every owned dynamic card's key; when one changed, recompute the stats.
// Returns the list of [cardId, oldKey, newKey] that changed (the caller emits the feedback events).
export function updateDynamic(state, p) {
  let changed = null;
  for (const id of p.cards) {
    const card = CARDS_BY_ID[id];
    if (!card || !card.dynamic) continue;
    const k = card.dynamic.key(p, state), old = p.dyn[id] || 0;
    if (k !== old) { p.dyn[id] = k; (changed = changed || []).push([id, old, k]); }
  }
  if (changed) refreshStats(p);
  return changed;
}

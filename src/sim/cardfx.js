// Card machinery: (1) stats = base config + the player's cards (+ timed modifiers), clamped by the
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
export function computeStats(cardIds, timed = []) {
  const stats = { ...CONFIG.base };
  const add = {}, mulSum = {};
  const apply = (mods) => {
    for (const [key, m] of Object.entries(mods || {})) {
      if (m.add) add[key] = (add[key] || 0) + m.add;
      if (m.mul !== undefined) mulSum[key] = (mulSum[key] || 0) + (m.mul - 1);
    }
  };
  for (const id of cardIds) { const card = CARDS_BY_ID[id]; if (card) apply(card.mods); }
  for (const t of timed) apply(t.mods);
  for (const key of Object.keys(stats)) {
    let v = (stats[key] + (add[key] || 0)) * (1 + (mulSum[key] || 0));
    const lim = CONFIG.statLimits[key];
    if (lim) v = Math.max(lim[0], Math.min(lim[1], v));
    stats[key] = v;
  }
  stats.magazine = Math.round(stats.magazine);
  stats.bulletsPerShot = Math.round(stats.bulletsPerShot);

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

// Call a hook on every card the player owns. `api` is the set of simulation operations the
// hook may use (spawnBullet, explode, heal, ...), supplied by combat.js.
export function runHook(state, hookName, ownerIndex, extra, api) {
  const owner = state.players[ownerIndex];
  if (!owner || !owner.cards.length) return;
  const counts = countCards(owner.cards);
  for (const id of Object.keys(counts)) {
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
      applyImpulse: (player, vx, vy) => api.applyImpulse(state, player.index, vx, vy),
      reflect: (bullet, opts) => api.reflect(state, ownerIndex, bullet, opts),
      addTimed: (mods, duration) => api.addTimed(state, ownerIndex, id, mods, duration),
    };
    hook(ctx);
  }
}

// Recompute a player's derived stats after a timed modifier started or ended.
export function refreshStats(p) {
  p.stats = computeStats(p.cards, p.timed);
  p.hp = Math.min(p.hp, p.stats.maxHp);
  p.ammo = Math.min(p.ammo, p.stats.magazine);
}

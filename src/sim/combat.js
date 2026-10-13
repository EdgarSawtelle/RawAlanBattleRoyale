// Everything that hurts or spawns things: bullets, damage, death, explosions, blocks.
// Used by player.js / bullet.js / world.js and (through the ctx object) by card hooks.
// The global balance caps (per-hit damage, per-trigger-pull damage, live bullets, impulse, healing)
// are all enforced HERE, in one place, with numbers from config.js (CONFIG.caps).
import { CONFIG } from '../config.js';
import { runHook, refreshStats } from './cardfx.js';
import { distPointToBody, distPointToRect } from './collision.js';

// Events are plain objects collected during one step; the renderer turns them into effects.
export function emit(state, type, data) { state.events.push({ type, tick: state.tick, ...data }); }

// The operations card hooks are allowed to use (handed to runHook).
const API = {
  spawnBullet: (state, ownerIndex, opts) => spawnBullet(state, ownerIndex, opts),
  explode: (state, x, y, r, dmg, ownerIndex, opts) => explode(state, x, y, r, dmg, ownerIndex, opts),
  heal: (state, idx, n) => heal(state, idx, n),
  applyImpulse: (state, idx, vx, vy) => applyImpulse(state, idx, vx, vy),
  reflect: (state, idx, bullet, opts) => reflectBullet(state, idx, bullet, opts),
  addTimed: (state, idx, src, mods, duration) => addTimed(state, idx, src, mods, duration),
};
export function fireHook(state, hookName, ownerIndex, extra) {
  runHook(state, hookName, ownerIndex, extra || {}, API);
}

// Create a bullet. opts: { x, y, angle, speed, damage, radius, gravity, bounces, style, lifetime,
//   generation, shotId, explosive, age, immune } (anything omitted comes from the owner's stats).
// Returns null when the owner already has the maximum number of live bullets.
export function spawnBullet(state, ownerIndex, opts) {
  const p = state.players[ownerIndex], st = p.stats;
  let live = 0; for (const o of state.bullets) if (o.owner === ownerIndex) live++;
  if (live >= CONFIG.caps.liveBullets) return null;
  const speed = opts.speed ?? st.bulletSpeed;
  const damage = opts.damage ?? st.damage;
  const b = {
    id: state.nextId++,
    owner: ownerIndex,
    x: opts.x, y: opts.y,
    vx: Math.cos(opts.angle) * speed, vy: Math.sin(opts.angle) * speed,
    r: opts.radius ?? st.bulletRadius,
    damage,
    launchDamage: damage,                  // damage at launch (growth cards add a fraction of this per bounce)
    gravity: opts.gravity ?? st.bulletGravity,
    knockback: opts.knockback ?? st.knockback,
    lifetime: opts.lifetime ?? st.bulletLifetime,
    bouncesLeft: opts.bounces ?? st.bounces,
    bounces: 0,
    generation: opts.generation || 0,      // 0 = fired by the gun, 1 = spawned by a card (cannot split / spawn more)
    shotId: opts.shotId ?? 0,              // all bullets of one trigger pull share this (per-shot damage cap)
    explosive: !!opts.explosive,
    reflected: false,
    age: opts.age ?? 0,
    immune: opts.immune ?? CONFIG.combat.ownerImmunity,   // seconds during which it cannot hit its owner
    style: opts.style || 'amber',          // cosmetic: 'amber' | 'pale' | 'ember'
  };
  state.bullets.push(b);
  return b;
}

// Healing, capped per round.
export function heal(state, idx, n) {
  const p = state.players[idx];
  if (!p.alive) return;
  const room = CONFIG.caps.healPerRound - p.healed;
  n = Math.min(n, room, p.stats.maxHp - p.hp);
  if (n <= 0) return;
  p.healed += n; p.hp += n;
  emit(state, 'heal', { player: idx, amount: n, x: p.x, y: p.y });
}

export function applyImpulse(state, idx, vx, vy) {
  const p = state.players[idx];
  p.vx += vx; p.vy += vy; p.carry = CONFIG.move.carryTime;
}

// Temporary stat modifiers. The same source refreshes (replaces) its entry instead of stacking.
export function addTimed(state, idx, src, mods, duration) {
  const p = state.players[idx];
  const e = p.timed.find((t) => t.src === src);
  if (e) { e.mods = mods; e.left = duration; } else p.timed.push({ src, mods, left: duration });
  refreshStats(p);
  emit(state, 'buff', { player: idx, src, x: p.x, y: p.y });
}

// Return Policy: a blocked bullet changes owner and flies back at the player who fired it.
// Returns true if the bullet was reflected (the bullet step then keeps it alive).
export function reflectBullet(state, blockerIdx, b, opts = {}) {
  const blocker = state.players[blockerIdx], shooter = state.players[b.owner];
  if (!b || b.owner === blockerIdx || b.reflected || b.explosive || !shooter) return false;
  if (blocker.reflectCount >= CONFIG.caps.reflectPerBlock) return false;
  blocker.reflectCount += 1;
  const speed = Math.hypot(b.vx, b.vy) * (opts.speedMul ?? 1.5);
  const angle = Math.atan2(shooter.y - b.y, shooter.x - b.x);
  b.vx = Math.cos(angle) * speed; b.vy = Math.sin(angle) * speed;
  b.damage *= opts.damageMul ?? 1.5; b.launchDamage = b.damage;
  b.owner = blockerIdx;
  b.reflected = true;                       // it cannot be reflected again (no ping-pong)
  b.immune = CONFIG.combat.ownerImmunity;   // fresh immunity for the new owner
  b.age = 0; b.bouncesLeft = 0;
  b.keep = true;                            // tells the bullet step not to destroy it
  emit(state, 'reflect', { player: blockerIdx, x: b.x, y: b.y, angle });
  return true;
}

function capImpulse(vx, vy) {
  const m = Math.hypot(vx, vy), cap = CONFIG.caps.impulse;
  return m > cap ? [vx / m * cap, vy / m * cap] : [vx, vy];
}

// Deal damage to a player. src = index of the attacker (own index = self damage, -1 = environment).
// `bullet` (optional) gives the direction of the knockback. opts: { kind: 'bullet'|'explosion'|'env', shotId, impulse }
export function damagePlayer(state, idx, amount, src, bullet, hitPos, opts = {}) {
  const p = state.players[idx];
  if (!p.alive || !(amount > 0)) return;
  const C = CONFIG.caps;
  if (src >= 0) {                                        // damage from a player's attack: apply the caps
    amount = Math.min(amount, C.hitDamage);              // per-hit cap
    const shotId = opts.shotId ?? (bullet ? bullet.shotId : 0);
    if (shotId) {                                        // per-trigger-pull cap on one target
      const taken = p.shotTaken[shotId] || 0;
      amount = Math.min(amount, C.shotDamage - taken);
      if (amount <= 0) return;
      p.shotTaken[shotId] = taken + amount;
    }
  }
  const invuln = state.cheats.invulnerable[idx];
  if (!invuln) p.hp -= amount;
  emit(state, 'hit', {
    player: idx, source: src, amount, x: hitPos ? hitPos.x : p.x, y: hitPos ? hitPos.y : p.y,
    angle: bullet ? Math.atan2(bullet.vy, bullet.vx) : -Math.PI / 2,
  });
  if (bullet) {
    const sp = Math.hypot(bullet.vx, bullet.vy) || 1;
    const k = bullet.knockback * (amount / CONFIG.base.damage) * p.stats.knockbackTaken;
    const [ix, iy] = capImpulse((bullet.vx / sp) * k, (bullet.vy / sp) * k * 0.6);
    p.vx += ix; p.vy += iy; p.carry = CONFIG.move.carryTime;
  }
  fireHook(state, 'onDamaged', idx, { amount, source: opts.kind || (src < 0 ? 'env' : 'bullet'), targetIndex: src, target: src >= 0 ? state.players[src] : null, bullet });
  if (p.hp <= 0 && !invuln) killPlayer(state, idx, src);
  else if (p.hp <= 0) p.hp = 1;
}

export function killPlayer(state, idx, src, reason) {
  const p = state.players[idx];
  if (!p.alive) return;
  p.alive = false; p.hp = 0; p.blockLeft = 0;
  emit(state, 'death', { player: idx, source: src, x: p.x, y: p.y, reason: reason || (src === -1 ? 'environment' : 'shot') });
  if (src >= 0 && src !== idx) fireHook(state, 'onKill', src, { target: p, targetIndex: idx });
}

export function damageBlock(state, block, amount, x, y) {
  if (!block.alive || !(amount > 0)) return;
  block.hp -= amount;
  if (block.hp <= 0) {
    block.alive = false;
    emit(state, 'blockBreak', { id: block.id, kind: block.kind, x: block.x + block.w / 2, y: block.y + block.h / 2, w: block.w, h: block.h });
    if (block.kind === 'barrel') {   // explosive drum: environment explosion (can hurt anyone, chains into other barrels)
      const B = CONFIG.hazards.barrel;
      explode(state, block.x + block.w / 2, block.y + block.h / 2, B.explosionRadius, B.explosionDamage, -1);
    }
  } else {
    emit(state, 'blockHit', { id: block.id, x, y, hp: block.hp, maxHp: block.maxHp });
  }
}

// Area damage. Hurts EVERYONE in range, including the owner (self-damage is on), and every
// destructible block. 100% damage within explosionFullRadius of the body, falling linearly to
// explosionEdgeFalloff at the radius. Shove: explosionKnockback * (damage / 20) * falloff * knockbackTaken (capped).
export function explode(state, x, y, radius, damage, ownerIndex, opts = {}) {
  const C = CONFIG.combat;
  emit(state, 'explosion', { x, y, r: radius, owner: ownerIndex });
  const falloff = (d) => d <= C.explosionFullRadius ? 1 : 1 - (1 - C.explosionEdgeFalloff) * ((d - C.explosionFullRadius) / Math.max(1, radius - C.explosionFullRadius));
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (!p.alive) continue;
    const d = distPointToBody(x, y, p);
    if (d > radius) continue;
    const f = falloff(d);
    damagePlayer(state, i, damage * f, ownerIndex, null, { x: p.x, y: p.y }, { kind: 'explosion', shotId: opts.shotId });
    if (p.alive) {
      const dx = p.x - x, dy = p.y - y, len = Math.hypot(dx, dy) || 1;
      const k = C.explosionKnockback * (damage / CONFIG.base.damage) * f * p.stats.knockbackTaken;
      const [ix, iy] = capImpulse((dx / len) * k, (dy / len) * k - 80 * f);
      p.vx += ix; p.vy += iy; p.carry = CONFIG.move.carryTime;
    }
  }
  for (const b of state.blocks) {
    if (!b.alive) continue;
    const d = distPointToRect(x, y, b);
    if (d > radius) continue;
    damageBlock(state, b, damage * C.explosionBlockMul * falloff(d), x, y);
  }
}
